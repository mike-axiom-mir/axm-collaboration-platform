'use strict';

(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('distribution') !== 'steam') return;

  document.title = 'AXM Local GameHub';
  document.body.dataset.distribution = 'steam';

  const heroEyebrow = document.querySelector('.hero .eyebrow');
  const heroCopy = document.querySelector('.hero h1 + p');
  const shelfHeading = document.querySelector('.library:not(.world-library) h2');
  const gameSelect = document.getElementById('allGames');
  const worldLibrary = document.querySelector('.world-library');
  const assetInbox = document.getElementById('assetInboxPanel');
  const workshopBack = document.getElementById('workshopBackLink');

  if (heroEyebrow) heroEyebrow.textContent = 'AXM · LOCAL GAMEHUB';
  if (heroCopy) heroCopy.textContent = 'One local game collection, one visible party, nineteen installed game packages.';
  if (shelfHeading) shelfHeading.textContent = 'Game library';
  if (gameSelect) gameSelect.setAttribute('aria-label', 'Choose an installed AXM Local GameHub game');
  if (worldLibrary) worldLibrary.hidden = true;
  if (assetInbox) assetInbox.hidden = true;
  if (workshopBack) workshopBack.remove();

  const main = document.querySelector('main');
  if (main && !document.getElementById('steamBuildNotice')) {
    const notice = document.createElement('aside');
    notice.id = 'steamBuildNotice';
    notice.className = 'steam-build-notice';
    notice.innerHTML = '<strong>TEST BUILD</strong><span>Local GameHub preparation · no Steam account, upload, approval, or release is implied.</span>';
    main.prepend(notice);
  }

  function removeWorldOptions() {
    if (!gameSelect) return;
    Array.from(gameSelect.options).forEach(option => {
      if (String(option.value || '').startsWith('world:')) option.remove();
    });
  }

  removeWorldOptions();
  if (gameSelect) new MutationObserver(removeWorldOptions).observe(gameSelect, { childList: true });
})();
