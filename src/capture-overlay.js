const {BrowserWindow,desktopCapturer,screen,ipcMain,nativeImage}=require('electron');
const path=require('node:path');
const {listWindows,localWindows}=require('./windows-native');
const {updatePresets}=require('./presets');
const {stitchDesktop}=require('./virtual-desktop');
const {pixelRect,presetSize}=require('./geometry');
let active=null;
function installOverlayCapture(main){
  ipcMain.handle('overlay-init',event=>active?.windows.find(entry=>entry.window.webContents===event.sender)?.init??null);
  ipcMain.handle('overlay-preset',(event,action)=>{
    const entry=active?.windows.find(entry=>entry.window.webContents===event.sender);
    if(!entry||entry.init.mode!=='fixed')throw new Error('지정 크기 캡처에서만 프리셋을 변경할 수 있습니다.');
    const result=updatePresets(active.presets,action);active.presets=result.presets;main.webContents.send('presets-updated',result);return result;
  });
  ipcMain.on('overlay-cancel',event=>{if(active?.windows.some(entry=>entry.window.webContents===event.sender))active.finish(null);});
  ipcMain.on('overlay-select',(event,rect)=>{
    const entry=active?.windows.find(entry=>entry.window.webContents===event.sender);
    if(!entry)return;
    try{
      if(entry.init.mode==='window'){
        if(!entry.init.targets.some(target=>target.id===rect?.windowId))throw new Error('선택할 수 없는 창입니다.');
        const source=active.windowSources.find(source=>source.id===rect.windowId);
        if(!source||source.thumbnail.isEmpty())throw new Error('이 창을 캡처하지 못했습니다.');
        active.finish(source.thumbnail.toDataURL());return;
      }
      const crop=pixelRect(rect,entry.init.bounds,entry.image.getSize());
      active.finish(entry.image.crop(crop).toDataURL());
    }catch(error){entry.window.webContents.send('overlay-error',error.message);}
  });
  main.on('closed',()=>active?.finish(null));
  screen.on('display-removed',()=>active?.finish(null));
  screen.on('display-metrics-changed',()=>active?.finish(null));
  return async function capture(mode,preset,options={}){
    if(active) return null;
    if(!['region','fixed','window'].includes(mode))throw new Error('잘못된 캡처 방식입니다.');
    if(mode==='fixed'&&!presetSize(preset?.width,preset?.height))throw new Error('잘못된 캡처 크기입니다.');
    let resolveResult;
    const result=new Promise(resolve=>{resolveResult=resolve;});
    const session={presets:(options.presets||[preset]).filter(p=>presetSize(p?.width,p?.height)).map(p=>({width:p.width,height:p.height})),windows:[],finish(data){
      if(active!==session)return;
      active=null;
      for(const entry of session.windows){if(!entry.window.isDestroyed())entry.window.destroy();}
      if(!main.isDestroyed()){if(main.isMinimized())main.restore();main.show();main.focus();}
      resolveResult(data);
    }};
    active=session;
    try{
      const wasVisible=main.isVisible();
      main.hide();
      // Only allow the compositor to remove a visible editor; tray captures need no delay.
      if(wasVisible)await new Promise(resolve=>setTimeout(resolve,40));
      if(active!==session)return result;
      const displays=screen.getAllDisplays();
      const thumbnailSize={width:Math.max(...displays.map(d=>Math.ceil(d.bounds.width*d.scaleFactor))),height:Math.max(...displays.map(d=>Math.ceil(d.bounds.height*d.scaleFactor)))};
      const [sources,windowSources,nativeWindows]=await Promise.all([
        desktopCapturer.getSources({types:['screen'],thumbnailSize}),
        mode==='window'?desktopCapturer.getSources({types:['window'],thumbnailSize:{width:7680,height:4320}}):[],
        mode==='window'?listWindows():[]
      ]);
      session.windowSources=windowSources;
      if(mode==='window'&&!nativeWindows.some(w=>windowSources.some(s=>s.id.split(':')[1]===w.handle&&!s.thumbnail.isEmpty())))throw new Error('선택할 수 있는 창이 없습니다.');
      if(active!==session)return result;
      const cursorPoint=screen.getCursorScreenPoint(),cursorDisplay=screen.getDisplayNearestPoint(cursorPoint);
      const virtual=mode==='fixed'?stitchDesktop(displays,sources,screen,nativeImage):null;
      const captureDisplays=virtual?[{id:'virtual',bounds:virtual.windowBounds}]:displays;
      const loads=[];
      for(const display of captureDisplays){
        const source=virtual?{thumbnail:virtual.image}:sources.find(s=>s.display_id===String(display.id));
        if(!source||source.thumbnail.isEmpty())throw new Error('화면을 가져오지 못했습니다. 모니터 연결과 화면 캡처 권한을 확인하세요.');
        const window=new BrowserWindow({...display.bounds,show:false,frame:false,transparent:false,backgroundColor:'#000000',alwaysOnTop:true,skipTaskbar:true,resizable:false,movable:false,hasShadow:false,enableLargerThanScreen:true,webPreferences:{preload:path.join(__dirname,'overlay-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
        if(virtual)window.setBounds(screen.screenToDipRect(window,virtual.physical));
        const nativeBounds=mode==='window'?screen.dipToScreenRect(null,display.bounds):null;
        const targets=mode==='window'?localWindows(nativeWindows,windowSources,display,nativeBounds):[];
        const physicalCursor=virtual?screen.dipToScreenPoint(cursorPoint):null;
        const entry={window,image:source.thumbnail,init:{mode,preset,presets:session.presets,visibleAreas:virtual?virtual.monitors.map(m=>({x:m.physical.x-virtual.physical.x,y:m.physical.y-virtual.physical.y,width:m.physical.width,height:m.physical.height})):null,startPoint:virtual?{x:physicalCursor.x-virtual.physical.x,y:physicalCursor.y-virtual.physical.y}:null,magnifier:options?.magnifier!==false,targets,bounds:virtual?{width:virtual.physical.width,height:virtual.physical.height}:{width:display.bounds.width,height:display.bounds.height},image:source.thumbnail.toDataURL(),imageSize:source.thumbnail.getSize()}};
        session.windows.push(entry);
        window.setAlwaysOnTop(true,'screen-saver');
        window.setMenu(null);window.setMenuBarVisibility(false);
        window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
        window.webContents.on('will-navigate',event=>event.preventDefault());
        window.on('closed',()=>session.finish(null));
        loads.push(window.loadFile(path.join(__dirname,'overlay.html')));
      }
      await Promise.all(loads);
      if(active!==session)return result;
      for(const {window} of session.windows)window.showInactive();
      session.windows[virtual?0:displays.findIndex(d=>d.id===cursorDisplay.id)]?.window.focus();
      return await result;
    }catch(error){session.finish(null);throw error;}
  };
}
module.exports={installOverlayCapture};
