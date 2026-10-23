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
if (typeof module !== 'undefined') module.exports = {selection, presetSize, pixelRect};
