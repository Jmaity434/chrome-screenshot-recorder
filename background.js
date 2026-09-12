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
    const tabId = sender.tab ? sender.tab.id : null;
    const windowId = sender.tab ? sender.tab.windowId : null;
    handleRegionCapture(message, tabId, windowId)
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

async function handleRegionCapture(message, tabId, windowId) {
  const docRect = message.docRect || message.rect;
  const dpr = message.dpr || 1;
  const initialScroll = message.initialScroll || { x: 0, y: 0 };
  const viewportDim = message.viewportDim || { width: 1920, height: 1080 };

  // Determine if the selected area exceeds the current viewport height or scroll boundary
  const isMultiSlice = tabId && (
    docRect.height > (viewportDim.height - 20) ||
    docRect.y < initialScroll.y ||
    (docRect.y + docRect.height) > (initialScroll.y + viewportDim.height)
  );

  let croppedBlob;

  if (isMultiSlice) {
    // Multi-slice scrolling capture for long selected areas
    const maxHeight = Math.min(docRect.height, 16000); // Guard against GPU canvas memory limits
    const canvasWidth = Math.round(docRect.width * dpr);
    const canvasHeight = Math.round(maxHeight * dpr);

    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const targetEndY = docRect.y + maxHeight;
    let currentY = docRect.y;

    while (currentY < targetEndY) {
      // 1. Scroll tab to the current slice position
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (scrollX, scrollY) => window.scrollTo(scrollX, scrollY),
        args: [docRect.x, currentY]
      });

      // 2. Wait for paint & rendering
      await new Promise(r => setTimeout(r, 220));

      // 3. Query actual scroll offset from tab
      const [{ result: scrollInfo }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          innerHeight: window.innerHeight,
          innerWidth: window.innerWidth
        })
      });

      // 4. Capture visible tab slice
      const captureOptions = { format: 'png', quality: 100 };
      const dataUrl = windowId
        ? await chrome.tabs.captureVisibleTab(windowId, captureOptions)
        : await chrome.tabs.captureVisibleTab(null, captureOptions);

      const blob = await (await fetch(dataUrl)).blob();
      const img = await createImageBitmap(blob);

      // 5. Calculate document vertical span for this slice
      const sliceDocY = Math.max(currentY, scrollInfo.scrollY);
      const sliceDocYEnd = Math.min(targetEndY, scrollInfo.scrollY + scrollInfo.innerHeight);
      const sliceH = sliceDocYEnd - sliceDocY;

      if (sliceH <= 0) break;

      // 6. Source crop coordinates in the captured viewport image
      const sx = Math.max(0, Math.round((docRect.x - scrollInfo.scrollX) * dpr));
      const sy = Math.max(0, Math.round((sliceDocY - scrollInfo.scrollY) * dpr));
      const sw = Math.min(img.width - sx, canvasWidth);
      const sh = Math.min(img.height - sy, Math.round(sliceH * dpr));

      // 7. Destination in final stitched canvas
      const dx = 0;
      const dy = Math.round((sliceDocY - docRect.y) * dpr);
      const dw = sw;
      const dh = sh;

      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

      // Advance by the slice height we actually captured
      currentY = sliceDocYEnd;

      if (sliceDocYEnd >= targetEndY || sliceH < 10) break;
    }

    // Restore original tab scroll position
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (x, y) => window.scrollTo(x, y),
        args: [initialScroll.x, initialScroll.y]
      });
    } catch (_) {}

    croppedBlob = await canvas.convertToBlob({ type: 'image/png' });

  } else {
    // Fast single-viewport capture when selection fits within visible screen
    const captureOptions = { format: 'png', quality: 100 };
    const dataUrl = windowId
      ? await chrome.tabs.captureVisibleTab(windowId, captureOptions)
      : await chrome.tabs.captureVisibleTab(null, captureOptions);

    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const relX = docRect.x - initialScroll.x;
    const relY = docRect.y - initialScroll.y;

    let sx = Math.round(relX * dpr);
    let sy = Math.round(relY * dpr);
    let sw = Math.round(docRect.width * dpr);
    let sh = Math.round(docRect.height * dpr);

    sx = Math.max(0, Math.min(sx, bitmap.width - 1));
    sy = Math.max(0, Math.min(sy, bitmap.height - 1));
    sw = Math.max(1, Math.min(sw, bitmap.width - sx));
    sh = Math.max(1, Math.min(sh, bitmap.height - sy));

    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

    croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  }

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
