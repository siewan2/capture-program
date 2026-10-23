const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {installBackground}=require('../src/background');
function setup(){
  const app=new EventEmitter(),main=new EventEmitter();let hidden=false,shown=false,focused=false;const sent=[];
  app.quit=()=>app.emit('before-quit');
  Object.assign(main,{isDestroyed:()=>false,isMinimized:()=>true,restore(){},show(){shown=true;hidden=false;},focus(){focused=true;},hide(){hidden=true;},webContents:{send:(...args)=>sent.push(args)}});
  class Tray extends EventEmitter{setToolTip(){}setContextMenu(menu){this.menu=menu;}isDestroyed(){return !!this.destroyed;}destroy(){this.destroyed=true;}}
  const tray=installBackground({app,main,Tray,Menu:{buildFromTemplate:items=>items},iconPath:'icon.png'});
  return{app,main,tray,sent,get hidden(){return hidden;},get shown(){return shown&&focused;}};
}
test('closing hides app while tray captures still reach renderer and double-click restores it',()=>{
  const s=setup();let prevented=false;s.main.emit('close',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(s.hidden,true);
  s.tray.menu.find(item=>item.label==='영역 캡처').click();assert.deepEqual(s.sent,[['capture-shortcut','region']]);assert.equal(s.hidden,true);
  s.tray.emit('double-click');assert.equal(s.shown,true);
});
test('explicit quit allows closing and releases tray resource',()=>{
  const s=setup();s.tray.menu.find(item=>item.label==='완전히 종료').click();let prevented=false;s.main.emit('close',{preventDefault(){prevented=true;}});assert.equal(prevented,false);
  s.app.emit('will-quit');assert.equal(s.tray.isDestroyed(),true);
});
