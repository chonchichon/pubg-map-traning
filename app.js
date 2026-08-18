const mapFrame = document.querySelector(".map-frame");
const mapGrid = document.querySelector("#mapGrid");
const markerA = document.querySelector("#markerA");
const markerB = document.querySelector("#markerB");
const pulseA = document.querySelector("#pulseA");
const pulseB = document.querySelector("#pulseB");
const distanceLine = document.querySelector("#distanceLine");
const guessForm = document.querySelector("#guessForm");
const guessInput = document.querySelector("#guessInput");
const resultCard = document.querySelector("#resultCard");
const nextBtn = document.querySelector("#nextBtn");
const roundCount = document.querySelector("#roundCount");
const streakCount = document.querySelector("#streakCount");
const avgError = document.querySelector("#avgError");
const meterFill = document.querySelector("#meterFill");
const accuracyText = document.querySelector("#accuracyText");
const tabPractice = document.querySelector("#tabPractice");
const tabMeasure = document.querySelector("#tabMeasure");
const practicePanel = document.querySelector("#practicePanel");
const measurePanel = document.querySelector("#measurePanel");
const measureResult = document.querySelector("#measureResult");
const measureDistance = document.querySelector("#measureDistance");
const resetMeasureBtn = document.querySelector("#resetMeasureBtn");
const markerSizeInput = document.querySelector("#markerSizeInput");
const markerSizeValue = document.querySelector("#markerSizeValue");

const MAP_METERS = 1000;
const MAX_DISTANCE = 1000;
const MIN_DISTANCE = 100;
const HIT_WINDOW = 10;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3;

let currentMode = "practice";
let currentRound = null;
let measurePoints = { a: null, b: null };
let rounds = 0;
let streak = 0;
let totalError = 0;
let answered = false;
let mapView = {
  zoom: 1,
  panX: 0,
  panY: 0,
};
let mapDrag = {
  active: false,
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomPoint() {
  return {
    x: Math.random() * 86 + 7,
    y: Math.random() * 86 + 7,
  };
}

function pointFromClick(event) {
  const rect = mapFrame.getBoundingClientRect();
  const localX = (event.clientX - rect.left - mapView.panX) / mapView.zoom;
  const localY = (event.clientY - rect.top - mapView.panY) / mapView.zoom;
  return {
    x: clamp((localX / mapGrid.offsetWidth) * 100, 0, 100),
    y: clamp((localY / mapGrid.offsetHeight) * 100, 0, 100),
  };
}

function clampMapPan() {
  const frameWidth = mapFrame.clientWidth;
  const frameHeight = mapFrame.clientHeight;
  const scaledWidth = mapGrid.offsetWidth * mapView.zoom;
  const scaledHeight = mapGrid.offsetHeight * mapView.zoom;

  if (scaledWidth <= frameWidth) {
    mapView.panX = (frameWidth - scaledWidth) / 2;
  } else {
    mapView.panX = clamp(mapView.panX, frameWidth - scaledWidth, 0);
  }

  if (scaledHeight <= frameHeight) {
    mapView.panY = (frameHeight - scaledHeight) / 2;
  } else {
    mapView.panY = clamp(mapView.panY, frameHeight - scaledHeight, 0);
  }
}

function updateMapTransform() {
  clampMapPan();
  mapGrid.style.transform = `translate(${mapView.panX}px, ${mapView.panY}px) scale(${mapView.zoom})`;
}

function updateMarkerSize() {
  const sizePercent = Number(markerSizeInput.value);
  document.documentElement.style.setProperty("--marker-scale", String(sizePercent / 100));
  markerSizeValue.textContent = `${sizePercent}% ô`;
}

function handleMapWheel(event) {
  event.preventDefault();
  const rect = mapFrame.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const previousZoom = mapView.zoom;
  const nextZoom = clamp(previousZoom * Math.exp(-event.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);

  if (nextZoom === previousZoom) return;

  const mapX = (pointerX - mapView.panX) / previousZoom;
  const mapY = (pointerY - mapView.panY) / previousZoom;
  mapView.zoom = nextZoom;
  mapView.panX = pointerX - mapX * nextZoom;
  mapView.panY = pointerY - mapY * nextZoom;
  updateMapTransform();
}

function startMapDrag(event) {
  if (event.button !== 2) return;

  event.preventDefault();
  mapDrag = {
    active: true,
    startX: event.clientX,
    startY: event.clientY,
    startPanX: mapView.panX,
    startPanY: mapView.panY,
  };
  mapFrame.classList.add("is-panning");
}

function dragMap(event) {
  if (!mapDrag.active) return;

  mapView.panX = mapDrag.startPanX + event.clientX - mapDrag.startX;
  mapView.panY = mapDrag.startPanY + event.clientY - mapDrag.startY;
  updateMapTransform();
}

function stopMapDrag() {
  if (!mapDrag.active) return;

  mapDrag.active = false;
  mapFrame.classList.remove("is-panning");
}

function distanceMeters(a, b) {
  const dx = ((a.x - b.x) / 100) * MAP_METERS;
  const dy = ((a.y - b.y) / 100) * MAP_METERS;
  return Math.hypot(dx, dy);
}

function makeRound() {
  let a = randomPoint();
  let b = randomPoint();
  let distance = distanceMeters(a, b);

  while (distance > MAX_DISTANCE || distance < MIN_DISTANCE) {
    a = randomPoint();
    b = randomPoint();
    distance = distanceMeters(a, b);
  }

  return { a, b, distance: Math.round(distance) };
}

function placeElement(element, point) {
  element.style.left = `${point.x}%`;
  element.style.top = `${point.y}%`;
}

function resetAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function hidePoint(element, pulse) {
  element.style.left = "-20%";
  element.style.top = "-20%";
  pulse.style.left = "-20%";
  pulse.style.top = "-20%";
}

function showPoint(marker, pulse, point) {
  [marker, pulse].forEach((element) => placeElement(element, point));
  resetAnimation(marker, "drop");
}

function hideLine() {
  distanceLine.classList.remove("reveal");
  distanceLine.style.width = "0";
}

function revealLine(a, b) {
  const ax = (a.x / 100) * mapGrid.offsetWidth;
  const ay = (a.y / 100) * mapGrid.offsetHeight;
  const bx = (b.x / 100) * mapGrid.offsetWidth;
  const by = (b.y / 100) * mapGrid.offsetHeight;
  const dx = bx - ax;
  const dy = by - ay;
  const pixelLength = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  distanceLine.style.left = `${ax}px`;
  distanceLine.style.top = `${ay}px`;
  distanceLine.style.width = `${pixelLength}px`;
  distanceLine.style.transform = `rotate(${angle}deg)`;
  resetAnimation(distanceLine, "reveal");
}

function renderRound() {
  currentRound = makeRound();
  answered = false;
  guessInput.value = "";
  guessInput.disabled = false;
  guessInput.focus();
  hideLine();
  resultCard.className = "result-card";
  resultCard.innerHTML = `
    <p class="result-kicker">Lượt mới</p>
    <strong>Đo khoảng cách bằng grid 100m.</strong>
    <span>Nhập số mét bạn đoán.</span>
  `;
  meterFill.style.width = "0%";
  accuracyText.textContent = "--";
  showPoint(markerA, pulseA, currentRound.a);
  showPoint(markerB, pulseB, currentRound.b);
}

function resetMeasure() {
  measurePoints = { a: null, b: null };
  hideLine();
  hidePoint(markerA, pulseA);
  hidePoint(markerB, pulseB);
  measureDistance.textContent = "--";
  measureResult.className = "result-card measure-card";
  measureResult.innerHTML = `
    <p class="result-kicker">Đang chờ chọn điểm</p>
    <strong>Click vào map để đặt A.</strong>
    <span>Sau đó click lần nữa để đặt B và xem khoảng cách cụ thể.</span>
  `;
}

function setMode(mode) {
  currentMode = mode;
  const isPractice = mode === "practice";
  tabPractice.classList.toggle("active", isPractice);
  tabMeasure.classList.toggle("active", !isPractice);
  tabPractice.setAttribute("aria-selected", String(isPractice));
  tabMeasure.setAttribute("aria-selected", String(!isPractice));
  practicePanel.classList.toggle("active", isPractice);
  measurePanel.classList.toggle("active", !isPractice);
  mapGrid.classList.toggle("measure-mode", !isPractice);

  if (isPractice) {
    renderRound();
  } else {
    resetMeasure();
  }
}

function evaluate(error) {
  if (error <= 1) {
    return {
      className: "correct",
      title: "Perfect shot.",
      kicker: "Không lệch",
      text: "Sai số gần như bằng 0m. Call khoảng cách kiểu này là quá sạch.",
    };
  }

  if (error <= 3) {
    return {
      className: "correct",
      title: "Chết luôn.",
      kicker: "1-3m",
      text: "Sai số cực nhỏ. Mức này coi như bắn trúng tâm.",
    };
  }

  if (error <= 5) {
    return {
      className: "close",
      title: "Gần chết.",
      kicker: "3-5m",
      text: "Ước lượng rất sát. Chỉ cần chỉnh thêm một chút là vào vùng kết liễu.",
    };
  }

  if (error <= HIT_WINDOW) {
    return {
      className: "close",
      title: "Dính tí dmg.",
      kicker: "5-10m",
      text: "Bạn vẫn nằm trong vùng trúng, nhưng chưa đủ chính xác để kết thúc gọn.",
    };
  }

  return {
    className: "wrong",
    title: "Sai.",
    kicker: "Sai",
    text: "Sai số quá 10m. Hãy đếm ô ngang, ô dọc trước rồi mới ước lượng đường chéo.",
  };
}

function updateStats(error, isCorrect) {
  rounds += 1;
  totalError += error;
  streak = isCorrect ? streak + 1 : 0;
  roundCount.textContent = rounds;
  streakCount.textContent = streak;
  avgError.textContent = `${Math.round(totalError / rounds)}m`;
}

function handleMeasureClick(event) {
  if (currentMode !== "measure") return;

  const point = pointFromClick(event);
  if (!measurePoints.a || measurePoints.b) {
    measurePoints = { a: point, b: null };
    hideLine();
    showPoint(markerA, pulseA, point);
    hidePoint(markerB, pulseB);
    measureDistance.textContent = "--";
    measureResult.innerHTML = `
      <p class="result-kicker">Đã đặt A</p>
      <strong>Click vị trí thứ hai để đặt B.</strong>
      <span>Khoảng cách sẽ hiện ngay sau khi có đủ hai điểm.</span>
    `;
    return;
  }

  measurePoints.b = point;
  const distance = Math.round(distanceMeters(measurePoints.a, measurePoints.b));
  showPoint(markerB, pulseB, point);
  revealLine(measurePoints.a, measurePoints.b);
  measureDistance.textContent = `${distance}m`;
  measureResult.className = "result-card correct measure-card";
  measureResult.innerHTML = `
    <p class="result-kicker">Đã đo xong</p>
    <strong>A đến B: ${distance}m.</strong>
    <span>Click tiếp trên map để bắt đầu cặp điểm mới.</span>
  `;
}

guessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (answered) {
    renderRound();
    return;
  }

  const guess = Number(guessInput.value);
  if (!Number.isFinite(guess)) return;

  const error = Math.abs(Math.round(guess) - currentRound.distance);
  const accuracy = Math.max(0, Math.round(100 - (error / HIT_WINDOW) * 100));
  const result = evaluate(error);
  const isCorrect = error <= HIT_WINDOW;

  answered = true;
  guessInput.disabled = true;
  revealLine(currentRound.a, currentRound.b);
  updateStats(error, isCorrect);
  resultCard.className = `result-card ${result.className}`;
  resultCard.innerHTML = `
    <p class="result-kicker">${result.kicker}</p>
    <strong>${result.title}</strong>
    <span>Bạn đoán ${Math.round(guess)}m. Đáp án: ${currentRound.distance}m. Sai số: ${error}m.</span>
    <span>${result.text}</span>
  `;
  meterFill.style.width = `${accuracy}%`;
  accuracyText.textContent = `${accuracy}%`;
});

tabPractice.addEventListener("click", () => setMode("practice"));
tabMeasure.addEventListener("click", () => setMode("measure"));
markerSizeInput.addEventListener("input", updateMarkerSize);
mapFrame.addEventListener("wheel", handleMapWheel, { passive: false });
mapFrame.addEventListener("mousedown", startMapDrag);
mapFrame.addEventListener("contextmenu", (event) => event.preventDefault());
mapGrid.addEventListener("click", handleMeasureClick);
nextBtn.addEventListener("click", renderRound);
resetMeasureBtn.addEventListener("click", resetMeasure);
window.addEventListener("mousemove", dragMap);
window.addEventListener("mouseup", stopMapDrag);
window.addEventListener("resize", () => {
  updateMapTransform();
  if (currentMode === "practice" && answered) revealLine(currentRound.a, currentRound.b);
  if (currentMode === "measure" && measurePoints.a && measurePoints.b) {
    revealLine(measurePoints.a, measurePoints.b);
  }
});

updateMapTransform();
updateMarkerSize();
setMode("practice");
