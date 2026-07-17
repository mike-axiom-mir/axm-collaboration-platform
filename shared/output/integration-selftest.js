const assert=require('assert'),path=require('path');
const {Worker}=require('worker_threads');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAQAAADYv8WvAAAAtGVYSWZJSSoACAAAAAYAEgEDAAEAAAABAAAAGgEFAAEAAABWAAAAGwEFAAEAAABeAAAAKAEDAAEAAAACAAAAEwIDAAEAAAABAAAAaYcEAAEAAABmAAAAAAAAAC8ZAQDoAwAALxkBAOgDAAAGAACQBwAEAAAAMDIxMAGRBwAEAAAAAQIDAACgBwAEAAAAMDEwMAGgAwABAAAA//8AAAKgBAABAAAAAgAAAAOgBAABAAAAAgAAAAAAAAD8moEFAAAACXBIWXMAAAsSAAALEgHS3X78AAAAC0lEQVQImWNggAEAAAoAAWeL7ekAAAAASUVORK5CYII=';
const worker=new Worker(path.join(__dirname,'axm-node-output-worker.cjs'));
const timeout=setTimeout(()=>{worker.terminate();console.error('FAIL wasm-vips worker timed out');process.exit(1);},30000);
worker.once('error',error=>{clearTimeout(timeout);console.error(error);process.exit(1);});
worker.once('message',result=>{
  clearTimeout(timeout);worker.terminate();
  assert.equal(result.ok,true,result.error);assert.equal(result.receipt.schema,'axm.output-receipt/v1');assert.equal(result.receipt.engine.name,'wasm-vips');assert.equal(result.receipt.engine.license,'MIT');assert.equal(result.receipt.dimensions.width,4);assert.ok(result.receipt.bytes>50);assert.match(result.receipt.sha256,/^[a-f0-9]{64}$/);
  console.log('AXM Output Engine integration: PASS (wasm-vips emitted verified 4x4 PNG bytes in isolated worker)');
});
worker.postMessage({schema:'axm.output-job/v1',kind:'image.transform',name:'integration-pixel',payload:{dataUrl:png,format:'PNG',width:4,filename:'integration-pixel'}});
