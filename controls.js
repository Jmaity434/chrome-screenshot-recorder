const timerEl = document.getElementById('timer');
const dotEl = document.getElementById('dot');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const stopIcon = document.getElementById('stop-icon');
const stopText = document.getElementById('stop-text');

let startTime = Date.now();
let pausedAt = 0;
let totalPaused = 0;
let isPaused = false;
let isSaving = false;
let timerInterval = null;

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function updateTimer() {
  if (isPaused || isSaving) return;
  const elapsed = Math.max(0, Date.now() - startTime - totalPaused);
  timerEl.textContent = formatTime(elapsed);
}

function startTimer() {
  startTime = Date.now();
  totalPaused = 0;
  isPaused = false;
  isSaving = false;
  timerInterval = setInterval(updateTimer, 250);
  updateTimer();
}

btnPause.addEventListener('click', async () => {
  if (isSaving) return;

  if (!isPaused) {
    // Pause
    isPaused = true;
    pausedAt = Date.now();
    btnPause.textContent = '▶';
    btnPause.title = 'Resume Recording';
    dotEl.classList.remove('recording');
    dotEl.classList.add('paused');
    try {
      await chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING' });
    } catch (_) {}
  } else {
    // Resume
    totalPaused += Date.now() - pausedAt;
    isPaused = false;
    btnPause.textContent = '⏸';
    btnPause.title = 'Pause Recording';
    dotEl.classList.remove('paused');
    dotEl.classList.add('recording');
    try {
      await chrome.runtime.sendMessage({ type: 'RESUME_RECORDING' });
    } catch (_) {}
  }
});

btnStop.addEventListener('click', async () => {
  if (isSaving) return;
  isSaving = true;

  btnStop.disabled = true;
  btnPause.disabled = true;
  stopIcon.innerHTML = '<span class="mini-spinner"></span>';
  stopText.textContent = 'Saving…';

  if (timerInterval) clearInterval(timerInterval);

  try {
    await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
  } catch (_) {}

  // Fallback safety timeout if background event is missed
  setTimeout(() => window.close(), 15000);
});

// Close controls bar when recording stops or fails
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RECORDING_STOPPED' || msg.type === 'RECORDING_FAILED') {
    if (timerInterval) clearInterval(timerInterval);
    window.close();
  }
});

startTimer();

