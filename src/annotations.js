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
function textFont(options){return `${options.italic?'italic ':''}${options.bold?'700 ':'400 '}${options.size}px "Segoe UI", sans-serif`;}
function drawText(context,text,point,options){
  context.save();context.fillStyle=options.color;context.font=textFont(options);
  context.textBaseline='top';
  text.split('\n').forEach((line,index)=>{
    const y=point.y+index*options.size*1.25;
    context.fillText(line,point.x,y);
    if(options.underline&&line){
      const metrics=context.measureText(line);
      context.fillRect(point.x,y+options.size*1.06,metrics.width,Math.max(1,options.size/16));
    }
  });
  context.restore();
}
if(typeof module!=='undefined')module.exports={drawStroke,drawText,textFont};
