const {test}=require('node:test');const assert=require('node:assert/strict');
const {virtualLayout,stitchDesktop}=require('../src/virtual-desktop');
test('desktop mosaic preserves native pixels across negative origins, different DPI and screen boundaries',()=>{
  const displays=[{id:1,bounds:{x:-2,y:0,width:2,height:2},scaleFactor:2},{id:2,bounds:{x:0,y:0,width:3,height:3},scaleFactor:1}];
  const screen={dipToScreenRect:(_,r)=>r.x<0?{x:-4,y:0,width:4,height:4}:r,screenToDipRect:(_,r)=>r};
  const layout=virtualLayout(displays,screen);assert.deepEqual(layout.physical,{x:-4,y:0,width:7,height:4});
  const sources=displays.map(d=>({display_id:String(d.id),thumbnail:{isEmpty:()=>false,resize:({width,height})=>({toBitmap(){const b=Buffer.alloc(width*height*4);for(let p=0;p<b.length;p+=4){b[p]=d.id*50;b[p+3]=255;}return b;}})}}));
  let pixels;
  const result=stitchDesktop(displays,sources,screen,{createFromBitmap:(b,size)=>{pixels=b;return size;}});
  assert.deepEqual(result.image,{width:7,height:4});assert.equal(pixels[3*4],50);assert.equal(pixels[4*4],100);assert.equal(pixels[(3*7+5)*4],0);assert.equal(pixels[(3*7+5)*4+3],255);
});
