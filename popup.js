// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('tab-active');
      t.classList.add('text-slate-500');
    });
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    tab.classList.add('tab-active');
    tab.classList.remove('text-slate-500');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ===== HELPERS =====
async function downloadDataUrl(dataUrl, prefix) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await chrome.downloads.download({
    url: dataUrl,
    filename: `${prefix}-${timestamp}.png`,
    saveAs: false
  });
}

// ===== SCREENSHOT: Visible Part =====
document.getElementById('btn-visible').addEventListener('click', async () => {
  const btn = document.getElementById('btn-visible');
  try {
    btn.disabled = true;
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });
    await downloadDataUrl(dataUrl, 'screenshot-visible');
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="text-xl">✓</span><span class="text-[11px] font-medium text-slate-700">Saved!</span>';
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 1200);
  } catch (err) {
    console.error(err);
    alert('Could not capture. Try a normal webpage.');
    btn.disabled = false;
  }
});

// ===== SCREENSHOT: Full Page =====
async function doFullPageCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const dimResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    })
  });
  const { height, viewportHeight, viewportWidth } = dimResults[0].result;
  const maxHeight = Math.min(height, 12000);
  const canvas = new OffscreenCanvas(viewportWidth, maxHeight);
  const ctx = canvas.getContext('2d');
  let y = 0;
  while (y < maxHeight) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (scrollY) => window.scrollTo(0, scrollY),
      args: [y]
    });
    await new Promise(r => setTimeout(r, 220));
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });
    const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
    const drawHeight = Math.min(viewportHeight, maxHeight - y);
    ctx.drawImage(img, 0, 0, viewportWidth, drawHeight, 0, y, viewportWidth, drawHeight);
    y += viewportHeight;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.scrollTo(0, 0)
  });
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return URL.createObjectURL(blob);
}

document.getElementById('btn-fullpage').addEventListener('click', async () => {
  const btn = document.getElementById('btn-fullpage');
  const orig = btn.innerHTML;
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="text-xl">⏳</span><span class="text-[11px] font-medium text-slate-700">Capturing…</span>';
    const objectUrl = await doFullPageCapture();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await chrome.downloads.download({
      url: objectUrl,
      filename: `screenshot-fullpage-${timestamp}.png`,
      saveAs: false
    });
    btn.innerHTML = '<span class="text-xl">✓</span><span class="text-[11px] font-medium text-slate-700">Saved!</span>';
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 1200);
  } catch (err) {
    console.error(err);
    alert('Full page capture failed.');
    btn.innerHTML = orig;
    btn.disabled = false;
  }
});

// ===== SCREENSHOT: Selected Area =====
document.getElementById('btn-region').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js']
    });
    window.close();
  } catch (err) {
    console.error(err);
    alert('Could not start region selection.');
  }
});

// ===== SCREENSHOT: Delay =====
document.getElementById('btn-delay').addEventListener('click', async () => {
  const btn = document.getElementById('btn-delay');
  const orig = btn.innerHTML;
  try {
    btn.disabled = true;
    for (let i = 3; i > 0; i--) {
      btn.innerHTML = `<span>⏱️</span><span>Capturing in ${i}s…</span>`;
      await new Promise(r => setTimeout(r, 1000));
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });
    await downloadDataUrl(dataUrl, 'screenshot-delay');
    btn.innerHTML = `<span>✓</span><span>Saved!</span>`;
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 1000);
  } catch (err) {
    console.error(err);
    btn.innerHTML = orig;
    btn.disabled = false;
  }
});

// ===== SCREENSHOT: Entire Screen =====
document.getElementById('btn-desktop-shot').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    const track = stream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);
    const bitmap = await imageCapture.grabFrame();
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await chrome.downloads.download({
      url,
      filename: `screenshot-screen-${timestamp}.png`,
      saveAs: false
    });
    track.stop();
    stream.getTracks().forEach(t => t.stop());
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch (err) {
    if (err.name !== 'NotAllowedError') alert('Could not capture entire screen.');
  }
});

// ===== RECORD MODE =====
let selectedMode = 'monitor';
document.querySelectorAll('.rec-mode').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.rec-mode').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedMode = card.dataset.mode;
  });
});

// ===== START RECORDING (NO EXTRA WINDOW) =====
document.getElementById('btn-start-record').addEventListener('click', async () => {
  const btn = document.getElementById('btn-start-record');
  const quality = document.getElementById('quality-select').value;
  const mic = document.getElementById('toggle-mic').checked;
  const systemAudio = document.getElementById('toggle-system-audio').checked;

  btn.disabled = true;
  btn.textContent = 'Starting…';

  try {
    // Start recording via background → offscreen (no visible window)
    const result = await chrome.runtime.sendMessage({
      type: 'START_RECORDING',
      settings: {
        mode: selectedMode,
        quality,
        mic,
        systemAudio
      }
    });

    if (result && result.ok === false) {
      throw new Error(result.error || 'Failed to start');
    }

    // Close popup - recording continues in offscreen
    window.close();
  } catch (err) {
    console.error(err);
    // Fallback: direct getDisplayMedia in popup if offscreen fails
    try {
      await startDirectRecording({ mode: selectedMode, quality, mic, systemAudio });
      window.close();
    } catch (e2) {
      console.error(e2);
      alert('Could not start recording. Please allow screen sharing.');
      btn.disabled = false;
      btn.textContent = '● Start Recording';
    }
  }
});

// Fallback direct recording (runs in popup, user keeps Chrome share bar)
async function startDirectRecording(settings) {
  const resMap = {
    '720':  { w: 1280, h: 720,  br: 6000000 },
    '1080': { w: 1920, h: 1080, br: 12000000 },
    '1440': { w: 2560, h: 1440, br: 18000000 }
  };
  const res = resMap[settings.quality] || resMap['1080'];

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: res.w },
      height: { ideal: res.h },
      frameRate: { ideal: 30 }
    },
    audio: settings.systemAudio !== false,
    preferCurrentTab: settings.mode === 'browser'
  });

  const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8', 'video/webm']
    .find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

  const chunks = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: res.br
  });

  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    await chrome.downloads.download({
      url,
      filename: `recording-${settings.quality}p-${ts}.webm`,
      saveAs: false
    });
    stream.getTracks().forEach(t => t.stop());
  };

  stream.getVideoTracks()[0].onended = () => {
    if (recorder.state === 'recording') recorder.stop();
  };

  recorder.start(1000);
}
