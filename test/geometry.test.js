const {test}=require('node:test');
const assert=require('node:assert/strict');
const {selection,presetSize}=require('../src/geometry');
test('reverse drag produces positive capture dimensions',()=>{assert.deepEqual(selection({x:200,y:100},{x:20,y:30},400,300),{x:20,y:30,width:180,height:70});});
test('selection stays within image bounds',()=>{assert.deepEqual(selection({x:-20,y:30},{x:900,y:800},640,480),{x:0,y:30,width:640,height:450});});
test('fixed sizes must be positive integral bounded pixel sizes',()=>{assert.equal(presetSize(1920,1080),true);for(const p of [[0,1],[-1,10],[1.5,20],[20000,20],[NaN,2]])assert.equal(presetSize(...p),false);});
const {pixelRect}=require('../src/geometry');
test('overlay coordinates map from logical pixels to 150% display pixels',()=>{
  assert.deepEqual(pixelRect({x:100,y:60,width:320,height:200},{width:1280,height:720},{width:1920,height:1080}),{x:150,y:90,width:480,height:300});
});
test('fixed image size remains exact at 150% scaling and screen edge',()=>{
  assert.deepEqual(pixelRect({x:1280-640/1.5,y:720-480/1.5,width:640/1.5,height:480/1.5},{width:1280,height:720},{width:1920,height:1080}),{x:1280,y:600,width:640,height:480});
});
test('overlay rejects invalid selection and clamps boundary rounding',()=>{
  assert.throws(()=>pixelRect({x:NaN,y:0,width:10,height:10},{width:100,height:100},{width:100,height:100}));
  assert.deepEqual(pixelRect({x:99.9,y:99.9,width:2,height:2},{width:100,height:100},{width:150,height:150}),{x:149,y:149,width:1,height:1});
});
const {resizeRect,moveRect,hitRect}=require('../src/geometry');
test('fixed capture sides and corners resize relative to opposite anchors',()=>{
  const r={x:100,y:100,width:200,height:100},bounds={width:1000,height:800};
  assert.deepEqual(resizeRect(r,'e',50,0,{},bounds),{x:100,y:100,width:250,height:100});
  assert.deepEqual(resizeRect(r,'nw',-20,-30,{},bounds),{x:80,y:70,width:220,height:130});
  assert.equal(hitRect(r,{x:100,y:150}),'w');assert.equal(hitRect(r,{x:150,y:130}),'move');
});
test('Shift preserves aspect, Alt preserves center, combined resize stays within screen',()=>{
  const r={x:100,y:100,width:200,height:100},bounds={width:500,height:400};
  const shifted=resizeRect(r,'se',100,10,{shift:true},bounds);assert.equal(shifted.width/shifted.height,2);assert.equal(shifted.x,100);
  const alt=resizeRect(r,'e',20,0,{alt:true},bounds);assert.deepEqual(alt,{x:80,y:100,width:240,height:100});
  const both=resizeRect(r,'se',2000,2000,{alt:true,shift:true},bounds);
  assert.equal(both.width/both.height,2);assert.equal(both.x+both.width/2,200);assert.equal(both.y+both.height/2,150);assert.ok(both.x>=0&&both.y>=0&&both.x+both.width<=500&&both.y+both.height<=400);
});
test('movement clamps to screen and extreme inward resize remains positive',()=>{
  const r={x:100,y:100,width:200,height:100},bounds={width:500,height:400};
  assert.deepEqual(moveRect(r,999,-999,bounds),{x:300,y:0,width:200,height:100});
  const resized=resizeRect(r,'se',-999,-999,{shift:true},bounds);assert.ok(resized.width>0&&resized.height>0);assert.equal(resized.width/resized.height,2);
});
