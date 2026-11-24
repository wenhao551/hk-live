import { formatTemp, formatAqhi, nextTrain, findAqhiStation, sourceTime } from './format.js';

const weatherUrl = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en';
const stationName = 'Hong Kong Observatory';
const temperatureElement = document.getElementById('weather-temperature');
const statusElement = document.getElementById('weather-status');
const updatedElement = document.getElementById('weather-updated');
const checkedElement = document.getElementById('weather-checked');
const refreshButton = document.getElementById('weather-refresh');
const hongKongTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Hong_Kong',
  dateStyle: 'medium',
  timeStyle: 'short'
});

function displayTime(element, date) {
  element.dateTime = date.toISOString();
  element.textContent = `${hongKongTime.format(date)} HKT`;
}

async function loadWeather() {
  if (refreshButton.disabled) return;

  refreshButton.disabled = true;
  statusElement.textContent = 'Loading weather…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(weatherUrl, {
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Weather request failed.');

    const data = await response.json();
    const temperature = formatTemp(data, stationName);
    if (temperature === '--') throw new Error('The requested temperature is missing.');

    const updated = new Date(data.updateTime);
    if (typeof data.updateTime !== 'string' || Number.isNaN(updated.getTime())) {
      throw new Error('Weather update time is missing.');
    }

    temperatureElement.textContent = temperature;
    displayTime(updatedElement, updated);
    statusElement.textContent = 'Current temperature';
  } catch {
    temperatureElement.textContent = '—';
    updatedElement.textContent = '—';
    updatedElement.removeAttribute('datetime');
    statusElement.textContent = 'Temperature unavailable. Check your connection or try again later.';
  } finally {
    clearTimeout(timeout);
    displayTime(checkedElement, new Date());
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', loadWeather);
setInterval(() => {
  if (document.visibilityState === 'visible') loadWeather();
}, 5 * 60 * 1000);
loadWeather();

const airQualityUrl = 'https://dashboard.data.gov.hk/api/aqhi-individual?format=json';
const transportUrl = 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=ISL&sta=SYP';

function renderAirQuality(data) {
  const station = findAqhiStation(data);
  const value = formatAqhi(data);
  const updated = sourceTime(station.publish_date);
  document.getElementById('air-quality-station').textContent = station.station;
  document.getElementById('air-quality-value').textContent = value;
  document.getElementById('air-quality-risk').textContent = `Health risk: ${station.health_risk}`;
  displayTime(document.getElementById('air-quality-updated'), updated);
  return 'Current air quality';
}

function renderTransport(json) {
  const rows = [nextTrain(json, 'UP'), nextTrain(json, 'DOWN')];
  const updated = sourceTime(json.data['ISL-SYP'].curr_time);
  document.getElementById('transport-up').textContent = rows[0];
  document.getElementById('transport-down').textContent = rows[1];
  displayTime(document.getElementById('transport-updated'), updated);
  return json.isdelay === 'Y' ? 'MTR reports delayed arrival data.' : 'Latest train arrivals';
}

async function loadCard(id, url, render, loading, unavailable) {
  const button = document.getElementById(`${id}-refresh`);
  if (button.disabled) return;
  const status = document.getElementById(`${id}-status`);
  button.disabled = true;
  status.textContent = loading;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Request failed.');
    status.textContent = render(await response.json());
  } catch {
    status.textContent = `${unavailable} Check your connection or try again later.`;
    const updated = document.getElementById(`${id}-updated`);
    updated.textContent = '—';
    updated.removeAttribute('datetime');
    if (id === 'air-quality') {
      document.getElementById('air-quality-value').textContent = '—';
      document.getElementById('air-quality-risk').textContent = 'Health risk: —';
    } else {
      document.getElementById('transport-up').textContent = 'Towards Chai Wan: —';
      document.getElementById('transport-down').textContent = 'Towards Kennedy Town: —';
    }
  } finally {
    clearTimeout(timeout);
    displayTime(document.getElementById(`${id}-checked`), new Date());
    button.disabled = false;
  }
}

for (const card of [
  ['air-quality', airQualityUrl, renderAirQuality, 'Loading air quality…', 'Air quality unavailable.'],
  ['transport', transportUrl, renderTransport, 'Loading train arrivals…', 'Train arrivals unavailable.']
]) {
  const load = () => loadCard(...card);
  document.getElementById(`${card[0]}-refresh`).addEventListener('click', load);
  setInterval(() => {
    if (document.visibilityState === 'visible') load();
  }, 5 * 60 * 1000);
  load();
}
