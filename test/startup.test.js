const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createStartup,STARTUP_ARG}=require('../src/startup');
function setup({writeSuccess=true}={}){
  let link=null,legacy=false;const writes=[];
  const app={isPackaged:true,getPath:()=>'/profile/AppData/Roaming',getLoginItemSettings:()=>({openAtLogin:legacy}),setLoginItemSettings:options=>{legacy=options.openAtLogin;}};
  const shell={readShortcutLink:()=>link,writeShortcutLink:(file,operation,options)=>{writes.push({file,operation,options});if(writeSuccess)link=options;return writeSuccess;}};
  const fileSystem={existsSync:()=>!!link,mkdirSync(){},unlinkSync(){link=null;}};
  return{writes,startup:createStartup({app,shell,fileSystem,platform:'win32',executable:'C:\\My Programs\\Capture Program.exe'}),setLegacy:value=>{legacy=value;}};
}
test('startup creates a hidden-launch shortcut in the current user Startup folder and removes it',()=>{
  const {startup,writes}=setup();assert.deepEqual(startup.get(),{supported:true,enabled:false});
  assert.equal(startup.set(true).enabled,true);assert.match(writes[0].file,/Microsoft.*Windows.*Start Menu.*Programs.*Startup.*Capture Program\.lnk/);
  assert.equal(writes[0].options.target,'C:\\My Programs\\Capture Program.exe');assert.equal(writes[0].options.args,STARTUP_ARG);
  assert.equal(startup.set(false).enabled,false);assert.throws(()=>startup.set('true'),/올바르지/);
});
test('development and non-Windows startup leave system settings untouched',()=>{
  for(const [platform,isPackaged] of [['linux',true],['win32',false]]){
    const app={isPackaged,getPath:()=>assert.fail('must not query'),getLoginItemSettings:()=>assert.fail('must not query')};
    const startup=createStartup({app,platform});assert.deepEqual(startup.get(),{supported:false,enabled:false});assert.throws(()=>startup.set(true),/배포/);
  }
});
test('legacy login registration is recognized and migrated or disabled',()=>{
  const {startup,setLegacy}=setup();setLegacy(true);assert.equal(startup.get().enabled,true);assert.equal(startup.set(false).enabled,false);
  setLegacy(true);assert.equal(startup.set(true).enabled,true);assert.equal(startup.set(false).enabled,false);
});
test('shortcut creation failures are reported',()=>{assert.throws(()=>setup({writeSuccess:false}).startup.set(true),/바로가기/);});
