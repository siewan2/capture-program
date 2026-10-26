const mosaicBlocks={weak:8,medium:16,strong:32};
function mosaicPixels(source,mask,region,blockSize,cache=new Map()){
  const output=new Uint8ClampedArray(region.width*region.height*4);
  function colorAt(x,y){
    const bx=Math.floor(x/blockSize)*blockSize,by=Math.floor(y/blockSize)*blockSize,key=by*source.width+bx;
    if(cache.has(key))return cache.get(key);
    let red=0,green=0,blue=0,alpha=0,count=0;
    for(let py=by;py<Math.min(source.height,by+blockSize);py++)for(let px=bx;px<Math.min(source.width,bx+blockSize);px++){
      const i=(py*source.width+px)*4,a=source.data[i+3];red+=source.data[i]*a;green+=source.data[i+1]*a;blue+=source.data[i+2]*a;alpha+=a;count++;
    }
    const color=[alpha?red/alpha:0,alpha?green/alpha:0,alpha?blue/alpha:0,count?alpha/count:0];cache.set(key,color);return color;
  }
  for(let y=0;y<region.height;y++)for(let x=0;x<region.width;x++){
    const local=(y*region.width+x)*4,sx=region.x+x,sy=region.y+y,original=(sy*source.width+sx)*4;
    // Never mix readable original pixels into a partially covered brush edge.
    if(mask[local+3]){const color=colorAt(sx,sy);for(let c=0;c<4;c++)output[local+c]=color[c];}
    else for(let c=0;c<4;c++)output[local+c]=source.data[original+c];
  }
  return output;
}
if(typeof module!=='undefined')module.exports={mosaicBlocks,mosaicPixels};
