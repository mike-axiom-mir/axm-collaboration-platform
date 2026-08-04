(function () {
  'use strict';

  var button = document.getElementById('axmPowerButton');
  var overlay = document.getElementById('axmPowerScreen');
  var keepButton = document.getElementById('axmPowerKeep');
  var stopButton = document.getElementById('axmPowerStop');
  var closeButton = document.getElementById('axmPowerClose');
  var status = document.getElementById('axmPowerStatus');

  if (!button || !overlay || !keepButton || !stopButton || !closeButton || !status) return;

  function setOpen(open) {
    overlay.hidden = !open;
    overlay.classList.toggle('show', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      status.textContent = '';
      keepButton.focus();
    } else {
      button.focus();
    }
  }

  button.addEventListener('click', function () { setOpen(true); });
  keepButton.addEventListener('click', function () { setOpen(false); });
  closeButton.addEventListener('click', function () { setOpen(false); });
  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) setOpen(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !overlay.hidden) setOpen(false);
  });

  stopButton.addEventListener('click', async function () {
    stopButton.disabled = true;
    keepButton.disabled = true;
    closeButton.disabled = true;
    status.className = 'power-status working';
    status.textContent = 'Stopping AXM-owned background runs...';

    try {
      var response = await fetch('/api/runtime/stop-all', {
        method: 'POST',
        headers: { 'x-axm-lifecycle': 'explicit-local-stop-all' }
      });
      var result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || ('Request failed (' + response.status + ')'));
      status.className = 'power-status accepted';
      status.textContent = 'Stop accepted. This screen will disconnect; you can close the browser tab.';
    } catch (error) {
      status.className = 'power-status failed';
      status.textContent = 'AXM was not stopped: ' + (error && error.message ? error.message : String(error));
      stopButton.disabled = false;
      keepButton.disabled = false;
      closeButton.disabled = false;
    }
  });
})();

