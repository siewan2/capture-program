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
    setAlwaysOnTop(){}setMenuBarVisibility(){}showInactive(){}focus(){}async loadFile(){}
  }
  const main=new EventEmitter();Object.assign(main,{hide(){hidden=true;},show(){shown=true;},focus(){},isMinimized(){return false;},isDestroyed(){return false;}});
  const electron={BrowserWindow:Window,screen:{getAllDisplays:()=>displays,getDisplayNearestPoint:()=>displays[0],getCursorScreenPoint:()=>({x:-100,y:100}),on(){}},ipcMain:{handle:(name,fn)=>handlers[name]=fn,on:(name,fn)=>events[name]=fn},desktopCapturer:{async getSources(){assert.equal(hidden,true);return displays.map(d=>({display_id:String(d.id),thumbnail:{isEmpty:()=>false,getSize:()=>({width:1920,height:1080}),toDataURL:()=>`display-${d.id}`,crop(rect){cropped={id:d.id,rect};return{toDataURL:()=>`cropped-${d.id}`};}}}));}}};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/capture-overlay'),'utf8'),{require:name=>name==='electron'?electron:name==='./geometry'?require('../src/geometry'):require(name),module,__dirname:require('node:path').resolve('src'),setTimeout:fn=>{fn();}});
  return{capture:module.exports.installOverlayCapture(main),handlers,events,windows,get shown(){return shown;},get cropped(){return cropped;}};
}
async function ready(state){for(let i=0;i<20&&state.windows.length<2;i++)await Promise.resolve();assert.equal(state.windows.length,2);}
test('overlay uses each actual display bounds and crops selected display at its own scale',async()=>{
  const s=setup(),result=s.capture('region');await ready(s);
  assert.equal(s.windows[0].options.x,-1280);
  assert.equal(s.handlers['overlay-init']({sender:s.windows[0].webContents}).image,'display-1');
  s.events['overlay-select']({sender:s.windows[0].webContents},{x:100,y:60,width:320,height:200});
  assert.equal(await result,'cropped-1');assert.equal(s.cropped.id,1);assert.deepEqual(s.cropped.rect,{x:150,y:90,width:480,height:300});assert.equal(s.shown,true);assert.ok(s.windows.every(w=>w.destroyed));
});
test('overlay blocks concurrent sessions, ignores unrelated IPC and restores app on cancel',async()=>{
  const s=setup(),result=s.capture('fixed',{width:640,height:480});await ready(s);
  assert.equal(await s.capture('region'),null);
  s.events['overlay-cancel']({sender:{}});assert.ok(s.windows.every(w=>!w.destroyed));
  s.events['overlay-cancel']({sender:s.windows[1].webContents});assert.equal(await result,null);assert.equal(s.shown,true);assert.ok(s.windows.every(w=>w.destroyed));
});
