const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, clipboard, nativeImage, Tray, Menu } = require('electron');
const path = require('node:path');
const {installBackground}=require('./background');
const {installOverlayCapture,isOverlayActive}=require('./capture-overlay');
const {createSaveDialogs}=require('./save-dialogs');
const {createPinnedStore}=require('./pinned-store');
const {createStartup,STARTUP_ARG}=require('./startup');
const {applyShortcuts} = require('./shortcuts');
if(process.platform==='win32')app.setAppUserModelId('com.siewan.captureprogram');
let main,tray;
const primaryInstance=app.requestSingleInstanceLock();
if(!primaryInstance)app.quit();
app.on('second-instance',(_,argv)=>{if(argv.includes(STARTUP_ARG))return;if(main&&!main.isDestroyed()){if(main.isMinimized())main.restore();main.show();main.focus();}});
app.whenReady().then(async () => {
  if(!primaryInstance)return;
  main = new BrowserWindow({width:1320,height:900,show:!process.argv.includes(STARTUP_ARG),minWidth:980,minHeight:650,backgroundColor:'#f5f7fb',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  main.setMenu(null);
  const pinned=createPinnedStore(path.join(app.getPath('userData'),'pinned-captures'));
  let flushedForQuit=false;
  app.on('before-quit',event=>{if(flushedForQuit)return;event.preventDefault();pinned.flush().finally(()=>{flushedForQuit=true;app.quit();});});
  ipcMain.handle('list-pinned',()=>pinned.list());
  ipcMain.handle('put-pinned',(_,item)=>pinned.put(item));
  ipcMain.handle('remove-pinned',(_,id)=>pinned.remove(id));
  const startup=createStartup({app});
  ipcMain.handle('get-startup',()=>startup.get());
  ipcMain.handle('set-startup',(_,enabled)=>startup.set(enabled));
  tray=installBackground({app,main,Tray,Menu,iconPath:path.join(__dirname,'tray.png')});
  const captureOverlay=installOverlayCapture(main);
  ipcMain.handle('capture-overlay',(_,mode,preset,options)=>captureOverlay(mode,preset,options));
  ipcMain.handle('copy-image',(_,data)=>{
    if(typeof data!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data))throw new Error('잘못된 이미지입니다.');
    const image=nativeImage.createFromDataURL(data);if(image.isEmpty())throw new Error('이미지를 읽지 못했습니다.');
    clipboard.writeImage(image);return true;
  });
  main.loadFile(path.join(__dirname,'index.html'));
  ipcMain.handle('shortcuts', (_, shortcuts) => applyShortcuts(globalShortcut, shortcuts, mode => {
    if(mode==='gallery'){
      if(isOverlayActive()||BrowserWindow.getAllWindows().some(window=>window!==main&&!window.isDestroyed()))return;
      if(main.isMinimized())main.restore();main.show();main.focus();
    }
    main.webContents.send('capture-shortcut', mode);
  }));
  main.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  main.webContents.on('will-navigate', event => event.preventDefault());
  const saving=createSaveDialogs({dialog,main,initialDirectory:app.getPath('pictures')});
  ipcMain.handle('save',(_,payload)=>saving.save(payload));
  ipcMain.handle('choose-batch-folder',(_,preferred)=>saving.chooseBatch(preferred));
  ipcMain.handle('save-batch-item',(_,token,payload)=>saving.saveBatch(token,payload));
  ipcMain.handle('end-batch-save',(_,token)=>saving.endBatch(token));
  ipcMain.on('capture-menu',(_,id,disabled)=>{
    if(typeof id!=='string')return;
    Menu.buildFromTemplate([
      {label:'이미지 저장…',enabled:!disabled,click:()=>main.webContents.send('gallery-action',{action:'save',id})},
      {label:'삭제',enabled:!disabled,click:()=>main.webContents.send('gallery-action',{action:'delete',id})}
    ]).popup({window:main});
  });
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});

app.on('will-quit', () => {if(app.isReady())globalShortcut.unregisterAll();});
