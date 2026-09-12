// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ===== HELPERS =====
function isRestrictedUrl(url) {
  if (!url) return false;
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') ||
         url.startsWith('about:') ||
         url.startsWith('view-source:') ||
         url.includes('chromewebstore.google.com') ||
         url.includes('chrome.google.com/webstore');
}

async function openPreview(captureId) {
  const url = chrome.runtime.getURL(`preview.html?id=${captureId}`);
  try {
    await chrome.windows.create({
      url,
      type: 'popup',
      width: 980,
      height: 720,
      focused: true
    });
  } catch (err) {
    await chrome.tabs.create({ url });
  }
}

async function previewDataUrl(dataUrl, prefix) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const captureId = 'shot_' + Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${prefix}-${timestamp}.png`;

  await saveCapture({
    id: captureId,
    type: 'image',
    blob: blob,
    filename: filename,
    mimeType: 'image/png',
    createdAt: Date.now()
  });

  await openPreview(captureId);
  window.close();
}

// ===== SCREENSHOT: Visible Part =====
document.getElementById('btn-visible').addEventListener('click', async () => {
  const btn = document.getElementById('btn-visible');
  try {
    btn.disabled = true;
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });
    await previewDataUrl(dataUrl, 'screenshot-visible');
  } catch (err) {
    console.error(err);
    alert('Could not capture. Try a normal webpage.');
    btn.disabled = false;
  }
});

// ===== SCREENSHOT: Full Page =====
async function doFullPageCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('No active tab found.');
  if (isRestrictedUrl(tab.url)) {
    throw new Error('Full page capture cannot run on Chrome internal or Web Store pages.');
  }

  const dimResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      dpr: window.devicePixelRatio || 1
    })
  });

  const { height, viewportHeight, viewportWidth, dpr } = dimResults[0].result;
  const scale = dpr || 1;
  const maxHeight = Math.min(height, 12000);
  const canvasWidth = Math.round(viewportWidth * scale);
  const canvasHeight = Math.round(maxHeight * scale);

  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
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

    const sWidth = Math.min(img.width, canvasWidth);
    const sHeight = Math.min(img.height, Math.round(drawHeight * scale));
    const dy = Math.round(y * scale);

    ctx.drawImage(img, 0, 0, sWidth, sHeight, 0, dy, sWidth, sHeight);
    y += viewportHeight;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.scrollTo(0, 0)
  });

  return await canvas.convertToBlob({ type: 'image/png' });
}

document.getElementById('btn-fullpage').addEventListener('click', async () => {
  const btn = document.getElementById('btn-fullpage');
  const orig = btn.innerHTML;
  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="ico">⏳</span><span class="lbl">Capturing…</span>';
    const blob = await doFullPageCapture();
    const captureId = 'shot_' + Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await saveCapture({
      id: captureId,
      type: 'image',
      blob: blob,
      filename: `screenshot-fullpage-${timestamp}.png`,
      mimeType: 'image/png',
      createdAt: Date.now()
    });
    await openPreview(captureId);
    window.close();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Full page capture failed.');
    btn.innerHTML = orig;
    btn.disabled = false;
  }
});

// ===== SCREENSHOT: Selected Area =====
document.getElementById('btn-region').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    if (isRestrictedUrl(tab.url)) {
      alert('Selected Area cannot run on Chrome internal or Web Store pages.');
      return;
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js']
    });
    window.close();
  } catch (err) {
    console.error(err);
    alert('Could not start region selection: ' + (err.message || 'Unknown error'));
  }
});

// ===== SCREENSHOT: Delay =====
document.getElementById('btn-delay').addEventListener('click', async () => {
  const btn = document.getElementById('btn-delay');
  const orig = btn.innerHTML;
  try {
    btn.disabled = true;
    for (let i = 3; i > 0; i--) {
      btn.textContent = `⏱️ Capturing in ${i}s…`;
      await new Promise(r => setTimeout(r, 1000));
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });
    await previewDataUrl(dataUrl, 'screenshot-delay');
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

    track.stop();
    stream.getTracks().forEach(t => t.stop());

    const captureId = 'shot_' + Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await saveCapture({
      id: captureId,
      type: 'image',
      blob: blob,
      filename: `screenshot-screen-${timestamp}.png`,
      mimeType: 'image/png',
      createdAt: Date.now()
    });

    await openPreview(captureId);
    window.close();
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

  const settings = { mode: selectedMode, quality, mic, systemAudio };

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'START_RECORDING',
      settings
    });

    if (result && result.ok === false) {
      throw new Error(result.error || 'Failed to start recording');
    }

    // Success - close popup, recording runs via background offscreen document
    window.close();
  } catch (err) {
    console.error('Recording start failed:', err);
    let msg = 'Could not start recording.';
    if (err.message) msg += ' ' + err.message;
    alert(msg);
    btn.disabled = false;
    btn.textContent = '● Start Recording';
  }
});
