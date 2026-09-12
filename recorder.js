let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let startTime = null;
let timerInterval = null;

const timerEl = document.getElementById('timer');
const btnStop = document.getElementById('btn-stop');

// Listen for the stream coming from the popup via chrome.runtime
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING' && message.streamId) {
    // We cannot transfer MediaStream directly via messaging easily.
    // So we use a different approach: the popup will open this window
    // AFTER getting the stream, and we use a global workaround.
  }
});

// Better approach: the popup will store the stream temporarily using
// a shared technique. Since MediaStream can't be passed via message,
// we will start getDisplayMedia FROM this recorder window itself.

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true
    });

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 8000000
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
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

      URL.revokeObjectURL(url);

      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }

      // Close this window after saving
      window.close();
    };

    // If user clicks "Stop sharing" in the Chrome bar
    stream.getVideoTracks()[0].onended = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    };

    mediaRecorder.start(1000);
    startTimer();
  } catch (err) {
    console.error(err);
    alert('Recording cancelled or permission denied.');
    window.close();
  }
}

btnStop.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
});

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

// Auto-start when this window opens
startRecording();
