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
if(typeof module!=='undefined')module.exports={drawStroke,drawText,textFont,drawShape,drawFreeform,restorePixels};

function fillStroke(context,options,closed=true){
  if(closed&&options.fillMode&&options.fillMode!=='none'){context.fillStyle=options.fillColor;context.fill();}
  if(!closed||options.fillMode!=='fill'){context.strokeStyle=options.color;context.lineWidth=options.width;context.lineJoin='round';context.lineCap='round';context.stroke();}
}
function drawShape(context,kind,rect,options){
  context.save();context.beginPath();
  if(kind==='rect')context.rect(rect.x,rect.y,rect.width,rect.height);
  else context.ellipse(rect.x+rect.width/2,rect.y+rect.height/2,rect.width/2,rect.height/2,0,0,Math.PI*2);
  fillStroke(context,options);context.restore();
}
function drawFreeform(context,points,options,closed){
  if(points.length<2)return;
  context.save();context.beginPath();context.moveTo(points[0].x,points[0].y);
  for(const point of points.slice(1))context.lineTo(point.x,point.y);
  if(closed&&points.length>=3)context.closePath();
  fillStroke(context,options,closed&&points.length>=3);context.restore();
}
function restorePixels(target,original,mask){
  for(let i=0;i<target.length;i+=4){
    const coverage=mask[i+3];if(!coverage)continue;
    if(coverage===255){for(let c=0;c<4;c++)target[i+c]=original[i+c];continue;}
    if(target[i]===original[i]&&target[i+1]===original[i+1]&&target[i+2]===original[i+2]&&target[i+3]===original[i+3])continue;
    const mix=coverage/255,oldAlpha=target[i+3]/255,baseAlpha=original[i+3]/255,alpha=oldAlpha*(1-mix)+baseAlpha*mix;
    for(let c=0;c<3;c++)target[i+c]=alpha?(target[i+c]*oldAlpha*(1-mix)+original[i+c]*baseAlpha*mix)/alpha:0;
    target[i+3]=alpha*255;
  }
  return target;
}
