"""Feature engineering: how far is each reading from what we expected?

Three independent expectations are built for every reading, all causal (they
only look backwards, so the same code runs on a live stream):

* temporal - the station's own last hour (catches spikes, noise bursts)
* spatial  - the nearest neighbouring stations, corrected for each station's
             normal offset (catches offsets, drift, anything one sensor does
             alone)
* climate  - the station's normal for that time of day (catches slow,
             region-wide departures such as heatwaves that the other two miss)

Each residual is divided by a robust scale learnt from a clean calibration
period, giving a z-score that means the same thing for every sensor type.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from . import config as C

SCALE_FLOOR = {
    "temperature": 0.25,
    "humidity": 1.2,
    "pressure": 0.12,
    "wind_speed": 0.6,
    "rainfall": 0.3,
}
TEMPORAL_WINDOW = C.STEPS_PER_HOUR
K_NEIGHBOURS = 4


def haversine_km(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 6371 * 2 * math.asin(math.sqrt(h))


def neighbour_map(k: int = K_NEIGHBOURS) -> dict[str, list[str]]:
    out = {}
    for s in C.STATIONS:
        others = sorted((haversine_km(s, o), o["id"]) for o in C.STATIONS if o is not s)
        out[s["id"]] = [sid for _, sid in others[:k]]
    return out


def _mad(x: pd.DataFrame) -> pd.Series:
    med = x.median()
    return 1.4826 * (x - med).abs().median()


def temporal_residual(w: pd.DataFrame) -> pd.DataFrame:
    ref = w.shift(1).rolling(TEMPORAL_WINDOW, min_periods=2).median()
    return w - ref


# Climatology only means something for temperature and humidity: pressure
# swings with passing weather systems for days at a time, and wind and rain are
# too bursty for a time-of-day normal.
CLIMATE_PARAMS = ("temperature", "humidity")


def hour_slot(index: pd.DatetimeIndex) -> np.ndarray:
    return index.hour.values * C.STEPS_PER_HOUR + index.minute.values // C.STEP_MINUTES


def climate_residual(w: pd.DataFrame, normal: pd.DataFrame) -> pd.DataFrame:
    """Reading minus the station's normal for that time of day.

    `normal` is indexed by 10-minute slot of the day. It is fixed at fit time
    so a heatwave cannot become its own baseline; in production it would come
    from the station's multi-year IMD normals.
    """
    ref = normal.reindex(hour_slot(w.index)).set_axis(w.index)
    return w - ref


class FeatureModel:
    """Learns per-station offsets and noise scales, then turns readings into z-scores."""

    def __init__(self):
        self.neighbours = neighbour_map()
        self.offsets: dict[str, pd.Series] = {}
        self.scales: dict[str, dict[str, pd.Series]] = {}
        self.normals: dict[str, pd.DataFrame] = {}

    # --- spatial -----------------------------------------------------------
    def spatial_residual(self, w: pd.DataFrame, p: str) -> pd.DataFrame:
        adj = w - self.offsets[p]
        out = pd.DataFrame(index=w.index, columns=w.columns, dtype=float)
        for sid in w.columns:
            nb = [n for n in self.neighbours[sid] if n in w.columns]
            out[sid] = adj[sid] - adj[nb].median(axis=1, skipna=True)
        return out

    # --- fit / transform ---------------------------------------------------
    def fit(self, wide: dict[str, pd.DataFrame]) -> "FeatureModel":
        for p, w in wide.items():
            network = w.median(axis=1)
            self.offsets[p] = w.sub(network, axis=0).median()
            floor = SCALE_FLOOR[p]
            # Smooth the time-of-day normal over +-1 h so two days are enough.
            slots = w.groupby(hour_slot(w.index)).mean()
            slots = slots.reindex(range(C.STEPS_PER_DAY)).interpolate(limit_direction="both")
            wrap = pd.concat([slots.iloc[-6:], slots, slots.iloc[:6]])
            self.normals[p] = (wrap.rolling(13, center=True).mean().iloc[6:-6]
                               .set_axis(slots.index))
            self.scales[p] = {
                "temporal": _mad(temporal_residual(w)).clip(lower=floor),
                "spatial": _mad(self.spatial_residual(w, p)).clip(lower=floor),
                # Two calibration days understate day-to-day variability, so
                # the climate scale gets a generous floor.
                "climate": _mad(climate_residual(w, self.normals[p])).clip(lower=floor * 3),
            }
        return self

    def transform(self, wide: dict[str, pd.DataFrame]) -> dict[str, dict[str, pd.DataFrame]]:
        """Return {kind: {param: signed z-score frame}} plus raw spatial residuals."""
        z = {"temporal": {}, "spatial": {}, "climate": {}, "spatial_raw": {}}
        for p, w in wide.items():
            sc = self.scales[p]
            sp = self.spatial_residual(w, p)
            z["spatial_raw"][p] = sp
            z["spatial"][p] = sp / sc["spatial"]
            z["temporal"][p] = temporal_residual(w) / sc["temporal"]
            if p in CLIMATE_PARAMS:
                z["climate"][p] = climate_residual(w, self.normals[p]) / sc["climate"]
            else:
                z["climate"][p] = pd.DataFrame(0.0, index=w.index, columns=w.columns)
        return z

    def to_dict(self) -> dict:
        return {
            "neighbours": self.neighbours,
            "offsets": {p: s.round(3).to_dict() for p, s in self.offsets.items()},
            "scales": {p: {k: v.round(3).to_dict() for k, v in d.items()}
                       for p, d in self.scales.items()},
        }


def matrix(z: dict, index: pd.Index, stations: list[str]) -> np.ndarray:
    """Stack |z| features into an (n_rows, n_features) matrix for Isolation Forest.

    Row order is time-major then station, matching `long_index`.
    """
    cols = []
    for kind in ("spatial", "temporal", "climate"):
        for p in C.PARAMS:
            a = z[kind][p].reindex(index=index, columns=stations).abs().values
            cols.append(np.clip(np.nan_to_num(a, nan=0.0), 0, 30).reshape(-1))
    return np.column_stack(cols)


FEATURE_NAMES = [f"{k}_{p}" for k in ("spatial", "temporal", "climate") for p in C.PARAMS]
