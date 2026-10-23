const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {EventEmitter}=require('node:events');
function setup(){
  const handlers={},events={},windows=[];let hidden=false,shown=false,cropped;
  const displays=[{id:1,bounds:{x:-1280,y:0,width:1280,height:720},scaleFactor:1.5},{id:2,bounds:{x:0,y:0,width:1920,height:1080},scaleFactor:1}];
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.webContents={setWindowOpenHandler(){},on(){},send(){}};windows.push(this);}
    isDestroyed(){return this.destroyed;}destroy(){this.destroyed=true;this.emit('closed');}
    setBounds(bounds){Object.assign(this.options,bounds);}setAlwaysOnTop(){}setMenu(){}setMenuBarVisibility(){}showInactive(){}focus(){}async loadFile(){}
  }
  const main=new EventEmitter();Object.assign(main,{hide(){hidden=true;},show(){shown=true;},focus(){},isMinimized(){return false;},isDestroyed(){return false;}});
  const electron={nativeImage:{createFromBitmap:(_,size)=>({isEmpty:()=>false,getSize:()=>size,toDataURL:()=> 'virtual-desktop',crop(rect){cropped={id:'virtual',rect};return{toDataURL:()=> 'cropped-virtual'};}})},BrowserWindow:Window,screen:{screenToDipRect:(_,r)=>({x:r.x/1.5,y:r.y/1.5,width:r.width/1.5,height:r.height/1.5}),dipToScreenPoint:p=>({x:p.x*1.5,y:p.y*1.5}),dipToScreenRect:(_,bounds)=>({...bounds,x:bounds.x*1.5,y:bounds.y*1.5,width:bounds.width*1.5,height:bounds.height*1.5}),getAllDisplays:()=>displays,getDisplayNearestPoint:()=>displays[0],getCursorScreenPoint:()=>({x:-100,y:100}),on(){}},ipcMain:{handle:(name,fn)=>handlers[name]=fn,on:(name,fn)=>events[name]=fn},desktopCapturer:{async getSources(options){assert.equal(hidden,true);if(options.types[0]==='window')return[{id:'window:123:0',name:'Example',thumbnail:{isEmpty:()=>false,toDataURL:()=> 'full-window-image'}}];return displays.map(d=>({display_id:String(d.id),thumbnail:{isEmpty:()=>false,resize:({width,height})=>({toBitmap:()=>Buffer.alloc(width*height*4,d.id)}),getSize:()=>({width:1920,height:1080}),toDataURL:()=>`display-${d.id}`,crop(rect){cropped={id:d.id,rect};return{toDataURL:()=>`cropped-${d.id}`};}}}));}}};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/capture-overlay'),'utf8'),{require:name=>name==='electron'?electron:name==='./geometry'?require('../src/geometry'):name==='./virtual-desktop'?require('../src/virtual-desktop'):name==='./windows-native'?{localWindows:require('../src/windows-native').localWindows,listWindows:async()=>[{handle:'123',x:50,y:50,width:600,height:400}]}:require(name),module,__dirname:require('node:path').resolve('src'),setTimeout:fn=>{fn();}});
  return{capture:module.exports.installOverlayCapture(main),handlers,events,windows,get shown(){return shown;},get cropped(){return cropped;}};
}
async function ready(state,count=2){for(let i=0;i<30&&state.windows.length<count;i++)await Promise.resolve();assert.equal(state.windows.length,count);}
test('overlay uses each actual display bounds and crops selected display at its own scale',async()=>{
  const s=setup(),result=s.capture('region');await ready(s);
  assert.equal(s.windows[0].options.x,-1280);
  assert.equal(s.handlers['overlay-init']({sender:s.windows[0].webContents}).image,'display-1');
  s.events['overlay-select']({sender:s.windows[0].webContents},{x:100,y:60,width:320,height:200});
  assert.equal(await result,'cropped-1');assert.equal(s.cropped.id,1);assert.deepEqual(s.cropped.rect,{x:150,y:90,width:480,height:300});assert.equal(s.shown,true);assert.ok(s.windows.every(w=>w.destroyed));
});
test('overlay blocks concurrent sessions, ignores unrelated IPC and restores app on cancel',async()=>{
  const s=setup(),result=s.capture('fixed',{width:640,height:480});await ready(s,1);
  assert.equal(await s.capture('region'),null);
  s.events['overlay-cancel']({sender:{}});assert.ok(s.windows.every(w=>!w.destroyed));
  s.events['overlay-cancel']({sender:s.windows[0].webContents});assert.equal(await result,null);assert.equal(s.shown,true);assert.ok(s.windows.every(w=>w.destroyed));
});

test('window mode validates selected native window id and returns whole window thumbnail',async()=>{
  const s=setup(),result=s.capture('window');await ready(s);
  const sender=s.windows[1].webContents;
  const init=s.handlers['overlay-init']({sender});assert.equal(init.mode,'window');assert.equal(init.targets[0].id,'window:123:0');
  s.events['overlay-select']({sender},{windowId:'window:invalid:0'});assert.ok(s.windows.every(w=>!w.destroyed));
  s.events['overlay-select']({sender},{windowId:'window:123:0'});assert.equal(await result,'full-window-image');assert.equal(s.shown,true);
});

test('fixed capture creates one overlay across monitors and crops from virtual desktop coordinates',async()=>{
  const s=setup(),result=s.capture('fixed',{width:640,height:480});await ready(s,1);
  const sender=s.windows[0].webContents,init=s.handlers['overlay-init']({sender});
  assert.equal(init.image,'virtual-desktop');assert.equal(init.bounds.width,4800);assert.equal(s.windows[0].options.x,-1280);
  s.events['overlay-select']({sender},{x:1800,y:100,width:640,height:480});
  assert.equal(await result,'cropped-virtual');assert.deepEqual(s.cropped.rect,{x:1800,y:100,width:640,height:480});
});
