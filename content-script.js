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
    inset: '0',
    width: '100vw',
    height: '100vh',
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: '2147483647',
    cursor: 'crosshair',
    userSelect: 'none'
  });

  const selection = document.createElement('div');
  Object.assign(selection.style, {
    position: 'absolute',
    border: '2px solid #d4af37',
    background: 'rgba(212, 175, 55, 0.18)',
    display: 'none',
    pointerEvents: 'none',
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)'
  });

  const info = document.createElement('div');
  Object.assign(info.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(15, 15, 15, 0.92)',
    color: '#fff',
    padding: '10px 18px',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    zIndex: '2147483647',
    boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.1)',
    pointerEvents: 'none'
  });
  info.textContent = 'Click & drag to select area  •  ESC to cancel';

  // Size indicator
  const sizeLabel = document.createElement('div');
  Object.assign(sizeLabel.style, {
    position: 'absolute',
    background: '#d4af37',
    color: '#111',
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'none',
    pointerEvents: 'none',
    fontFamily: 'system-ui, sans-serif'
  });

  overlay.appendChild(selection);
  selection.appendChild(sizeLabel);
  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(info);

  let startX = 0, startY = 0, isSelecting = false;

  function cleanup() {
    overlay.remove();
    info.remove();
    window.__screenCaptureSelecting = false;
    document.removeEventListener('keydown', onKey, true);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  }
  document.addEventListener('keydown', onKey, true);

  overlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0px';
    selection.style.height = '0px';
    selection.style.display = 'block';
    sizeLabel.style.display = 'block';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    e.preventDefault();

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    selection.style.left = x + 'px';
    selection.style.top = y + 'px';
    selection.style.width = w + 'px';
    selection.style.height = h + 'px';

    sizeLabel.textContent = Math.round(w) + ' × ' + Math.round(h);
    sizeLabel.style.left = '4px';
    sizeLabel.style.top = h > 24 ? '-22px' : '4px';
  });

  overlay.addEventListener('mouseup', async (e) => {
    if (!isSelecting) return;
    isSelecting = false;
    e.preventDefault();
    e.stopPropagation();

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 8 || h < 8) {
      cleanup();
      return;
    }

    // Completely remove overlay so it is not in the screenshot
    overlay.style.opacity = '0';
    info.style.opacity = '0';

    // Wait for the browser to paint (remove overlay from screen)
    await new Promise(r => setTimeout(r, 80));

    const dpr = window.devicePixelRatio || 1;

    // Send to background for capture + crop
    try {
      chrome.runtime.sendMessage({
        type: 'CAPTURE_REGION',
        rect: { x, y, width: w, height: h },
        dpr: dpr
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
        }
      });
    } catch (err) {
      console.error('Failed to send capture message:', err);
    }

    // Cleanup after a short delay
    setTimeout(cleanup, 150);
  });
})();
