// preview.js - Preview and Download Window Logic
let currentBlob = null;
let currentObjectUrl = null;
let currentCapture = null;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(sec) {
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function initPreview() {
  const params = new URLSearchParams(window.location.search);
  const captureId = params.get('id');

  const spinner = document.getElementById('loading-spinner');
  const videoEl = document.getElementById('preview-video');
  const imageEl = document.getElementById('preview-image');
  const titleEl = document.getElementById('preview-title');
  const typeBadge = document.getElementById('type-badge');
  const metaInfo = document.getElementById('meta-info');
  const filenameInput = document.getElementById('input-filename');
  const btnCopy = document.getElementById('btn-copy');

  if (!captureId) {
    spinner.innerHTML = '<span style="color:#ef4444;">No capture ID specified.</span>';
    return;
  }

  try {
    const capture = await getCapture(captureId);
    if (!capture) {
      spinner.innerHTML = '<span style="color:#ef4444;">Capture not found or expired.</span>';
      return;
    }

    currentCapture = capture;
    currentBlob = capture.blob;
    currentObjectUrl = URL.createObjectURL(currentBlob);
    filenameInput.value = capture.filename || 'capture';

    spinner.style.display = 'none';

    if (capture.type === 'video') {
      titleEl.textContent = 'Screen Recording';
      typeBadge.textContent = 'WebM Video';
      typeBadge.style.color = '#0284c7';
      typeBadge.style.background = 'rgba(14, 165, 233, 0.12)';
      typeBadge.style.borderColor = 'rgba(14, 165, 233, 0.25)';

      videoEl.src = currentObjectUrl;
      videoEl.style.display = 'block';

      videoEl.onloadedmetadata = () => {
        const sizeStr = formatBytes(currentBlob.size);
        const durationStr = formatDuration(videoEl.duration);
        metaInfo.textContent = `${videoEl.videoWidth}×${videoEl.videoHeight} • ${durationStr} • ${sizeStr}`;
      };
    } else {
      titleEl.textContent = 'Screenshot';
      typeBadge.textContent = 'PNG Image';
      typeBadge.style.color = '#16a34a';
      typeBadge.style.background = 'rgba(22, 163, 74, 0.12)';
      typeBadge.style.borderColor = 'rgba(22, 163, 74, 0.25)';

      imageEl.src = currentObjectUrl;
      imageEl.style.display = 'block';
      btnCopy.style.display = 'inline-flex';

      imageEl.onload = () => {
        const sizeStr = formatBytes(currentBlob.size);
        metaInfo.textContent = `${imageEl.naturalWidth}×${imageEl.naturalHeight} • ${sizeStr}`;
      };
    }
  } catch (err) {
    console.error('Failed to load capture:', err);
    spinner.innerHTML = `<span style="color:#ef4444;">Failed to load preview: ${err.message}</span>`;
  }
}

// Download action
document.getElementById('btn-download').addEventListener('click', async () => {
  const btn = document.getElementById('btn-download');
  const filenameInput = document.getElementById('input-filename');
  let filename = filenameInput.value.trim();

  if (!filename) {
    filename = currentCapture ? currentCapture.filename : 'capture';
  }

  // Ensure extension
  const ext = currentCapture && currentCapture.type === 'video' ? '.webm' : '.png';
  if (!filename.toLowerCase().endsWith(ext)) {
    filename += ext;
  }

  const origContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Downloading…</span>';

  try {
    await chrome.downloads.download({
      url: currentObjectUrl,
      filename: filename,
      saveAs: false
    });

    btn.innerHTML = '<span>✓ Downloaded!</span>';
    setTimeout(() => {
      btn.innerHTML = origContent;
      btn.disabled = false;
    }, 1500);
  } catch (err) {
    console.error('Download failed, using anchor fallback:', err);
    const a = document.createElement('a');
    a.href = currentObjectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    btn.innerHTML = origContent;
    btn.disabled = false;
  }
});

// Copy to Clipboard (for images)
document.getElementById('btn-copy').addEventListener('click', async () => {
  const btn = document.getElementById('btn-copy');
  const copyText = document.getElementById('copy-text');

  if (!currentBlob) return;

  try {
    let pngBlob = currentBlob;
    if (pngBlob.type !== 'image/png') {
      pngBlob = new Blob([currentBlob], { type: 'image/png' });
    }

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': pngBlob })
    ]);

    copyText.textContent = 'Copied!';
    setTimeout(() => {
      copyText.textContent = 'Copy Image';
    }, 1800);
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    alert('Could not copy image to clipboard: ' + err.message);
  }
});

// Close button
document.getElementById('btn-close').addEventListener('click', () => {
  window.close();
});

window.addEventListener('DOMContentLoaded', initPreview);
