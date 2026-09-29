"""MicroPython reference node for a low-cost demo AWS (ESP32).

Reference only: written against the standard sensor drivers but not yet run on
hardware in this repo.

Wiring
    BME280  (temperature, humidity, pressure)  I2C  SDA=21 SCL=22
    Anemometer reed switch  (wind)              GPIO 27, 2.4 km/h per pulse/s
    Tipping-bucket rain gauge                   GPIO 26, 0.2794 mm per tip

Every 10 minutes the node averages the BME280, converts pulse counts, and
POSTs one reading to the SkyNova server's /api/ingest, the same JSON the
edge agent sends. If Wi-Fi is down it keeps the last 144 readings (one day) in
RAM and sends them oldest-first when the link returns.
"""

import time

import machine
import network
import urequests
from bme280 import BME280  # pip-installable via mip: "bme280"

STATION = "BPL"
SERVER = "http://192.168.1.10:8000/api/ingest"
WIFI = ("your-ssid", "your-password")
PERIOD_S = 600

i2c = machine.I2C(0, sda=machine.Pin(21), scl=machine.Pin(22))
bme = BME280(i2c=i2c)

wind_pulses = 0
rain_tips = 0


def _wind(_):
    global wind_pulses
    wind_pulses += 1


def _rain(_):
    global rain_tips
    rain_tips += 1


machine.Pin(27, machine.Pin.IN, machine.Pin.PULL_UP).irq(trigger=machine.Pin.IRQ_FALLING, handler=_wind)
machine.Pin(26, machine.Pin.IN, machine.Pin.PULL_UP).irq(trigger=machine.Pin.IRQ_FALLING, handler=_rain)

queue = []


def connect():
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    if not sta.isconnected():
        sta.connect(*WIFI)
        for _ in range(20):
            if sta.isconnected():
                break
            time.sleep(0.5)
    return sta.isconnected()


def stamp():
    y, mo, d, h, mi, s, *_ = time.localtime()
    return "%04d-%02d-%02dT%02d:%02d:00" % (y, mo, d, h, mi - mi % 10)


def sample():
    global wind_pulses, rain_tips
    t = h = p = 0.0
    n = 10
    for _ in range(n):
        tt, pp, hh = bme.read_compensated_data()
        t += tt / 100
        p += pp / 25600
        h += hh / 1024
        time.sleep(1)
    wind_ms = (wind_pulses / PERIOD_S) * 2.4 / 3.6
    rain_mm = rain_tips * 0.2794
    wind_pulses = rain_tips = 0
    return {
        "station": STATION,
        "timestamp": stamp(),
        "temperature": round(t / n, 2),
        "humidity": round(h / n, 1),
        "pressure": round(p / n, 2),
        "wind_speed": round(wind_ms, 2),
        "rainfall": round(rain_mm, 2),
    }


while True:
    started = time.time()
    queue.append(sample())
    queue = queue[-144:]
    if connect():
        while queue:
            try:
                r = urequests.post(SERVER, json=queue[0])
                ok = r.status_code == 200
                r.close()
            except OSError:
                ok = False
            if not ok:
                break
            queue.pop(0)
    time.sleep(max(1, PERIOD_S - (time.time() - started)))
