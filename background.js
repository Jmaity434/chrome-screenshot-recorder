// Service worker - Manifest V3
importScripts('db.js');

let controlsWindowId = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('1080p Screenshot & Screen Recorder installed.');
});

async function setupOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DISPLAY_MEDIA', 'USER_MEDIA'],
    justification: 'Recording screen/tab without capturing the control bar'
  });
}

async function openControlsBar() {
  // Close existing controls if any
  if (controlsWindowId !== null) {
    const oldId = controlsWindowId;
    controlsWindowId = null;
    try { await chrome.windows.remove(oldId); } catch (_) {}
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('controls.html'),
    type: 'popup',
    width: 260,
    height: 76,
    focused: true,
    top: 80,
    left: 80
  });
  controlsWindowId = win.id;
}

async function closeControlsBar() {
  if (controlsWindowId !== null) {
    const oldId = controlsWindowId;
    controlsWindowId = null;
    try { await chrome.windows.remove(oldId); } catch (_) {}
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Region capture
  if (message.type === 'CAPTURE_REGION') {
    const windowId = sender.tab ? sender.tab.windowId : null;
    handleRegionCapture(message.rect, message.dpr, windowId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error(err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  // Start recording
  if (message.type === 'START_RECORDING') {
    (async () => {
      try {
        await setupOffscreen();

        // Retry sending START_OFFSCREEN_RECORDING in case document is still initializing
        let result = null;
        let lastErr = null;
        for (let i = 0; i < 10; i++) {
          try {
            result = await chrome.runtime.sendMessage({
              type: 'START_OFFSCREEN_RECORDING',
              settings: message.settings
            });
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            await new Promise(r => setTimeout(r, 100));
          }
        }

        if (lastErr) {
          throw new Error('Offscreen document failed to initialize: ' + lastErr.message);
        }

        if (result && result.ok === false) {
          sendResponse(result);
          return;
        }

        // Open floating control bar AFTER recording starts
        // selfBrowserSurface:exclude ensures this bar is NOT in the video
        await openControlsBar();
        sendResponse({ ok: true });
      } catch (err) {
        console.error(err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // Stop
  if (message.type === 'STOP_RECORDING') {
    (async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'STOP_OFFSCREEN_RECORDING' });
      } catch (_) {}
      sendResponse({ ok: true });
    })();
    return true;
  }

  // Pause
  if (message.type === 'PAUSE_RECORDING') {
    chrome.runtime.sendMessage({ type: 'PAUSE_OFFSCREEN_RECORDING' })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }

  // Resume
  if (message.type === 'RESUME_RECORDING') {
    chrome.runtime.sendMessage({ type: 'RESUME_OFFSCREEN_RECORDING' })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }

  // Recording ended (from offscreen)
  if (message.type === 'RECORDING_STOPPED' || message.type === 'RECORDING_FAILED') {
    closeControlsBar();
    if (message.type === 'RECORDING_STOPPED' && message.captureId) {
      openPreviewWindow(message.captureId);
    }
    return false;
  }
});

async function openPreviewWindow(captureId) {
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

// Clean up if user closes the controls window manually
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === controlsWindowId) {
    controlsWindowId = null;
    chrome.runtime.sendMessage({ type: 'STOP_OFFSCREEN_RECORDING' }).catch(() => {});
  }
});

async function handleRegionCapture(rect, dpr, windowId) {
  const captureOptions = { format: 'png', quality: 100 };
  let dataUrl;
  if (windowId) {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, captureOptions);
  } else {
    dataUrl = await chrome.tabs.captureVisibleTab(null, captureOptions);
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const scale = dpr || 1;
  let sx = Math.round(rect.x * scale);
  let sy = Math.round(rect.y * scale);
  let sw = Math.round(rect.width * scale);
  let sh = Math.round(rect.height * scale);

  sx = Math.max(0, Math.min(sx, bitmap.width - 1));
  sy = Math.max(0, Math.min(sy, bitmap.height - 1));
  sw = Math.max(1, Math.min(sw, bitmap.width - sx));
  sh = Math.max(1, Math.min(sh, bitmap.height - sy));

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  const captureId = 'shot_' + Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-region-${timestamp}.png`;

  await saveCapture({
    id: captureId,
    type: 'image',
    blob: croppedBlob,
    filename: filename,
    mimeType: 'image/png',
    createdAt: Date.now()
  });

  await openPreviewWindow(captureId);
}
