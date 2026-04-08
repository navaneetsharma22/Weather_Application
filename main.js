/* ================= SELECTORS ================= */
const grantContainer = document.getElementById("location-grant");
const searchForm = document.querySelector("[data-searchForm]");
const searchInput = document.querySelector("[data-searchInput]");
const autocompleteList = document.querySelector("[data-autocompleteList]");
const loading = document.querySelector(".loading-container");
const userInfo = document.querySelector("#weather-dashboard");
const errorBox = document.querySelector(".error-container");
const errorMsg = document.querySelector("[data-errorMessage]");
const themeBtn = document.querySelector("[data-themeToggle]");
const wrapper = document.querySelector(".wrapper");
const favoritesList = document.querySelector("[data-favoritesList]");
const recentList = document.querySelector("[data-recentList]");
const favoriteBtn = document.querySelector("[data-favoriteBtn]");
const localTimeEl = document.querySelector("[data-localTime]");
const alertBanner = document.querySelector("[data-alertBanner]");
const alertTitle = document.querySelector("[data-alertTitle]");
const alertCopy = document.querySelector("[data-alertCopy]");
const installBtn = document.querySelector("[data-installBtn]");
const voiceSearchBtn = document.querySelector("[data-voiceSearch]");
const refreshBtn = document.querySelector("[data-refreshWeather]");
const unitButtons = document.querySelectorAll("[data-unitToggle]");

const searchToggle = document.getElementById("search-toggle");
const searchPanel = document.getElementById("search-panel");
const seeMoreBtn = document.querySelector("[data-seeMoreBtn]");
const detailsModal = document.getElementById("details-modal");
const closeModal = document.getElementById("close-modal");

const cityNameEl = document.querySelector("[data-cityName]");
const cityNameSidebar = document.querySelector("[data-cityNameSidebar]");
const countryCodeEl = document.querySelector("[data-countryCode]");
const navDateEl = document.querySelector("[data-navDate]");
const countryIconEl = document.querySelector("[data-countryIcon]");
const weatherDescEl = document.querySelector("[data-weatherDesc]");
const weatherIconEl = document.querySelector("[data-weatherIcon]");
const temperatureEl = document.querySelector("[data-temperature]");
const tempHighEl = document.querySelector("[data-tempHigh]");
const tempLowEl = document.querySelector("[data-tempLow]");

const windspeedEl = document.querySelector("[data-windspeed]");
const humidityEl = document.querySelector("[data-humidity]");
const cloudinessEl = document.querySelector("[data-cloudiness]");
const feelsLikeEl = document.querySelector("[data-feelsLike]");
const pressureEl = document.querySelector("[data-pressure]");
const visibilityEl = document.querySelector("[data-visibility]");
const sunriseEl = document.querySelector("[data-sunrise]");
const sunsetEl = document.querySelector("[data-sunset]");
const minMaxEl = document.querySelector("[data-minMax]");

const recentCardsEl = document.querySelector("[data-recentCards]");
const forecastLabels = document.getElementById("forecast-labels");
const forecastTemps = document.getElementById("forecast-temps");
const curvePath = document.getElementById("curve-path");

const API_KEY = "3d6b3bc817ad02eb2818c0ad867eb7c3";
const STORAGE_KEYS = {
  theme: "weather-theme-mode",
  unit: "weather-unit",
  recent: "weather-recent-cities",
  favorites: "weather-favorite-cities",
  lastViewed: "weather-last-viewed",
  userCoords: "weather-user-coordinates",
};

/* ================= INITIAL STATE ================= */
let deferredInstallPrompt = null;
let autocompleteController = null;
let searchDebounce = null;

const state = {
  unit: localStorage.getItem(STORAGE_KEYS.unit) || "metric",
  theme: localStorage.getItem(STORAGE_KEYS.theme) || "dark",
  recentCities: readStorageArray(STORAGE_KEYS.recent),
  favoriteCities: readStorageArray(STORAGE_KEYS.favorites),
  currentWeather: null,
  currentForecast: null,
  currentCityKey: "",
  lastTarget: readStorageObject(STORAGE_KEYS.lastViewed),
};

applyTheme(state.theme);
syncUnitButtons();
renderSavedLists();
registerServiceWorker();
restoreLastView();

/* ================= EVENT LISTENERS ================= */
searchToggle.addEventListener("click", () => searchPanel.classList.toggle("hidden"));
seeMoreBtn.addEventListener("click", () => detailsModal.removeAttribute("hidden"));
closeModal.addEventListener("click", () => detailsModal.setAttribute("hidden", "true"));

themeBtn.addEventListener("click", () => {
  state.theme = wrapper.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  applyTheme(state.theme);
});

document.querySelector("[data-grantAccess]").addEventListener("click", requestUserLocation);

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = searchInput.value.trim();
  if (!city) return;
  clearSuggestions();
  fetchWeatherByCity(city, true);
});

searchInput.addEventListener("input", handleSearchInput);
searchInput.addEventListener("focus", handleSearchInput);
document.addEventListener("click", (event) => {
  if (!searchForm.contains(event.target)) clearSuggestions();
});

voiceSearchBtn.addEventListener("click", startVoiceSearch);
refreshBtn.addEventListener("click", refreshCurrentWeather);
favoriteBtn.addEventListener("click", toggleFavoriteCity);

unitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextUnit = button.dataset.unit;
    if (nextUnit === state.unit) return;

    state.unit = nextUnit;
    localStorage.setItem(STORAGE_KEYS.unit, state.unit);
    syncUnitButtons();

    if (state.currentWeather) refreshCurrentWeather();
  });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

/* ================= VIEW CONTROL ================= */
function hideAll() {
  grantContainer.style.display = "none";
  loading.style.display = "none";
  userInfo.style.display = "none";
  errorBox.style.display = "none";
}

function showLoading() {
  hideAll();
  loading.style.display = "flex";
}

function showUserInfo() {
  hideAll();
  userInfo.style.display = "flex";
}

function restoreLastView() {
  hideAll();

  const rememberedCoords =
    readStorageObject(STORAGE_KEYS.userCoords) || readSessionCoords();

  if (state.lastTarget?.type === "city" && state.lastTarget.query) {
    fetchWeatherByCity(state.lastTarget.query, false);
    return;
  }

  if (state.lastTarget?.type === "coords" && state.lastTarget.coords) {
    fetchWeatherByCoords(state.lastTarget.coords, false);
    return;
  }

  if (rememberedCoords) {
    fetchWeatherByCoords(rememberedCoords, false);
    return;
  }

  hideAll();
  grantContainer.style.display = "flex";
}

/* ================= THEME ================= */
function applyTheme(mode) {
  wrapper.classList.toggle("light", mode === "light");
  themeBtn.innerText = mode === "light" ? "☀️" : "🌙";
}

function syncUnitButtons() {
  unitButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.unit === state.unit);
  });
}

function setWeatherTheme(weatherMain, iconCode) {
  const key = String(weatherMain || "").toLowerCase();
  const isNight = iconCode?.endsWith("n");

  if (isNight) {
    wrapper.dataset.weatherTheme = "night";
    return;
  }

  if (key.includes("thunder")) {
    wrapper.dataset.weatherTheme = "storm";
    return;
  }

  if (key.includes("rain") || key.includes("drizzle") || key.includes("mist")) {
    wrapper.dataset.weatherTheme = "rain";
    return;
  }

  if (key.includes("snow")) {
    wrapper.dataset.weatherTheme = "snow";
    return;
  }

  if (key.includes("cloud")) {
    wrapper.dataset.weatherTheme = "clouds";
    return;
  }

  if (key.includes("clear")) {
    wrapper.dataset.weatherTheme = "clear";
    return;
  }

  wrapper.dataset.weatherTheme = "default";
}

/* ================= STORAGE HELPERS ================= */
function readStorageArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readStorageObject(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readSessionCoords() {
  try {
    const value = sessionStorage.getItem(STORAGE_KEYS.userCoords);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function saveCoords(coords) {
  sessionStorage.setItem(STORAGE_KEYS.userCoords, JSON.stringify(coords));
  localStorage.setItem(STORAGE_KEYS.userCoords, JSON.stringify(coords));
}

function rememberLastTarget(target) {
  state.lastTarget = target;
  localStorage.setItem(STORAGE_KEYS.lastViewed, JSON.stringify(target));
}

/* ================= LOCATION ================= */
function requestUserLocation() {
  if (!navigator.geolocation) {
    showError("Geolocation is not supported on this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };

      saveCoords(coords);
      rememberLastTarget({ type: "coords", coords });
      fetchWeatherByCoords(coords, true);
    },
    () => showError("Location access denied.")
  );
}

/* ================= FETCH HELPERS ================= */
async function fetchJSON(url) {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || String(data.cod) === "404" || String(data.cod) === "401") {
    throw new Error(data.message || "Unable to fetch weather data.");
  }

  return data;
}

async function fetchWeatherByCoords(coords, persistTarget = true) {
  showLoading();

  try {
    const weather = await fetchJSON(buildWeatherUrlByCoords(coords));
    if (persistTarget) rememberLastTarget({ type: "coords", coords });
    await handleWeatherSuccess(weather, persistTarget);
  } catch (error) {
    showError(error.message || "Unable to fetch weather.");
  }
}

async function fetchWeatherByCity(city, persistTarget = true) {
  showLoading();

  try {
    const weather = await fetchJSON(buildWeatherUrlByCity(city));
    if (persistTarget) rememberLastTarget({ type: "city", query: city });
    await handleWeatherSuccess(weather, persistTarget);
  } catch (error) {
    showError(normalizeError(error.message));
  }
}

async function handleWeatherSuccess(weather, persistTarget) {
  const [forecast] = await Promise.all([
    fetchJSON(buildForecastUrl(weather.coord.lat, weather.coord.lon)),
    fetchAQI(weather.coord.lat, weather.coord.lon),
  ]);

  state.currentWeather = weather;
  state.currentForecast = forecast;
  state.currentCityKey = getCityKey(weather.name, weather.sys.country);

  if (persistTarget) {
    addRecentCity(weather.name, weather.sys.country);
  }

  renderWeather(weather, forecast);
  searchInput.value = `${weather.name}, ${weather.sys.country}`;
}

/* ================= SEARCH ================= */
function handleSearchInput() {
  const query = searchInput.value.trim();

  if (searchDebounce) clearTimeout(searchDebounce);

  if (query.length < 2) {
    clearSuggestions();
    return;
  }

  searchDebounce = setTimeout(() => {
    fetchCitySuggestions(query);
  }, 250);
}

async function fetchCitySuggestions(query) {
  if (autocompleteController) autocompleteController.abort();
  autocompleteController = new AbortController();

  try {
    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`,
      { signal: autocompleteController.signal }
    );
    const suggestions = await response.json();
    renderSuggestions(Array.isArray(suggestions) ? suggestions : []);
  } catch (error) {
    if (error.name !== "AbortError") clearSuggestions();
  }
}

function renderSuggestions(items) {
  autocompleteList.innerHTML = "";

  if (!items.length) {
    clearSuggestions();
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-item";
    button.innerHTML = `
      <span class="suggestion-label">${item.name}</span>
      <span class="suggestion-meta">${[item.state, item.country].filter(Boolean).join(", ")}</span>
    `;

    button.addEventListener("click", () => {
      const query = [item.name, item.state, item.country].filter(Boolean).join(", ");
      searchInput.value = query;
      clearSuggestions();
      fetchWeatherByCity(query, true);
    });

    fragment.appendChild(button);
  });

  autocompleteList.appendChild(fragment);
  autocompleteList.classList.add("active");
}

function clearSuggestions() {
  autocompleteList.innerHTML = "";
  autocompleteList.classList.remove("active");
}

function startVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showError("Voice search is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    searchInput.value = transcript;
    fetchWeatherByCity(transcript, true);
  };

  recognition.onerror = () => {
    showError("Voice search could not understand the request.");
  };

  recognition.start();
}

/* ================= RENDER WEATHER ================= */
function renderWeather(weather, forecast) {
  showUserInfo();
  setWeatherTheme(weather.weather[0]?.main, weather.weather[0]?.icon);

  cityNameEl.innerText = weather.name;
  if (cityNameSidebar) cityNameSidebar.innerText = `${weather.name}, ${weather.sys.country}`;
  if (countryCodeEl) countryCodeEl.innerText = weather.sys.country;
  
  if (navDateEl) navDateEl.innerText = new Date((weather.dt + weather.timezone) * 1000).toLocaleDateString([], {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC"
  });

  weatherDescEl.innerText = weather.weather[0].description;
  
  animateTemp(temperatureEl, weather.main.temp);
  if (tempHighEl) tempHighEl.innerText = formatTemperature(weather.main.temp_max);
  if (tempLowEl) tempLowEl.innerText = formatTemperature(weather.main.temp_min);

  windspeedEl.innerText = formatWind(weather.wind.speed);
  humidityEl.innerText = `${weather.main.humidity}%`;
  cloudinessEl.innerText = `${weather.clouds.all}%`;

  feelsLikeEl.innerText = formatTemperature(weather.main.feels_like);
  pressureEl.innerText = `${weather.main.pressure} hPa`;
  visibilityEl.innerText = formatVisibility(weather.visibility);
  sunriseEl.innerText = formatClock(weather.sys.sunrise, weather.timezone);
  sunsetEl.innerText = formatClock(weather.sys.sunset, weather.timezone);
  minMaxEl.innerText = `${formatTemperature(weather.main.temp_min)} / ${formatTemperature(weather.main.temp_max)}`;
  localTimeEl.innerText = `Local time: ${formatClock(weather.dt, weather.timezone)} • ${formatDateTime(weather.dt, weather.timezone)}`;

  renderForecast(forecast);
  renderAlert(weather, forecast);
  syncFavoriteButton();
  reanimate(userInfo);
}

function renderForecast(forecast) {
  renderHourlyForecast(forecast.list.slice(0, 6));
  renderDailyForecast(buildDailyForecast(forecast.list));
}

function renderHourlyForecast(items) {
  hourlyForecast.innerHTML = items
    .map((item) => {
      const rainChance = typeof item.pop === "number" ? `${Math.round(item.pop * 100)}% rain` : "Rain n/a";

      return `
        <article class="forecast-chip">
          <p>${formatClock(item.dt, state.currentWeather.timezone)}</p>
          <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png" alt="${item.weather[0].description}" />
          <strong>${formatTemperature(item.main.temp)}</strong>
          <span>${rainChance}</span>
        </article>
      `;
    })
    .join("");
}

function renderDailyForecast(items) {
  if (!curvePath) return;

  forecastLabels.innerHTML = "";
  forecastTemps.innerHTML = "";

  const containerW = document.querySelector(".forecast-graph").clientWidth || 1000;
  curvePath.setAttribute("d", "");
  
  if (!items.length) return;

  let maxTemp = -Infinity;
  let minTemp = Infinity;
  items.forEach(item => {
    if (item.max > maxTemp) maxTemp = item.max;
    if (item.min < minTemp) minTemp = item.min;
  });

  const range = (maxTemp - minTemp) || 1;
  const paddingY = 20; 
  const availableH = 100 - (paddingY * 2);

  const points = [];
  const svgNS = "http://www.w3.org/2000/svg";
  
  // clear previous points
  document.querySelectorAll(".curve-point").forEach(el => el.remove());

  const svg = document.getElementById("weekly-curve");

  items.forEach((item, index) => {
    const x = (index / (items.length - 1)) * 1000;
    const normalizedY = (item.max - minTemp) / range;
    const y = 100 - paddingY - (normalizedY * availableH);
    points.push({x, y});

    const l = document.createElement("span");
    l.innerText = item.label;
    forecastLabels.appendChild(l);

    const t = document.createElement("span");
    t.innerText = formatTemperature(item.max);
    forecastTemps.appendChild(t);

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", index === 0 ? "7" : "5");
    circle.setAttribute("class", index === 0 ? "curve-point active" : "curve-point");
    svg.appendChild(circle);
  });

  // Calculate bezier curve
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    if (i > 0) {
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      d += ` C ${cp1x},${p0.y} ${cp1x},${p1.y} ${p1.x},${p1.y}`;
    }
  }

  curvePath.setAttribute("d", d);
}

function renderAlert(weather, forecast) {
  const advisories = [];
  const temp = weather.main.temp;
  const wind = weather.wind.speed;
  const currentMain = weather.weather[0]?.main?.toLowerCase() || "";
  const rainChance = Math.round((forecast.list[0]?.pop || 0) * 100);
  const aqiValue = Number(document.querySelector("[data-aqi-value]").innerText);

  if (state.unit === "metric" ? temp >= 35 : temp >= 95) {
    advisories.push("High temperature. Stay hydrated and limit prolonged sun exposure.");
  }

  if (state.unit === "metric" ? temp <= 3 : temp <= 38) {
    advisories.push("Cold conditions ahead. Layer up if you are stepping out.");
  }

  if ((state.unit === "metric" ? wind >= 12 : wind >= 26) || currentMain.includes("thunder")) {
    advisories.push("Windy or stormy conditions expected. Secure loose outdoor items.");
  }

  if (rainChance >= 60 || currentMain.includes("rain")) {
    advisories.push("Rain is likely soon. Carry an umbrella or raincoat.");
  }

  if (aqiValue && aqiValue >= 151) {
    advisories.push("Air quality is unhealthy for some people. Reduce strenuous outdoor activity.");
  }

  if (!advisories.length) {
    alertBanner.hidden = true;
    return;
  }

  alertTitle.innerText = "Weather Advisory";
  alertCopy.innerText = advisories[0];
  alertBanner.hidden = false;
}

/* ================= FAVORITES / RECENT ================= */
function getCityKey(name, country) {
  return `${name}|${country}`.toLowerCase();
}

function addRecentCity(name, country) {
  const item = { name, country };
  const key = getCityKey(name, country);

  state.recentCities = [item, ...state.recentCities.filter((city) => getCityKey(city.name, city.country) !== key)].slice(0, 6);
  localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(state.recentCities));
  renderSavedLists();
}

function toggleFavoriteCity() {
  if (!state.currentWeather) return;

  const city = {
    name: state.currentWeather.name,
    country: state.currentWeather.sys.country,
  };
  const key = getCityKey(city.name, city.country);
  const exists = state.favoriteCities.some((item) => getCityKey(item.name, item.country) === key);

  state.favoriteCities = exists
    ? state.favoriteCities.filter((item) => getCityKey(item.name, item.country) !== key)
    : [city, ...state.favoriteCities].slice(0, 8);

  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favoriteCities));
  renderSavedLists();
  syncFavoriteButton();
}

function syncFavoriteButton() {
  const isFavorite = state.favoriteCities.some(
    (item) => getCityKey(item.name, item.country) === state.currentCityKey
  );

  favoriteBtn.classList.toggle("is-favorite", isFavorite);
  favoriteBtn.innerText = isFavorite ? "★" : "☆";
}

function renderSavedLists() {
  renderChipList(favoritesList, state.favoriteCities, "No favorites yet");
  renderChipList(recentList, state.recentCities, "No recent searches yet");
  if (typeof renderRecentCardsUI === 'function') renderRecentCardsUI(state.recentCities);
}

function renderChipList(container, cities, emptyText) {
  // Legacy list - keep it for favorites compatibility
  container.innerHTML = "";
  if (!cities.length) {
    const placeholder = document.createElement("span");
    placeholder.className = "empty-copy"; placeholder.innerText = emptyText;
    container.appendChild(placeholder);
    return;
  }
  cities.forEach((city) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "saved-chip";
    button.innerText = `${city.name}, ${city.country}`;
    button.addEventListener("click", () => {
      searchPanel.classList.add("hidden");
      searchInput.value = `${city.name}, ${city.country}`;
      fetchWeatherByCity(`${city.name},${city.country}`, true);
    });
    container.appendChild(button);
  });
}

function renderRecentCardsUI(cities) {
  if (!recentCardsEl) return;
  recentCardsEl.innerHTML = "";
  if (!cities.length) {
    recentCardsEl.innerHTML = `<p style="color:rgba(255,255,255,0.6)">No recent searches.</p>`;
    return;
  }
  
  cities.forEach(async (city) => {
    const card = document.createElement("div");
    card.className = "r-card";
    card.innerHTML = `<div class="r-info"><p>${city.name}</p><span>${city.country}</span></div><div class="r-visual"><p>...</p></div>`;
    recentCardsEl.appendChild(card);
    
    // Fetch quick weather for this card
    try {
      const data = await fetchJSON(buildWeatherUrlByCity(`${city.name},${city.country}`));
      card.innerHTML = `
        <div class="r-info">
          <p>${data.name}, ${data.sys.country}</p>
          <span>${data.weather[0].main}</span>
        </div>
        <div class="r-visual">
          <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}.png" alt="${data.weather[0].description}" />
          <strong>${formatTemperature(data.main.temp)}</strong>
        </div>
      `;
      card.addEventListener("click", () => fetchWeatherByCity(`${data.name},${data.sys.country}`, true));
    } catch {
      card.innerHTML = `<div class="r-info"><p>${city.name}</p><span>Error fading</span></div>`;
    }
  });
}

/* ================= ERROR ================= */
function showError(message) {
  hideAll();
  errorMsg.innerText = message;
  errorBox.style.display = "flex";
}

function normalizeError(message) {
  if (!message) return "Unable to fetch weather right now.";
  if (message.toLowerCase().includes("city")) return "City not found. Try a more specific city name.";
  if (message.toLowerCase().includes("nothing to geocode")) return "Enter a city name to search.";
  return message.charAt(0).toUpperCase() + message.slice(1);
}

/* ================= FORMATTERS ================= */
function animateTemp(element, value) {
  const startValue = Number(element.dataset.value || 0);
  const duration = 420;
  const startTime = performance.now();

  function frame(timestamp) {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const current = startValue + (value - startValue) * progress;

    element.innerText = formatTemperature(current);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      element.dataset.value = String(value);
      element.innerText = formatTemperature(value);
    }
  }

  requestAnimationFrame(frame);
}

function formatTemperature(value) {
  const symbol = state.unit === "metric" ? "°C" : "°F";
  return `${Math.round(value)} ${symbol}`;
}

function formatWind(speed) {
  return state.unit === "metric"
    ? `${speed.toFixed(1)} m/s`
    : `${speed.toFixed(1)} mph`;
}

function formatVisibility(visibilityMeters) {
  if (state.unit === "metric") {
    return `${(visibilityMeters / 1000).toFixed(1)} km`;
  }

  return `${(visibilityMeters / 1609.34).toFixed(1)} mi`;
}

function formatClock(unixSeconds, timezoneOffsetSeconds) {
  return new Date((unixSeconds + timezoneOffsetSeconds) * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatDateTime(unixSeconds, timezoneOffsetSeconds) {
  return new Date((unixSeconds + timezoneOffsetSeconds) * 1000).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/* ================= FORECAST HELPERS ================= */
function buildDailyForecast(list) {
  const todayKey = new Date((state.currentWeather.dt + state.currentWeather.timezone) * 1000)
    .toISOString()
    .slice(0, 10);

  const grouped = new Map();

  list.forEach((item) => {
    const key = new Date((item.dt + state.currentWeather.timezone) * 1000).toISOString().slice(0, 10);
    if (key === todayKey) return;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(item);
  });

  return Array.from(grouped.entries())
    .slice(0, 5)
    .map(([key, items]) => {
      const temps = items.map((entry) => entry.main.temp);
      const pivot =
        items.find((entry) => entry.dt_txt.includes("12:00:00")) ||
        items[Math.floor(items.length / 2)];
      const averagePop =
        items.reduce((total, entry) => total + (entry.pop || 0), 0) / Math.max(items.length, 1);

      return {
        label: new Date(`${key}T00:00:00Z`).toLocaleDateString([], {
          weekday: "long",
          timeZone: "UTC",
        }),
        min: Math.min(...temps),
        max: Math.max(...temps),
        icon: pivot.weather[0].icon,
        description: pivot.weather[0].description,
        rainChance: `${Math.round(averagePop * 100)}% rain`,
      };
    });
}

function buildWeatherUrlByCity(city) {
  return `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${state.unit}`;
}

function buildWeatherUrlByCoords({ lat, lon }) {
  return `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${state.unit}`;
}

function buildForecastUrl(lat, lon) {
  return `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${state.unit}`;
}

async function refreshCurrentWeather() {
  if (state.lastTarget?.type === "city" && state.lastTarget.query) {
    await fetchWeatherByCity(state.lastTarget.query, false);
    return;
  }

  if (state.lastTarget?.type === "coords" && state.lastTarget.coords) {
    await fetchWeatherByCoords(state.lastTarget.coords, false);
    return;
  }

  restoreLastView();
}

/* ================= AQI ================= */
async function fetchAQI(lat, lon) {
  try {
    const data = await fetchJSON(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
    );

    if (!data.list || !data.list.length) return showAQINotAvailable();

    const c = data.list[0].components;
    if (!c.pm2_5 && !c.pm10 && !c.co) return showAQINotAvailable();

    const finalAQI = Math.max(
      aqiPM25(c.pm2_5 || 0),
      aqiPM10(c.pm10 || 0),
      aqiCO(c.co || 0)
    );

    const visual = getAQIVisual(finalAQI);
    document.querySelector("[data-aqi-value]").innerText = finalAQI;
    document.querySelector("[data-aqi-emoji]").innerText = visual.emoji;

    const bar = document.querySelector("[data-aqi-fill]");
    bar.style.width = `${Math.min((finalAQI / 500) * 100, 100)}%`;
    bar.style.backgroundColor = visual.color;
  } catch {
    showAQINotAvailable();
  }
}

function showAQINotAvailable() {
  document.querySelector("[data-aqi-value]").innerText = "--";
  document.querySelector("[data-aqi-emoji]").innerText = "✖";
  const bar = document.querySelector("[data-aqi-fill]");
  bar.style.width = "100%";
  bar.style.backgroundColor = "#9ca3af";
}

function calcAQI(Cp, BP_lo, BP_hi, I_lo, I_hi) {
  return Math.round(((I_hi - I_lo) / (BP_hi - BP_lo)) * (Cp - BP_lo) + I_lo);
}

function aqiPM25(pm) {
  if (pm <= 12) return calcAQI(pm, 0, 12, 0, 50);
  if (pm <= 35.4) return calcAQI(pm, 12.1, 35.4, 51, 100);
  if (pm <= 55.4) return calcAQI(pm, 35.5, 55.4, 101, 150);
  if (pm <= 150.4) return calcAQI(pm, 55.5, 150.4, 151, 200);
  if (pm <= 250.4) return calcAQI(pm, 150.5, 250.4, 201, 300);
  return calcAQI(pm, 250.5, 500, 301, 500);
}

function aqiPM10(pm) {
  if (pm <= 54) return calcAQI(pm, 0, 54, 0, 50);
  if (pm <= 154) return calcAQI(pm, 55, 154, 51, 100);
  if (pm <= 254) return calcAQI(pm, 155, 254, 101, 150);
  if (pm <= 354) return calcAQI(pm, 255, 354, 151, 200);
  if (pm <= 424) return calcAQI(pm, 355, 424, 201, 300);
  return calcAQI(pm, 425, 604, 301, 500);
}

function aqiCO(co) {
  const ppm = co / 1145;
  if (ppm <= 4.4) return calcAQI(ppm, 0, 4.4, 0, 50);
  if (ppm <= 9.4) return calcAQI(ppm, 4.5, 9.4, 51, 100);
  if (ppm <= 12.4) return calcAQI(ppm, 9.5, 12.4, 101, 150);
  if (ppm <= 15.4) return calcAQI(ppm, 12.5, 15.4, 151, 200);
  if (ppm <= 30.4) return calcAQI(ppm, 15.5, 30.4, 201, 300);
  return calcAQI(ppm, 30.5, 50.4, 301, 500);
}

function getAQIVisual(aqi) {
  if (aqi <= 50) return { emoji: "😊", color: "#00e400" };
  if (aqi <= 100) return { emoji: "🙂", color: "#ffff00" };
  if (aqi <= 150) return { emoji: "😐", color: "#ff7e00" };
  if (aqi <= 200) return { emoji: "😷", color: "#ff0000" };
  if (aqi <= 300) return { emoji: "☠", color: "#8f3f97" };
  return { emoji: "☠☠", color: "#7e0023" };
}

/* ================= PWA ================= */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Service worker registration can fail on file:// previews.
    });
  });
}

/* ================= RE-ANIMATE ================= */
function reanimate(element) {
  element.classList.remove("active");
  void element.offsetWidth;
  element.classList.add("active");
}
