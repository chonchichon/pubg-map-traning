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

const MAP_METERS = 1000;
const MAX_DISTANCE = 700;
const MIN_DISTANCE = 100;

let currentMode = "practice";
let currentRound = null;
let measurePoints = { a: null, b: null };
let rounds = 0;
let streak = 0;
let totalError = 0;
let answered = false;

function randomPoint() {
  return {
    x: Math.random() * 86 + 7,
    y: Math.random() * 86 + 7,
  };
}

function pointFromClick(event) {
  const rect = mapGrid.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
  };
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
  const rect = mapGrid.getBoundingClientRect();
  const ax = (a.x / 100) * rect.width;
  const ay = (a.y / 100) * rect.height;
  const bx = (b.x / 100) * rect.width;
  const by = (b.y / 100) * rect.height;
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
  if (error <= 25) {
    return {
      className: "correct",
      title: "Chuẩn như ping marker.",
      kicker: "Đúng",
      text: "Sai số cực thấp. Đây là mức nên giữ khi call khoảng cách trong combat.",
    };
  }

  if (error <= 50) {
    return {
      className: "close",
      title: "Rất gần.",
      kicker: "Gần đúng",
      text: "Sai số vẫn dùng tốt trong game. Thử nhìn thêm số ô chéo để ổn định hơn.",
    };
  }

  if (error <= 100) {
    return {
      className: "close",
      title: "Ổn, nhưng còn lệch.",
      kicker: "Cần chỉnh",
      text: "Bạn đang lệch khoảng một ô grid. Nhớ mỗi ô là 100m và đường chéo dài hơn cạnh.",
    };
  }

  return {
    className: "wrong",
    title: "Lệch khá xa.",
    kicker: "Sai",
    text: "Hãy đếm ô ngang, ô dọc trước rồi mới ước lượng đường chéo giữa A và B.",
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
  const accuracy = Math.max(0, Math.round(100 - (error / MAX_DISTANCE) * 100));
  const result = evaluate(error);
  const isCorrect = error <= 25;

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
mapGrid.addEventListener("click", handleMeasureClick);
nextBtn.addEventListener("click", renderRound);
resetMeasureBtn.addEventListener("click", resetMeasure);
window.addEventListener("resize", () => {
  if (currentMode === "practice" && answered) revealLine(currentRound.a, currentRound.b);
  if (currentMode === "measure" && measurePoints.a && measurePoints.b) {
    revealLine(measurePoints.a, measurePoints.b);
  }
});

setMode("practice");
