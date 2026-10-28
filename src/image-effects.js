function grayscalePixels(data){
  for(let i=0;i<data.length;i+=4){const gray=Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]);data[i]=gray;data[i+1]=gray;data[i+2]=gray;}
  return data;
}
function addBlackBorder(context,width,height,thickness=2){
  const border=[1,2,3,4,5].includes(thickness)?thickness:2;
  context.save();context.fillStyle='#000000';
  context.fillRect(0,0,width,Math.min(border,height));context.fillRect(0,Math.max(0,height-border),width,Math.min(border,height));
  context.fillRect(0,0,Math.min(border,width),height);context.fillRect(Math.max(0,width-border),0,Math.min(border,width),height);context.restore();
}
if(typeof module!=='undefined')module.exports={grayscalePixels,addBlackBorder};
