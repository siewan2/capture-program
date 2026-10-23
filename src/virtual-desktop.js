function virtualLayout(displays,screen){
  const monitors=displays.map(display=>({display,physical:screen.dipToScreenRect(null,display.bounds)}));
  const x=Math.min(...monitors.map(m=>m.physical.x)),y=Math.min(...monitors.map(m=>m.physical.y));
  const right=Math.max(...monitors.map(m=>m.physical.x+m.physical.width)),bottom=Math.max(...monitors.map(m=>m.physical.y+m.physical.height));
  const physical={x,y,width:right-x,height:bottom-y};
  return{monitors,physical,windowBounds:screen.screenToDipRect(null,physical)};
}
function stitchDesktop(displays,sources,screen,nativeImage){
  const layout=virtualLayout(displays,screen),{width,height}=layout.physical;
  if(width*height>100000000)throw new Error('전체 모니터 해상도가 너무 큽니다. 모니터 해상도를 낮춘 후 다시 시도하세요.');
  const bitmap=Buffer.alloc(width*height*4);
  for(let i=3;i<bitmap.length;i+=4)bitmap[i]=255;
  for(const {display,physical} of layout.monitors){
    const source=sources.find(s=>s.display_id===String(display.id));
    if(!source||source.thumbnail.isEmpty())throw new Error('모니터 화면을 가져오지 못했습니다.');
    const image=source.thumbnail.resize({width:physical.width,height:physical.height,quality:'best'}),pixels=image.toBitmap({scaleFactor:1});
    if(pixels.length!==physical.width*physical.height*4)throw new Error('모니터 이미지의 픽셀 크기를 확인하지 못했습니다.');
    for(let row=0;row<physical.height;row++)pixels.copy(bitmap,((physical.y-layout.physical.y+row)*width+physical.x-layout.physical.x)*4,row*physical.width*4,(row+1)*physical.width*4);
  }
  return{...layout,image:nativeImage.createFromBitmap(bitmap,{width,height})};
}
module.exports={virtualLayout,stitchDesktop};
