"""SkyNova central server: ingests edge readings, runs the engine, feeds the dashboard.

    uvicorn server.api:app --port 8000

Endpoints
    POST /api/ingest     one reading or a list of readings from edge agents
    GET  /api/network    dashboard JSON (same shape as web/public/data/network.json)
    GET  /api/alerts     current incidents only
    GET  /api/health     liveness + row counts
    GET  /               the built dashboard (web/dist), when present
"""

from __future__ import annotations

import os
import sqlite3
import sys
import threading
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from skynova import config as C  # noqa: E402
from skynova.detector import Detector  # noqa: E402
from skynova.export import payload  # noqa: E402
from skynova.pipeline import run  # noqa: E402
from skynova.simulator import simulate  # noqa: E402

DB_PATH = Path(os.environ.get("SKYNOVA_DB", ROOT / "data" / "skynova.db"))
WINDOW_DAYS = float(os.environ.get("SKYNOVA_WINDOW_DAYS", "10"))
STATION_IDS = {s["id"] for s in C.STATIONS}


class Reading(BaseModel):
    station: str
    timestamp: str
    temperature: float | None = None
    humidity: float | None = None
    pressure: float | None = None
    wind_speed: float | None = None
    rainfall: float | None = None
    edge_flags: list[str] = Field(default_factory=list)


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            station TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            temperature REAL, humidity REAL, pressure REAL, wind_speed REAL, rainfall REAL,
            edge_flags TEXT,
            PRIMARY KEY (station, timestamp)
        )""")
    return con


def calibrate() -> Detector:
    """Fit the engine on two clean days.

    A real deployment calibrates on each station's own recent clean history;
    the prototype uses the simulator's first two days, which are fault-free.
    """
    csv = os.environ.get("SKYNOVA_CALIB_CSV")
    if csv:
        df = pd.read_csv(csv, parse_dates=["timestamp"])
    else:
        df, _ = simulate()
        df = df[df["timestamp"] < df["timestamp"].min() + pd.Timedelta(days=2)]
    return Detector(calib_days=2.0).fit(df)


app = FastAPI(title="SkyNova", version="1.0")
con = connect()
lock = threading.Lock()
detector = calibrate()
cache: dict = {"rows": -1, "payload": None}


@app.post("/api/ingest")
def ingest(body: Reading | list[Reading]):
    items = body if isinstance(body, list) else [body]
    bad = [r.station for r in items if r.station not in STATION_IDS]
    if bad:
        raise HTTPException(400, f"unknown station(s): {sorted(set(bad))}")
    with lock:
        con.executemany(
            "INSERT OR REPLACE INTO readings VALUES (?,?,?,?,?,?,?,?)",
            [(r.station, pd.Timestamp(r.timestamp).strftime("%Y-%m-%d %H:%M:%S"),
              r.temperature, r.humidity, r.pressure, r.wind_speed, r.rainfall,
              ",".join(r.edge_flags)) for r in items],
        )
        con.commit()
    return {"accepted": len(items)}


def load_window() -> pd.DataFrame:
    with lock:
        df = pd.read_sql_query("SELECT * FROM readings", con, parse_dates=["timestamp"])
    if df.empty:
        return df
    df = df[df["timestamp"] >= df["timestamp"].max() - pd.Timedelta(days=WINDOW_DAYS)]
    # The newest timestep is usually still arriving; hold it back until every
    # station has reported or the next timestep starts.
    latest = df["timestamp"].max()
    if df[df["timestamp"] == latest]["station"].nunique() < len(STATION_IDS):
        df = df[df["timestamp"] < latest]
    return df.drop(columns=["edge_flags"])


def network() -> dict:
    df = load_window()
    if df.empty or df["timestamp"].nunique() < C.STEPS_PER_HOUR * 2:
        raise HTTPException(503, "waiting for data: start edge/edge_agent.py")
    if cache["rows"] == len(df):
        return cache["payload"]
    # Fill the grid so a station that stopped reporting shows up as "no data".
    grid = pd.MultiIndex.from_product(
        [pd.date_range(df["timestamp"].min(), df["timestamp"].max(), freq=f"{C.STEP_MINUTES}min"),
         sorted(STATION_IDS)], names=["timestamp", "station"])
    df = df.set_index(["timestamp", "station"]).reindex(grid).reset_index()
    data = payload(run(df, meta={}, detector=detector))
    cache.update(rows=len(df), payload=data)
    return data


@app.get("/api/network")
def get_network():
    return network()


@app.get("/api/alerts")
def get_alerts():
    data = network()
    last = data["steps"] - 1
    return [x for x in data["incidents"] if x["end"] >= last - 1]


@app.get("/api/health")
def health():
    with lock:
        n, stations, latest = con.execute(
            "SELECT COUNT(*), COUNT(DISTINCT station), MAX(timestamp) FROM readings").fetchone()
    return {"ok": True, "readings": n, "stations": stations, "latest": latest}


DIST = ROOT / "web" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
