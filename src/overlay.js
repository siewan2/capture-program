const canvas=document.getElementById('surface'),ctx=canvas.getContext('2d'),hint=document.getElementById('hint');
let config,image,start=null,rect=null,submitted=false,hovered=null,cursor=null,fixedDrag=null;
function paint(){
  ctx.drawImage(image,0,0,canvas.width,canvas.height);if(config.mode!=='window'){ctx.fillStyle='#0006';ctx.fillRect(0,0,canvas.width,canvas.height);}
  if(config.mode==='window'){
    if(hovered){
      const sx=canvas.width/config.bounds.width,sy=canvas.height/config.bounds.height;
      ctx.strokeStyle='#ff3030';ctx.lineWidth=3*sx;
      ctx.strokeRect(hovered.x*sx,hovered.y*sy,hovered.width*sx,hovered.height*sy);
      hint.textContent=hovered.name+' · 클릭하여 창 캡처 · Esc 취소';
    }else hint.textContent='캡처할 창 위로 마우스를 이동하세요 · Esc 취소';
  }else if(rect){const r=pixelRect(rect,config.bounds,config.imageSize);ctx.drawImage(image,r.x,r.y,r.width,r.height,r.x,r.y,r.width,r.height);ctx.strokeStyle='#b6a8ff';ctx.lineWidth=2*canvas.width/config.bounds.width;ctx.strokeRect(r.x,r.y,r.width,r.height);hint.textContent=`${r.width} × ${r.height} px · ${config.mode==='fixed'?'이동·크기 조절 후 Enter 또는 더블클릭':'마우스를 놓으면 캡처'} · Esc 취소`;}
  if(config.mode==='fixed'&&rect){
    const sx=canvas.width/config.bounds.width,sy=canvas.height/config.bounds.height;
    ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#6559ec';ctx.lineWidth=sx;
    for(const handle of rectHandles(rect)){ctx.fillRect((handle.x-4)*sx,(handle.y-4)*sy,8*sx,8*sy);ctx.strokeRect((handle.x-4)*sx,(handle.y-4)*sy,8*sx,8*sy);}ctx.restore();
  }
  if(config.mode==='region'&&cursor){
    const x=Math.floor(cursor.x*canvas.width/config.bounds.width)+0.5,y=Math.floor(cursor.y*canvas.height/config.bounds.height)+0.5;
    ctx.save();ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);
    ctx.strokeStyle='#ff3030';ctx.lineWidth=1;ctx.stroke();ctx.restore();
  }


}
function magnify(p){
  const box=document.getElementById('magnifier');
  if(!config.magnifier||config.mode!=='region'){box.hidden=true;return;}
  const x=Math.max(0,Math.min(image.width-1,Math.floor(p.x*image.width/config.bounds.width))),y=Math.max(0,Math.min(image.height-1,Math.floor(p.y*image.height/config.bounds.height)));
  const zoom=document.getElementById('zoom').getContext('2d');zoom.imageSmoothingEnabled=false;zoom.fillStyle='#333';zoom.fillRect(0,0,160,160);
  zoom.drawImage(image,x-40,y-40,80,80,0,0,160,160);zoom.strokeStyle='#ff3030';zoom.lineWidth=1;zoom.beginPath();zoom.moveTo(0,81.5);zoom.lineTo(160,81.5);zoom.moveTo(81.5,0);zoom.lineTo(81.5,160);zoom.stroke();zoom.strokeStyle='white';zoom.strokeRect(80.5,80.5,1,1);
  box.hidden=false;box.style.left=Math.max(0,Math.min(config.bounds.width-164,p.x+24+164>config.bounds.width?p.x-188:p.x+24))+'px';box.style.top=Math.max(0,Math.min(config.bounds.height-188,p.y+24+188>config.bounds.height?p.y-212:p.y+24))+'px';
  document.getElementById('zoomLabel').textContent=`${x}, ${y} · 2×`;
}
function hoverWindow(p){hovered=(config.targets||[]).find(w=>p.x>=w.x&&p.y>=w.y&&p.x<w.x+w.width&&p.y<w.y+w.height)||null;}
function point(e){return{x:Math.max(0,Math.min(config.bounds.width,e.clientX)),y:Math.max(0,Math.min(config.bounds.height,e.clientY))};}
function initFixed(){
  const width=config.preset.width*config.bounds.width/config.imageSize.width,height=config.preset.height*config.bounds.height/config.imageSize.height;
  const scale=Math.min(1,config.bounds.width/width,config.bounds.height/height);
  rect={x:(config.bounds.width-width*scale)/2,y:(config.bounds.height-height*scale)/2,width:width*scale,height:height*scale};
}
function fixedCursor(p){const hit=rect&&hitRect(rect,p);canvas.style.cursor=hit==='move'?'move':hit?hit+'-resize':'crosshair';}
function submit(){if(rect&&!submitted){submitted=true;window.overlayAPI.select(rect);}}
canvas.onpointerdown=e=>{
  if(!config||e.button!==0||submitted)return;
  if(config.mode==='window'){hoverWindow(point(e));if(hovered){submitted=true;window.overlayAPI.select({windowId:hovered.id});}return;}
  canvas.setPointerCapture(e.pointerId);
  cursor=point(e);magnify(cursor);
  if(config.mode==='fixed'){
    const p=point(e);let hit=hitRect(rect,p);if(!hit){rect=moveRect(rect,p.x-rect.x,p.y-rect.y,config.bounds);hit='move';}
    fixedDrag={start:p,rect:{...rect},handle:hit};paint();return;
  }
  start=point(e);rect=null;paint();
};
canvas.onpointermove=e=>{
  if(!config||submitted)return;
  if(config.mode==='window'){hoverWindow(point(e));paint();return;}
  cursor=point(e);magnify(cursor);
  if(config.mode==='fixed'){
    const p=point(e);if(fixedDrag){const dx=p.x-fixedDrag.start.x,dy=p.y-fixedDrag.start.y;rect=fixedDrag.handle==='move'?moveRect(fixedDrag.rect,dx,dy,config.bounds):resizeRect(fixedDrag.rect,fixedDrag.handle,dx,dy,{shift:e.shiftKey,alt:e.altKey},config.bounds);paint();}fixedCursor(p);return;
  }
  if(!start){paint();return;}
  const next=selection(start,point(e),config.bounds.width,config.bounds.height);
  rect=next.width>=1&&next.height>=1?next:null;paint();
};
canvas.onpointerup=e=>{
  if(config?.mode==='fixed'){fixedDrag=null;return;}
  if(!start||submitted)return;
  const next=selection(start,point(e),config.bounds.width,config.bounds.height);start=null;
  rect=next.width>=1&&next.height>=1?next:null;
  if(rect)submit();else{paint();hint.textContent='마우스로 영역을 드래그하세요 · Esc 취소';}
};
canvas.onpointerleave=()=>{document.getElementById('magnifier').hidden=true;cursor=null;if(image?.complete)paint();};
canvas.onpointercancel=()=>{if(config?.mode==='fixed'){fixedDrag=null;return;}start=null;rect=null;if(config)paint();};
canvas.ondblclick=e=>{if(config?.mode==='fixed'){e.preventDefault();submit();}};
document.getElementById('fixedCapture').onclick=submit;document.getElementById('fixedCancel').onclick=()=>window.overlayAPI.cancel();
document.onkeydown=e=>{
  if(e.key==='Escape')window.overlayAPI.cancel();
  if(config?.mode!=='fixed'||!rect||submitted)return;
  if(e.key==='Enter'){e.preventDefault();submit();return;}
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  const d=directions[e.key];if(d){e.preventDefault();const step=e.shiftKey?10:1;rect=moveRect(rect,d[0]*step*config.bounds.width/config.imageSize.width,d[1]*step*config.bounds.height/config.imageSize.height,config.bounds);paint();}
};
document.oncontextmenu=e=>{e.preventDefault();window.overlayAPI.cancel();};
window.overlayAPI.onError(message=>{submitted=false;hint.textContent=message;});
(async()=>{try{
  config=await window.overlayAPI.init();if(!config)return;
  image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=config.image;});
  canvas.width=config.imageSize.width;canvas.height=config.imageSize.height;if(config.mode==='fixed'){initFixed();document.getElementById('fixedControls').hidden=false;}paint();
  if(config.mode==='window')hint.textContent='캡처할 창 위로 마우스를 이동한 후 클릭하세요 · Esc 취소';

}catch{hint.textContent='화면을 표시하지 못했습니다. Esc로 취소하세요.';}})();
