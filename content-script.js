// Content script for "Select Area" screenshot (supports Long / Scrolling Area)
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
    background: 'rgba(15, 23, 42, 0.35)',
    zIndex: '2147483647',
    cursor: 'crosshair',
    userSelect: 'none'
  });

  const selection = document.createElement('div');
  Object.assign(selection.style, {
    position: 'fixed',
    border: '2px solid #2563eb',
    background: 'rgba(37, 99, 235, 0.12)',
    display: 'none',
    pointerEvents: 'none',
    boxShadow: '0 0 0 99999px rgba(15, 23, 42, 0.42), inset 0 0 20px rgba(37, 99, 235, 0.15)',
    borderRadius: '4px'
  });

  // Top instruction pill (Liquid Glass)
  const info = document.createElement('div');
  Object.assign(info.style, {
    position: 'fixed',
    top: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px) saturate(180%)',
    webkitBackdropFilter: 'blur(20px) saturate(180%)',
    color: '#0f172a',
    padding: '9px 18px',
    borderRadius: '14px',
    fontSize: '12.5px',
    fontWeight: '600',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
    zIndex: '2147483647',
    boxShadow: '0 10px 30px -4px rgba(15, 23, 42, 0.18), inset 0 1.5px 1px rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.9)',
    pointerEvents: 'none',
    letterSpacing: '-0.1px'
  });
  info.innerHTML = '<span style="color:#2563eb;margin-right:6px;">✂️</span> Click & drag area  •  <b>Scroll down for long page</b>  •  ESC to cancel';

  // Size indicator badge
  const sizeLabel = document.createElement('div');
  Object.assign(sizeLabel.style, {
    position: 'fixed',
    background: '#2563eb',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '6px',
    display: 'none',
    pointerEvents: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
    zIndex: '2147483647',
    letterSpacing: '0.2px'
  });

  overlay.appendChild(selection);
  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(info);
  document.documentElement.appendChild(sizeLabel);

  let startDocX = 0;
  let startDocY = 0;
  let currentDocX = 0;
  let currentDocY = 0;
  let lastClientX = 0;
  let lastClientY = 0;
  let isSelecting = false;
  let autoScrollSpeed = 0;
  let animFrameId = null;

  function cleanup() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    window.removeEventListener('scroll', onScroll, { passive: true });
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    info.remove();
    sizeLabel.remove();
    window.__screenCaptureSelecting = false;
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  }
  document.addEventListener('keydown', onKey, true);

  function renderSelection() {
    const minDocX = Math.min(startDocX, currentDocX);
    const minDocY = Math.min(startDocY, currentDocY);
    const w = Math.abs(currentDocX - startDocX);
    const h = Math.abs(currentDocY - startDocY);

    // Convert document coordinates to current viewport coordinates
    const viewX = minDocX - window.scrollX;
    const viewY = minDocY - window.scrollY;

    selection.style.left = viewX + 'px';
    selection.style.top = viewY + 'px';
    selection.style.width = w + 'px';
    selection.style.height = h + 'px';

    let labelText = `${Math.round(w)} × ${Math.round(h)} px`;
    if (h > window.innerHeight) {
      labelText += ' (Long Area)';
    }
    sizeLabel.textContent = labelText;

    // Position size label floating near cursor so it stays visible during long scroll
    const labelX = Math.min(window.innerWidth - 130, Math.max(10, lastClientX + 12));
    const labelY = Math.min(window.innerHeight - 30, Math.max(10, lastClientY + 16));
    sizeLabel.style.left = labelX + 'px';
    sizeLabel.style.top = labelY + 'px';
  }

  function onScroll() {
    if (!isSelecting) return;
    currentDocX = lastClientX + window.scrollX;
    currentDocY = lastClientY + window.scrollY;
    renderSelection();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Smooth auto-scroll loop when cursor is near edges
  function autoScrollTick() {
    if (!isSelecting) return;
    if (autoScrollSpeed !== 0) {
      window.scrollBy(0, autoScrollSpeed);
      currentDocX = lastClientX + window.scrollX;
      currentDocY = lastClientY + window.scrollY;
      renderSelection();
    }
    animFrameId = requestAnimationFrame(autoScrollTick);
  }

  // Allow mouse wheel scrolling while dragging
  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    window.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: 'auto' });
    currentDocX = lastClientX + window.scrollX;
    currentDocY = lastClientY + window.scrollY;
    renderSelection();
  }, { passive: false });

  overlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    isSelecting = true;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    startDocX = e.clientX + window.scrollX;
    startDocY = e.clientY + window.scrollY;
    currentDocX = startDocX;
    currentDocY = startDocY;

    selection.style.display = 'block';
    sizeLabel.style.display = 'block';
    renderSelection();

    autoScrollSpeed = 0;
    animFrameId = requestAnimationFrame(autoScrollTick);
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    e.preventDefault();

    lastClientX = e.clientX;
    lastClientY = e.clientY;
    currentDocX = e.clientX + window.scrollX;
    currentDocY = e.clientY + window.scrollY;

    // Detect proximity to viewport vertical edges for auto-scrolling
    const edgeThreshold = 70;
    const viewHeight = window.innerHeight;

    if (e.clientY > viewHeight - edgeThreshold) {
      // Near bottom: scroll down
      const ratio = (e.clientY - (viewHeight - edgeThreshold)) / edgeThreshold;
      autoScrollSpeed = Math.min(28, Math.round(ratio * 22) + 3);
    } else if (e.clientY < edgeThreshold) {
      // Near top: scroll up
      const ratio = (edgeThreshold - e.clientY) / edgeThreshold;
      autoScrollSpeed = -Math.min(28, Math.round(ratio * 22) + 3);
    } else {
      autoScrollSpeed = 0;
    }

    renderSelection();
  });

  overlay.addEventListener('mouseup', async (e) => {
    if (!isSelecting) return;
    isSelecting = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    autoScrollSpeed = 0;

    e.preventDefault();
    e.stopPropagation();

    currentDocX = e.clientX + window.scrollX;
    currentDocY = e.clientY + window.scrollY;

    const minDocX = Math.round(Math.min(startDocX, currentDocX));
    const minDocY = Math.round(Math.min(startDocY, currentDocY));
    const w = Math.round(Math.abs(currentDocX - startDocX));
    const h = Math.round(Math.abs(currentDocY - startDocY));

    if (w < 8 || h < 8) {
      cleanup();
      return;
    }

    // Hide selection overlay during capture
    overlay.style.display = 'none';
    sizeLabel.style.display = 'none';

    // Show capturing progress pill
    info.innerHTML = '<span style="color:#2563eb;margin-right:6px;">⏳</span> Stitching & capturing area…';

    const dpr = window.devicePixelRatio || 1;
    const initialScroll = { x: window.scrollX, y: window.scrollY };
    const viewportDim = { width: window.innerWidth, height: window.innerHeight };

    // Send document coordinates to background
    try {
      chrome.runtime.sendMessage({
        type: 'CAPTURE_REGION',
        docRect: { x: minDocX, y: minDocY, width: w, height: h },
        dpr: dpr,
        initialScroll: initialScroll,
        viewportDim: viewportDim
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
        }
        cleanup();
      });
    } catch (err) {
      console.error('Failed to send capture message:', err);
      cleanup();
    }
  });
})();

