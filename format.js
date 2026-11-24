export function formatTemp(data, stationName = 'Hong Kong Observatory') {
  if (!Array.isArray(data?.temperature?.data)) {
    throw new Error('Weather data is missing.');
  }
  if (data.temperature.data.length === 0) return '--';
  // Station order can change, so never select a station by array position.
  const station = data.temperature.data.find((entry) => entry?.place === stationName);
  if (!station || !Number.isFinite(station.value) || station.unit !== 'C') {
    throw new Error('The requested temperature is missing.');
  }
  return `${station.value} °C`;
}

export function sourceTime(value) {
  // These two feeds publish Hong Kong local timestamps without a timezone.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new Error('Source timestamp is missing.');
  }
  const date = new Date(`${value.replace(' ', 'T')}+08:00`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid source timestamp.');
  return date;
}

export function findAqhiStation(data, stationName = 'Central/Western') {
  const station = Array.isArray(data)
    ? data.find((entry) => entry?.station === stationName) : null;
  if (!station || !/^(?:[1-9]|10|10\+)$/.test(String(station.aqhi)) ||
      typeof station.health_risk !== 'string' || !station.health_risk.trim()) {
    throw new Error('Air quality reading is missing.');
  }
  return station;
}

export function formatAqhi(data, stationName = 'Central/Western') {
  const station = findAqhiStation(data, stationName);
  return `AQHI ${station.aqhi}`;
}

export function nextTrain(json, direction = 'UP') {
  if (json?.status !== 1) throw new Error('Train data is unavailable.');
  const station = json.data?.['ISL-SYP'];
  if (!station || !Array.isArray(station.UP) || !Array.isArray(station.DOWN)) {
    throw new Error('Station data is missing.');
  }
  if (direction !== 'UP' && direction !== 'DOWN') {
    throw new Error('Invalid train direction.');
  }
  const destinations = { CHW: 'Chai Wan', KET: 'Kennedy Town' };
  const trains = station[direction].filter((train) => train?.valid === 'Y');
  const arrivals = trains.map((train) => {
    if (typeof train.ttnt !== 'string' || !/^\d+$/.test(train.ttnt) ||
        typeof train.dest !== 'string' || !/^[A-Z]{3}$/.test(train.dest)) {
      throw new Error('Invalid train arrival.');
    }
    const minutes = Number(train.ttnt);
    if (!Number.isSafeInteger(minutes)) throw new Error('Invalid train minutes.');
    return { minutes, destination: destinations[train.dest] || `station code ${train.dest}` };
  });
  arrivals.sort((a, b) => a.minutes - b.minutes);
  const label = direction === 'UP' ? 'Chai Wan' : 'Kennedy Town';
  if (!arrivals.length) return `Towards ${label}: No upcoming trains`;
  const next = arrivals[0];
  return `Towards ${next.destination}: ${next.minutes} min`;
}
