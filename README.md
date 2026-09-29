# SkyNova: intelligent anomaly detection for Automatic Weather Stations

Smart India Hackathon 2026 · **SIH26073** · Theme: Disaster Management · Category: Software
Team **SkyNova** · Team ID 162269

Automatic Weather Stations (AWS) report every ten minutes, and some of those readings are wrong. A
faulty sensor and a real thunderstorm can both produce a "strange" number. SkyNova checks every
reading and decides which one it is: **sensor fault** or **extreme weather**. It explains each
decision in one sentence and warns when a sensor is drifting towards failure.

Everything runs offline in Python with classical, explainable ML. It needs no cloud AI and no API keys.

## Results

Scored against the simulator's ground-truth labels: 10 days, 8 stations, 11,520 station readings.

| Metric | Value |
|---|---|
| Precision (anomaly vs normal) | **94.2%** |
| Recall | **91.3%** |
| False-alarm rate on normal readings | **1.7%** |
| Fault-vs-weather classification, on caught anomalies | **95.1%** |
| Engine time per station reading | ~0.05 ms |

Every injected incident is detected:

| Incident | Share classified correctly | First flag after onset |
|---|---|---|
| Temperature spikes (loose connector) | 100% | 0 min |
| Humidity sensor frozen | 100% | 0 min |
| Barometer drifting +6 hPa over 8 days | 91% | 60 min |
| Anemometer bearing failure (erratic) | 88% | 10 min |
| Power / GSM failure | 100% | 0 min |
| Rain-gauge false tips | 100% | 0 min |
| Temperature calibration offset (+3.5 °C) | 99% | 10 min |
| Humidity output below physical limit | 100% | 0 min |
| Thunderstorm A, Thunderstorm B (moving cells) | 77%, 76% | 0 min |
| Heatwave (region-wide) | 84% | 90 min |

Regenerate these numbers with `python -m skynova.export`.

## How it decides

```
 edge agent ──► quality control ──► features ──► Isolation Forest ──► dual detection ──► alert + reason
 (buffer when      range, jump,       15 robust     300 trees,            fault or            predictive
  link is down)    frozen, dry rain   z-scores      trained on 2          weather?            maintenance
                                                    clean days
```

1. **Quality control** (WMO-style gross-error checks): physical range, impossible jumps, a sensor
   frozen for 2 h, erratic output, rain under a dry sky.
2. **Features**: each reading is compared with three expectations, all looking only backwards:
   - *temporal*: the station's own last hour
   - *spatial*: its 4 nearest neighbours, corrected for each station's normal offset
   - *climate*: the station's normal for that time of day (temperature and humidity)

   Each residual is divided by a robust noise scale, giving 15 z-scores per reading.
3. **Isolation Forest** scores how unusual the whole picture is. Statistical evidence must persist
   for 2 of 3 readings; hard-rule hits fire immediately.
4. **Dual detection**, the core idea:
   - A **broken sensor misbehaves alone**: one parameter, one station, while the neighbours stay calm.
   - **Real weather is coherent**: pressure falls, wind gusts, rain starts and temperature drops
     together, and neighbouring stations see the same thing within about 2 hours. A heatwave lifts
     every station alike, so a station that stands out *during* a heatwave is still flagged as a fault.
5. **Predictive maintenance**: each sensor's one-day median bias against its neighbours is fitted
   with a trend line over 3 days. A steady walk (R² ≥ 0.8) is projected forward to the
   calibration tolerance, which gives a service ETA.

## Run it

```bash
pip install -r requirements.txt

# 1. batch: simulate, detect, score, and write the dashboard data
python -m skynova.export

# 2. tests (metrics, every incident caught, causality: live == replay)
python -m pytest -q

# 3. dashboard (React + Vite + framer-motion)
cd web && npm install && npm run dev        # http://localhost:5173

# 4. live end-to-end: server + edge agent streaming 8 stations
uvicorn server.api:app --port 8000          # also serves web/dist if built
python edge/edge_agent.py --speed 60        # in a second terminal
```

When a local server is running, the dashboard reads `/api/network` and shows *Live from edge
agents*. The deployed site has no server, so it replays the exported JSON.

## Layout

```
skynova/        the engine
  config.py       stations, sensor limits, thresholds
  simulator.py    labelled synthetic network: 8 fault types, 2 storms, 1 heatwave
  preprocess.py   range / jump / persistence checks
  features.py     temporal, spatial and climate z-scores
  detector.py     Isolation Forest + dual detection + one-sentence reasons
  maintenance.py  drift tracking and service ETA
  evaluate.py     precision / recall / confusion matrix / per-incident scoring
  loaders.py      real data: generic IMD/MOSDAC-style AWS CSV, Meteostat hourly
  export.py       writes web/public/data/network.json
server/api.py   FastAPI: /api/ingest, /api/network, /api/alerts, /api/health
edge/           edge agent with store-and-forward SQLite outbox
hardware/       MicroPython reference node (ESP32 + BME280 + anemometer + rain gauge)
web/            React dashboard (white theme, animated replay)
tests/          pytest suite
```

## Using real data

```python
from skynova.loaders import load_aws_csv, load_meteostat_csv
from skynova.pipeline import run

df = load_aws_csv("imd_aws_export.csv")          # timestamp, station, temperature, ...
result = run(df, meta={})                        # verdicts in result["pred"]
```

Station coordinates live in `skynova/config.py`. Add your stations there so the spatial check
knows each station's neighbours.

## Limits

- The headline numbers come from a **simulated** network. Real AWS archives have no fault labels,
  so a detector cannot be scored on them. The simulator exists to provide those labels.
- The climate normal is learnt from two calibration days. A deployment would use each station's
  multi-year IMD normals instead.
- Storm recall is lower at the fringe of a cell (light rain, small pressure dips). Those readings
  are real weather but barely unusual.
- `hardware/esp32_aws_node.py` has not been run on hardware yet.

## References

- WMO-No. 8, *Guide to Instruments and Methods of Observation*: quality control of AWS data
- Liu, Ting & Zhou (2008), *Isolation Forest*, IEEE ICDM
- India Meteorological Department, AWS network: https://mausam.imd.gov.in
- MOSDAC AWS time-series archive: https://www.mosdac.gov.in
- Meteostat: https://meteostat.net
