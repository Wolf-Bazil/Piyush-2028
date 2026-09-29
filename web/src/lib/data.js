// Loads the network replay. A local SkyNova server (server/api.py) exposes the
// same shape at /api/network, fed by live edge agents; the deployed site has no
// server, so it falls back to the JSON the Python pipeline exported.
export async function loadNetwork() {
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const sources = local ? ['/api/network', '/data/network.json'] : ['/data/network.json'];
  for (const url of sources) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const type = res.headers.get('content-type') || '';
      if (!type.includes('json')) continue;
      const data = await res.json();
      return { ...prepare(data), source: url.startsWith('/api') ? 'live' : 'replay' };
    } catch {
      /* try the next source */
    }
  }
  throw new Error('No network data found');
}

export const CLS = { NORMAL: 0, FAULT: 1, WEATHER: 2, MISSING: 3 };

export const CLS_META = {
  0: { key: 'normal', label: 'Normal', color: '#6b7482' },
  1: { key: 'fault', label: 'Sensor fault', color: '#ff5b6b' },
  2: { key: 'weather', label: 'Extreme weather', color: '#2dd4ef' },
  3: { key: 'missing', label: 'No data', color: '#4b5260' },
};

export const PARAM_META = {
  temperature: { label: 'Temperature', short: 'Temp' },
  humidity: { label: 'Humidity', short: 'RH' },
  pressure: { label: 'Pressure', short: 'Pres' },
  wind_speed: { label: 'Wind speed', short: 'Wind' },
  rainfall: { label: 'Rainfall', short: 'Rain' },
};

function prepare(d) {
  const start = new Date(d.start.replace(' ', 'T'));
  const stepMs = d.step_minutes * 60 * 1000;
  const time = (i) => new Date(start.getTime() + i * stepMs);
  const byId = Object.fromEntries(d.stations.map((s) => [s.id, s]));
  return { ...d, time, byId, stepsPerHour: 60 / d.step_minutes };
}

// Latest maintenance snapshot at or before step t.
export function maintenanceAt(d, t) {
  let snap = d.maintenance[0];
  for (const s of d.maintenance) {
    if (s.at <= t) snap = s;
    else break;
  }
  return snap;
}

// Storm cells from the scenario, positioned at step t.
export function stormsAt(d, t) {
  const hours = t / d.stepsPerHour;
  return (d.scenario?.storms || [])
    .map((s) => {
      const dt = hours - s.start_day * 24;
      if (dt < 0 || dt > s.hours) return null;
      return {
        name: s.name,
        lon: s.start_lonlat[0] + s.velocity_deg_per_hour[0] * dt,
        lat: s.start_lonlat[1] + s.velocity_deg_per_hour[1] * dt,
        radius: s.radius_deg,
        progress: dt / s.hours,
      };
    })
    .filter(Boolean);
}

export function heatwaveAt(d, t) {
  const hours = t / d.stepsPerHour;
  return (d.scenario?.heatwaves || []).find(
    (h) => Math.abs(hours - h.peak_day * 24) < h.half_width_hours * 0.8
  );
}
