"""Dual-detection engine.

Stage 1 - is this reading anomalous?
    hard QC rules (range, step, persistence, rain-without-humidity)
    + robust z-scores against neighbours / own history / climatology
    + Isolation Forest over all 15 z-features together

Stage 2 - sensor fault or real weather?
    A broken sensor misbehaves ALONE: one parameter, one station.
    Real weather is COHERENT: several parameters move together in a physically
    consistent way (pressure falls, wind gusts, rain, temperature drops), and
    neighbouring stations see the same thing within a couple of hours.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from . import config as C
from . import preprocess as P
from .features import FEATURE_NAMES, FeatureModel, matrix

COHERENCE_WINDOW = 2 * C.STEPS_PER_HOUR   # look back 2 h for neighbour agreement
SIGNATURE_Z = 3.0
ERRATIC_Z = 3.0


class Detector:
    def __init__(self, calib_days: float = 2.0, seed: int = 7):
        self.calib_days = calib_days
        self.seed = seed
        self.features = FeatureModel()
        self.iforest: IsolationForest | None = None
        self.if_threshold = 0.0
        self.if_scale = 1.0

    # ------------------------------------------------------------------ fit
    def fit(self, df: pd.DataFrame) -> "Detector":
        wide = P.to_wide(df)
        t0 = wide[C.PARAMS[0]].index[0]
        cut = t0 + pd.Timedelta(days=self.calib_days)
        calib = {p: w[w.index < cut] for p, w in wide.items()}
        calib = P.clean_for_features(calib, P.range_violations(calib))
        self.features.fit(calib)

        z = self.features.transform(calib)
        # Skip the first day: climatology features are still warming up.
        idx = calib[C.PARAMS[0]].index
        idx = idx[idx >= t0 + pd.Timedelta(days=1)]
        X = matrix(z, idx, list(calib[C.PARAMS[0]].columns))
        self.iforest = IsolationForest(n_estimators=300, contamination="auto",
                                       random_state=self.seed).fit(X)
        s = -self.iforest.score_samples(X)
        # Threshold well outside anything seen during clean calibration.
        self.if_threshold = float(np.quantile(s, 0.999) + 0.02)
        self.if_scale = float(np.quantile(s, 0.999) - np.median(s)) or 0.05
        return self

    # --------------------------------------------------------------- detect
    def detect(self, df: pd.DataFrame) -> pd.DataFrame:
        raw = P.to_wide(df)
        index = raw[C.PARAMS[0]].index
        stations = list(raw[C.PARAMS[0]].columns)
        T, S = len(index), len(stations)

        ranges = P.range_violations(raw)
        steps = P.step_violations(raw)
        stuck = P.persistence_violations(raw)
        missing = P.missing_mask(raw).values
        wide = P.clean_for_features(raw, ranges)
        z = self.features.transform(wide)

        X = matrix(z, index, stations)
        if_score = (-self.iforest.score_samples(X)).reshape(T, S)
        if_hit = if_score > self.if_threshold

        def arr(frames, p):
            return frames[p].reindex(index=index, columns=stations).values

        zs = {k: {p: np.nan_to_num(arr(z[k], p)) for p in C.PARAMS}
              for k in ("spatial", "temporal", "climate")}
        val = {p: arr(raw, p) for p in C.PARAMS}

        # --- stage 1: rule hits, per parameter ---------------------------
        rule = {}
        for p in C.PARAMS:
            rule[p] = {
                "range": arr(ranges, p),
                "stuck": arr(stuck, p),
                "step": arr(steps, p),
            }
        rain_dry = (np.nan_to_num(val["rainfall"]) > 3.0) & (np.nan_to_num(val["humidity"], nan=100) < 60)

        # Per-parameter statistical strength (1.0 == at threshold).
        strength = np.stack([
            np.maximum.reduce([
                np.abs(zs["spatial"][p]) / C.SPATIAL_Z,
                np.abs(zs["temporal"][p]) / C.TEMPORAL_Z,
                np.abs(zs["climate"][p]) / C.CLIMATE_Z,
            ]) for p in C.PARAMS
        ])                                                   # (params, T, S)
        stat_hit = strength >= 1.0

        # Erratic: the reading keeps jumping around its own last hour (a dying
        # anemometer bearing) - RMS of the temporal z over the last hour.
        erratic = {p: pd.DataFrame(zs["temporal"][p] ** 2).rolling(C.STEPS_PER_HOUR, min_periods=3)
                   .mean().pow(0.5).values > ERRATIC_Z for p in C.PARAMS}

        # --- stage 2 evidence: physical signature ------------------------
        def worst(p):
            # the strongest of temporal / climate deviation, keeping its sign
            t, c = zs["temporal"][p], zs["climate"][p]
            return np.where(np.abs(t) > np.abs(c), t, c)

        storm_parts = np.stack([
            (worst("pressure") < -SIGNATURE_Z) | (zs["spatial"]["pressure"] < -SIGNATURE_Z),
            (worst("wind_speed") > SIGNATURE_Z),
            (np.nan_to_num(val["rainfall"]) >= 1.0),
            (worst("temperature") < -SIGNATURE_Z),
            (worst("humidity") > SIGNATURE_Z),
        ])
        storm_sig = storm_parts.sum(axis=0) >= 3
        heat_sig = (zs["climate"]["temperature"] > SIGNATURE_Z) & (zs["climate"]["humidity"] < -1.5)

        # --- stage 2 evidence: spatial coherence per parameter -----------
        nb_idx = [[stations.index(n) for n in self.features.neighbours[s] if n in stations]
                  for s in stations]
        coherence = np.zeros((len(C.PARAMS), T, S))
        for k, p in enumerate(C.PARAMS):
            dev = worst(p)
            # Strongest move each neighbour made in the last 2 h, each direction.
            hi = pd.DataFrame(dev).rolling(COHERENCE_WINDOW, min_periods=1).max().values
            lo = pd.DataFrame(dev).rolling(COHERENCE_WINDOW, min_periods=1).min().values
            for j, nbs in enumerate(nb_idx):
                # A neighbour agrees only if it moved the same way by a comparable
                # amount: ordinary gustiness next door does not excuse a z=12 spike.
                need = np.maximum(SIGNATURE_Z, 0.4 * np.abs(dev[:, j]))[:, None]
                same_up = (hi[:, nbs] >= need).mean(axis=1)
                same_dn = (-lo[:, nbs] >= need).mean(axis=1)
                coherence[k, :, j] = np.where(dev[:, j] >= 0, same_up, same_dn)

        # --- assemble per station-timestep verdicts ----------------------
        cls = np.full((T, S), C.NORMAL, dtype=object)
        param = np.full((T, S), "", dtype=object)
        reason = np.full((T, S), "", dtype=object)

        any_stat = stat_hit.any(axis=0)
        lead = strength.argmax(axis=0)
        # Statistical evidence alone must persist: 2 of the last 3 readings.
        # Hard-rule hits (range, jump, frozen, erratic) fire immediately.
        soft = pd.DataFrame(any_stat | if_hit).rolling(3, min_periods=1).sum().values >= 2
        anomalous = (soft & (any_stat | if_hit)) | rain_dry
        for p in C.PARAMS:
            anomalous |= rule[p]["range"] | rule[p]["stuck"] | rule[p]["step"]
            rule[p]["erratic"] = erratic[p]
            anomalous |= erratic[p]

        for t, j in zip(*np.nonzero(anomalous | missing)):
            if missing[t, j]:
                cls[t, j], param[t, j], reason[t, j] = C.MISSING, "*", "No data received (power/comms)"
                continue
            verdict = self._classify(t, j, rule, rain_dry, storm_sig, heat_sig,
                                     storm_parts, coherence, strength, lead, zs, val)
            cls[t, j], param[t, j], reason[t, j] = verdict

        out = pd.DataFrame({
            "timestamp": np.repeat(index.values, S),
            "station": np.tile(stations, T),
            "pred": cls.reshape(-1),
            "pred_param": param.reshape(-1),
            "reason": reason.reshape(-1),
            "iforest": np.round(((if_score - self.if_threshold) / self.if_scale).reshape(-1), 3),
        })
        for p in C.PARAMS:
            out[f"z_{p}"] = np.round(zs["spatial"][p].reshape(-1), 2)
        return out

    # -------------------------------------------------------------- helpers
    def _classify(self, t, j, rule, rain_dry, storm_sig, heat_sig, storm_parts,
                  coherence, strength, lead, zs, val):
        # 1. Physically impossible or frozen output: always the sensor.
        for p in C.PARAMS:
            if rule[p]["range"][t, j]:
                return C.SENSOR_FAULT, p, (
                    f"{C.NAMES[p]} = {val[p][t, j]:g} {C.UNITS[p]} is outside the physical range "
                    f"{C.RANGE_LIMITS[p]}")
            if rule[p]["stuck"][t, j]:
                return C.SENSOR_FAULT, p, (
                    f"{C.NAMES[p]} frozen at {val[p][t, j]:g} {C.UNITS[p]} for "
                    f"{C.PERSISTENCE_STEPS * C.STEP_MINUTES // 60} h")

        # 2. Several sensors agree on a storm / heatwave pattern: real weather.
        if storm_sig[t, j]:
            names = [n for n, hit in zip(["pressure fall", "wind gust", "rain",
                                          "temperature drop", "humidity rise"],
                                         storm_parts[:, t, j]) if hit]
            return C.WEATHER_EVENT, "*", "Storm signature: " + ", ".join(names)
        if heat_sig[t, j] and coherence[C.PARAMS.index("temperature"), t, j] >= C.COHERENCE_MIN:
            # A heatwave warms every station alike, so it never separates one
            # station from its neighbours. If a sensor does, it is broken
            # underneath the heatwave.
            k = int(np.argmax([abs(zs["spatial"][p][t, j]) for p in C.PARAMS]))
            p = C.PARAMS[k]
            if abs(zs["spatial"][p][t, j]) >= C.SPATIAL_Z:
                return C.SENSOR_FAULT, p, (
                    f"{C.NAMES[p]} deviates {zs['spatial'][p][t, j]:+.1f}σ from neighbours during a "
                    "heatwave that affects them all equally")
            return C.WEATHER_EVENT, "*", (
                f"Heat anomaly {zs['climate']['temperature'][t, j]:+.1f}σ vs previous days, "
                "humidity down, neighbours agree")

        # 3. Implausible jumps and dry-sky rain: sensor.
        if rain_dry[t, j]:
            return C.SENSOR_FAULT, "rainfall", (
                f"{val['rainfall'][t, j]:g} mm rain with humidity only "
                f"{val['humidity'][t, j]:.0f}%: rain gauge false tip")
        for p in C.PARAMS:
            if rule[p]["step"][t, j]:
                return C.SENSOR_FAULT, p, f"{C.NAMES[p]} jumped more than {C.STEP_LIMITS[p]} {C.UNITS[p]} in one reading"
        for p in C.PARAMS:
            if rule[p]["erratic"][t, j] and coherence[C.PARAMS.index(p), t, j] < C.COHERENCE_MIN:
                return C.SENSOR_FAULT, p, f"{C.NAMES[p]} readings erratic over the last hour; neighbours steady"

        # 4. Statistical anomaly: does the neighbourhood agree?
        k = lead[t, j]
        p = C.PARAMS[k]
        coh = coherence[k, t, j]
        if coh >= C.COHERENCE_MIN:
            return C.WEATHER_EVENT, "*", (
                f"{C.NAMES[p]} anomaly shared by {coh:.0%} of neighbouring stations")
        zsp = zs["spatial"][p][t, j]
        return C.SENSOR_FAULT, p, (
            f"{C.NAMES[p]} deviates {zsp:+.1f}σ from neighbours; no neighbour agrees")
