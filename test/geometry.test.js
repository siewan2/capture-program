const {test}=require('node:test');
const assert=require('node:assert/strict');
const {selection,presetSize}=require('../src/geometry');
test('reverse drag produces positive capture dimensions',()=>{assert.deepEqual(selection({x:200,y:100},{x:20,y:30},400,300),{x:20,y:30,width:180,height:70});});
test('selection stays within image bounds',()=>{assert.deepEqual(selection({x:-20,y:30},{x:900,y:800},640,480),{x:0,y:30,width:640,height:450});});
test('fixed sizes must be positive integral bounded pixel sizes',()=>{assert.equal(presetSize(1920,1080),true);for(const p of [[0,1],[-1,10],[1.5,20],[20000,20],[NaN,2]])assert.equal(presetSize(...p),false);});
