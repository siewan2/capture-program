const canvas=document.getElementById('surface'),ctx=canvas.getContext('2d'),hint=document.getElementById('hint');
let config,image,start=null,rect=null,submitted=false;
function paint(){
  ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.fillStyle='#0006';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(rect){const r=pixelRect(rect,config.bounds,config.imageSize);ctx.drawImage(image,r.x,r.y,r.width,r.height,r.x,r.y,r.width,r.height);ctx.strokeStyle='#b6a8ff';ctx.lineWidth=2*canvas.width/config.bounds.width;ctx.strokeRect(r.x,r.y,r.width,r.height);hint.textContent=`${r.width} × ${r.height} px · ${config.mode==='fixed'?'클릭하여 캡처':'마우스를 놓으면 캡처'} · Esc 취소`;}
}
function point(e){return{x:Math.max(0,Math.min(config.bounds.width,e.clientX)),y:Math.max(0,Math.min(config.bounds.height,e.clientY))};}
function fixedAt(p){
  const w=config.preset.width*config.bounds.width/config.imageSize.width,h=config.preset.height*config.bounds.height/config.imageSize.height;
  if(w>config.bounds.width||h>config.bounds.height){rect=null;hint.textContent='지정 크기가 이 화면보다 큽니다. 다른 화면에서 선택하거나 Esc로 취소하세요.';return;}
  rect={x:Math.min(p.x,config.bounds.width-w),y:Math.min(p.y,config.bounds.height-h),width:w,height:h};
}
function submit(){if(rect&&!submitted){submitted=true;window.overlayAPI.select(rect);}}
canvas.onpointerdown=e=>{
  if(!config||e.button!==0||submitted)return;
  canvas.setPointerCapture(e.pointerId);
  if(config.mode==='fixed'){fixedAt(point(e));if(rect)submit();return;}
  start=point(e);rect=null;
};
canvas.onpointermove=e=>{
  if(!config||submitted)return;
  if(config.mode==='fixed'){fixedAt(point(e));paint();return;}
  if(!start)return;
  const next=selection(start,point(e),config.bounds.width,config.bounds.height);
  rect=next.width>=1&&next.height>=1?next:null;paint();
};
canvas.onpointerup=e=>{
  if(!start||submitted)return;
  const next=selection(start,point(e),config.bounds.width,config.bounds.height);start=null;
  rect=next.width>=1&&next.height>=1?next:null;
  if(rect)submit();else{paint();hint.textContent='마우스로 영역을 드래그하세요 · Esc 취소';}
};
canvas.onpointercancel=()=>{start=null;rect=null;if(config)paint();};
document.onkeydown=e=>{if(e.key==='Escape')window.overlayAPI.cancel();};
document.oncontextmenu=e=>{e.preventDefault();window.overlayAPI.cancel();};
window.overlayAPI.onError(message=>{submitted=false;hint.textContent=message;});
(async()=>{try{
  config=await window.overlayAPI.init();if(!config)return;
  image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=config.image;});
  canvas.width=config.imageSize.width;canvas.height=config.imageSize.height;paint();
  if(config.mode==='fixed')hint.textContent=`${config.preset.width} × ${config.preset.height} px · 원하는 위치를 클릭하세요 · Esc 취소`;
}catch{hint.textContent='화면을 표시하지 못했습니다. Esc로 취소하세요.';}})();
