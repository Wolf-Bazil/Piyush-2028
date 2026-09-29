"""Predictive maintenance: how far has each sensor drifted, and when will it
cross its calibration tolerance?

Bias is the station's median disagreement with its neighbours over the last
day (after removing its normal offset). A healthy sensor's bias wanders around
zero; a degrading one walks steadily away. Fitting a line to the last two days
of bias gives a rate, and the rate gives an ETA to the tolerance limit, so the
technician visit can be booked before the data goes bad.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C

BIAS_WINDOW = C.STEPS_PER_DAY
TREND_WINDOW = 3 * C.STEPS_PER_DAY
MIN_R2 = 0.8          # a real drift is a steady walk, not a wander


def bias_series(spatial_raw: dict[str, pd.DataFrame], exclude: pd.DataFrame | None = None):
    """Rolling one-day median of each sensor's residual against its neighbours.

    `exclude` (time x station, bool) masks timesteps already explained as
    weather, so a storm passing one station does not count as drift.
    """
    out = {}
    for p, r in spatial_raw.items():
        r = r.copy()
        if exclude is not None:
            r = r.mask(exclude.reindex(index=r.index, columns=r.columns).fillna(False))
        out[p] = r.rolling(BIAS_WINDOW, min_periods=C.STEPS_PER_HOUR * 6).median()
    return out


def assess(bias: dict[str, pd.DataFrame], at: int | None = None) -> list[dict]:
    """Health of every sensor at row `at` (default: the latest)."""
    rows = []
    any_frame = next(iter(bias.values()))
    at = len(any_frame) - 1 if at is None else at
    for p, b in bias.items():
        tol = C.DRIFT_TOLERANCE[p]
        for sid in b.columns:
            window = b[sid].iloc[max(0, at - TREND_WINDOW + 1):at + 1].dropna()
            now = float(b[sid].iloc[at]) if not np.isnan(b[sid].iloc[at]) else 0.0
            slope_day, r2 = 0.0, 0.0
            if len(window) > C.STEPS_PER_HOUR * 6:
                x = np.arange(len(window)) / C.STEPS_PER_DAY
                coef = np.polyfit(x, window.values, 1)
                slope_day = float(coef[0])
                resid = window.values - np.polyval(coef, x)
                var = float(np.var(window.values))
                r2 = 1 - float(np.var(resid)) / var if var > 0 else 0.0
            health = float(np.clip(100 * (1 - abs(now) / tol), 0, 100))
            # Only project an ETA for a steady walk away from zero that has
            # already covered a meaningful share of the tolerance.
            growing = slope_day * now > 0 and r2 >= MIN_R2 and abs(now) >= 0.25 * tol
            eta_h = None
            if abs(now) >= tol:
                eta_h = 0.0
            elif growing and abs(slope_day) > 0.05 * tol:
                eta_h = (tol - abs(now)) / abs(slope_day) * 24
            if abs(now) >= tol:
                status = "service now"
            elif eta_h is not None and eta_h < 7 * 24:
                status = "schedule visit"
            elif abs(now) >= 0.5 * tol:
                status = "watch"
            else:
                status = "ok"
            rows.append({
                "station": sid, "param": p, "bias": round(now, 3),
                "tolerance": tol, "health": round(health, 1),
                "drift_per_day": round(slope_day, 3),
                "trend_r2": round(r2, 2),
                "eta_hours": None if eta_h is None else round(eta_h, 1),
                "status": status,
            })
    return rows
