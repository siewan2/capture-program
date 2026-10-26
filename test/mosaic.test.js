const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mosaicBlocks,mosaicPixels}=require('../src/mosaic');
function fixture(){const source={width:64,height:32,data:new Uint8ClampedArray(64*32*4)};for(let y=0;y<32;y++)for(let x=0;x<64;x++)source.data.set([x*4,y*8,100,255],(y*64+x)*4);return source;}
test('three strengths use distinct pixel blocks and leave pixels outside the brush unchanged',()=>{
  const source=fixture(),original=new Uint8ClampedArray(source.data),mask=new Uint8ClampedArray(source.data.length);mask[3]=255;
  const results=[];
  for(const strength of ['weak','medium','strong']){const output=mosaicPixels(source,mask,{x:0,y:0,width:64,height:32},mosaicBlocks[strength]);results.push(output[0]);assert.deepEqual(Array.from(output.slice(4,8)),[4,0,100,255]);}
  assert.deepEqual(results,[14,30,62]);assert.deepEqual(source.data,original);
});
test('source-aligned blocks remain stable across mask updates and partial brush edges do not blend original pixels',()=>{
  const source=fixture(),region={x:2,y:2,width:5,height:5},mask=new Uint8ClampedArray(5*5*4),cache=new Map();mask[3]=1;mask[7]=255;
  const first=mosaicPixels(source,mask,region,8,cache),second=mosaicPixels(source,mask,region,8,cache);
  assert.deepEqual(Array.from(first.slice(0,4)),Array.from(first.slice(4,8)));assert.deepEqual(first,second);assert.equal(cache.size,1);
});
test('block averages handle transparent pixels without color bleed',()=>{
  const source={width:2,height:1,data:new Uint8ClampedArray([255,0,0,255,0,0,255,0])},mask=new Uint8ClampedArray([0,0,0,255,0,0,0,255]);
  assert.deepEqual(Array.from(mosaicPixels(source,mask,{x:0,y:0,width:2,height:1},8)),[255,0,0,128,255,0,0,128]);
});
