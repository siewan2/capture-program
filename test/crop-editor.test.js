const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fitCropRect,cropPixels}=require('../src/crop-editor');
const {resizeRect,moveRect}=require('../src/geometry');
test('crop presets fit inside the image and keep their requested ratio during corner and side resize',()=>{
  const bounds={width:800,height:600};
  for(const ratio of [[1,1],[3,4],[4,3],[9,16]]){
    const rect=fitCropRect(bounds,ratio);assert.ok(Math.abs(rect.width/rect.height-ratio[0]/ratio[1])<1e-9);
    for(const handle of ['nw','n','e','se']){
      const resized=resizeRect(rect,handle,40,25,{shift:true,alt:false},bounds),crop=cropPixels(resized,bounds);
      assert.ok(Math.abs(resized.width/resized.height-ratio[0]/ratio[1])<1e-9);
      assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.width<=800&&crop.y+crop.height<=600);
      assert.ok(Math.abs(crop.width-crop.height*ratio[0]/ratio[1])<=2);
    }
  }
});
test('free crop resizes independently, moves within bounds, and rounds subpixel selections to valid pixels',()=>{
  const bounds={width:800,height:600},rect=fitCropRect(bounds,null);
  assert.deepEqual(rect,{x:80,y:60,width:640,height:480});
  const resized=resizeRect(rect,'se',20,10,{shift:false,alt:false},bounds);assert.equal(resized.width,660);assert.equal(resized.height,490);
  assert.deepEqual(cropPixels(moveRect(resized,1000,1000,bounds),bounds),{x:140,y:110,width:660,height:490});
  assert.deepEqual(cropPixels({x:799.8,y:599.8,width:.2,height:.2},bounds),{x:799,y:599,width:1,height:1});
});
