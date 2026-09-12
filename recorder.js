let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let startTime = null;
let timerInterval = null;

const timerEl = document.getElementById('timer');
const btnStop = document.getElementById('btn-stop');

// Find the best supported MIME type
function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/webm';
}

async function startRecording() {
  try {
    // High quality constraints
    const displayMediaOptions = {
      video: {
        displaySurface: 'monitor', // prefer full screen if possible
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
        cursor: 'always'
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100
      },
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      systemAudio: 'include'
    };

    // First try with audio
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch (audioErr) {
      console.warn('Audio not available, trying video only:', audioErr);
      // Fallback: video only
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });
    }

    // Force highest quality on the track if possible
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      console.log('Actual capture settings:', settings);

      // Try to apply constraints again
      try {
        await videoTrack.applyConstraints({
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        });
      } catch (e) {
        console.warn('Could not apply extra constraints:', e);
      }
    }

    recordedChunks = [];
    const mimeType = getSupportedMimeType();
    console.log('Using MIME type:', mimeType);

    const options = {
      mimeType: mimeType,
      videoBitsPerSecond: 12000000, // 12 Mbps for high quality 1080p
      audioBitsPerSecond: 192000
    };

    // Some browsers throw if bitsPerSecond is not supported with certain codecs
    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      console.warn('High bitrate failed, trying lower:', e);
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 8000000
      });
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      alert('Recording error occurred. Please try again.');
    };

    mediaRecorder.onstop = async () => {
      try {
        if (recordedChunks.length === 0) {
          alert('No video data recorded. Please try again.');
          window.close();
          return;
        }

        const blob = new Blob(recordedChunks, { type: mimeType.split(';')[0] });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recording-1080p-${timestamp}.webm`;

        await chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: false
        });

        // Cleanup after a short delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 5000);

        if (stream) {
          stream.getTracks().forEach(t => t.stop());
          stream = null;
        }

        if (timerInterval) clearInterval(timerInterval);

        // Close window
        setTimeout(() => window.close(), 400);
      } catch (err) {
        console.error('Save error:', err);
        alert('Failed to save the recording.');
      }
    };

    // When user clicks "Stop sharing" in the Chrome UI
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    });

    // Start recording — collect data every 1 second
    mediaRecorder.start(1000);
    startTimer();

    console.log('Recording started successfully');
  } catch (err) {
    console.error('Recording failed:', err);

    let message = 'Recording cancelled or permission denied.';
    if (err.name === 'NotAllowedError') {
      message = 'Permission denied. Please allow screen sharing.';
    } else if (err.name === 'NotFoundError') {
      message = 'No screen source found.';
    } else if (err.name === 'NotSupportedError') {
      message = 'Screen recording is not supported in this browser.';
    }

    alert(message);
    window.close();
  }
}

btnStop.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    btnStop.disabled = true;
    btnStop.textContent = 'Saving…';
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
