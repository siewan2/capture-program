const {test}=require('node:test');
const assert=require('node:assert/strict');
const {applyShortcuts}=require('../src/shortcuts');
test('registers modes, reports unavailable shortcuts and disables empty bindings',()=>{
  const callbacks={};let reset=false;
  const api={unregisterAll(){reset=true;},register(key,fn){assert.ok(reset);if(key==='Control+2')return false;callbacks[key]=fn;return true;}};
  const triggered=[];
  const result=applyShortcuts(api,{region:'Control+1',window:'Control+2',fixed:''},mode=>triggered.push(mode));
  assert.equal(result.region,'등록됨');assert.match(result.window,/등록 실패/);assert.equal(result.fixed,'사용 안 함');callbacks['Control+1']();assert.deepEqual(triggered,['region']);
});
test('invalid accelerator exceptions do not prevent other registrations',()=>{
  const api={unregisterAll(){},register(key){if(key==='bad')throw Error('invalid');return true;}};
  const result=applyShortcuts(api,{region:'bad',window:'Control+2',fixed:null},()=>{});
  assert.match(result.region,/형식/);assert.equal(result.window,'등록됨');assert.match(result.fixed,/잘못된/);
});
