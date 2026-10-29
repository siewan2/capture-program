const fs=require('node:fs');
const path=require('node:path');
const STARTUP_ARG='--startup-hidden';
const STARTUP_LINK='Capture Program.lnk';
function createStartup({app,shell,platform=process.platform,executable=process.execPath,fileSystem=fs}){
  const supported=platform==='win32'&&app.isPackaged;
  const options={path:executable,args:[STARTUP_ARG]};
  const directory=supported?path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs','Startup'):null;
  const shortcut=directory?path.join(directory,STARTUP_LINK):null;
  function hasShortcut(){
    if(!shortcut||!fileSystem.existsSync(shortcut))return false;
    try{const link=shell.readShortcutLink(shortcut);return path.win32.normalize(link.target).toLowerCase()===path.win32.normalize(executable).toLowerCase()&&link.args===STARTUP_ARG;}catch{return false;}
  }
  function get(){
    if(!supported)return{supported:false,enabled:false};
    const legacy=app.getLoginItemSettings(options);
    return{supported:true,enabled:hasShortcut()||(legacy.openAtLogin&&legacy.executableWillLaunchAtLogin!==false)};
  }
  function set(enabled){
    if(typeof enabled!=='boolean')throw new Error('자동 실행 설정이 올바르지 않습니다.');
    if(!supported)throw new Error('Windows 배포 버전에서 설정할 수 있습니다.');
    if(enabled){
      fileSystem.mkdirSync(directory,{recursive:true});
      if(!shell.writeShortcutLink(shortcut,'create',{target:executable,args:STARTUP_ARG,cwd:path.dirname(executable),description:'Capture Program · Windows 시작 시 백그라운드 실행',icon:executable,iconIndex:0}))throw new Error('시작프로그램 바로가기를 만들지 못했습니다.');
    }else if(fileSystem.existsSync(shortcut))fileSystem.unlinkSync(shortcut);
    app.setLoginItemSettings({...options,openAtLogin:false});
    const state=get();if(state.enabled!==enabled)throw new Error('Windows 시작 설정을 변경하지 못했습니다.');
    return state;
  }
  return{get,set};
}
module.exports={createStartup,STARTUP_ARG,STARTUP_LINK};
