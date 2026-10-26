const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('overlayAPI',{
  init:()=>ipcRenderer.invoke('overlay-init'),
  preset:action=>ipcRenderer.invoke('overlay-preset',action),
  select:rect=>ipcRenderer.send('overlay-select',rect),
  remember:rect=>ipcRenderer.send('overlay-state',rect),
  cancel:rect=>ipcRenderer.send('overlay-cancel',rect),
  onError:callback=>ipcRenderer.on('overlay-error',(_,message)=>callback(message))
});
