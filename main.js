/* ================= SELECTORS ================= */
const userTab = document.querySelector("[data-userWeather]");
const searchTab = document.querySelector("[data-searchWeather]");
const grantContainer = document.querySelector(".grant-location-container");
const searchForm = document.querySelector("[data-searchForm]");
const searchInput = document.querySelector("[data-searchInput]");
const loading = document.querySelector(".loading-container");
const userInfo = document.querySelector(".user-info-container");
const errorBox = document.querySelector(".error-container");
const errorMsg = document.querySelector("[data-errorMessage]");
const themeBtn = document.querySelector("[data-themeToggle]");
const wrapper = document.querySelector(".wrapper");

const API_KEY = "3d6b3bc817ad02eb2818c0ad867eb7c3";

/* ================= INITIAL STATE ================= */
let currentTab = userTab;
currentTab.classList.add("current-tab");
searchForm.classList.remove("active");
getFromSession();

/* ================= THEME ================= */
themeBtn.addEventListener("click", () => {
  wrapper.classList.toggle("light");
  themeBtn.innerText = wrapper.classList.contains("light") ? "☀️" : "🌙";
});

/* ================= TAB SWITCH ================= */
userTab.addEventListener("click", () => switchTab(userTab));
searchTab.addEventListener("click", () => switchTab(searchTab));

function switchTab(tab) {
  if (tab === currentTab) return;

  currentTab.classList.remove("current-tab");
  tab.classList.add("current-tab");
  currentTab = tab;

  hideAll();

  if (tab === searchTab) {
    searchForm.classList.add("active");
  } else {
    getFromSession();
  }
}

/* ================= UI HELPERS ================= */
function hideAll() {
  grantContainer.classList.remove("active");
  searchForm.classList.remove("active");
  loading.classList.remove("active");
  userInfo.classList.remove("active");
  errorBox.classList.remove("active");
}

/* ================= SESSION ================= */
function getFromSession() {
  hideAll();
  const coords = sessionStorage.getItem("user-coordinates");

  if (!coords) {
    grantContainer.classList.add("active");
  } else {
    fetchWeatherByCoords(JSON.parse(coords));
  }
}

/* ================= LOCATION ================= */
document.querySelector("[data-grantAccess]").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const coords = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
      sessionStorage.setItem("user-coordinates", JSON.stringify(coords));
      fetchWeatherByCoords(coords);
    },
    () => showError("Location access denied")
  );
});

/* ================= FETCH BY COORDS ================= */
async function fetchWeatherByCoords({ lat, lon }) {
  hideAll();
  loading.classList.add("active");

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
    );
    const data = await res.json();

    if (data.cod !== 200) throw new Error();

    renderWeather(data);
  } catch {
    showError("Unable to fetch weather");
  }
}

/* ================= SEARCH ================= */
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = searchInput.value.trim();
  if (!city) return;
  fetchWeatherByCity(city);
});

async function fetchWeatherByCity(city) {
  hideAll();
  loading.classList.add("active");

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`
    );
    const data = await res.json();

    if (data.cod !== 200) throw new Error();

    renderWeather(data);
  } catch {
    showError("City not found");
  }
}

/* ================= RENDER WEATHER ================= */
function renderWeather(data) {
  hideAll();
  userInfo.classList.add("active");

  document.querySelector("[data-cityName]").innerText = data.name;
  document.querySelector("[data-countryIcon]").src =
    `https://flagcdn.com/48x36/${data.sys.country.toLowerCase()}.png`;

  document.querySelector("[data-weatherDesc]").innerText =
    data.weather[0].description;

  document.querySelector("[data-weatherIcon]").src =
    `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;

  animateTemp(document.querySelector("[data-temrature]"), data.main.temp);

  document.querySelector("[data-windspeed]").innerText =
    `${data.wind.speed} m/s`;
  document.querySelector("[data-humidity]").innerText =
    `${data.main.humidity}%`;
  document.querySelector("[data-cloudiness]").innerText =
    `${data.clouds.all}%`;

  fetchAQI(data.coord.lat, data.coord.lon);
  reanimate(userInfo);
}

/* ================= ERROR ================= */
function showError(msg) {
  hideAll();
  errorMsg.innerText = msg;
  errorBox.classList.add("active");
}

/* ================= TEMP ANIMATION ================= */
function animateTemp(el, value) {
  let start = 0;
  const step = value / 40;

  const i = setInterval(() => {
    start += step;
    if (start >= value) {
      el.innerText = `${value.toFixed(1)} °C`;
      clearInterval(i);
    } else {
      el.innerText = `${start.toFixed(1)} °C`;
    }
  }, 20);
}

/* ================= AQI ================= */
async function fetchAQI(lat, lon) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
    );
    const data = await res.json();

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
  document.querySelector("[data-aqi-emoji]").innerText = "❌";
  const bar = document.querySelector("[data-aqi-fill]");
  bar.style.width = "100%";
  bar.style.backgroundColor = "#9ca3af";
}

/* ================= AQI CALC HELPERS ================= */
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
  if (aqi <= 300) return { emoji: "☠️", color: "#8f3f97" };
  return { emoji: "☠️☠️", color: "#7e0023" };
}

/* ================= RE-ANIMATE ================= */
function reanimate(el) {
  el.classList.remove("active");
  void el.offsetWidth;
  el.classList.add("active");
}
