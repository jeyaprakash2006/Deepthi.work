/* Deepthi.work host policy. Upstream editor binaries and license notices are retained. */
(() => {
  const isLocal = (value) => {
    try {
      const url = new URL(String(value), location.href);
      return (['http:', 'https:', 'blob:'].includes(url.protocol) && url.origin === location.origin);
    } catch { return false; }
  };
  const notice = () => {
    let status = document.getElementById('deepthi-link-notice');
    if (!status) {
      status = document.createElement('div');
      status.id = 'deepthi-link-notice';
      status.setAttribute('role', 'status');
      status.style.cssText = 'position:fixed;bottom:36px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#344832;color:white;padding:12px 18px;border-radius:8px;font:13px system-ui;max-width:90%;pointer-events:none';
      document.body.appendChild(status);
    }
    status.textContent = 'External links are disabled in Deepthi.work.';
    clearTimeout(window.deepthiNoticeTimer);
    window.deepthiNoticeTimer = setTimeout(() => status.remove(), 3500);
  };
  const open = window.open.bind(window);
  window.open = (url, target, features) => {
    if (!isLocal(url)) { notice(); return null; }
    return open(url, target, features);
  };
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (link && !isLocal(link.href)) {
      event.preventDefault(); event.stopImmediatePropagation(); notice();
    }
  }, true);
})();
