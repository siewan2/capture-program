const canvas=document.getElementById('surface'),ctx=canvas.getContext('2d'),hint=document.getElementById('hint');
let config,image,start=null,rect=null,submitted=false,hovered=null,cursor=null;
function paint(){
  ctx.drawImage(image,0,0,canvas.width,canvas.height);if(config.mode!=='window'){ctx.fillStyle='#0006';ctx.fillRect(0,0,canvas.width,canvas.height);}
  if(config.mode==='window'){
    if(hovered){
      const sx=canvas.width/config.bounds.width,sy=canvas.height/config.bounds.height;
      ctx.strokeStyle='#ff3030';ctx.lineWidth=3*sx;
      ctx.strokeRect(hovered.x*sx,hovered.y*sy,hovered.width*sx,hovered.height*sy);
      hint.textContent=hovered.name+' · 클릭하여 창 캡처 · Esc 취소';
    }else hint.textContent='캡처할 창 위로 마우스를 이동하세요 · Esc 취소';
  }else if(rect){const r=pixelRect(rect,config.bounds,config.imageSize);ctx.drawImage(image,r.x,r.y,r.width,r.height,r.x,r.y,r.width,r.height);ctx.strokeStyle='#b6a8ff';ctx.lineWidth=2*canvas.width/config.bounds.width;ctx.strokeRect(r.x,r.y,r.width,r.height);hint.textContent=`${r.width} × ${r.height} px · ${config.mode==='fixed'?'클릭하여 캡처':'마우스를 놓으면 캡처'} · Esc 취소`;}
  if(config.mode==='region'&&cursor){
    const x=Math.floor(cursor.x*canvas.width/config.bounds.width)+0.5,y=Math.floor(cursor.y*canvas.height/config.bounds.height)+0.5;
    ctx.save();ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);
    ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();ctx.restore();
  }


}
function magnify(p){
  const box=document.getElementById('magnifier');
  if(!config.magnifier||config.mode!=='region'){box.hidden=true;return;}
  const x=Math.max(0,Math.min(image.width-1,Math.floor(p.x*image.width/config.bounds.width))),y=Math.max(0,Math.min(image.height-1,Math.floor(p.y*image.height/config.bounds.height)));
  const zoom=document.getElementById('zoom').getContext('2d');zoom.imageSmoothingEnabled=false;zoom.fillStyle='#333';zoom.fillRect(0,0,160,160);
  zoom.drawImage(image,x-16,y-16,32,32,0,0,160,160);zoom.strokeStyle='#ff3030';zoom.lineWidth=1;zoom.beginPath();zoom.moveTo(0,82.5);zoom.lineTo(160,82.5);zoom.moveTo(82.5,0);zoom.lineTo(82.5,160);zoom.stroke();zoom.strokeStyle='white';zoom.strokeRect(80.5,80.5,4,4);
  box.hidden=false;box.style.left=Math.max(0,Math.min(config.bounds.width-164,p.x+24+164>config.bounds.width?p.x-188:p.x+24))+'px';box.style.top=Math.max(0,Math.min(config.bounds.height-188,p.y+24+188>config.bounds.height?p.y-212:p.y+24))+'px';
  document.getElementById('zoomLabel').textContent=`${x}, ${y} · 5×`;
}
function hoverWindow(p){hovered=(config.targets||[]).find(w=>p.x>=w.x&&p.y>=w.y&&p.x<w.x+w.width&&p.y<w.y+w.height)||null;}
function point(e){return{x:Math.max(0,Math.min(config.bounds.width,e.clientX)),y:Math.max(0,Math.min(config.bounds.height,e.clientY))};}
function fixedAt(p){
  const w=config.preset.width*config.bounds.width/config.imageSize.width,h=config.preset.height*config.bounds.height/config.imageSize.height;
  if(w>config.bounds.width||h>config.bounds.height){rect=null;hint.textContent='지정 크기가 이 화면보다 큽니다. 다른 화면에서 선택하거나 Esc로 취소하세요.';return;}
  rect={x:Math.min(p.x,config.bounds.width-w),y:Math.min(p.y,config.bounds.height-h),width:w,height:h};
}
function submit(){if(rect&&!submitted){submitted=true;window.overlayAPI.select(rect);}}
canvas.onpointerdown=e=>{
  if(!config||e.button!==0||submitted)return;
  if(config.mode==='window'){hoverWindow(point(e));if(hovered){submitted=true;window.overlayAPI.select({windowId:hovered.id});}return;}
  canvas.setPointerCapture(e.pointerId);
  cursor=point(e);magnify(cursor);
  if(config.mode==='fixed'){fixedAt(point(e));if(rect)submit();return;}
  start=point(e);rect=null;paint();
};
canvas.onpointermove=e=>{
  if(!config||submitted)return;
  if(config.mode==='window'){hoverWindow(point(e));paint();return;}
  cursor=point(e);magnify(cursor);
  if(config.mode==='fixed'){fixedAt(point(e));paint();return;}
  if(!start){paint();return;}
  const next=selection(start,point(e),config.bounds.width,config.bounds.height);
  rect=next.width>=1&&next.height>=1?next:null;paint();
};
canvas.onpointerup=e=>{
  if(!start||submitted)return;
  const next=selection(start,point(e),config.bounds.width,config.bounds.height);start=null;
  rect=next.width>=1&&next.height>=1?next:null;
  if(rect)submit();else{paint();hint.textContent='마우스로 영역을 드래그하세요 · Esc 취소';}
};
canvas.onpointerleave=()=>{document.getElementById('magnifier').hidden=true;cursor=null;if(image?.complete)paint();};
canvas.onpointercancel=()=>{start=null;rect=null;if(config)paint();};
document.onkeydown=e=>{if(e.key==='Escape')window.overlayAPI.cancel();};
document.oncontextmenu=e=>{e.preventDefault();window.overlayAPI.cancel();};
window.overlayAPI.onError(message=>{submitted=false;hint.textContent=message;});
(async()=>{try{
  config=await window.overlayAPI.init();if(!config)return;
  image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=config.image;});
  canvas.width=config.imageSize.width;canvas.height=config.imageSize.height;paint();
  if(config.mode==='window')hint.textContent='캡처할 창 위로 마우스를 이동한 후 클릭하세요 · Esc 취소';
  if(config.mode==='fixed')hint.textContent=`${config.preset.width} × ${config.preset.height} px · 원하는 위치를 클릭하세요 · Esc 취소`;
}catch{hint.textContent='화면을 표시하지 못했습니다. Esc로 취소하세요.';}})();
