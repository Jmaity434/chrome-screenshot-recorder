// Service worker - Manifest V3

chrome.runtime.onInstalled.addListener(() => {
  console.log('1080p Screenshot & Screen Recorder installed.');
});

// Handle region capture request from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_REGION') {
    handleRegionCapture(message.rect, message.dpr, sender.tab.id);
    return true; // async
  }
});

async function handleRegionCapture(rect, dpr, tabId) {
  try {
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });

    // Crop the selected region using OffscreenCanvas
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const scale = dpr || 1;
    const sx = Math.round(rect.x * scale);
    const sy = Math.round(rect.y * scale);
    const sw = Math.round(rect.width * scale);
    const sh = Math.round(rect.height * scale);

    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const url = URL.createObjectURL(croppedBlob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await chrome.downloads.download({
      url: url,
      filename: `screenshot-region-${timestamp}.png`,
      saveAs: false
    });

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) {
    console.error('Region capture failed:', err);
  }
}
