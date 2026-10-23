const {BrowserWindow,desktopCapturer,screen,ipcMain}=require('electron');
const path=require('node:path');
const {pixelRect,presetSize}=require('./geometry');
let active=null;
function installOverlayCapture(main){
  ipcMain.handle('overlay-init',event=>active?.windows.find(entry=>entry.window.webContents===event.sender)?.init??null);
  ipcMain.on('overlay-cancel',event=>{if(active?.windows.some(entry=>entry.window.webContents===event.sender))active.finish(null);});
  ipcMain.on('overlay-select',(event,rect)=>{
    const entry=active?.windows.find(entry=>entry.window.webContents===event.sender);
    if(!entry)return;
    try{
      const crop=pixelRect(rect,entry.init.bounds,entry.image.getSize());
      active.finish(entry.image.crop(crop).toDataURL());
    }catch(error){entry.window.webContents.send('overlay-error',error.message);}
  });
  main.on('closed',()=>active?.finish(null));
  screen.on('display-removed',()=>active?.finish(null));
  screen.on('display-metrics-changed',()=>active?.finish(null));
  return async function capture(mode,preset){
    if(active) return null;
    if(!['region','fixed'].includes(mode))throw new Error('잘못된 캡처 방식입니다.');
    if(mode==='fixed'&&!presetSize(preset?.width,preset?.height))throw new Error('잘못된 캡처 크기입니다.');
    let resolveResult;
    const result=new Promise(resolve=>{resolveResult=resolve;});
    const session={windows:[],finish(data){
      if(active!==session)return;
      active=null;
      for(const entry of session.windows){if(!entry.window.isDestroyed())entry.window.destroy();}
      if(!main.isDestroyed()){if(main.isMinimized())main.restore();main.show();main.focus();}
      resolveResult(data);
    }};
    active=session;
    try{
      main.hide();
      await new Promise(resolve=>setTimeout(resolve,250));
      if(active!==session)return result;
      const displays=screen.getAllDisplays();
      const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.max(...displays.map(d=>Math.ceil(d.bounds.width*d.scaleFactor))),height:Math.max(...displays.map(d=>Math.ceil(d.bounds.height*d.scaleFactor)))}});
      if(active!==session)return result;
      const cursorDisplay=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      for(const display of displays){
        const source=sources.find(s=>s.display_id===String(display.id));
        if(!source||source.thumbnail.isEmpty())throw new Error('화면을 가져오지 못했습니다. 모니터 연결과 화면 캡처 권한을 확인하세요.');
        const window=new BrowserWindow({...display.bounds,show:false,frame:false,transparent:false,backgroundColor:'#000000',alwaysOnTop:true,skipTaskbar:true,resizable:false,movable:false,hasShadow:false,enableLargerThanScreen:true,webPreferences:{preload:path.join(__dirname,'overlay-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
        const entry={window,image:source.thumbnail,init:{mode,preset,bounds:{width:display.bounds.width,height:display.bounds.height},image:source.thumbnail.toDataURL(),imageSize:source.thumbnail.getSize()}};
        session.windows.push(entry);
        window.setAlwaysOnTop(true,'screen-saver');
        window.setMenuBarVisibility(false);
        window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
        window.webContents.on('will-navigate',event=>event.preventDefault());
        window.on('closed',()=>session.finish(null));
        await window.loadFile(path.join(__dirname,'overlay.html'));
        if(active!==session)return result;
      }
      for(const {window} of session.windows)window.showInactive();
      session.windows[displays.findIndex(d=>d.id===cursorDisplay.id)]?.window.focus();
      return await result;
    }catch(error){session.finish(null);throw error;}
  };
}
module.exports={installOverlayCapture};
