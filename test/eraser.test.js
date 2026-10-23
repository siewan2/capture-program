const {test}=require('node:test');const assert=require('node:assert/strict');
const {restorePixels}=require('../src/annotations');
test('eraser restores source pixels, preserves uncovered annotations and does not erase screenshot content',()=>{
  const actual=new Uint8ClampedArray([255,0,0,255, 255,0,0,255, 10,20,30,255]);
  const source=new Uint8ClampedArray([10,20,30,255, 10,20,30,255, 10,20,30,255]);
  restorePixels(actual,source,[0,0,0,255,0,0,0,0,0,0,0,128]);assert.deepEqual(Array.from(actual),[10,20,30,255,255,0,0,255,10,20,30,255]);
});
test('eraser antialias interpolation keeps opaque background opaque and restores transparency',()=>{
  const actual=new Uint8ClampedArray([255,0,0,255,255,0,0,255]);
  restorePixels(actual,new Uint8ClampedArray([0,0,255,255,0,0,0,0]),[0,0,0,128,0,0,0,255]);
  assert.deepEqual(Array.from(actual),[127,0,128,255,0,0,0,0]);
});
