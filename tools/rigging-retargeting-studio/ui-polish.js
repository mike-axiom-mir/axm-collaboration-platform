const waitForBundle = setInterval(() => {
  if (document.body.dataset.retargetStatus !== 'pass') return;
  clearInterval(waitForBundle);
  const payload = JSON.parse(document.querySelector('#bundle-json').textContent);
  const profiles = Object.fromEntries(payload.bundle.profiles.map(profile => [profile.id, profile]));
  document.querySelector('#tall-height').textContent = `${(profiles.tall.height / profiles.source.height).toFixed(3)}× source`;
  document.querySelector('#compact-height').textContent = `${(profiles.compact.height / profiles.source.height).toFixed(3)}× source`;
}, 50);
