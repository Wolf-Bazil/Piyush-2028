"""Synthetic Automatic Weather Station network with labelled ground truth.

Real AWS archives (IMD / MOSDAC) do not come with labels saying "this reading
was a broken sensor" versus "this was a real storm", so a detector cannot be
scored on them. The simulator builds a physically plausible network, then
injects two kinds of anomaly the detector must tell apart:

* sensor faults   - spike, stuck value, slow drift, calibration offset,
                    noisy bearing, false rain-gauge tips, out-of-range output,
                    and a power/comms dropout (missing data)
* weather events  - moving thunderstorm cells (pressure drop, gust, rain,
                    cold pool) and a region-wide heatwave

Every station-timestep carries a label, so every metric in the dashboard is
measured against known truth.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import config as C


@dataclass
class Fault:
    station: str
    param: str
    kind: str
    start_day: float
    hours: float
    magnitude: float = 0.0
    note: str = ""


@dataclass
class Storm:
    name: str
    start_day: float
    hours: float
    start_lonlat: tuple
    velocity_deg_per_hour: tuple
    radius_deg: float = 0.45
    strength: float = 1.0


@dataclass
class Heatwave:
    name: str
    peak_day: float
    half_width_hours: float
    delta_c: float


@dataclass
class Scenario:
    days: int = 10
    start: str = "2026-06-01 00:00"
    seed: int = 2028
    faults: list = field(default_factory=list)
    storms: list = field(default_factory=list)
    heatwaves: list = field(default_factory=list)


def default_scenario() -> Scenario:
    return Scenario(
        faults=[
            Fault("SHR", "temperature", "spike", 2.55, 1.0, 15.0,
                  "Loose connector: isolated +15 °C spikes"),
            Fault("VDS", "humidity", "stuck", 3.1, 14.0, 0.0,
                  "Humidity sensor frozen at one value"),
            Fault("RJG", "pressure", "drift", 2.0, 8.0 * 24, 6.0,
                  "Barometer drifting +6 hPa over 8 days"),
            Fault("DWS", "wind_speed", "noise", 4.2, 8.0, 7.0,
                  "Anemometer bearing failure: erratic readings"),
            Fault("NMD", "*", "dropout", 5.0, 6.0, 0.0,
                  "Power / GSM failure: no data"),
            Fault("BPL", "rainfall", "false_tip", 5.55, 0.7, 22.0,
                  "Rain gauge false tips on a dry afternoon"),
            Fault("RSN", "temperature", "offset", 8.15, 20.0, 3.5,
                  "Temperature sensor out of calibration (+3.5 °C)"),
            Fault("SJP", "humidity", "out_of_range", 8.8, 4.0, 0.5,
                  "Humidity output railed below physical limit"),
        ],
        storms=[
            Storm("Thunderstorm A", 3.55, 7.0, (75.6, 23.3), (0.42, 0.02)),
            Storm("Thunderstorm B", 9.25, 6.0, (75.9, 22.6), (0.33, 0.24),
                  radius_deg=0.5, strength=1.15),
        ],
        heatwaves=[Heatwave("Heatwave", 6.6, 20.0, 6.0)],
    )


def _ar1(rng, n, phi, sigma):
    out = np.zeros(n)
    eps = rng.normal(0, sigma, n)
    for i in range(1, n):
        out[i] = phi * out[i - 1] + eps[i]
    return out


def simulate(scn: Scenario | None = None) -> tuple[pd.DataFrame, dict]:
    """Return (long dataframe, metadata). One row per station per timestep."""
    scn = scn or default_scenario()
    rng = np.random.default_rng(scn.seed)
    n = scn.days * C.STEPS_PER_DAY
    times = pd.date_range(scn.start, periods=n, freq=f"{C.STEP_MINUTES}min")
    hours = np.arange(n) / C.STEPS_PER_HOUR          # hours since start
    hod = hours % 24                                  # hour of day
    days = hours / 24

    stations = C.STATIONS
    S = len(stations)
    ids = [s["id"] for s in stations]
    lon = np.array([s["lon"] for s in stations])
    lat = np.array([s["lat"] for s in stations])
    elev = np.array([s["elevation"] for s in stations], dtype=float)

    # Regional (shared) signals - every station sees these.
    diurnal = np.sin(2 * np.pi * (hod - 8) / 24)                 # peak 14:00
    synoptic_t = _ar1(rng, n, 0.995, 0.06)
    synoptic_p = 2.0 * np.sin(2 * np.pi * days / 6.5) + _ar1(rng, n, 0.998, 0.03)
    tide = 0.9 * np.cos(4 * np.pi * (hod - 10) / 24)             # semidiurnal
    daylight = np.clip(np.sin(np.pi * (hod - 6) / 12), 0, None)

    temp = np.zeros((n, S))
    hum = np.zeros((n, S))
    pres = np.zeros((n, S))
    wind = np.zeros((n, S))
    rain = np.zeros((n, S))

    for j in range(S):
        t_off = -0.0065 * (elev[j] - 450) + rng.normal(0, 0.3)
        temp[:, j] = (31 + t_off + 6.5 * diurnal + synoptic_t
                      + _ar1(rng, n, 0.9, 0.12) + rng.normal(0, 0.12, n))
        pres[:, j] = (1008 - elev[j] / 8.3 + synoptic_p + tide
                      + _ar1(rng, n, 0.95, 0.05) + rng.normal(0, 0.08, n))
        wind_base = 1.8 + 2.6 * daylight + rng.uniform(-0.3, 0.3)
        wind[:, j] = np.clip(wind_base * rng.lognormal(0, 0.25, n)
                             + _ar1(rng, n, 0.8, 0.25), 0, None)

    # Region-wide heatwave: warmer and drier everywhere at once.
    heat = np.zeros(n)
    for hw in scn.heatwaves:
        x = (hours - hw.peak_day * 24) / hw.half_width_hours
        bump = np.where(np.abs(x) < 1, 0.5 * (1 + np.cos(np.pi * x)), 0)
        heat += hw.delta_c * bump
    temp += heat[:, None]

    # Moving thunderstorm cells.
    storm_int = np.zeros((n, S))
    for st in scn.storms:
        t0 = st.start_day * 24
        active = (hours >= t0) & (hours <= t0 + st.hours)
        dt = hours - t0
        cx = st.start_lonlat[0] + st.velocity_deg_per_hour[0] * dt
        cy = st.start_lonlat[1] + st.velocity_deg_per_hour[1] * dt
        d = np.sqrt((lon[None, :] - cx[:, None]) ** 2
                    + (lat[None, :] - cy[:, None]) ** 2)
        inten = st.strength * np.exp(-(d / st.radius_deg) ** 2)
        storm_int += np.where(active[:, None], inten, 0)

    # Cold pool lingers after the gust front passes: exponential memory.
    cold = np.zeros_like(storm_int)
    for i in range(1, n):
        cold[i] = np.maximum(storm_int[i], cold[i - 1] * 0.93)
    temp -= 8.0 * cold
    pres += -4.5 * storm_int + 1.5 * (cold - storm_int)   # drop then recovery bump
    wind += 14.0 * storm_int * rng.uniform(0.7, 1.3, (n, S))
    rain += np.where(storm_int > 0.15,
                     12.0 * storm_int * rng.uniform(0.5, 1.4, (n, S)), 0)

    # Humidity follows temperature inversely, rain saturates it.
    for j in range(S):
        hum[:, j] = (58 - 3.0 * (temp[:, j] - temp[:, j].mean())
                     + _ar1(rng, n, 0.97, 0.35) + rng.normal(0, 1.0, n))
    hum += 35 * cold
    hum = np.clip(hum, 8, 100)

    # Scattered light showers at single stations - real, local, not anomalies.
    for _ in range(6):
        j = rng.integers(S)
        i0 = rng.integers(C.STEPS_PER_DAY, n - 10)
        rain[i0:i0 + 4, j] += rng.uniform(0.1, 0.8, 4)

    rain = np.round(np.clip(rain, 0, None), 1)
    wind = np.clip(wind, 0, None)

    # Ground-truth labels (station-level).
    label = np.full((n, S), C.NORMAL, dtype=object)
    label_param = np.full((n, S), "", dtype=object)
    label_note = np.full((n, S), "", dtype=object)

    # The cold pool behind a storm is still real weather, so label on it.
    weather = (cold > 0.15) | (heat[:, None] > 2.0)
    label[weather] = C.WEATHER_EVENT
    for st in scn.storms:
        t0 = st.start_day * 24
        mask = (hours[:, None] >= t0) & (hours[:, None] <= t0 + st.hours + 6) & (cold > 0.15)
        label_note[mask] = st.name
    for hw in scn.heatwaves:
        label_note[(heat[:, None] > 2.0) & (label_note == "")] = hw.name
    label_param[weather] = "*"

    data = {"temperature": temp, "humidity": hum, "pressure": pres,
            "wind_speed": wind, "rainfall": rain}

    for f in scn.faults:
        j = ids.index(f.station)
        i0 = int(round(f.start_day * C.STEPS_PER_DAY))
        i1 = min(n, i0 + max(1, int(round(f.hours * C.STEPS_PER_HOUR))))
        sl = slice(i0, i1)
        affected = np.zeros(n, dtype=bool)

        if f.kind == "dropout":
            for p in C.PARAMS:
                data[p][sl, j] = np.nan
            label[sl, j] = C.MISSING
            label_param[sl, j] = "*"
            label_note[sl, j] = f.note
            continue

        arr = data[f.param]
        if f.kind == "spike":
            idx = [i0, i0 + 2, i0 + 5]
            arr[idx, j] += f.magnitude
            affected[idx] = True
        elif f.kind == "stuck":
            arr[sl, j] = round(float(arr[i0, j]), 1)
            # A flat line is only provably stuck once it has been flat for the
            # persistence window, so truth starts there.
            affected[i0 + C.PERSISTENCE_STEPS - 1:i1] = True
        elif f.kind == "drift":
            ramp = np.linspace(0, f.magnitude, i1 - i0)
            arr[sl, j] += ramp
            # Truth: faulty once the bias passes a third of the tolerance
            # (about 0.7 hPa, five times the barometer's noise).
            affected[i0:i1] = ramp >= C.DRIFT_TOLERANCE[f.param] * 0.35
        elif f.kind == "noise":
            arr[sl, j] = np.abs(arr[sl, j] + rng.normal(0, f.magnitude, i1 - i0))
            affected[sl] = True
        elif f.kind == "false_tip":
            arr[sl, j] = np.round(f.magnitude * rng.uniform(0.6, 1.2, i1 - i0), 1)
            affected[sl] = True
        elif f.kind == "offset":
            arr[sl, j] += f.magnitude
            affected[sl] = True
        elif f.kind == "out_of_range":
            arr[sl, j] = f.magnitude
            affected[sl] = True

        label[affected, j] = C.SENSOR_FAULT
        label_param[affected, j] = f.param
        label_note[affected, j] = f.note

    rows = []
    for j, sid in enumerate(ids):
        df = pd.DataFrame({"timestamp": times, "station": sid})
        for p in C.PARAMS:
            df[p] = np.round(data[p][:, j], 2)
        df["label"] = label[:, j]
        df["label_param"] = label_param[:, j]
        df["label_note"] = label_note[:, j]
        rows.append(df)
    out = pd.concat(rows, ignore_index=True).sort_values(["timestamp", "station"])
    out = out.reset_index(drop=True)

    meta = {
        "start": str(times[0]),
        "end": str(times[-1]),
        "steps": n,
        "faults": [f.__dict__ for f in scn.faults],
        "storms": [{**s.__dict__} for s in scn.storms],
        "heatwaves": [h.__dict__ for h in scn.heatwaves],
    }
    return out, meta
