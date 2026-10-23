const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const path=require('node:path');
const fs=require('node:fs/promises');
async function listWindows(){
  if(process.platform!=='win32')throw new Error('화면에서 창 선택은 Windows에서 지원됩니다.');
  const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const script=await fs.readFile(path.join(__dirname,'windows-list.ps1'),'utf8');
  const {stdout}=await promisify(execFile)(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:15000,maxBuffer:4*1024*1024});
  const windows=JSON.parse(stdout.replace(/^\uFEFF/,''));
  return (Array.isArray(windows)?windows:[windows]).filter(w=>w&&typeof w.handle==='string'&&[w.x,w.y,w.width,w.height].every(Number.isFinite)&&w.width>0&&w.height>0);
}
function localWindows(windows,sources,display,nativeBounds){
  const allowed=new Map(sources.filter(s=>s.id.startsWith('window:')&&!s.thumbnail.isEmpty()).map(s=>[s.id.split(':')[1],s]));
  return windows.filter(w=>allowed.has(w.handle)).map(w=>({id:allowed.get(w.handle).id,name:allowed.get(w.handle).name,x:(w.x-nativeBounds.x)*display.bounds.width/nativeBounds.width,y:(w.y-nativeBounds.y)*display.bounds.height/nativeBounds.height,width:w.width*display.bounds.width/nativeBounds.width,height:w.height*display.bounds.height/nativeBounds.height}));
}
module.exports={listWindows,localWindows};
