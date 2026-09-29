"""End-to-end batch run: simulate -> detect -> evaluate -> maintenance."""

from __future__ import annotations

import time

import pandas as pd

from . import config as C
from . import evaluate as E
from . import maintenance as M
from . import preprocess as P
from .detector import Detector
from .simulator import simulate


def run(df: pd.DataFrame | None = None, meta: dict | None = None, calib_days: float = 2.0,
        detector: Detector | None = None):
    """Detect over `df` (long rows). Pass a fitted `detector` to skip calibration."""
    if df is None:
        df, meta = simulate()
    det = detector or Detector(calib_days=calib_days).fit(df)
    t0 = time.perf_counter()
    pred = det.detect(df)
    detect_seconds = time.perf_counter() - t0

    wide = P.clean_for_features(P.to_wide(df), P.range_violations(P.to_wide(df)))
    z = det.features.transform(wide)
    weather = (pred.assign(w=pred["pred"] == C.WEATHER_EVENT)
               .pivot(index="timestamp", columns="station", values="w"))
    bias = M.bias_series(z["spatial_raw"], exclude=weather)

    result = {"df": df, "meta": meta or {}, "detector": det, "pred": pred, "bias": bias,
              "ms_per_station_reading": 1000 * detect_seconds / len(pred)}
    if "label" in df.columns and meta:
        joined = E.join(df, pred)
        result["metrics"] = E.metrics(joined)
        result["incidents"] = E.per_incident(joined, meta) if meta else []
    result["maintenance"] = M.assess(bias)
    return result
