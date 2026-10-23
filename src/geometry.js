'use strict';
function selection(a, b, width, height) {
  const clamp = (v, max) => Math.max(0, Math.min(max, v));
  const x1 = clamp(a.x, width), y1 = clamp(a.y, height);
  const x2 = clamp(b.x, width), y2 = clamp(b.y, height);
  return { x: Math.min(x1,x2), y: Math.min(y1,y2), width: Math.abs(x2-x1), height: Math.abs(y2-y1) };
}
function presetSize(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 16384 && height <= 16384;
}
function pixelRect(rect,bounds,imageSize){
  if(!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)throw new Error('영역을 다시 선택하세요.');
  const scaleX=imageSize.width/bounds.width,scaleY=imageSize.height/bounds.height;
  const x=Math.max(0,Math.min(imageSize.width-1,Math.round(rect.x*scaleX)));
  const y=Math.max(0,Math.min(imageSize.height-1,Math.round(rect.y*scaleY)));
  const width=Math.min(imageSize.width-x,Math.max(1,Math.round(rect.width*scaleX)));
  const height=Math.min(imageSize.height-y,Math.max(1,Math.round(rect.height*scaleY)));
  return{x,y,width,height};
}
if (typeof module !== 'undefined') module.exports = {selection, presetSize, pixelRect, moveRect, resizeRect, rectHandles, hitRect};
function moveRect(rect,dx,dy,bounds){return {...rect,x:Math.max(0,Math.min(bounds.width-rect.width,rect.x+dx)),y:Math.max(0,Math.min(bounds.height-rect.height,rect.y+dy))};}
function resizeRect(rect,handle,dx,dy,modifiers,bounds){
  const ax=handle.includes('w')?-1:handle.includes('e')?1:0,ay=handle.includes('n')?-1:handle.includes('s')?1:0;
  const centeredX=modifiers.alt||ax===0,centeredY=modifiers.alt||ay===0;
  const anchorX=centeredX?rect.x+rect.width/2:ax<0?rect.x+rect.width:rect.x;
  const anchorY=centeredY?rect.y+rect.height/2:ay<0?rect.y+rect.height:rect.y;
  const maxW=centeredX?2*Math.min(anchorX,bounds.width-anchorX):ax<0?anchorX:bounds.width-anchorX;
  const maxH=centeredY?2*Math.min(anchorY,bounds.height-anchorY):ay<0?anchorY:bounds.height-anchorY;
  let width=rect.width+(ax?ax*dx*(modifiers.alt?2:1):0),height=rect.height+(ay?ay*dy*(modifiers.alt?2:1):0);
  if(modifiers.shift){
    let scale=ax&&ay?(Math.abs(width/rect.width-1)>=Math.abs(height/rect.height-1)?width/rect.width:height/rect.height):ax?width/rect.width:height/rect.height;
    scale=Math.min(Math.min(maxW/rect.width,maxH/rect.height),Math.max(Math.max(4/rect.width,4/rect.height),scale));
    width=rect.width*scale;height=rect.height*scale;
  }else{width=ax?Math.min(maxW,Math.max(4,width)):rect.width;height=ay?Math.min(maxH,Math.max(4,height)):rect.height;}
  return {x:centeredX?anchorX-width/2:ax<0?anchorX-width:anchorX,y:centeredY?anchorY-height/2:ay<0?anchorY-height:anchorY,width,height};
}
function rectHandles(rect){
  const {x,y,width:w,height:h}=rect;return [['nw',x,y],['n',x+w/2,y],['ne',x+w,y],['e',x+w,y+h/2],['se',x+w,y+h],['s',x+w/2,y+h],['sw',x,y+h],['w',x,y+h/2]].map(([name,x,y])=>({name,x,y}));
}
function hitRect(rect,p,tolerance=8){
  for(const handle of rectHandles(rect))if(Math.abs(p.x-handle.x)<=tolerance&&Math.abs(p.y-handle.y)<=tolerance)return handle.name;
  if(p.x>=rect.x-tolerance&&p.x<=rect.x+rect.width+tolerance&&p.y>=rect.y-tolerance&&p.y<=rect.y+rect.height+tolerance){
    if(Math.abs(p.x-rect.x)<=tolerance)return 'w';if(Math.abs(p.x-rect.x-rect.width)<=tolerance)return 'e';if(Math.abs(p.y-rect.y)<=tolerance)return 'n';if(Math.abs(p.y-rect.y-rect.height)<=tolerance)return 's';
    return 'move';
  }
  return null;
}
