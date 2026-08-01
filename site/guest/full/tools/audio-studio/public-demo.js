(function () {
  'use strict';
  var back = document.querySelector('.brand a');
  if (back) {
    back.href = '../../../index.html';
    back.setAttribute('aria-label', 'Back to public maker room');
  }
}());
