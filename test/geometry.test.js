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
