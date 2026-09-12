const btnScreenshot = document.getElementById('btn-screenshot');
const btnStart = document.getElementById('btn-start-record');
const btnStop = document.getElementById('btn-stop-record');
const statusEl = document.getElementById('recording-status');
const timerEl = document.getElementById('timer');

let mediaRecorder = null;
let recordedChunks = [];
let startTime = null;
let timerInterval = null;
let stream = null;

// ========== SCREENSHOT ==========
btnScreenshot.addEventListener('click', async () => {
  try {
    btnScreenshot.disabled = true;
    btnScreenshot.textContent = 'Capturing…';

    // Capture the visible tab at high quality
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });

    // Download the image
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-1080p-${timestamp}.png`;

    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false
    });

    btnScreenshot.innerHTML = '<span class="icon">✓</span> Saved!';
    setTimeout(() => {
      btnScreenshot.innerHTML = '<span class="icon">📷</span> Capture Visible Tab';
      btnScreenshot.disabled = false;
    }, 1500);
  } catch (err) {
    console.error('Screenshot error:', err);
    alert('Could not capture screenshot. Make sure you are on a normal webpage.');
    btnScreenshot.innerHTML = '<span class="icon">📷</span> Capture Visible Tab';
    btnScreenshot.disabled = false;
  }
});

// ========== SCREEN RECORDING ==========
btnStart.addEventListener('click', async () => {
  try {
    // Request display media at 1080p
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true, // include system audio if available
      preferCurrentTab: false
    });

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 8000000 // ~8 Mbps for good 1080p quality
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `recording-1080p-${timestamp}.webm`;

      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      });

      // Cleanup
      URL.revokeObjectURL(url);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }

      stopTimer();
      statusEl.classList.add('hidden');
      btnStart.disabled = false;
      btnStop.disabled = true;
      btnStart.innerHTML = '<span class="icon">🎥</span> Start Recording';
    };

    // Handle user clicking "Stop sharing" in the browser bar
    stream.getVideoTracks()[0].onended = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    };

    mediaRecorder.start(1000); // collect data every second
    startTimer();

    btnStart.disabled = true;
    btnStop.disabled = false;
    statusEl.classList.remove('hidden');
  } catch (err) {
    console.error('Recording error:', err);
    if (err.name !== 'NotAllowedError') {
      alert('Could not start recording. Please allow screen access.');
    }
    btnStart.disabled = false;
  }
});

btnStop.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
});

// ========== TIMER ==========
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerEl.textContent = '00:00';
}
