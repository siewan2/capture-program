const {test}=require('node:test');
const assert=require('node:assert/strict');
const {listWindows,localWindows}=require('../src/windows-native');
test('window hit targets retain native z-order, filter unavailable windows and map mixed DPI coordinates',()=>{
  const windows=[{handle:'11',x:-1500,y:150,width:600,height:450},{handle:'99',x:0,y:0,width:5,height:5},{handle:'22',x:-1800,y:0,width:1200,height:900}];
  const sources=['11','22'].map(handle=>({id:`window:${handle}:0`,name:handle,thumbnail:{isEmpty:()=>false}}));
  const targets=localWindows(windows,sources,{bounds:{width:1280,height:720}},{x:-1920,y:0,width:1920,height:1080});
  assert.deepEqual(targets.map(w=>w.id),['window:11:0','window:22:0']);
  assert.deepEqual(targets[0],{id:'window:11:0',name:'11',x:280,y:100,width:400,height:300});
});
test('Windows native window enumeration compiles and returns structured bounds',{skip:process.platform!=='win32'},async()=>{
  const windows=await listWindows();assert.ok(Array.isArray(windows));
  for(const w of windows){assert.match(w.handle,/^\d+$/);assert.ok(w.width>0&&w.height>0);}
});
