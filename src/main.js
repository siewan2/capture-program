const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, clipboard, nativeImage, Tray, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const {installBackground}=require('./background');
const {installOverlayCapture}=require('./capture-overlay');
const {saveImage} = require('./storage');
const {applyShortcuts} = require('./shortcuts');
let main,tray;
const primaryInstance=app.requestSingleInstanceLock();
if(!primaryInstance)app.quit();
app.on('second-instance',()=>{if(main&&!main.isDestroyed()){if(main.isMinimized())main.restore();main.show();main.focus();}});
app.whenReady().then(async () => {
  if(!primaryInstance)return;
  const configPath=path.join(app.getPath('userData'),'save-settings.json');
  let saveDirectory=path.join(app.getPath('pictures'),'Capture Program');
  try{const config=JSON.parse(await fs.readFile(configPath,'utf8'));if(typeof config.directory==='string'&&path.isAbsolute(config.directory))saveDirectory=config.directory;}catch(error){if(error.code!=='ENOENT')console.warn('저장 폴더 설정을 읽지 못해 기본 폴더를 사용합니다.');}
  ipcMain.handle('save-directory',()=>saveDirectory);
  ipcMain.handle('choose-save-directory',async()=>{
    const result=await dialog.showOpenDialog(main,{title:'캡처 이미지 저장 폴더',defaultPath:saveDirectory,properties:['openDirectory','createDirectory']});
    if(result.canceled||!result.filePaths.length)return null;
    const selected=result.filePaths[0];
    await fs.mkdir(path.dirname(configPath),{recursive:true});
    await fs.writeFile(configPath,JSON.stringify({directory:selected}),'utf8');
    saveDirectory=selected;
    return saveDirectory;
  });
  main = new BrowserWindow({width:1320,height:900,minWidth:980,minHeight:650,backgroundColor:'#f5f7fb',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
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
    main.webContents.send('capture-shortcut', mode);
  }));
  main.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  main.webContents.on('will-navigate', event => event.preventDefault());
  ipcMain.handle('save', async (_, payload) => { await saveImage(saveDirectory,payload); return true; });
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});

app.on('will-quit', () => {if(app.isReady())globalShortcut.unregisterAll();});
