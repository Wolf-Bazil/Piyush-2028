"""Reshape raw readings and run the gross-error checks that need no model."""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C


def to_wide(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Long rows (timestamp, station, params...) -> {param: time x station}."""
    order = [s["id"] for s in C.STATIONS if s["id"] in set(df["station"])]
    wide = {}
    for p in C.PARAMS:
        w = df.pivot_table(index="timestamp", columns="station", values=p,
                           aggfunc="last", dropna=False)
        wide[p] = w.reindex(columns=order).sort_index().astype(float)
    return wide


def range_violations(wide: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    out = {}
    for p, w in wide.items():
        lo, hi = C.RANGE_LIMITS[p]
        out[p] = (w < lo) | (w > hi)
    return out


def step_violations(wide: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    out = {}
    for p, w in wide.items():
        # Compare against the median of the previous three readings, not just
        # the last one: after a spike the next (good) reading would otherwise
        # look like a jump too.
        ref = w.shift(1).rolling(3, min_periods=1).median()
        out[p] = (w - ref).abs() > C.STEP_LIMITS[p]
    return out


def persistence_violations(wide: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    out = {}
    for p, w in wide.items():
        if p not in C.PERSISTENCE_PARAMS:
            out[p] = pd.DataFrame(False, index=w.index, columns=w.columns)
            continue
        # max - min, not std: pandas' rolling std leaves ~1e-6 of float noise
        # on a perfectly flat series, which hides exactly the fault we want.
        roll = w.rolling(C.PERSISTENCE_STEPS, min_periods=C.PERSISTENCE_STEPS)
        out[p] = (roll.max() - roll.min()) < 1e-9
    return out


def missing_mask(wide: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """True where a station sent nothing at all for a timestep."""
    stacked = np.stack([w.isna().values for w in wide.values()])
    return pd.DataFrame(stacked.all(axis=0), index=wide[C.PARAMS[0]].index,
                        columns=wide[C.PARAMS[0]].columns)


def clean_for_features(wide, ranges):
    """Blank out impossible values so they cannot poison neighbours' baselines."""
    return {p: w.mask(ranges[p]) for p, w in wide.items()}
