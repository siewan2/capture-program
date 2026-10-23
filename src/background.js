function installBackground({app,main,Tray,Menu,iconPath}){
  let quitting=false;
  const tray=new Tray(iconPath);
  const show=()=>{if(main.isDestroyed())return;if(main.isMinimized())main.restore();main.show();main.focus();};
  const capture=mode=>{if(!main.isDestroyed())main.webContents.send('capture-shortcut',mode);};
  tray.setToolTip('Capture Program · 단축키로 캡처');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'프로그램 열기',click:show},
    {type:'separator'},
    {label:'영역 캡처',click:()=>capture('region')},
    {label:'창 캡처',click:()=>capture('window')},
    {label:'지정 크기 캡처',click:()=>capture('fixed')},
    {type:'separator'},
    {label:'완전히 종료',click:()=>app.quit()}
  ]));
  tray.on('double-click',show);
  app.on('before-quit',()=>{quitting=true;});
  main.on('close',event=>{if(!quitting&&!tray.isDestroyed()){event.preventDefault();main.hide();}});
  app.on('will-quit',()=>{if(!tray.isDestroyed())tray.destroy();});
  return tray;
}
module.exports={installBackground};
