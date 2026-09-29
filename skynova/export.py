"""Run the pipeline and write the JSON the web dashboard replays.

    python -m skynova.export            # -> web/public/data/network.json
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import config as C
from . import maintenance as M
from .pipeline import run

CODES = {C.NORMAL: 0, C.SENSOR_FAULT: 1, C.WEATHER_EVENT: 2, C.MISSING: 3}
OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "network.json"
SNAPSHOT_EVERY = 3 * C.STEPS_PER_HOUR


def _num(x, nd=2):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return round(float(x), nd)


def incidents_from(pred: pd.DataFrame, times: pd.DatetimeIndex) -> list[dict]:
    """Collapse per-step verdicts into incidents (runs of the same verdict).

    A gap of up to 30 minutes inside a run is bridged, so a fault that
    flickers does not become ten alerts.
    """
    pos = {t: i for i, t in enumerate(times)}
    out = []
    flagged = pred[pred["pred"] != C.NORMAL].copy()
    flagged["i"] = flagged["timestamp"].map(pos)
    for (sid, cls), g in flagged.groupby(["station", "pred"]):
        g = g.sort_values("i")
        run_start, prev, rows = None, None, []
        for r in g.itertuples():
            if prev is not None and r.i - prev > 3:
                out.append(_incident(sid, cls, rows))
                rows = []
            rows.append(r)
            prev = r.i
        if rows:
            out.append(_incident(sid, cls, rows))
    out.sort(key=lambda x: x["start"])
    for k, inc in enumerate(out):
        inc["id"] = k
    return out


def _incident(sid, cls, rows):
    params = [r.pred_param for r in rows if r.pred_param and r.pred_param != "*"]
    param = max(set(params), key=params.count) if params else "*"
    # The most informative reason is the one from the strongest reading.
    best = max(rows, key=lambda r: abs(r.iforest))
    return {
        "station": sid, "cls": CODES[cls], "param": param,
        "start": int(rows[0].i), "end": int(rows[-1].i), "steps": len(rows),
        "reason": rows[0].reason if cls == C.MISSING else best.reason,
    }


def build() -> dict:
    return payload(run())


def payload(res: dict) -> dict:
    """Shape a pipeline result into the dashboard's JSON (also served live by server/api.py)."""
    df, pred, meta, bias = res["df"], res["pred"], res["meta"], res["bias"]
    times = pd.DatetimeIndex(sorted(df["timestamp"].unique()))
    stations = [s["id"] for s in C.STATIONS]
    labelled = "label" in df.columns

    series, verdict, truth, vparam = {}, {}, {}, {}
    for sid in stations:
        d = df[df["station"] == sid].set_index("timestamp").reindex(times)
        series[sid] = {p: [_num(v) for v in d[p].values] for p in C.PARAMS}
        if labelled:
            truth[sid] = [CODES.get(v, 0) for v in d["label"].fillna(C.NORMAL).values]
        pv = pred[pred["station"] == sid].set_index("timestamp").reindex(times)
        verdict[sid] = [CODES[v] for v in pv["pred"].fillna(C.MISSING).values]
        # Which sensor the verdict points at: index into PARAMS, 5 = whole
        # station (weather / no data), -1 = nothing flagged.
        vparam[sid] = [C.PARAMS.index(p) if p in C.PARAMS else (5 if p == "*" else -1)
                       for p in pv["pred_param"].fillna("").values]

    snapshots = []
    for at in range(SNAPSHOT_EVERY - 1, len(times), SNAPSHOT_EVERY):
        snapshots.append({"at": at, "rows": [
            {k: r[k] for k in ("station", "param", "bias", "health", "drift_per_day", "eta_hours", "status")}
            for r in M.assess(bias, at)
        ]})

    det = res["detector"]
    return {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "start": str(times[0]),
        "step_minutes": C.STEP_MINUTES,
        "steps": len(times),
        "stations": C.STATIONS,
        "neighbours": det.features.neighbours,
        "params": C.PARAMS,
        "units": C.UNITS,
        "tolerance": C.DRIFT_TOLERANCE,
        "series": series,
        "verdict": verdict,
        "vparam": vparam,
        "truth": truth,
        "incidents": incidents_from(pred, times),
        "maintenance": snapshots,
        "metrics": res.get("metrics"),
        "injected": res.get("incidents"),
        "scenario": {
            "faults": meta.get("faults", []),
            "storms": [{k: v for k, v in s.items()} for s in meta.get("storms", [])],
            "heatwaves": meta.get("heatwaves", []),
        },
        "model": {
            "iforest_trees": det.iforest.n_estimators,
            "features": 15,
            "calibration_days": det.calib_days,
            "ms_per_station_reading": round(res["ms_per_station_reading"], 4),
        },
    }


def main():
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":"), default=_default), encoding="utf-8")
    m = data["metrics"]["detection"]
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
    print(f"precision {m['precision']}  recall {m['recall']}  f1 {m['f1']}  "
          f"false-alarm {m['false_alarm_rate']:.2%}  "
          f"fault-vs-weather {data['metrics']['fault_vs_weather_accuracy']:.1%}")


def _default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, tuple):
        return list(o)
    return str(o)


if __name__ == "__main__":
    main()
