let mediaRecorder = null;
let recordedChunks = [];
let stream = null;
let micStream = null;
let audioCtx = null;
let currentSettings = {};

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
    startRecording(msg.settings)
      .then(() => sendResponse({ ok: true }))
      .catch(err => {
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

  if (msg.type === 'PAUSE_OFFSCREEN_RECORDING') {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'RESUME_OFFSCREEN_RECORDING') {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
    }
    sendResponse({ ok: true });
    return true;
  }
});

async function startRecording(settings = {}) {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;

  currentSettings = settings;
  const res = getResolution(settings.quality || '1080');
  const mode = settings.mode || 'monitor';

  // selfBrowserSurface: 'exclude' → control bar window will NOT appear in the video
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
      audio: false,
      selfBrowserSurface: 'exclude'
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

  // Handle microphone audio if requested
  micStream = null;
  audioCtx = null;
  if (settings.mic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
    } catch (micErr) {
      console.warn('Microphone permission denied or unavailable:', micErr);
    }
  }

  // Combine video and audio tracks (with mixing if both mic and system audio are present)
  let recordStream = stream;
  const sysAudioTracks = stream.getAudioTracks();

  if (micStream && sysAudioTracks.length > 0) {
    try {
      audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(dest);

      const sysSource = audioCtx.createMediaStreamSource(new MediaStream([sysAudioTracks[0]]));
      sysSource.connect(dest);

      recordStream = new MediaStream([
        videoTrack,
        dest.stream.getAudioTracks()[0]
      ]);
    } catch (mixErr) {
      console.warn('Audio mixing failed, falling back to mic audio:', mixErr);
      recordStream = new MediaStream([videoTrack, micStream.getAudioTracks()[0]]);
    }
  } else if (micStream) {
    recordStream = new MediaStream([videoTrack, micStream.getAudioTracks()[0]]);
  }

  recordedChunks = [];
  const mimeType = getSupportedMimeType();

  try {
    mediaRecorder = new MediaRecorder(recordStream, {
      mimeType,
      videoBitsPerSecond: res.bitrate,
      audioBitsPerSecond: 192000
    });
  } catch (e) {
    mediaRecorder = new MediaRecorder(recordStream, {
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
      const captureId = 'rec_' + Date.now();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const q = currentSettings.quality || '1080';
      const filename = `recording-${q}p-${timestamp}.webm`;

      await saveCapture({
        id: captureId,
        type: 'video',
        blob: blob,
        filename: filename,
        mimeType: 'video/webm',
        createdAt: Date.now()
      });

      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
      if (audioCtx) {
        try { await audioCtx.close(); } catch (_) {}
        audioCtx = null;
      }
      mediaRecorder = null;

      chrome.runtime.sendMessage({
        type: 'RECORDING_STOPPED',
        captureId: captureId
      });
    } catch (err) {
      console.error(err);
      chrome.runtime.sendMessage({ type: 'RECORDING_FAILED', error: err.message });
    }
  };

  videoTrack.addEventListener('ended', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  });

  mediaRecorder.start(1000);
  chrome.runtime.sendMessage({ type: 'RECORDING_STARTED' });
}
