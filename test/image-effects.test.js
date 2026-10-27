const {test}=require('node:test');
const assert=require('node:assert/strict');
const {grayscalePixels,addBlackBorder}=require('../src/image-effects');
const {arrowGeometry}=require('../src/annotations');
test('grayscale uses luminance and preserves transparency and existing neutral pixels',()=>{
  const pixels=new Uint8ClampedArray([255,0,0,255,0,255,0,128,0,0,255,0,42,42,42,77]);grayscalePixels(pixels);
  assert.deepEqual(Array.from(pixels),[54,54,54,255,182,182,182,128,18,18,18,0,42,42,42,77]);
});
test('automatic frame covers exactly two inside pixels without expanding the image',()=>{
  const pixels=new Uint8Array(10*8).fill(255),context={save(){},restore(){},fillRect(x,y,w,h){for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)pixels[py*10+px]=0;}};
  addBlackBorder(context,10,8);
  for(let y=0;y<8;y++)for(let x=0;x<10;x++)assert.equal(pixels[y*10+x],x<2||x>=8||y<2||y>=6?0:255);
});
test('arrows point toward the drag endpoint in every direction and shorten their heads for short drags',()=>{
  for(const end of [{x:100,y:0},{x:-100,y:0},{x:0,y:100},{x:50,y:-50}]){
    const shape=arrowGeometry({x:0,y:0},end,3),dx=end.x-shape.base.x,dy=end.y-shape.base.y;
    assert.ok(dx*end.x+dy*end.y>0);assert.ok(Number.isFinite(shape.left.x+shape.right.y));
  }
  assert.equal(arrowGeometry({x:2,y:2},{x:2,y:2},3),null);
  assert.ok(arrowGeometry({x:0,y:0},{x:3,y:0},10).base.x>0);
});
