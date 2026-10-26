const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createStartup,STARTUP_ARG}=require('../src/startup');
function setup(){let saved={openAtLogin:false};const writes=[];const app={isPackaged:true,getLoginItemSettings:()=>saved,setLoginItemSettings:options=>{writes.push(options);saved={...options};}};return{app,writes,startup:createStartup({app,platform:'win32',executable:'C:\\My Programs\\Capture Program.exe'})};}
test('startup defaults off, enables hidden login launch at the exact executable path and removes registration',()=>{
  const {startup,writes}=setup();assert.deepEqual(startup.get(),{supported:true,enabled:false});
  assert.equal(startup.set(true).enabled,true);assert.deepEqual(writes[0],{path:'C:\\My Programs\\Capture Program.exe',args:[STARTUP_ARG],openAtLogin:true});
  assert.equal(startup.set(false).enabled,false);assert.equal(writes[1].openAtLogin,false);
  assert.throws(()=>startup.set('true'),/올바르지/);assert.equal(writes.length,2);
});
test('development and non-Windows startup cannot change login registration',()=>{
  for(const [platform,isPackaged] of [['linux',true],['win32',false]]){
    const app={isPackaged,setLoginItemSettings:()=>assert.fail('must not register'),getLoginItemSettings:()=>assert.fail('must not query')};
    const startup=createStartup({app,platform});assert.deepEqual(startup.get(),{supported:false,enabled:false});assert.throws(()=>startup.set(true),/배포/);
  }
});
test('failed OS registration and Task Manager blocking are reported rather than claiming enabled',()=>{
  const app={isPackaged:true,setLoginItemSettings(){},getLoginItemSettings:()=>({openAtLogin:false})};const startup=createStartup({app,platform:'win32'});assert.throws(()=>startup.set(true),/변경하지/);
  app.getLoginItemSettings=()=>({openAtLogin:true,executableWillLaunchAtLogin:false});assert.equal(startup.get().enabled,false);assert.throws(()=>startup.set(true),/시작 앱/);
});
