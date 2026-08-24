'use strict';
(function(){const video=document.getElementById('trailer'),replay=document.getElementById('replay');if(!video||!replay)return;replay.addEventListener('click',()=>{video.currentTime=0;const attempt=video.play();if(attempt&&typeof attempt.catch==='function')attempt.catch(()=>{});video.focus();});})();
