"""Score detector output against the simulator's ground truth."""

from __future__ import annotations

import pandas as pd

from . import config as C

CLASSES = [C.NORMAL, C.SENSOR_FAULT, C.WEATHER_EVENT, C.MISSING]


def join(truth: pd.DataFrame, pred: pd.DataFrame) -> pd.DataFrame:
    return truth.merge(pred, on=["timestamp", "station"], how="inner")


def metrics(joined: pd.DataFrame) -> dict:
    j = joined[joined["label"] != C.MISSING]
    truth_anom = j["label"] != C.NORMAL
    pred_anom = j["pred"].isin([C.SENSOR_FAULT, C.WEATHER_EVENT])

    tp = int((truth_anom & pred_anom).sum())
    fp = int((~truth_anom & pred_anom).sum())
    fn = int((truth_anom & ~pred_anom).sum())
    tn = int((~truth_anom & ~pred_anom).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    caught = j[truth_anom & pred_anom]
    class_acc = float((caught["label"] == caught["pred"]).mean()) if len(caught) else 0.0

    confusion = pd.crosstab(joined["label"], joined["pred"]).reindex(
        index=CLASSES, columns=CLASSES, fill_value=0)

    return {
        "rows": int(len(joined)),
        "detection": {
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "f1": round(f1, 3),
            "false_alarm_rate": round(fp / (fp + tn), 4) if fp + tn else 0.0,
            "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        },
        "fault_vs_weather_accuracy": round(class_acc, 3),
        "confusion": {r: {c: int(confusion.loc[r, c]) for c in CLASSES} for r in CLASSES},
    }


def per_incident(joined: pd.DataFrame, meta: dict) -> list[dict]:
    """Was each injected incident caught, how fast, and classified how?"""
    out = []
    t0 = pd.Timestamp(meta["start"])
    step = pd.Timedelta(minutes=C.STEP_MINUTES)

    def summarise(name, kind, expected, rows, onset):
        hits = rows[rows["pred"] == expected]
        any_flag = rows[rows["pred"] != C.NORMAL]
        first = hits["timestamp"].min() if len(hits) else None
        return {
            "incident": name,
            "type": kind,
            "expected": expected,
            "truth_steps": int(len(rows)),
            "caught_steps": int(len(hits)),
            "recall": round(len(hits) / len(rows), 3) if len(rows) else 0.0,
            "flagged_any_class": round(len(any_flag) / len(rows), 3) if len(rows) else 0.0,
            "detected": bool(len(hits)),
            "delay_minutes": (int((first - onset) / pd.Timedelta(minutes=1))
                              if first is not None else None),
        }

    for f in meta["faults"]:
        mask = (joined["station"] == f["station"]) & (joined["label_note"] == f["note"])
        rows = joined[mask]
        expected = C.MISSING if f["kind"] == "dropout" else C.SENSOR_FAULT
        onset = rows["timestamp"].min() if len(rows) else t0 + f["start_day"] * pd.Timedelta(days=1)
        out.append({**summarise(f"{f['station']} {f['param']} {f['kind']}", f["kind"],
                                expected, rows, onset), "station": f["station"], "note": f["note"]})

    for ev in meta["storms"] + meta["heatwaves"]:
        rows = joined[(joined["label_note"] == ev["name"]) & (joined["label"] == C.WEATHER_EVENT)]
        onset = rows["timestamp"].min() if len(rows) else t0
        out.append({**summarise(ev["name"], "weather", C.WEATHER_EVENT, rows, onset),
                    "station": ",".join(sorted(rows["station"].unique())), "note": ev["name"]})
    return out
