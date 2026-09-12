const btnVisible = document.getElementById('btn-visible');
const btnFullpage = document.getElementById('btn-fullpage');
const btnRegion = document.getElementById('btn-region');
const btnStartRecord = document.getElementById('btn-start-record');

// ========== HELPER: Download dataURL ==========
async function downloadDataUrl(dataUrl, prefix) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${prefix}-${timestamp}.png`;
  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false
  });
}

// ========== 1. VISIBLE AREA ==========
btnVisible.addEventListener('click', async () => {
  try {
    btnVisible.disabled = true;
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });
    await downloadDataUrl(dataUrl, 'screenshot-visible');
    btnVisible.innerHTML = '<span class="icon">✓</span> Saved!';
    setTimeout(() => {
      btnVisible.innerHTML = '<span class="icon">📷</span> Visible Area';
      btnVisible.disabled = false;
    }, 1200);
  } catch (err) {
    console.error(err);
    alert('Could not capture. Make sure you are on a normal webpage.');
    btnVisible.disabled = false;
  }
});

// ========== 2. FULL PAGE ==========
async function doFullPageCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Get page dimensions
  const dimResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    })
  });

  const { height, viewportHeight, viewportWidth } = dimResults[0].result;
  const maxHeight = Math.min(height, 12000); // safety limit

  const canvas = new OffscreenCanvas(viewportWidth, maxHeight);
  const ctx = canvas.getContext('2d');

  let y = 0;
  while (y < maxHeight) {
    // Scroll the page
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (scrollY) => window.scrollTo(0, scrollY),
      args: [y]
    });

    await new Promise(r => setTimeout(r, 250)); // wait for paint

    // Capture visible part
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });
    const img = await createImageBitmap(await (await fetch(dataUrl)).blob());

    const drawHeight = Math.min(viewportHeight, maxHeight - y);
    ctx.drawImage(img, 0, 0, viewportWidth, drawHeight, 0, y, viewportWidth, drawHeight);

    y += viewportHeight;
  }

  // Scroll back to top
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.scrollTo(0, 0)
  });

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return URL.createObjectURL(blob);
}

btnFullpage.addEventListener('click', async () => {
  try {
    btnFullpage.disabled = true;
    btnFullpage.innerHTML = '<span class="icon">⏳</span> Capturing…';

    const objectUrl = await doFullPageCapture();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    await chrome.downloads.download({
      url: objectUrl,
      filename: `screenshot-fullpage-${timestamp}.png`,
      saveAs: false
    });

    btnFullpage.innerHTML = '<span class="icon">✓</span> Saved!';
    setTimeout(() => {
      btnFullpage.innerHTML = '<span class="icon">📄</span> Full Page';
      btnFullpage.disabled = false;
    }, 1200);
  } catch (err) {
    console.error(err);
    alert('Full page capture failed on this page. Try Visible Area instead.');
    btnFullpage.innerHTML = '<span class="icon">📄</span> Full Page';
    btnFullpage.disabled = false;
  }
});

// ========== 3. SELECT AREA (Region) ==========
btnRegion.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject selection overlay
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js']
    });

    // Close popup so user can draw the selection
    window.close();
  } catch (err) {
    console.error(err);
    alert('Could not start region selection.');
  }
});

// ========== RECORDING ==========
// Opens a persistent window so recording continues even if you switch tabs
btnStartRecord.addEventListener('click', async () => {
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL('recorder.html'),
      type: 'popup',
      width: 320,
      height: 240,
      focused: true
    });

    // Close the main popup
    window.close();
  } catch (err) {
    console.error(err);
    alert('Could not open recorder window.');
  }
});
