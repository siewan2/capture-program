const { app, BrowserWindow, desktopCapturer, ipcMain, dialog, screen, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const {installOverlayCapture}=require('./capture-overlay');
const {saveImage} = require('./storage');
const {applyShortcuts} = require('./shortcuts');
let main;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
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
  main = new BrowserWindow({width:1320,height:900,minWidth:980,minHeight:650,backgroundColor:'#111522',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const captureOverlay=installOverlayCapture(main);
  ipcMain.handle('capture-overlay',(_,mode,preset)=>captureOverlay(mode,preset));
  main.loadFile(path.join(__dirname,'index.html'));
  ipcMain.handle('shortcuts', (_, shortcuts) => applyShortcuts(globalShortcut, shortcuts, mode => {
    main.webContents.send('capture-shortcut', mode);
  }));
  main.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  main.webContents.on('will-navigate', event => event.preventDefault());
  ipcMain.handle('sources', async (_, type) => {
    const displays = screen.getAllDisplays();
    const size = type === 'screen' ? {width:Math.max(...displays.map(d=>Math.round(d.size.width*d.scaleFactor))),height:Math.max(...displays.map(d=>Math.round(d.size.height*d.scaleFactor)))} : {width:7680,height:4320};
    main.hide();
    try {
      await delay(350);
      const sources = await desktopCapturer.getSources({types:[type],thumbnailSize:size});
      return sources.filter(s=>!s.thumbnail.isEmpty() && s.name !== 'Capture Program').map(s=>({id:s.id,name:s.name,image:s.thumbnail.toDataURL(),width:s.thumbnail.getSize().width,height:s.thumbnail.getSize().height}));
    } finally { main.show(); }
  });
  ipcMain.handle('save', async (_, payload) => { await saveImage(saveDirectory,payload); return true; });
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});

app.on('will-quit', () => globalShortcut.unregisterAll());
