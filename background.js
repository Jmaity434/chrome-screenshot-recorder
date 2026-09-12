// Service worker - Manifest V3

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
    reasons: ['USER_MEDIA'],
    justification: 'Recording screen/tab without capturing the control bar'
  });
}

async function openControlsBar() {
  // Close existing controls if any
  if (controlsWindowId !== null) {
    try { await chrome.windows.remove(controlsWindowId); } catch (_) {}
    controlsWindowId = null;
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('controls.html'),
    type: 'popup',
    width: 220,
    height: 64,
    focused: true,
    top: 80,
    left: 80
  });
  controlsWindowId = win.id;
}

async function closeControlsBar() {
  if (controlsWindowId !== null) {
    try { await chrome.windows.remove(controlsWindowId); } catch (_) {}
    controlsWindowId = null;
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
        await new Promise(r => setTimeout(r, 120));

        const result = await chrome.runtime.sendMessage({
          type: 'START_OFFSCREEN_RECORDING',
          settings: message.settings
        });

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
      await closeControlsBar();
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
    // Forward to controls window if still open
    return false;
  }
});

// Clean up if user closes the controls window manually
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === controlsWindowId) {
    controlsWindowId = null;
    // Optional: stop recording when control bar is closed
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
  const url = URL.createObjectURL(croppedBlob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await chrome.downloads.download({
    url,
    filename: `screenshot-region-${timestamp}.png`,
    saveAs: false
  });

  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
