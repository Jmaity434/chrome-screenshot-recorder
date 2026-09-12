let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let startTime = null;
let timerInterval = null;

const timerEl = document.getElementById('timer');
const btnStop = document.getElementById('btn-stop');

function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}

function getResolution(quality) {
  const map = {
    '720':  { w: 1280, h: 720,  bitrate: 6000000 },
    '1080': { w: 1920, h: 1080, bitrate: 12000000 },
    '1440': { w: 2560, h: 1440, bitrate: 18000000 }
  };
  return map[quality] || map['1080'];
}

async function startRecording() {
  try {
    // Load settings from popup
    const data = await chrome.storage.local.get('recSettings');
    const settings = data.recSettings || { mode: 'monitor', quality: '1080', mic: true, systemAudio: true };
    const res = getResolution(settings.quality);

    const displayMediaOptions = {
      video: {
        displaySurface: settings.mode === 'browser' ? 'browser' : (settings.mode === 'window' ? 'window' : 'monitor'),
        width: { ideal: res.w, max: res.w },
        height: { ideal: res.h, max: res.h },
        frameRate: { ideal: 30, max: 30 },
        cursor: 'always'
      },
      audio: settings.systemAudio || settings.mic ? {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100
      } : false,
      preferCurrentTab: settings.mode === 'browser',
      selfBrowserSurface: 'exclude',
      systemAudio: settings.systemAudio ? 'include' : 'exclude'
    };

    try {
      stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch (e) {
      // Fallback video only
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: res.w, max: res.w },
          height: { ideal: res.h, max: res.h },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({
          width: { ideal: res.w },
          height: { ideal: res.h },
          frameRate: { ideal: 30 }
        });
      } catch (_) {}
    }

    recordedChunks = [];
    const mimeType = getSupportedMimeType();

    let mediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: res.bitrate,
      audioBitsPerSecond: 192000
    };

    try {
      mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
    } catch (e) {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: Math.min(res.bitrate, 8000000)
      });
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      alert('Recording error. Please try again.');
    };

    mediaRecorder.onstop = async () => {
      try {
        if (recordedChunks.length === 0) {
          alert('No video data recorded.');
          window.close();
          return;
        }

        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const qLabel = settings.quality || '1080';

        await chrome.downloads.download({
          url,
          filename: `recording-${qLabel}p-${timestamp}.webm`,
          saveAs: false
        });

        setTimeout(() => URL.revokeObjectURL(url), 5000);

        if (stream) {
          stream.getTracks().forEach(t => t.stop());
          stream = null;
        }
        if (timerInterval) clearInterval(timerInterval);

        setTimeout(() => window.close(), 400);
      } catch (err) {
        console.error(err);
        alert('Failed to save recording.');
      }
    };

    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    });

    mediaRecorder.start(1000);
    startTimer();
  } catch (err) {
    console.error(err);
    let msg = 'Recording cancelled or permission denied.';
    if (err.name === 'NotAllowedError') msg = 'Permission denied. Please allow screen sharing.';
    alert(msg);
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

startRecording();
