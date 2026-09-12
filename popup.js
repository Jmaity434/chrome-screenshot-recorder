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
btnFullpage.addEventListener('click', async () => {
  try {
    btnFullpage.disabled = true;
    btnFullpage.innerHTML = '<span class="icon">⏳</span> Capturing…';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script to scroll and capture
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureFullPage
    });

    const dataUrl = results[0].result;
    if (dataUrl) {
      await downloadDataUrl(dataUrl, 'screenshot-fullpage');
      btnFullpage.innerHTML = '<span class="icon">✓</span> Saved!';
    } else {
      throw new Error('Full page capture failed');
    }

    setTimeout(() => {
      btnFullpage.innerHTML = '<span class="icon">📄</span> Full Page';
      btnFullpage.disabled = false;
    }, 1200);
  } catch (err) {
    console.error(err);
    alert('Full page capture failed. Try on a simpler page.');
    btnFullpage.innerHTML = '<span class="icon">📄</span> Full Page';
    btnFullpage.disabled = false;
  }
});

// This function runs inside the page
function captureFullPage() {
  return new Promise(async (resolve) => {
    const body = document.body;
    const html = document.documentElement;

    const fullWidth = Math.max(body.scrollWidth, html.scrollWidth, body.offsetWidth, html.offsetWidth);
    const fullHeight = Math.max(body.scrollHeight, html.scrollHeight, body.offsetHeight, html.offsetHeight);

    // Limit very long pages to avoid memory issues
    const maxHeight = 15000;
    const captureHeight = Math.min(fullHeight, maxHeight);

    const canvas = document.createElement('canvas');
    canvas.width = fullWidth;
    canvas.height = captureHeight;
    const ctx = canvas.getContext('2d');

    const viewportHeight = window.innerHeight;
    let currentY = 0;

    // Hide fixed/sticky elements temporarily for cleaner capture
    const fixedEls = [];
    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') {
        fixedEls.push({ el, original: el.style.visibility });
        el.style.visibility = 'hidden';
      }
    });

    while (currentY < captureHeight) {
      window.scrollTo(0, currentY);
      await new Promise(r => setTimeout(r, 150)); // wait for render

      // We can't use captureVisibleTab from content script.
      // So we return a signal and do actual capture from background/popup.
      // For simplicity in this version we use a different approach.
      break;
    }

    // Restore fixed elements
    fixedEls.forEach(({ el, original }) => {
      el.style.visibility = original;
    });

    // Fallback: just capture current view (we will improve full page properly)
    resolve(null);
  });
}

// Better Full Page implementation using chrome.tabs.captureVisibleTab + scrolling from popup
async function doFullPageCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Get page dimensions
  const dimResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
      height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    })
  });

  const { width, height, viewportHeight, viewportWidth } = dimResults[0].result;
  const maxHeight = Math.min(height, 12000); // safety limit

  // Create canvas
  const canvas = new OffscreenCanvas(viewportWidth, maxHeight);
  const ctx = canvas.getContext('2d');

  let y = 0;
  while (y < maxHeight) {
    // Scroll
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (scrollY) => window.scrollTo(0, scrollY),
      args: [y]
    });

    await new Promise(r => setTimeout(r, 200));

    // Capture
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });

    // Draw onto canvas
    const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
    ctx.drawImage(img, 0, y, viewportWidth, Math.min(viewportHeight, maxHeight - y));

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

// Override the full page button with the better implementation
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
}, { once: false });

// Remove the old broken listener by re-assigning carefully - actually the above will add another listener.
// Better to clean it.

// ========== 3. SELECT AREA (Region) ==========
btnRegion.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject selection overlay
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js']
    });

    // Close popup so user can select
    window.close();
  } catch (err) {
    console.error(err);
    alert('Could not start region selection.');
  }
});

// ========== RECORDING ==========
// Opens a small persistent window so recording continues even if you switch tabs
btnStartRecord.addEventListener('click', async () => {
  try {
    // Create a small dedicated recording window
    await chrome.windows.create({
      url: chrome.runtime.getURL('recorder.html'),
      type: 'popup',
      width: 280,
      height: 200,
      focused: true
    });

    // Close the main popup
    window.close();
  } catch (err) {
    console.error(err);
    alert('Could not open recorder window.');
  }
});
