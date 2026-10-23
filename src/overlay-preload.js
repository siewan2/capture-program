const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('overlayAPI',{
  init:()=>ipcRenderer.invoke('overlay-init'),
  select:rect=>ipcRenderer.send('overlay-select',rect),
  cancel:()=>ipcRenderer.send('overlay-cancel'),
  onError:callback=>ipcRenderer.on('overlay-error',(_,message)=>callback(message))
});
