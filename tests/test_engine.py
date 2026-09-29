"""python -m pytest -q"""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from skynova import config as C  # noqa: E402
from skynova import evaluate as E  # noqa: E402
from skynova.detector import Detector  # noqa: E402
from skynova.simulator import simulate  # noqa: E402


@pytest.fixture(scope="module")
def run():
    df, meta = simulate()
    det = Detector().fit(df)
    pred = det.detect(df)
    return df, meta, det, pred, E.join(df, pred)


def test_simulator_shape(run):
    df, *_ = run
    assert len(df) == 10 * C.STEPS_PER_DAY * len(C.STATIONS)
    assert set(df["label"]) == {C.NORMAL, C.SENSOR_FAULT, C.WEATHER_EVENT, C.MISSING}


def test_headline_metrics(run):
    *_, joined = run
    m = E.metrics(joined)
    assert m["detection"]["precision"] >= 0.9
    assert m["detection"]["recall"] >= 0.88
    assert m["detection"]["false_alarm_rate"] <= 0.03
    assert m["fault_vs_weather_accuracy"] >= 0.9


def test_every_incident_detected_with_right_class(run):
    df, meta, _, _, joined = run
    for inc in E.per_incident(joined, meta):
        assert inc["detected"], inc["incident"]
        assert inc["recall"] >= 0.7, inc


def test_engine_is_causal(run):
    """A verdict at step t must not change when the future is removed.

    This is what makes the batch replay equal to what a live server would have
    said at the time.
    """
    df, _, det, pred, _ = run
    times = sorted(df["timestamp"].unique())
    for cut in (400, 520, 790, 1100):
        t = times[cut]
        live = det.detect(df[df["timestamp"] <= t])
        a = live[live["timestamp"] == t].set_index("station")["pred"]
        b = pred[pred["timestamp"] == t].set_index("station")["pred"]
        assert (a == b.reindex(a.index)).all(), (t, a.to_dict(), b.to_dict())


def test_sensor_fault_is_not_called_weather(run):
    *_, joined = run
    offset = joined[joined["label_note"].str.contains("out of calibration")]
    assert (offset["pred"] == C.SENSOR_FAULT).mean() > 0.95


def test_heatwave_is_weather_not_fault(run):
    *_, joined = run
    heat = joined[(joined["label_note"] == "Heatwave") & (joined["pred"] != C.NORMAL)]
    assert (heat["pred"] == C.WEATHER_EVENT).mean() > 0.95
