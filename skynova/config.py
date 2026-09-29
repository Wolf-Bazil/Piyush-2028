"""Network layout, sensor limits and detector thresholds.

Everything tunable lives here so the pipeline, the edge agent and the server
all agree on the same numbers.
"""

# Timestep of the AWS network. IMD AWS report every 10-15 minutes.
STEP_MINUTES = 10
STEPS_PER_HOUR = 60 // STEP_MINUTES
STEPS_PER_DAY = 24 * STEPS_PER_HOUR

PARAMS = ["temperature", "humidity", "pressure", "wind_speed", "rainfall"]

NAMES = {
    "temperature": "Temperature",
    "humidity": "Humidity",
    "pressure": "Pressure",
    "wind_speed": "Wind speed",
    "rainfall": "Rainfall",
}

UNITS = {
    "temperature": "°C",
    "humidity": "%",
    "pressure": "hPa",
    "wind_speed": "m/s",
    "rainfall": "mm/10min",
}

# A small regional network around Bhopal, Madhya Pradesh.
# elevation drives the pressure and temperature offsets per station.
STATIONS = [
    {"id": "BPL", "name": "Bhopal",       "lat": 23.26, "lon": 77.41, "elevation": 523},
    {"id": "SHR", "name": "Sehore",       "lat": 23.20, "lon": 77.08, "elevation": 502},
    {"id": "RSN", "name": "Raisen",       "lat": 23.33, "lon": 77.78, "elevation": 435},
    {"id": "VDS", "name": "Vidisha",      "lat": 23.52, "lon": 77.81, "elevation": 424},
    {"id": "NMD", "name": "Narmadapuram", "lat": 22.75, "lon": 77.72, "elevation": 297},
    {"id": "RJG", "name": "Rajgarh",      "lat": 24.01, "lon": 76.73, "elevation": 486},
    {"id": "SJP", "name": "Shajapur",     "lat": 23.43, "lon": 76.27, "elevation": 448},
    {"id": "DWS", "name": "Dewas",        "lat": 22.97, "lon": 76.05, "elevation": 535},
]

# Physically possible range for each sensor (WMO-No. 8 style gross-error limits).
RANGE_LIMITS = {
    "temperature": (-10.0, 52.0),
    "humidity": (2.0, 100.0),
    "pressure": (850.0, 1060.0),
    "wind_speed": (0.0, 60.0),
    "rainfall": (0.0, 60.0),
}

# Largest believable change between two consecutive 10-minute readings.
STEP_LIMITS = {
    "temperature": 6.0,
    "humidity": 25.0,
    "pressure": 3.0,
    "wind_speed": 20.0,
    "rainfall": 40.0,
}

# Persistence check: a reading that does not move at all for this long is stuck.
# Wind and rain are legitimately flat (calm, dry) so they are excluded.
PERSISTENCE_STEPS = 12  # 2 hours
PERSISTENCE_PARAMS = ["temperature", "humidity", "pressure"]

# Bias beyond which a sensor is out of calibration (used for maintenance ETA).
DRIFT_TOLERANCE = {
    "temperature": 1.5,
    "humidity": 8.0,
    "pressure": 2.0,
    "wind_speed": 2.5,
    "rainfall": 1.0,
}

# Detector thresholds.
SPATIAL_Z = 5.0          # robust z of a reading against its neighbours
TEMPORAL_Z = 5.0         # robust z against the station's own recent history
CLIMATE_Z = 3.5          # robust z against the same hour on previous days
IFOREST_CONTAMINATION = 0.03
COHERENCE_MIN = 0.3      # share of neighbours that must see the same event
NEIGHBOUR_RADIUS_KM = 120

# Human-readable classes.
NORMAL = "normal"
SENSOR_FAULT = "sensor_fault"
WEATHER_EVENT = "weather_event"
MISSING = "missing"
