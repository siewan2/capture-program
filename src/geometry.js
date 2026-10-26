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
if (typeof module !== 'undefined') module.exports = {selection, presetSize, pixelRect, restoreFixedRect, moveRect, resizeRect, rectHandles, hitRect};
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
function hitRect(rect,p,tolerance=6){
  const nearest=rectHandles(rect).map(handle=>({...handle,distance:Math.hypot(p.x-handle.x,p.y-handle.y)})).sort((a,b)=>a.distance-b.distance)[0];
  if(nearest.distance<=tolerance)return nearest.name;
  const edge=Math.min(tolerance,4);
  if(p.x>=rect.x-edge&&p.x<=rect.x+rect.width+edge&&p.y>=rect.y-edge&&p.y<=rect.y+rect.height+edge){
    if(Math.abs(p.x-rect.x)<=edge)return 'w';if(Math.abs(p.x-rect.x-rect.width)<=edge)return 'e';if(Math.abs(p.y-rect.y)<=edge)return 'n';if(Math.abs(p.y-rect.y-rect.height)<=edge)return 's';
    return 'move';
  }
  return null;
}

function restoreFixedRect(saved,physical){
  if(!saved||![saved.x,saved.y,saved.width,saved.height].every(Number.isFinite)||saved.width<=0||saved.height<=0)return null;
  const width=Math.min(Math.round(saved.width),physical.width),height=Math.min(Math.round(saved.height),physical.height);
  if(width<1||height<1)return null;
  return{x:Math.max(0,Math.min(physical.width-width,Math.round(saved.x-physical.x))),y:Math.max(0,Math.min(physical.height-height,Math.round(saved.y-physical.y))),width,height};
}
