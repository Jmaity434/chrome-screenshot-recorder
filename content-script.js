// Content script for "Select Area" screenshot
(function () {
  // Prevent multiple injections
  if (window.__screenCaptureSelecting) return;
  window.__screenCaptureSelecting = true;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = '__sc_overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.35)',
    zIndex: '2147483647',
    cursor: 'crosshair'
  });

  const selection = document.createElement('div');
  Object.assign(selection.style, {
    position: 'absolute',
    border: '2px solid #d4af37',
    background: 'rgba(212, 175, 55, 0.15)',
    display: 'none',
    pointerEvents: 'none'
  });

  const info = document.createElement('div');
  Object.assign(info.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#0f0f0f',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'system-ui, sans-serif',
    zIndex: '2147483647',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
  });
  info.textContent = 'Click and drag to select area • Press ESC to cancel';

  overlay.appendChild(selection);
  document.body.appendChild(overlay);
  document.body.appendChild(info);

  let startX, startY, isSelecting = false;

  function cleanup() {
    overlay.remove();
    info.remove();
    window.__screenCaptureSelecting = false;
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      cleanup();
    }
  }
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('mousedown', (e) => {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0';
    selection.style.height = '0';
    selection.style.display = 'block';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selection.style.left = x + 'px';
    selection.style.top = y + 'px';
    selection.style.width = w + 'px';
    selection.style.height = h + 'px';
  });

  overlay.addEventListener('mouseup', async (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 5 || h < 5) {
      cleanup();
      return;
    }

    // Hide overlay before capture
    overlay.style.display = 'none';
    info.style.display = 'none';

    // Tell the extension to capture the visible tab, then crop
    chrome.runtime.sendMessage({
      type: 'CAPTURE_REGION',
      rect: { x, y, width: w, height: h },
      dpr: window.devicePixelRatio || 1
    });

    cleanup();
  });
})();
