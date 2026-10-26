const canvas=document.getElementById('surface'),ctx=canvas.getContext('2d'),hint=document.getElementById('hint');
let config,image,start=null,rect=null,submitted=false,hovered=null,cursor=null,fixedDrag=null,localPresets=[];
function paintShade(){
  const shade=document.getElementById('shade');shade.hidden=!config.shade||config.mode==='window';if(shade.hidden)return;
  const x=rect?rect.x/config.bounds.width*100:0,y=rect?rect.y/config.bounds.height*100:100,w=rect?rect.width/config.bounds.width*100:0,h=rect?rect.height/config.bounds.height*100:0;
  const bands=[[0,0,100,y],[0,y,x,h],[x+w,y,100-x-w,h],[0,y+h,100,100-y-h]];
  bands.forEach(([left,top,width,height],i)=>Object.assign(shade.children[i].style,{left:left+'%',top:top+'%',width:Math.max(0,width)+'%',height:Math.max(0,height)+'%'}));
}
function paint(){
  paintShade();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(config.mode==='window'){
    if(hovered){
      const sx=canvas.width/config.bounds.width,sy=canvas.height/config.bounds.height;
      ctx.strokeStyle='#ff3030';ctx.lineWidth=3*sx;
      ctx.strokeRect(hovered.x*sx,hovered.y*sy,hovered.width*sx,hovered.height*sy);
      hint.textContent=hovered.name+' · 클릭하여 창 캡처 · Esc 취소';
    }else hint.textContent='캡처할 창 위로 마우스를 이동하세요 · Esc 취소';
  }else if(rect){const r=pixelRect(rect,config.bounds,config.imageSize);ctx.strokeStyle='#ff3030';ctx.lineWidth=1;ctx.strokeRect(r.x+.5,r.y+.5,Math.max(0,r.width-1),Math.max(0,r.height-1));hint.textContent=`${r.width} × ${r.height} px · ${config.mode==='fixed'?'이동·크기 조절 후 Enter 또는 더블클릭':'마우스를 놓으면 캡처'} · Esc 취소`;}
  if(config.mode==='fixed'&&rect){
    const sx=canvas.width/config.bounds.width,sy=canvas.height/config.bounds.height;
    const handleSize=4*config.bounds.width/canvas.getBoundingClientRect().width;
    ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#ff3030';ctx.lineWidth=1;
    for(const handle of rectHandles(rect)){ctx.fillRect((handle.x-handleSize)*sx,(handle.y-handleSize)*sy,2*handleSize*sx,2*handleSize*sy);ctx.strokeRect((handle.x-handleSize)*sx,(handle.y-handleSize)*sy,2*handleSize*sx,2*handleSize*sy);}ctx.restore();syncFixedInputs();positionFixedUI();
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
  const x=Math.max(0,Math.min(image.naturalWidth-1,Math.floor(p.x*image.naturalWidth/config.bounds.width))),y=Math.max(0,Math.min(image.naturalHeight-1,Math.floor(p.y*image.naturalHeight/config.bounds.height)));
  const zoom=document.getElementById('zoom').getContext('2d');zoom.imageSmoothingEnabled=false;zoom.fillStyle='#333';zoom.fillRect(0,0,160,160);
  zoom.drawImage(image,x-40,y-40,80,80,0,0,160,160);zoom.strokeStyle='#ff3030';zoom.lineWidth=1;zoom.beginPath();zoom.moveTo(0,81.5);zoom.lineTo(160,81.5);zoom.moveTo(81.5,0);zoom.lineTo(81.5,160);zoom.stroke();zoom.strokeStyle='white';zoom.strokeRect(80.5,80.5,1,1);
  box.hidden=false;box.style.left=Math.max(0,Math.min(config.bounds.width-164,p.x+24+164>config.bounds.width?p.x-188:p.x+24))+'px';box.style.top=Math.max(0,Math.min(config.bounds.height-188,p.y+24+188>config.bounds.height?p.y-212:p.y+24))+'px';
  document.getElementById('zoomLabel').textContent=`${x}, ${y} · 2×`;
}
function hoverWindow(p){hovered=(config.targets||[]).find(w=>p.x>=w.x&&p.y>=w.y&&p.x<w.x+w.width&&p.y<w.y+w.height)||null;}
function point(e){const bounds=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(config.bounds.width,(e.clientX-bounds.left)*config.bounds.width/bounds.width)),y:Math.max(0,Math.min(config.bounds.height,(e.clientY-bounds.top)*config.bounds.height/bounds.height))};}
function fixedHit(p){return rect&&hitRect(rect,p,6*config.bounds.width/canvas.getBoundingClientRect().width);}
function initFixed(){
  const width=config.preset.width*config.bounds.width/config.imageSize.width,height=config.preset.height*config.bounds.height/config.imageSize.height;
  const scale=Math.min(1,config.bounds.width/width,config.bounds.height/height);
  const center=config.startPoint||{x:config.bounds.width/2,y:config.bounds.height/2};
  rect={x:Math.max(0,Math.min(config.bounds.width-width*scale,center.x-width*scale/2)),y:Math.max(0,Math.min(config.bounds.height-height*scale,center.y-height*scale/2)),width:width*scale,height:height*scale};
}
function renderCapturePresets(selected){
  const select=document.getElementById('capturePresets');select.replaceChildren(new Option('사용자 지정','custom'),...localPresets.map((p,i)=>new Option(`${p.width} × ${p.height}`,String(i))));
  select.value=Number.isInteger(selected)?String(selected):'custom';
}
function syncFixedInputs(){
  const size=pixelRect(rect,config.bounds,config.imageSize);
  for(const [id,value] of [['captureWidth',size.width],['captureHeight',size.height]])if(document.activeElement!==document.getElementById(id))document.getElementById(id).value=value;
  if(document.activeElement!==document.getElementById('capturePresets')){const index=localPresets.findIndex(p=>p.width===size.width&&p.height===size.height);document.getElementById('capturePresets').value=index<0?'custom':String(index);}
}
function setCaptureSize(width,height){
  if(!presetSize(width,height))throw new Error('가로·세로는 1~16384 사이 정수로 입력하세요.');
  if(width>config.imageSize.width||height>config.imageSize.height)throw new Error('전체 모니터 화면보다 큰 크기는 적용할 수 없습니다.');
  const w=width*config.bounds.width/config.imageSize.width,h=height*config.bounds.height/config.imageSize.height,cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
  rect={x:Math.max(0,Math.min(config.bounds.width-w,cx-w/2)),y:Math.max(0,Math.min(config.bounds.height-h,cy-h/2)),width:w,height:h};paint();
}
function readCaptureSize(){return{width:Number(document.getElementById('captureWidth').value),height:Number(document.getElementById('captureHeight').value)};}
function applyCaptureSize(){try{const size=readCaptureSize();setCaptureSize(size.width,size.height);document.getElementById('fixedStatus').textContent='크기를 적용했습니다.';return size;}catch(error){document.getElementById('fixedStatus').textContent=error.message;return null;}}
document.getElementById('applyCaptureSize').onclick=applyCaptureSize;
document.getElementById('capturePresets').onchange=async event=>{
  const index=Number(event.target.value);if(event.target.value==='custom'||!localPresets[index])return;
  try{const p=localPresets[index];setCaptureSize(p.width,p.height);await window.overlayAPI.preset({type:'select',index});document.getElementById('fixedStatus').textContent='프리셋을 적용했습니다.';}catch(error){document.getElementById('fixedStatus').textContent=error.message;}
};
document.getElementById('addCapturePreset').onclick=async()=>{
  const size=applyCaptureSize();if(!size)return;
  try{const result=await window.overlayAPI.preset({type:'add',preset:size});localPresets=result.presets;renderCapturePresets(result.selected);document.getElementById('fixedStatus').textContent='프리셋을 저장했습니다.';}catch(error){document.getElementById('fixedStatus').textContent=error.message;}
};
function positionFixedUI(){
  const areas=config.visibleAreas||[{x:0,y:0,...config.bounds}],cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
  const area=areas.find(a=>cx>=a.x&&cx<a.x+a.width&&cy>=a.y&&cy<a.y+a.height)||areas.slice().sort((a,b)=>Math.hypot(cx-a.x-a.width/2,cy-a.y-a.height/2)-Math.hypot(cx-b.x-b.width/2,cy-b.y-b.height/2))[0];
  const box=canvas.getBoundingClientRect(),sx=box.width/config.bounds.width,sy=box.height/config.bounds.height;
  const left=box.left+area.x*sx,top=box.top+area.y*sy,right=left+area.width*sx,bottom=top+area.height*sy;
  const controls=document.getElementById('fixedControls');controls.style.maxWidth=Math.max(200,right-left-16)+'px';
  const size=controls.getBoundingClientRect();controls.style.transform='none';controls.style.left=Math.max(left+8,Math.min(right-size.width-8,box.left+cx*sx-size.width/2))+'px';
  const below=box.top+(rect.y+rect.height)*sy+12,above=box.top+rect.y*sy-size.height-12;
  controls.style.top=Math.max(top+8,Math.min(bottom-size.height-8,below+size.height<bottom?below:above>top?above:bottom-size.height-12))+'px';controls.style.bottom='auto';
  hint.style.left=(left+right)/2+'px';hint.style.top=top+16+'px';hint.style.maxWidth=right-left-24+'px';
}
function fixedCursor(p){const hit=fixedDrag?.handle||fixedHit(p);canvas.style.cursor=hit==='move'?'move':hit?hit+'-resize':'crosshair';}
function submit(){if(rect&&!submitted){submitted=true;window.overlayAPI.select(rect);}}
canvas.onpointerdown=e=>{
  if(!config||!image?.complete||!image.naturalWidth||e.button!==0||submitted)return;
  if(config.mode==='window'){hoverWindow(point(e));if(hovered){submitted=true;window.overlayAPI.select({windowId:hovered.id});}return;}
  canvas.setPointerCapture(e.pointerId);
  cursor=point(e);magnify(cursor);
  if(config.mode==='fixed'){
    const p=point(e);let hit=fixedHit(p);if(!hit){rect=moveRect(rect,p.x-rect.x,p.y-rect.y,config.bounds);hit='move';}
    fixedDrag={start:p,rect:{...rect},handle:hit};fixedCursor(p);paint();return;
  }
  start=point(e);rect=null;paint();
};
canvas.onpointermove=e=>{
  if(!config||!image?.complete||!image.naturalWidth||submitted)return;
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
  if(config?.mode==='fixed'){fixedDrag=null;fixedCursor(point(e));return;}
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
  if(e.target.closest('input,select,button')){if(e.key==='Enter'&&e.target.matches('input')){e.preventDefault();applyCaptureSize();}return;}
  if(e.key==='Enter'){e.preventDefault();submit();return;}
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  const d=directions[e.key];if(d){e.preventDefault();const step=e.shiftKey?10:1;rect=moveRect(rect,d[0]*step*config.bounds.width/config.imageSize.width,d[1]*step*config.bounds.height/config.imageSize.height,config.bounds);paint();if(cursor)fixedCursor(cursor);}
};
document.oncontextmenu=e=>{if(e.target.closest('input,select'))return;e.preventDefault();window.overlayAPI.cancel();};
window.overlayAPI.onError(message=>{submitted=false;hint.textContent=message;});
(async()=>{try{
  config=await window.overlayAPI.init();if(!config)return;
  image=document.getElementById('backdrop');await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=config.image;});
  canvas.width=config.imageSize.width;canvas.height=config.imageSize.height;if(config.mode==='fixed'){localPresets=config.presets?.length?config.presets:[config.preset];renderCapturePresets();initFixed();document.getElementById('fixedControls').hidden=false;}paint();
  if(config.mode==='window')hint.textContent='캡처할 창 위로 마우스를 이동한 후 클릭하세요 · Esc 취소';

}catch{hint.textContent='화면을 표시하지 못했습니다. Esc로 취소하세요.';}})();
