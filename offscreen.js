let mediaRecorder = null;
let recordedChunks = [];
let stream = null;

function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_OFFSCREEN_RECORDING') {
    startRecording(msg.settings).then(() => sendResponse({ ok: true })).catch(err => {
      console.error(err);
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  if (msg.type === 'STOP_OFFSCREEN_RECORDING') {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    sendResponse({ ok: true });
    return true;
  }
});

async function startRecording(settings = {}) {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;

  const res = getResolution(settings.quality || '1080');
  const mode = settings.mode || 'monitor';

  const options = {
    video: {
      displaySurface: mode === 'browser' ? 'browser' : (mode === 'window' ? 'window' : 'monitor'),
      width: { ideal: res.w, max: res.w },
      height: { ideal: res.h, max: res.h },
      frameRate: { ideal: 30, max: 30 }
    },
    audio: settings.systemAudio !== false,
    preferCurrentTab: mode === 'browser',
    selfBrowserSurface: 'exclude',
    systemAudio: settings.systemAudio !== false ? 'include' : 'exclude'
  };

  try {
    stream = await navigator.mediaDevices.getDisplayMedia(options);
  } catch (e) {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: res.w },
        height: { ideal: res.h },
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

  try {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: res.bitrate,
      audioBitsPerSecond: 192000
    });
  } catch (e) {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: Math.min(res.bitrate, 8000000)
    });
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    try {
      if (recordedChunks.length === 0) {
        chrome.runtime.sendMessage({ type: 'RECORDING_FAILED', error: 'No data' });
        return;
      }

      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const q = settings.quality || '1080';

      await chrome.downloads.download({
        url,
        filename: `recording-${q}p-${timestamp}.webm`,
        saveAs: false
      });

      setTimeout(() => URL.revokeObjectURL(url), 5000);

      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }

      chrome.runtime.sendMessage({ type: 'RECORDING_STOPPED' });
    } catch (err) {
      console.error(err);
      chrome.runtime.sendMessage({ type: 'RECORDING_FAILED', error: err.message });
    }
  };

  stream.getVideoTracks()[0].addEventListener('ended', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  });

  mediaRecorder.start(1000);
  chrome.runtime.sendMessage({ type: 'RECORDING_STARTED' });
}
