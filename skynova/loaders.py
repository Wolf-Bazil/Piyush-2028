"""Bring real AWS data into SkyNova's long format:

    timestamp, station, temperature, humidity, pressure, wind_speed, rainfall

Real archives carry no fault labels, so on real data the engine runs and the
dashboard works, but the evaluation panel has nothing to score against.
Thresholds are tuned for 10-minute AWS reports; hourly data is resampled.
"""

from __future__ import annotations

import pandas as pd

from . import config as C

# IMD / MOSDAC AWS exports use varying headers; map the common ones.
AWS_COLUMNS = {
    "temperature": ["temperature", "temp", "air_temp", "t", "ta"],
    "humidity": ["humidity", "rh", "rel_hum", "relative_humidity"],
    "pressure": ["pressure", "slp", "stn_pres", "station_pressure", "pres"],
    "wind_speed": ["wind_speed", "ws", "wspd", "wind"],
    "rainfall": ["rainfall", "rain", "rf", "prcp", "precip"],
}


def _pick(df: pd.DataFrame, names: list[str]) -> str | None:
    low = {c.lower().strip(): c for c in df.columns}
    for n in names:
        if n in low:
            return low[n]
    return None


def load_aws_csv(path: str, station: str | None = None, time_col: str = "timestamp") -> pd.DataFrame:
    """Generic AWS CSV (one or many stations). Wind must already be in m/s."""
    df = pd.read_csv(path)
    tcol = _pick(df, [time_col, "time", "datetime", "date_time", "obs_time"])
    out = pd.DataFrame({"timestamp": pd.to_datetime(df[tcol])})
    scol = _pick(df, ["station", "station_id", "stn", "id"])
    out["station"] = df[scol].astype(str) if scol else station
    for p, names in AWS_COLUMNS.items():
        c = _pick(df, names)
        out[p] = pd.to_numeric(df[c], errors="coerce") if c else float("nan")
    return _to_step(out)


def load_meteostat_csv(path: str, station: str) -> pd.DataFrame:
    """Meteostat hourly export: wspd is km/h, prcp is mm/hour, pres is sea level."""
    df = pd.read_csv(path, parse_dates=["time"])
    out = pd.DataFrame({
        "timestamp": df["time"],
        "station": station,
        "temperature": df["temp"],
        "humidity": df["rhum"],
        "pressure": df["pres"],
        "wind_speed": df["wspd"] / 3.6,
        "rainfall": df["prcp"],
    })
    return _to_step(out)


def _to_step(df: pd.DataFrame) -> pd.DataFrame:
    """Resample every station onto the 10-minute grid the engine expects."""
    parts = []
    freq = f"{C.STEP_MINUTES}min"
    for sid, g in df.groupby("station"):
        g = g.set_index("timestamp").sort_index()
        g = g[~g.index.duplicated()]
        step = g.index.to_series().diff().median()
        if step and step > pd.Timedelta(freq):
            factor = step / pd.Timedelta(freq)
            # Spread each coarse rain total evenly over its 10-minute steps.
            rain = g["rainfall"] / factor
            g = g.drop(columns=["rainfall", "station"]).resample(freq).interpolate(limit=int(factor))
            g["rainfall"] = rain.resample(freq).ffill(limit=int(factor) - 1)
        else:
            g = g.drop(columns=["station"]).resample(freq).mean()
        g["station"] = sid
        parts.append(g.reset_index())
    return pd.concat(parts, ignore_index=True)[["timestamp", "station", *C.PARAMS]]
