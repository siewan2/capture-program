function drawStroke(context,points,options){
  if(!points.length)return;
  context.save();
  context.strokeStyle=options.color;context.fillStyle=options.color;
  context.lineWidth=options.width;context.lineCap='round';context.lineJoin='round';
  context.globalAlpha=options.opacity??1;
  if(options.highlight)context.globalCompositeOperation='multiply';
  context.beginPath();
  if(points.length===1){context.arc(points[0].x,points[0].y,options.width/2,0,Math.PI*2);context.fill();}
  else{context.moveTo(points[0].x,points[0].y);for(const point of points.slice(1))context.lineTo(point.x,point.y);context.stroke();}
  context.restore();
}
function drawText(context,text,point,options){
  context.save();context.fillStyle=options.color;context.font=`${options.size}px "Segoe UI", sans-serif`;
  context.textBaseline='top';
  text.split('\n').forEach((line,index)=>context.fillText(line,point.x,point.y+index*options.size*1.25));
  context.restore();
}
if(typeof module!=='undefined')module.exports={drawStroke,drawText};
