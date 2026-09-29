"""Edge agent: runs next to the AWS logger, checks each reading, ships it upstream.

    python edge/edge_agent.py --server http://localhost:8000 --speed 60

What it does per reading
    1. read the sensors      (simulated network, a CSV replay, or a serial line)
    2. local gross-error QC  (range limits; flags travel with the reading)
    3. POST to the server    (batch per timestep)
    4. if the link is down   -> append to a local SQLite outbox, retry later,
                                oldest first, so nothing is lost in an outage

The edge never needs the internet for QC, and the central engine can be run on
the same box when a station is fully offline.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from skynova import config as C  # noqa: E402
from skynova.simulator import simulate  # noqa: E402


class Outbox:
    """Durable store-and-forward queue for readings the server has not acked."""

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.execute("CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY, body TEXT)")

    def push(self, batch: list[dict]):
        self.db.execute("INSERT INTO outbox (body) VALUES (?)", (json.dumps(batch),))
        self.db.commit()

    def flush(self, send) -> int:
        sent = 0
        for rid, body in self.db.execute("SELECT id, body FROM outbox ORDER BY id").fetchall():
            if not send(json.loads(body)):
                break
            self.db.execute("DELETE FROM outbox WHERE id = ?", (rid,))
            self.db.commit()
            sent += 1
        return sent

    def __len__(self):
        return self.db.execute("SELECT COUNT(*) FROM outbox").fetchone()[0]


def local_qc(row: dict) -> list[str]:
    flags = []
    for p in C.PARAMS:
        v = row.get(p)
        if v is None:
            flags.append(f"{p}:missing")
            continue
        lo, hi = C.RANGE_LIMITS[p]
        if not lo <= v <= hi:
            flags.append(f"{p}:range")
    return flags


def source_rows(args) -> pd.DataFrame:
    if args.csv:
        df = pd.read_csv(args.csv, parse_dates=["timestamp"])
    else:
        df, _ = simulate()
        df = df.drop(columns=["label", "label_param", "label_note"])
    if args.stations != "all":
        df = df[df["station"].isin(args.stations.split(","))]
    return df.sort_values(["timestamp", "station"])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--server", default="http://localhost:8000")
    ap.add_argument("--speed", type=float, default=30, help="timesteps per second (1 = real-time x600)")
    ap.add_argument("--stations", default="all", help="comma-separated ids, or 'all'")
    ap.add_argument("--csv", help="replay a CSV (timestamp, station, temperature, ...) instead of the simulator")
    ap.add_argument("--outbox", default=str(ROOT / "data" / "edge_outbox.db"))
    args = ap.parse_args()

    outbox = Outbox(Path(args.outbox))
    session = requests.Session()

    def send(batch):
        try:
            r = session.post(f"{args.server}/api/ingest", json=batch, timeout=5)
            return r.ok
        except requests.RequestException:
            return False

    df = source_rows(args)
    steps = df.groupby("timestamp", sort=True)
    print(f"edge agent: {df['station'].nunique()} station(s), {len(steps)} timesteps -> {args.server}")

    for i, (ts, g) in enumerate(steps):
        batch = []
        for row in g.to_dict("records"):
            reading = {"station": row["station"], "timestamp": ts.isoformat()}
            for p in C.PARAMS:
                v = row.get(p)
                reading[p] = None if v is None or pd.isna(v) else float(v)
            reading["edge_flags"] = local_qc(reading)
            if len([f for f in reading["edge_flags"] if f.endswith(":missing")]) == len(C.PARAMS):
                continue  # the logger produced nothing: that is the outage itself
            batch.append(reading)

        if len(outbox):
            outbox.flush(send)
        if batch and not send(batch):
            outbox.push(batch)
        if i % 36 == 0:
            flagged = sum(bool(r["edge_flags"]) for r in batch)
            print(f"{ts}  sent {len(batch):>2}  edge-flagged {flagged}  queued {len(outbox)}")
        time.sleep(1 / args.speed)

    print("done; queued:", len(outbox))


if __name__ == "__main__":
    main()
