// Service worker - Manifest V3

chrome.runtime.onInstalled.addListener(() => {
  console.log('1080p Screenshot & Screen Recorder installed.');
});

// Handle region capture request from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_REGION') {
    const tabId = sender.tab ? sender.tab.id : null;
    const windowId = sender.tab ? sender.tab.windowId : null;

    handleRegionCapture(message.rect, message.dpr, windowId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error(err);
        sendResponse({ ok: false, error: err.message });
      });

    return true; // keep channel open for async response
  }
});

async function handleRegionCapture(rect, dpr, windowId) {
  try {
    // Capture the visible tab (use windowId for reliability)
    const captureOptions = {
      format: 'png',
      quality: 100
    };

    let dataUrl;
    if (windowId) {
      dataUrl = await chrome.tabs.captureVisibleTab(windowId, captureOptions);
    } else {
      dataUrl = await chrome.tabs.captureVisibleTab(null, captureOptions);
    }

    if (!dataUrl) {
      throw new Error('captureVisibleTab returned empty');
    }

    // Load image
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const scale = dpr || 1;

    // Calculate crop coordinates (device pixels)
    let sx = Math.round(rect.x * scale);
    let sy = Math.round(rect.y * scale);
    let sw = Math.round(rect.width * scale);
    let sh = Math.round(rect.height * scale);

    // Clamp to image bounds (safety)
    sx = Math.max(0, Math.min(sx, bitmap.width - 1));
    sy = Math.max(0, Math.min(sy, bitmap.height - 1));
    sw = Math.max(1, Math.min(sw, bitmap.width - sx));
    sh = Math.max(1, Math.min(sh, bitmap.height - sy));

    // Crop
    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const url = URL.createObjectURL(croppedBlob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-region-${timestamp}.png`;

    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    });

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 15000);

    console.log('Region screenshot saved:', filename, `${sw}x${sh}`);
  } catch (err) {
    console.error('Region capture failed:', err);
    throw err;
  }
}
