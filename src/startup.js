const STARTUP_ARG='--startup-hidden';
const STARTUP_NAME='CaptureProgram';
function createStartup({app,platform=process.platform,executable=process.execPath}){
  const supported=platform==='win32'&&app.isPackaged;
  const options={name:STARTUP_NAME,path:executable,args:[STARTUP_ARG]};
  function get(){
    if(!supported)return{supported:false,enabled:false};
    const state=app.getLoginItemSettings(options);
    return{supported:true,enabled:state.openAtLogin&&state.executableWillLaunchAtLogin!==false};
  }
  function set(enabled){
    if(typeof enabled!=='boolean')throw new Error('자동 실행 설정이 올바르지 않습니다.');
    if(!supported)throw new Error('Windows 배포 버전에서 설정할 수 있습니다.');
    app.setLoginItemSettings({...options,openAtLogin:enabled});
    const state=get();if(state.enabled!==enabled)throw new Error('Windows 시작 설정을 변경하지 못했습니다. 작업 관리자의 시작 앱 설정도 확인하세요.');
    return state;
  }
  return{get,set};
}
module.exports={createStartup,STARTUP_ARG};
