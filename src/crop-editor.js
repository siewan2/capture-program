function fitCropRect(bounds,ratio,previous){
  let width=previous?.width||bounds.width*.8,height=previous?.height||bounds.height*.8;
  if(ratio){const scale=Math.min(width/ratio[0],height/ratio[1]);width=ratio[0]*scale;height=ratio[1]*scale;}
  width=Math.min(bounds.width,Math.max(1,width));height=Math.min(bounds.height,Math.max(1,height));
  const cx=previous?previous.x+previous.width/2:bounds.width/2,cy=previous?previous.y+previous.height/2:bounds.height/2;
  return{x:Math.max(0,Math.min(bounds.width-width,cx-width/2)),y:Math.max(0,Math.min(bounds.height-height,cy-height/2)),width,height};
}
function cropPixels(rect,bounds){
  const x=Math.max(0,Math.min(bounds.width-1,Math.round(rect.x))),y=Math.max(0,Math.min(bounds.height-1,Math.round(rect.y)));
  return{x,y,width:Math.max(1,Math.min(bounds.width-x,Math.round(rect.width))),height:Math.max(1,Math.min(bounds.height-y,Math.round(rect.height)))};
}
function createCropEditor({image,workspace,layer,guide,controls,ratioSelect,dimensions,applyButton,cancelButton,onApply,onActiveChange}){
  const ratios={'free':null,'1:1':[1,1],'3:4':[3,4],'4:3':[4,3],'9:16':[9,16]};
  const context=guide.getContext('2d');let active=false,rect=null,drag=null;
  const bounds=()=>({width:image.width,height:image.height});
  const position=()=>{
    if(!active)return;
    const box=image.getBoundingClientRect(),area=workspace.getBoundingClientRect();
    const left=Math.max(box.left,area.left),top=Math.max(box.top,area.top),right=Math.min(box.right,area.right),bottom=Math.min(box.bottom,area.bottom);
    Object.assign(layer.style,{left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'});
    Object.assign(guide.style,{left:box.left-left+'px',top:box.top-top+'px',width:box.width+'px',height:box.height+'px'});
    Object.assign(controls.style,{left:(area.left+8)+'px',top:(area.top+8)+'px',maxWidth:Math.max(100,area.width-16)+'px'});
  };
  const paint=()=>{
    if(!active)return;position();
    const {width,height}=bounds(),r=cropPixels(rect,bounds());context.clearRect(0,0,width,height);context.fillStyle='#0006';
    context.fillRect(0,0,width,r.y);context.fillRect(0,r.y,r.x,r.height);context.fillRect(r.x+r.width,r.y,width-r.x-r.width,r.height);context.fillRect(0,r.y+r.height,width,height-r.y-r.height);
    context.strokeStyle='#ff3030';context.lineWidth=1;context.strokeRect(r.x+.5,r.y+.5,Math.max(0,r.width-1),Math.max(0,r.height-1));
    const size=4*width/Math.max(1,image.getBoundingClientRect().width);context.fillStyle='#fff';
    for(const h of rectHandles(rect)){context.fillRect(h.x-size,h.y-size,size*2,size*2);context.strokeRect(h.x-size,h.y-size,size*2,size*2);}
    dimensions.textContent=`${r.width} × ${r.height} px`;
  };
  const point=event=>{const box=guide.getBoundingClientRect();return{x:Math.max(0,Math.min(image.width,(event.clientX-box.left)*image.width/box.width)),y:Math.max(0,Math.min(image.height,(event.clientY-box.top)*image.height/box.height))};};
  const hit=p=>hitRect(rect,p,6*image.width/Math.max(1,image.getBoundingClientRect().width));
  const cursor=p=>{const name=drag?.handle||hit(p);guide.style.cursor=name==='move'?'move':name?name+'-resize':'crosshair';};
  function cancel(){if(!active)return;active=false;drag=null;layer.hidden=true;controls.hidden=true;onActiveChange(false);}
  function apply(){if(!active)return;const result=cropPixels(rect,bounds());cancel();onApply(result);}
  guide.onpointerdown=event=>{
    if(!active||event.button!==0)return;event.preventDefault();event.stopPropagation();guide.focus({preventScroll:true});
    const p=point(event);let handle=hit(p);if(!handle){rect=moveRect(rect,p.x-rect.x-rect.width/2,p.y-rect.y-rect.height/2,bounds());handle='move';}
    drag={point:p,rect:{...rect},handle};guide.setPointerCapture(event.pointerId);paint();cursor(p);
  };
  guide.onpointermove=event=>{
    if(!active)return;const p=point(event);
    if(drag){const dx=p.x-drag.point.x,dy=p.y-drag.point.y;rect=drag.handle==='move'?moveRect(drag.rect,dx,dy,bounds()):resizeRect(drag.rect,drag.handle,dx,dy,{shift:!!ratios[ratioSelect.value]||event.shiftKey,alt:event.altKey},bounds());paint();}
    cursor(p);
  };
  guide.onpointerup=event=>{drag=null;if(active)cursor(point(event));};guide.onpointercancel=()=>{drag=null;};
  guide.ondblclick=event=>{event.preventDefault();apply();};guide.oncontextmenu=event=>{event.preventDefault();cancel();};
  ratioSelect.onchange=()=>{if(!active)return;rect=fitCropRect(bounds(),ratios[ratioSelect.value],rect);paint();try{localStorage.setItem('cropRatio',ratioSelect.value);}catch{}};
  applyButton.onclick=apply;cancelButton.onclick=cancel;
  window.addEventListener('keydown',event=>{
    if(!active||event.isComposing)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();return;}
    if(event.target.closest('input,textarea,select,button'))return;
    if(event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();apply();return;}
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(direction){event.preventDefault();event.stopImmediatePropagation();const step=event.shiftKey?10:1;rect=moveRect(rect,direction[0]*step,direction[1]*step,bounds());paint();}
  },true);
  new ResizeObserver(paint).observe(image);workspace.addEventListener('scroll',position);window.addEventListener('resize',paint);
  return{get active(){return active;},cancel,start(){
    if(active||!image.width||!image.height)return;
    let selected='free';try{const stored=localStorage.getItem('cropRatio');if(Object.hasOwn(ratios,stored))selected=stored;}catch{}
    ratioSelect.value=selected;rect=fitCropRect(bounds(),ratios[selected]);guide.width=image.width;guide.height=image.height;active=true;layer.hidden=false;controls.hidden=false;paint();guide.focus({preventScroll:true});onActiveChange(true);
  }};
}
if(typeof module!=='undefined')module.exports={fitCropRect,cropPixels};
