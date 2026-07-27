(function () {
  'use strict';
  var current = null;
  var prompt = document.getElementById('prompt');
  var result = document.getElementById('result');
  var copy = document.getElementById('copy');
  var receipt = document.getElementById('receipt');
  var alternatives = document.getElementById('alternatives');

  document.getElementById('compose').addEventListener('click', function () {
    try {
      current = AXMCopyComposer.compose({ prompt: prompt.value });
      copy.textContent = '“' + current.text + '”';
      alternatives.innerHTML = current.alternatives.length ? '<h2>Alternatives</h2>' + current.alternatives.map(function (item) { return '<p>“' + item.replace(/[&<>]/g, function (value) { return ({'&':'&amp;','<':'&lt;','>':'&gt;'})[value]; }) + '”</p>'; }).join('') : '';
      receipt.textContent = JSON.stringify(current.receipt, null, 2);
      result.classList.remove('hidden');
    } catch (error) {
      current = null;
      copy.textContent = error.message;
      receipt.textContent = '';
      alternatives.innerHTML = '';
      result.classList.remove('hidden');
    }
  });

  document.getElementById('copyButton').addEventListener('click', async function () {
    if (!current) return;
    await navigator.clipboard.writeText(current.text);
    this.textContent = 'COPIED';
  });
})();
