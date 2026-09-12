// ===== TABS =====
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
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

function flashCard(btn, originalHTML) {
  btn.innerHTML = '<div class="option-icon">✓</div><div class="option-label">Saved!</div>';
  setTimeout(() => {
    btn.innerHTML = originalHTML;
  }, 1200);
}

// ===== SCREENSHOT: Visible Part =====
document.getElementById('btn-visible').addEventListener('click', async () => {
  const btn = document.getElementById('btn-visible');
  const original = btn.innerHTML;
  try {
    btn.disabled = true;
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });
    await downloadDataUrl(dataUrl, 'screenshot-visible');
    flashCard(btn, original);
  } catch (err) {
    console.error(err);
    alert('Could not capture. Try a normal webpage.');
  } finally {
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
  const original = btn.innerHTML;
  try {
    btn.disabled = true;
    btn.innerHTML = '<div class="option-icon">⏳</div><div class="option-label">Capturing…</div>';
    const objectUrl = await doFullPageCapture();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await chrome.downloads.download({
      url: objectUrl,
      filename: `screenshot-fullpage-${timestamp}.png`,
      saveAs: false
    });
    flashCard(btn, original);
  } catch (err) {
    console.error(err);
    alert('Full page capture failed. Try Visible Part.');
    btn.innerHTML = original;
  } finally {
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

// ===== SCREENSHOT: Visible after Delay =====
document.getElementById('btn-delay').addEventListener('click', async () => {
  const btn = document.getElementById('btn-delay');
  const original = btn.innerHTML;
  try {
    btn.disabled = true;
    const delay = 3;
    for (let i = delay; i > 0; i--) {
      btn.innerHTML = `<span class="row-icon">⏱️</span><span>Capturing in ${i}s…</span>`;
      await new Promise(r => setTimeout(r, 1000));
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 });
    await downloadDataUrl(dataUrl, 'screenshot-delay');
    btn.innerHTML = `<span class="row-icon">✓</span><span>Saved!</span>`;
    setTimeout(() => {
      btn.innerHTML = original;
      btn.disabled = false;
    }, 1000);
  } catch (err) {
    console.error(err);
    alert('Delay capture failed.');
    btn.innerHTML = original;
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
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await chrome.downloads.download({
      url: url,
      filename: `screenshot-screen-${timestamp}.png`,
      saveAs: false
    });

    track.stop();
    stream.getTracks().forEach(t => t.stop());
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch (err) {
    console.error(err);
    if (err.name !== 'NotAllowedError') {
      alert('Could not capture entire screen.');
    }
  }
});

// ===== RECORD MODE SELECTION =====
let selectedMode = 'monitor';

document.querySelectorAll('#panel-record .option-card[data-mode]').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('#panel-record .option-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedMode = card.dataset.mode;
  });
});

// ===== START RECORDING =====
document.getElementById('btn-start-record').addEventListener('click', async () => {
  const quality = document.getElementById('quality-select').value;
  const mic = document.getElementById('toggle-mic').checked;
  const systemAudio = document.getElementById('toggle-system-audio').checked;

  await chrome.storage.local.set({
    recSettings: {
      mode: selectedMode,
      quality: quality,
      mic: mic,
      systemAudio: systemAudio
    }
  });

  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL('recorder.html'),
      type: 'popup',
      width: 320,
      height: 240,
      focused: true
    });
    window.close();
  } catch (err) {
    console.error(err);
    alert('Could not open recorder window.');
  }
});
