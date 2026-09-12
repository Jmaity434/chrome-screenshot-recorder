const timerEl = document.getElementById('timer');
const dotEl = document.getElementById('dot');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const bar = document.getElementById('bar');

let startTime = Date.now();
let pausedAt = 0;
let totalPaused = 0;
let isPaused = false;
let timerInterval = null;

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function updateTimer() {
  if (isPaused) return;
  const elapsed = Date.now() - startTime - totalPaused;
  timerEl.textContent = formatTime(elapsed);
}

function startTimer() {
  startTime = Date.now();
  totalPaused = 0;
  isPaused = false;
  timerInterval = setInterval(updateTimer, 250);
  updateTimer();
}

btnPause.addEventListener('click', async () => {
  if (!isPaused) {
    // Pause
    isPaused = true;
    pausedAt = Date.now();
    btnPause.textContent = '▶';
    btnPause.title = 'Resume';
    dotEl.classList.remove('recording');
    dotEl.classList.add('paused');
    await chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING' });
  } else {
    // Resume
    totalPaused += Date.now() - pausedAt;
    isPaused = false;
    btnPause.textContent = '⏸';
    btnPause.title = 'Pause';
    dotEl.classList.remove('paused');
    dotEl.classList.add('recording');
    await chrome.runtime.sendMessage({ type: 'RESUME_RECORDING' });
  }
});

btnStop.addEventListener('click', async () => {
  btnStop.disabled = true;
  btnPause.disabled = true;
  btnStop.textContent = '…';
  if (timerInterval) clearInterval(timerInterval);
  await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
  // Window will be closed by background after save
  setTimeout(() => window.close(), 800);
});

// Listen for external stop (user clicked Stop sharing in Chrome bar)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RECORDING_STOPPED' || msg.type === 'RECORDING_FAILED') {
    if (timerInterval) clearInterval(timerInterval);
    window.close();
  }
});

startTimer();
