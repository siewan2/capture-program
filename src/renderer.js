const $ = id => document.getElementById(id);
const canvas=$('editor'), ctx=canvas.getContext('2d');
let originalCanvas=null,imageRevision=0,loadingImage=false,zoomDrag=null,controlDown=false;
let captures=[], current=null, tool='highlighter', drawing=null, freeform=null, busy=false;
let presets;
try {presets=JSON.parse(localStorage.getItem('presets'));} catch {}
if(!Array.isArray(presets)||!presets.length||!presets.every(p=>presetSize(p.width,p.height))) presets=[{width:640,height:480},{width:1280,height:720},{width:1920,height:1080}];
function status(message){$('status').textContent=message;}
let settings;
try { settings=JSON.parse(localStorage.getItem('settings')); } catch {}
settings={theme:settings?.theme==='dark'?'dark':'light',magnifier:settings?.magnifier!==false,shade:settings?.shade===true,lastFixedRect:settings?.lastFixedRect,lastFixedSize:presetSize(settings?.lastFixedSize?.width,settings?.lastFixedSize?.height)?settings.lastFixedSize:null,format:settings?.format==='jpeg'?'jpeg':'png',shortcuts:{region:'Control+Shift+1',window:'Control+Shift+2',fixed:'Control+Shift+3',gallery:'Control+Shift+4',...settings?.shortcuts}};
document.documentElement.dataset.theme=settings.theme;$('theme').value=settings.theme;
$('theme').onchange=()=>{settings.theme=$('theme').value;document.documentElement.dataset.theme=settings.theme;persistSettings();$('settingsStatus').textContent='화면 스타일을 저장했습니다.';};
function persistSettings(){localStorage.setItem('settings',JSON.stringify(settings));}
function showTab(name){
  finishText(true);finishFreeform(true);
  $('capturePanel').hidden=name!=='capture';$('settingsPanel').hidden=name!=='settings';
  for(const tab of ['capture','settings']){ $(tab+'Tab').classList.toggle('active',name===tab);$(tab+'Tab').setAttribute('aria-selected',String(name===tab)); }
}
async function refreshStartup(){
  try{const state=await window.captureAPI.getStartup();$('startupEnabled').checked=state.enabled;$('startupEnabled').disabled=!state.supported;$('startupStatus').textContent=state.supported?'':'Windows 배포 버전에서 설정할 수 있습니다.';}
  catch(error){$('startupStatus').textContent='자동 실행 설정 확인 실패: '+error.message;}
}
$('startupEnabled').onchange=async()=>{
  const enabled=$('startupEnabled').checked;$('startupEnabled').disabled=true;
  try{const state=await window.captureAPI.setStartup(enabled);$('startupEnabled').checked=state.enabled;$('startupStatus').textContent=state.enabled?'Windows 시작 시 백그라운드에서 실행합니다.':'Windows 자동 실행을 해제했습니다.';}
  catch(error){$('startupEnabled').checked=!enabled;$('startupStatus').textContent=error.message;}
  finally{$('startupEnabled').disabled=false;}
};
refreshStartup();
$('captureShadeEnabled').checked=settings.shade;
$('captureShadeEnabled').onchange=()=>{settings.shade=$('captureShadeEnabled').checked;persistSettings();$('settingsStatus').textContent='캡처 화면 음영 설정을 저장했습니다.';};
$('magnifierEnabled').checked=settings.magnifier;
$('magnifierEnabled').onchange=()=>{settings.magnifier=$('magnifierEnabled').checked;persistSettings();$('settingsStatus').textContent='돋보기 설정을 저장했습니다.';};
$('captureTab').onclick=()=>showTab('capture');$('settingsTab').onclick=()=>{showTab('settings');refreshStartup();};
function updateFormat(){ $('imageFormat').value=settings.format; }
updateFormat();$('imageFormat').onchange=()=>{settings.format=$('imageFormat').value;persistSettings();updateFormat();$('settingsStatus').textContent='저장 형식을 저장했습니다.';};
let shortcutRevision=0;
async function registerShortcuts(){
  const revision=++shortcutRevision;
  try{const result=await window.captureAPI.shortcuts(settings.shortcuts);if(revision!==shortcutRevision)return;for(const mode of ['region','window','fixed','gallery'])$('shortcut-status-'+mode).textContent=result[mode];}
  catch(e){$('settingsStatus').textContent='단축키 등록 실패: '+e.message;}
}
for(const mode of ['region','window','fixed','gallery']){
  const input=$('shortcut-'+mode);input.value=settings.shortcuts[mode]||'';
  input.onkeydown=event=>{
    if(event.key==='Tab')return;
    event.preventDefault();
    if(['Control','Shift','Alt','Meta'].includes(event.key))return;
    let key='';
    if(!['Backspace','Delete'].includes(event.key)){
      const parts=[];if(event.ctrlKey)parts.push('Control');if(event.altKey)parts.push('Alt');if(event.shiftKey)parts.push('Shift');if(event.metaKey)parts.push('Super');
      const code=event.code;
      const name=/^Key[A-Z]$/.test(code)?code.slice(3):/^Digit[0-9]$/.test(code)?code.slice(5):/^F([1-9]|1[0-9]|2[0-4])$/.test(code)?code:null;
      if(!name||(!event.ctrlKey&&!event.altKey&&!event.metaKey&&!name.startsWith('F'))){$('shortcut-status-'+mode).textContent='Ctrl/Alt와 문자·숫자 조합 또는 F1~F24를 사용하세요.';return;}
      parts.push(name);key=parts.join('+');
      if(Object.entries(settings.shortcuts).some(([other,value])=>other!==mode&&value===key)){$('shortcut-status-'+mode).textContent='다른 기능에서 이미 사용하는 단축키입니다.';return;}
    }
    settings.shortcuts[mode]=key;input.value=key;persistSettings();registerShortcuts();
  };
}
registerShortcuts();
window.captureAPI.onFixedRectUpdated(rect=>{settings.lastFixedRect=rect;settings.lastFixedSize={width:rect.width,height:rect.height};persistSettings();});
window.captureAPI.onPresetsUpdated(({presets:updated,selected})=>{presets=updated;renderPresets(selected);});
window.captureAPI.onCapture(mode=>{if(mode==='gallery'){showTab('capture');return;}if(!['region','window','fixed','gallery'].includes(mode)||busy||document.querySelector('dialog[open]'))return;showTab('capture');begin(mode);});
function renderPresets(selected=0){
  for(const id of ['presets','settingsPresets']){$(id).replaceChildren(...presets.map((p,i)=>new Option(`${p.width} × ${p.height}`,i)));$(id).value=Math.min(selected,presets.length-1);}
  localStorage.setItem('presets',JSON.stringify(presets));localStorage.setItem('selectedPreset',$('presets').value);
}
renderPresets(Math.max(0,Number(localStorage.getItem('selectedPreset'))||0));
$('presets').onchange=()=>{$('settingsPresets').value=$('presets').value;localStorage.setItem('selectedPreset',$('presets').value);};
$('settingsPresets').onchange=()=>{$('presets').value=$('settingsPresets').value;localStorage.setItem('selectedPreset',$('presets').value);};
$('addPreset').onclick=()=>{const width=Number($('pw').value),height=Number($('ph').value);if(!presetSize(width,height)){$('presetStatus').textContent='크기는 1~16384 사이의 정수로 입력하세요.';return;}if(presets.some(p=>p.width===width&&p.height===height)){$('presetStatus').textContent='이미 등록된 크기입니다.';return;}presets.push({width,height});renderPresets(presets.length-1);$('presetStatus').textContent='프리셋을 저장했습니다.';};
$('removePreset').onclick=()=>{if(presets.length===1){$('presetStatus').textContent='프리셋을 하나 이상 유지하세요.';return;}const index=Number($('settingsPresets').value);presets.splice(index,1);renderPresets(index);$('presetStatus').textContent='프리셋을 삭제했습니다.';};
function loadImage(data){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data;});}
function renderGallery(){
  $('count').textContent=captures.length;
  $('gallery').replaceChildren(...captures.map(item=>{
    const card=document.createElement('div');card.className='capture'+(current===item?' selected':'');
    const select=document.createElement('button');select.className='capture-select';
    const img=document.createElement('img');img.src=item.data;img.alt=item.name;
    select.title=`${item.name} · 우클릭: 저장 / 삭제`;select.append(img);select.onclick=()=>openItem(item);
    select.oncontextmenu=event=>{event.preventDefault();openItem(item);window.captureAPI.contextMenu(item.id,saving);};
    const pin=document.createElement('button');pin.className='capture-icon capture-pin';pin.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 8 0-1 6 4 4v2h-6v6l-1 2-1-2v-6H5v-2l4-4z"/></svg>';pin.title=item.pinned?'고정 해제':'고정 · 재실행 후에도 유지';pin.setAttribute('aria-label',pin.title);pin.setAttribute('aria-pressed',String(!!item.pinned));pin.disabled=!!item.pinPending;pin.onclick=()=>togglePin(item);
    const remove=document.createElement('button');remove.className='capture-icon capture-delete';remove.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';remove.title='이미지 삭제';remove.setAttribute('aria-label','이미지 삭제');remove.disabled=saving||!!item.pinPending;remove.onclick=()=>deleteItem(item);
    card.append(select,pin,remove);return card;
  }));
  for(const id of ['rotateLeft','rotate','undo','reset'])$(id).disabled=!current || loadingImage || (id==='undo'&&!current.history.length&&!textDraft&&!freeform);
  $('saveAll').disabled=!captures.length||saving;
  $('finishFreeform').disabled=!freeform;$('cancelFreeform').disabled=!freeform;

}
async function openItem(item){
  finishText(true);finishFreeform(true);current=item;
  const revision=++imageRevision;loadingImage=true;renderGallery();
  try{
    const [img,base]=await Promise.all([loadImage(item.data),loadImage(item.baseData)]);item.width=img.width;item.height=img.height;if(current!==item||revision!==imageRevision)return;
    canvas.width=img.width;canvas.height=img.height;ctx.drawImage(img,0,0);
    originalCanvas=document.createElement('canvas');originalCanvas.width=base.width;originalCanvas.height=base.height;originalCanvas.getContext('2d').drawImage(base,0,0);
    canvas.hidden=false;$('empty').hidden=true;applyViewScale();status(`${item.name} · ${img.width} × ${img.height} px`);
  }catch(error){if(revision===imageRevision)status('이미지 열기 실패: '+error.message);}
  finally{if(revision===imageRevision){loadingImage=false;renderGallery();}}
}
function applyViewScale(){
  if(!current||canvas.hidden)return;
  const area=$('workspace'),fit=Math.min(1,(area.clientWidth-24)/canvas.width,(area.clientHeight-24)/canvas.height);
  const scale=Math.max(.01,fit)*(current.viewZoom||1);
  canvas.style.width=canvas.width*scale+'px';canvas.style.height=canvas.height*scale+'px';canvas.style.maxWidth='none';canvas.style.maxHeight='none';
  positionTextInput();
}
new ResizeObserver(applyViewScale).observe($('workspace'));
function endZoom(){if(!zoomDrag)return;const id=zoomDrag.pointerId;zoomDrag=null;try{if($('workspace').hasPointerCapture(id))$('workspace').releasePointerCapture(id);}catch{}canvas.style.cursor=tool==='text'?'text':tool==='select'?'default':'crosshair';}
const workspace=$('workspace');
workspace.addEventListener('wheel',event=>{
  if(!event.ctrlKey||!current||loadingImage||event.target.closest('input,textarea,button,select'))return;
  event.preventDefault();event.stopImmediatePropagation();finishText(true);finishFreeform(true);
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?workspace.clientHeight:1);
  if(!delta)return;
  current.viewZoom=Math.max(.1,Math.min(8,(current.viewZoom||1)*Math.exp(-Math.max(-300,Math.min(300,delta))/500)));
  applyViewScale();status(`보기 배율 ${Math.round(current.viewZoom*100)}% · Ctrl+휠 또는 Ctrl+드래그로 조절`);
},{passive:false,capture:true});
workspace.addEventListener('pointerdown',event=>{
  if(!current||loadingImage||event.button!==0||!(event.ctrlKey||controlDown||event.getModifierState?.('Control')))return;
  if(event.target!==canvas&&event.target!==workspace)return;
  event.preventDefault();event.stopImmediatePropagation();finishText(true);finishFreeform(true);
  zoomDrag={x:event.clientX,y:event.clientY,zoom:current.viewZoom||1,pointerId:event.pointerId};workspace.setPointerCapture(event.pointerId);canvas.style.cursor='zoom-in';
},true);
window.addEventListener('pointermove',event=>{
  if(!zoomDrag||event.pointerId!==zoomDrag.pointerId)return;
  event.preventDefault();event.stopImmediatePropagation();const dx=event.clientX-zoomDrag.x,dy=zoomDrag.y-event.clientY,delta=Math.abs(dx)>=Math.abs(dy)?dx:dy;
  current.viewZoom=Math.max(.1,Math.min(8,zoomDrag.zoom*Math.exp(delta/180)));applyViewScale();
  canvas.style.cursor=delta>=0?'zoom-in':'zoom-out';status(`보기 확대 ${Math.round(current.viewZoom*100)}% · Ctrl+오른쪽/위: 확대 · 왼쪽/아래: 축소`);
},true);
for(const type of ['pointerup','pointercancel'])window.addEventListener(type,event=>{if(zoomDrag&&event.pointerId===zoomDrag.pointerId){event.preventDefault();event.stopImmediatePropagation();endZoom();}},true);
window.addEventListener('keydown',event=>{if(event.key==='Control')controlDown=true;});window.addEventListener('keyup',event=>{if(event.key==='Control')controlDown=false;});
window.addEventListener('blur',()=>{controlDown=false;endZoom();});
function checkpoint(){current.history.push({data:current.data,baseData:current.baseData});if(current.history.length>20)current.history.shift();}
function commit(){applyViewScale();current.data=canvas.toDataURL('image/png');current.width=canvas.width;current.height=canvas.height;persistPinned(current);renderGallery();}
async function addCapture(data){const item={id:crypto.randomUUID(),data,originalData:data,baseData:data,name:`캡처 ${new Date().toLocaleTimeString('ko-KR')}`,history:[]};captures.unshift(item);await openItem(item);return item;}
function point(event,target){const r=target.getBoundingClientRect();return{x:Math.max(0,Math.min(target.width,(event.clientX-r.left)*target.width/r.width)),y:Math.max(0,Math.min(target.height,(event.clientY-r.top)*target.height/r.height))};}
async function begin(mode){
  if(busy||saving||document.querySelector('dialog[open]'))return;
  finishText(true);finishFreeform(true);busy=true;
  try{
    const preset=mode==='fixed'&&presetSize(settings.lastFixedSize?.width,settings.lastFixedSize?.height)?settings.lastFixedSize:presets[Number($('presets').value)];
    const data=await window.captureAPI.captureOverlay(mode,preset,{magnifier:settings.magnifier,shade:settings.shade,lastFixedRect:settings.lastFixedRect,presets});
    if(data){
      showTab('capture');const item=await addCapture(data);
      if(mode==='fixed'&&presetSize(item.width,item.height)){settings.lastFixedSize={width:item.width,height:item.height};persistSettings();}
      try{await window.captureAPI.copyImage(data);status('캡처 이미지를 클립보드에 복사했습니다.');}
      catch(error){status(`캡처 완료 · 클립보드 복사 실패: ${error.message}`);}
    }else status('캡처를 취소했습니다.');
  }catch(error){status(`캡처 실패: ${error.message}`);}finally{busy=false;}
}
$('region').onclick=()=>begin('region');$('window').onclick=()=>begin('window');$('fixed').onclick=()=>begin('fixed');
const toolOptions={
  pen:{color:'#ff524f',width:3},eraser:{color:'#ffffff',width:30},highlighter:{color:'#ffeb3b',width:28,opacity:0.35},
  rect:{color:'#ff524f',width:3,fillMode:'none',fillColor:'#99ccff'},ellipse:{color:'#ff524f',width:3,fillMode:'none',fillColor:'#99ccff'},freeform:{color:'#ff524f',width:3,fillMode:'none',fillColor:'#99ccff',closed:true},text:{color:'#000000',size:32,bold:false,italic:false,underline:false}
};
try{
  const saved=JSON.parse(localStorage.getItem('toolOptions'));
  for(const [name,options] of Object.entries(toolOptions)){
    const stored=saved?.[name];if(!stored||typeof stored!=='object')continue;
    for(const [key,value] of Object.entries(options)){
      const next=stored[key];
      if(typeof next!==typeof value)continue;
      if(typeof value==='boolean')options[key]=next;
      else if(typeof value==='number'){
        const [min,max]=key==='opacity'?[.1,.8]:key==='size'?[8,240]:[1,100];
        if(Number.isFinite(next)&&next>=min&&next<=max)options[key]=next;
      }else if((key==='color'||key==='fillColor')&&/^#[0-9a-f]{6}$/i.test(next))options[key]=next;
      else if(key==='fillMode'&&['none','fill','both'].includes(next))options[key]=next;
    }
  }
}catch{}
function persistToolOptions(){try{localStorage.setItem('toolOptions',JSON.stringify(toolOptions));}catch(error){status('도구 설정 저장 실패: '+error.message);}}
let textDraft=null;
const swatches=[['검정','#000000'],['노랑','#ffeb3b'],['초록','#64e572'],['하늘','#43d9ff'],['분홍','#ff77b7'],['주황','#ffad42'],['보라','#b18aff'],['빨강','#ff524f']];
for(const [name,color] of swatches){const button=document.createElement('button');button.title=name;button.setAttribute('aria-label',name);button.dataset.color=color;button.style.backgroundColor=color;button.onmousedown=event=>{if(textDraft)event.preventDefault();};button.onclick=()=>{$('color').value=color;changeOptions();if(textDraft)$('inlineText').focus({preventScroll:true});};$('colorSwatches').append(button);}
function syncOptions(){
  canvas.style.cursor=tool==='text'?'text':'crosshair';
  const options=toolOptions[tool]||toolOptions.pen;
  const shape=['rect','ellipse','freeform'].includes(tool);
  $('fillOption').hidden=!shape||(tool==='freeform'&&!options.closed);$('fillColorOption').hidden=!shape||options.fillMode==='none'||(tool==='freeform'&&!options.closed);$('freeformOption').hidden=tool!=='freeform';
  $('freeformActions').hidden=tool!=='freeform';
  $('fillMode').value=options.fillMode||'none';syncFillColor();$('freeformKind').value=toolOptions.freeform.closed?'closed':'open';
  $('color').value=options.color;$('weight').value=options.width||3;
  syncTextColor();
  for(const [id,key] of [['textBold','bold'],['textItalic','italic'],['textUnderline','underline']])$(id).setAttribute('aria-pressed',String(toolOptions.text[key]));
  $('textSize').value=toolOptions.text.size;$('opacity').value=Math.round(toolOptions.highlighter.opacity*100);$('opacityValue').textContent=$('opacity').value+'%';
  $('drawingColorOption').hidden=tool==='text'||tool==='eraser';$('colorSwatches').hidden=tool==='eraser';$('widthOption').hidden=tool==='text'||tool==='select';$('opacityOption').hidden=tool!=='highlighter';$('widthLabel').textContent=tool==='eraser'?'지우개 크기':tool==='highlighter'?'형광펜 두께':'선 두께';
  document.querySelectorAll('#colorSwatches button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===options.color)));
}
function changeOptions(){
  const options=toolOptions[tool]||toolOptions.pen;options.color=$('color').value;
  const width=Number($('weight').value),size=Number($('textSize').value);
  if(Number.isFinite(width)&&width>=1&&width<=100)options.width=width;
  if(Number.isFinite(size)&&size>=8&&size<=240)toolOptions.text.size=size;
  toolOptions.highlighter.opacity=Number($('opacity').value)/100;
  $('opacityValue').textContent=$('opacity').value+'%';
  document.querySelectorAll('#colorSwatches button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===options.color)));
  if(['rect','ellipse','freeform'].includes(tool)){options.fillMode=$('fillMode').value;}
  toolOptions.freeform.closed=$('freeformKind').value==='closed';
  $('fillColorOption').hidden=!['rect','ellipse','freeform'].includes(tool)||options.fillMode==='none'||(tool==='freeform'&&!options.closed);$('fillOption').hidden=!['rect','ellipse','freeform'].includes(tool)||(tool==='freeform'&&!options.closed);
  if(freeform){freeform.options={...toolOptions.freeform};paintFreeform();}
  syncTextColor();
  if(textDraft)previewText();
  persistToolOptions();
}
for(const id of ['color','weight','textSize','opacity','fillMode','freeformKind'])$(id).oninput=changeOptions;
function syncFillColor(){
  const color=toolOptions[tool]?.fillColor||'#99ccff';$('fillColorDot').style.backgroundColor=color;
  document.querySelectorAll('#fillPalette button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===color)));
}
const fillColors=[['검정','#000000'],['흰색','#ffffff'],['회색','#666666'],['빨강','#ff3030'],['주황','#ff9800'],['노랑','#ffeb3b'],['초록','#159447'],['파랑','#0088ff'],['하늘','#99ccff'],['보라','#8e44ad'],['분홍','#ed4b91']];
for(const [name,color] of fillColors){const button=document.createElement('button');button.type='button';button.dataset.color=color;button.style.backgroundColor=color;button.setAttribute('aria-label','채우기 '+name);button.onclick=()=>{if(!toolOptions[tool]?.fillColor)return;toolOptions[tool].fillColor=color;persistToolOptions();syncFillColor();$('fillPalette').hidden=true;$('fillColor').setAttribute('aria-expanded','false');if(freeform){freeform.options={...toolOptions.freeform};paintFreeform();}};$('fillPalette').append(button);}
$('fillColor').onclick=()=>{$('fillPalette').hidden=!$('fillPalette').hidden;$('fillColor').setAttribute('aria-expanded',String(!$('fillPalette').hidden));};
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{finishText(true);finishFreeform(true);$('fillPalette').hidden=true;tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));canvas.style.cursor=tool==='text'?'text':tool==='select'?'default':'crosshair';syncOptions();});
function positionTextInput(){
  if(!textDraft)return;
  const r=canvas.getBoundingClientRect(),scaleX=r.width/canvas.width,scaleY=r.height/canvas.height;
  const input=$('inlineText'),options=toolOptions.text,lines=input.value.split('\n');
  ctx.save();ctx.font=textFont(options);const measured=Math.max(0,...lines.map(line=>ctx.measureText(line).width));ctx.restore();
  const left=r.left+textDraft.point.x*scaleX,top=r.top+textDraft.point.y*scaleY;
  input.style.left=left+'px';input.style.top=top+'px';
  input.style.width=Math.max(8,Math.min(Math.max(110,measured*scaleX+options.size*scaleX*.65+6),r.right-left-2))+'px';
  input.style.height=Math.max(8,Math.min(Math.max(options.size*scaleY*1.25+4,lines.length*options.size*scaleY*1.25+4),r.bottom-top-2))+'px';
  input.style.fontSize=options.size*scaleY+'px';input.style.fontWeight=options.bold?'700':'400';input.style.fontStyle=options.italic?'italic':'normal';input.style.caretColor=options.color;
  const bar=$('textFormatBar'),barRect=bar.getBoundingClientRect();
  bar.style.left=Math.max(8,Math.min(left,window.innerWidth-barRect.width-8))+'px';
  bar.style.top=(top-barRect.height-12>=8?top-barRect.height-12:Math.min(window.innerHeight-barRect.height-8,top+input.getBoundingClientRect().height+12))+'px';
}
function previewText(){if(!textDraft)return;ctx.putImageData(textDraft.base,0,0);drawText(ctx,$('inlineText').value,textDraft.point,toolOptions.text);positionTextInput();}
function finishText(apply){
  if(!textDraft)return;
  const draft=textDraft,value=$('inlineText').value;textDraft=null;
  $('inlineText').hidden=true;$('textActions').hidden=true;$('textFormatBar').hidden=true;$('textPalette').hidden=true;$('textColor').setAttribute('aria-expanded','false');
  ctx.putImageData(draft.base,0,0);
  if(apply&&value.trim()){checkpoint();drawText(ctx,value,draft.point,toolOptions.text);commit();}else renderGallery();
}
$('workspace').addEventListener('pointerdown',event=>{if(event.target===$('workspace')&&textDraft)finishText(true);});
$('inlineText').oninput=previewText;
function syncTextColor(){
  $('textColorDot').style.backgroundColor=toolOptions.text.color;
  document.querySelectorAll('#textPalette button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===toolOptions.text.color)));
}
const textColors=[['검정','#000000'],['흰색','#ffffff'],['회색','#666666'],['빨강','#ff3030'],['주황','#ff9800'],['노랑','#ffeb3b'],['초록','#159447'],['파랑','#0088ff'],['보라','#8e44ad'],['분홍','#ed4b91']];
for(const [name,color] of textColors){
  const button=document.createElement('button');button.type='button';button.dataset.color=color;button.style.backgroundColor=color;button.setAttribute('aria-label','텍스트 '+name);
  button.onmousedown=event=>event.preventDefault();
  button.onclick=()=>{$('color').value=color;changeOptions();$('textPalette').hidden=true;$('textColor').setAttribute('aria-expanded','false');$('inlineText').focus({preventScroll:true});};
  $('textPalette').append(button);
}
$('textColor').onmousedown=event=>event.preventDefault();
$('textColor').onclick=()=>{$('textPalette').hidden=!$('textPalette').hidden;$('textColor').setAttribute('aria-expanded',String(!$('textPalette').hidden));positionTextInput();};
for(const [id,key] of [['textBold','bold'],['textItalic','italic'],['textUnderline','underline']]){
  $(id).onmousedown=event=>event.preventDefault();
  $(id).onclick=()=>{toolOptions.text[key]=!toolOptions.text[key];persistToolOptions();$(id).setAttribute('aria-pressed',String(toolOptions.text[key]));previewText();$('inlineText').focus();};
}
$('inlineText').onpointerdown=event=>{if(event.button===0&&textDraft){event.preventDefault();finishText(true);finishFreeform(true);}};

$('inlineText').onkeydown=e=>{if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();finishText(false);}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishText(true);}};
$('applyText').onclick=()=>finishText(true);$('cancelText').onclick=()=>finishText(false);
new ResizeObserver(positionTextInput).observe(canvas);$('workspace').addEventListener('scroll',positionTextInput);window.addEventListener('resize',positionTextInput);
function paintFreeform(){
  if(!freeform)return;
  ctx.putImageData(freeform.base,0,0);
  const points=[...freeform.points];if(freeform.hover&&!freeform.dragging)points.push(freeform.hover);
  drawFreeform(ctx,points,freeform.options,freeform.options.closed);
  const size=5*canvas.width/canvas.getBoundingClientRect().width;
  ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#0088ff';ctx.lineWidth=size/4;
  for(const p of freeform.points){ctx.fillRect(p.x-size/2,p.y-size/2,size,size);ctx.strokeRect(p.x-size/2,p.y-size/2,size,size);}ctx.restore();
}
function addFreeformPoint(p){
  if(!freeform)freeform={base:ctx.getImageData(0,0,canvas.width,canvas.height),points:[],hover:null,dragging:false,options:{...toolOptions.freeform}};
  const first=freeform.points[0],threshold=10*canvas.width/canvas.getBoundingClientRect().width;
  if(freeform.options.closed&&freeform.points.length>=3&&Math.hypot(p.x-first.x,p.y-first.y)<threshold){finishFreeform(true);return;}
  const last=freeform.points.at(-1);if(!last||Math.hypot(p.x-last.x,p.y-last.y)>1)freeform.points.push(p);
  freeform.hover=null;freeform.dragging=true;$('freeformActions').hidden=false;paintFreeform();renderGallery();
  status('클릭으로 꼭짓점, 드래그로 자유곡선을 추가하세요. 더블클릭/Enter/시작점 클릭으로 완료 · Esc 취소');
}
function finishFreeform(apply){
  if(!freeform)return;const draft=freeform;freeform=null;$('freeformActions').hidden=tool!=='freeform';ctx.putImageData(draft.base,0,0);
  if(apply&&draft.points.length>=2){checkpoint();drawFreeform(ctx,draft.points,draft.options,draft.options.closed);commit();}else renderGallery();
}
$('finishFreeform').onclick=()=>finishFreeform(true);$('cancelFreeform').onclick=()=>finishFreeform(false);
canvas.ondblclick=event=>{if(tool==='freeform'){event.preventDefault();finishFreeform(true);}};
document.addEventListener('keydown',event=>{
  if(!freeform||event.target.closest('input,textarea,select'))return;
  if(event.key==='Enter'){event.preventDefault();finishFreeform(true);}
  if(event.key==='Escape'){event.preventDefault();finishFreeform(false);}
  if(event.key==='Backspace'){event.preventDefault();freeform.points.pop();if(!freeform.points.length)finishFreeform(false);else{freeform.hover=null;paintFreeform();}}
});
canvas.onpointerdown=e=>{
  if(!current||loadingImage||e.button!==0)return;
  if(tool==='select')return;
  const p=point(e,canvas);
  if(tool==='text'){
    e.preventDefault();
    if(textDraft){finishText(true);return;}
    textDraft={base:ctx.getImageData(0,0,canvas.width,canvas.height),point:p};
    $('inlineText').value='';$('inlineText').hidden=false;$('textActions').hidden=false;$('textFormatBar').hidden=false;positionTextInput();const draft=textDraft;$('inlineText').focus({preventScroll:true});renderGallery();
    requestAnimationFrame(()=>{if(textDraft===draft)$('inlineText').focus({preventScroll:true});});
    status('텍스트를 입력하고 크기·색상·서식을 조절하세요. 이미지를 다시 클릭하면 입력이 끝납니다.');return;
  }
  if(tool==='freeform'){e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);addFreeformPoint(p);return;}
  checkpoint();drawing={start:p,points:[p],base:ctx.getImageData(0,0,canvas.width,canvas.height),tool,options:{...toolOptions[tool]}};
  canvas.setPointerCapture(e.pointerId);
  if(tool==='eraser')eraseStroke(drawing);
  if(tool==='pen'||tool==='highlighter')drawStroke(ctx,[p],{...drawing.options,highlight:tool==='highlighter'});
};
canvas.onpointermove=e=>{
  if(tool==='freeform'&&freeform){const p=point(e,canvas);if(freeform.dragging&&(e.buttons&1)){if(Math.hypot(p.x-freeform.points.at(-1).x,p.y-freeform.points.at(-1).y)>2)freeform.points.push(p);}freeform.hover=p;paintFreeform();return;}
  if(!drawing)return;
  const p=point(e,canvas),options=drawing.options;if(drawing.tool!=='eraser')ctx.putImageData(drawing.base,0,0);
  if(drawing.tool==='eraser'){drawing.points.push(p);eraseStroke(drawing);}
  else if(drawing.tool==='pen'||drawing.tool==='highlighter'){
    drawing.points.push(p);drawStroke(ctx,drawing.points,{...options,highlight:drawing.tool==='highlighter'});
  }else{
    const r=selection(drawing.start,p,canvas.width,canvas.height);drawShape(ctx,drawing.tool,r,options);
  }
};
function eraseStroke(stroke){
  if(!originalCanvas)return;
  ctx.putImageData(stroke.base,0,0);
  const radius=stroke.options.width/2+2;
  const left=Math.max(0,Math.floor(Math.min(...stroke.points.map(p=>p.x))-radius)),top=Math.max(0,Math.floor(Math.min(...stroke.points.map(p=>p.y))-radius));
  const right=Math.min(canvas.width,Math.ceil(Math.max(...stroke.points.map(p=>p.x))+radius)),bottom=Math.min(canvas.height,Math.ceil(Math.max(...stroke.points.map(p=>p.y))+radius));
  if(right<=left||bottom<=top)return;
  const mask=document.createElement('canvas');mask.width=right-left;mask.height=bottom-top;
  const m=mask.getContext('2d');m.translate(-left,-top);drawStroke(m,stroke.points,{color:'#fff',width:stroke.options.width});
  const output=ctx.getImageData(left,top,mask.width,mask.height),original=originalCanvas.getContext('2d').getImageData(left,top,mask.width,mask.height);
  restorePixels(output.data,original.data,m.getImageData(0,0,mask.width,mask.height).data);ctx.putImageData(output,left,top);
}
function rotateCanvas(source,direction=1){const result=document.createElement('canvas');result.width=source.height;result.height=source.width;const c=result.getContext('2d');c.translate(direction===1?result.width:0,direction===1?0:result.height);c.rotate(direction*Math.PI/2);c.drawImage(source,0,0);return result;}
function finishDrawing(){if(zoomDrag){endZoom();return;}if(freeform)freeform.dragging=false;if(drawing){drawing=null;commit();}}canvas.onpointerup=finishDrawing;canvas.onpointercancel=finishDrawing;
syncOptions();
$('undo').onclick=()=>{if(freeform){finishFreeform(false);return;}if(textDraft){finishText(false);return;}if(!current?.history.length)return;const previous=current.history.pop();current.data=previous.data;current.baseData=previous.baseData;persistPinned(current);openItem(current);};
function rotateImage(direction){
  finishText(true);finishFreeform(true);if(!current)return;checkpoint();
  const rotated=rotateCanvas(canvas,direction);originalCanvas=rotateCanvas(originalCanvas,direction);current.baseData=originalCanvas.toDataURL();
  canvas.width=rotated.width;canvas.height=rotated.height;ctx.drawImage(rotated,0,0);commit();
};
$('rotate').onclick=()=>rotateImage(1);$('rotateLeft').onclick=()=>rotateImage(-1);
$('reset').onclick=()=>{finishText(false);finishFreeform(false);if(!current)return;checkpoint();current.data=current.originalData;current.baseData=current.originalData;current.viewZoom=1;persistPinned(current);openItem(current);};
function pinnedSnapshot(item){return{id:item.id,name:item.name,data:item.data,originalData:item.originalData,baseData:item.baseData};}
function persistPinned(item){if(item.pinned)window.captureAPI.putPinned(pinnedSnapshot(item)).catch(error=>status('고정 이미지 저장 실패: '+error.message));}
async function togglePin(item){
  if(item.pinPending)return;
  if(current===item){finishText(true);finishFreeform(true);}
  const wasPinned=!!item.pinned;item.pinPending=true;item.pinned=!wasPinned;renderGallery();
  try{if(item.pinned)await window.captureAPI.putPinned(pinnedSnapshot(item));else await window.captureAPI.removePinned(item.id);status(item.pinned?'이미지를 고정했습니다. 다음 실행에도 복원됩니다.':'고정을 해제했습니다. 다음 실행에는 복원되지 않습니다.');}
  catch(error){item.pinned=wasPinned;status('핀 설정 실패: '+error.message);}
  finally{item.pinPending=false;renderGallery();}
}
async function restorePinned(){
  try{const result=await window.captureAPI.listPinned();const restored=result.items.filter(item=>!captures.some(existing=>existing.id===item.id)).map(item=>({...item,pinned:true,history:[]}));captures.push(...restored);if(!current&&captures.length)await openItem(captures[0]);else renderGallery();if(result.failed)status(`고정 이미지 ${result.failed}개를 읽지 못했습니다. 나머지 이미지는 복원했습니다.`);}
  catch(error){status('고정 이미지 복원 실패: '+error.message);}
}
async function deleteItem(item){
  if(item.pinPending)return;
  if(item.pinned){item.pinned=false;item.pinPending=true;renderGallery();try{await window.captureAPI.removePinned(item.id);}catch(error){item.pinned=true;item.pinPending=false;renderGallery();status('고정 이미지 삭제 실패: '+error.message);return;}item.pinPending=false;}
  if(current===item){finishText(false);finishFreeform(false);}
  const index=captures.indexOf(item);if(index<0)return;captures.splice(index,1);
  if(current===item){current=null;if(captures.length){openItem(captures[Math.min(index,captures.length-1)]);return;}canvas.hidden=true;$('empty').hidden=false;}
  renderGallery();status('캡처를 삭제했습니다.');
}
window.captureAPI.onGalleryAction(({action,id})=>{if(saving)return;const item=captures.find(item=>item.id===id);if(!item)return;if(action==='save')saveItems([item]);if(action==='delete')deleteItem(item);});
let saving=false;
async function encodeItem(item,format){
  if(format==='png')return item.data;
  const image=await loadImage(item.data),output=document.createElement('canvas');
  output.width=image.width;output.height=image.height;
  const c=output.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,output.width,output.height);c.drawImage(image,0,0);
  return output.toDataURL('image/jpeg',0.92);
}
async function saveItems(items,all=false){
  if(saving||!items.length)return;
  finishText(true);finishFreeform(true);
  const snapshots=items.map(item=>({data:item.data,name:item.name}));let format=settings.format;
  saving=true;renderGallery();let saved=0,token=null,cancelled=false;const failures=[];
  try{
    if(all){const batch=await window.captureAPI.chooseBatchFolder(settings.format);if(!batch){status('모두 저장을 취소했습니다.');return;}token=batch.token;format=batch.format;}
    for(const [index,item] of snapshots.entries()){
      status(`저장 중… ${index+1} / ${snapshots.length}`);
      try{const success=all?await window.captureAPI.saveBatchItem(token,{data:await encodeItem(item,format),format}):await window.captureAPI.save({data:item.data,jpegData:await encodeItem(item,'jpeg'),format});if(success)saved++;else cancelled=true;}
      catch(error){failures.push(item.name+': '+error.message);}
    }
    status(failures.length?`${saved}개 저장, ${failures.length}개 실패 · ${failures.join(' / ')}`:cancelled?'저장을 취소했습니다.':`${format.toUpperCase()} 이미지 ${saved}개를 저장했습니다.`);
  }catch(error){status('저장 실패: '+error.message);}
  finally{if(token)await window.captureAPI.endBatchSave(token).catch(()=>{});saving=false;renderGallery();}
}
$('saveAll').onclick=()=>saveItems(captures,true);
renderGallery();
restorePinned();

document.addEventListener('keydown',async event=>{
  const target=event.target;
  if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='c'||event.altKey||event.shiftKey||event.repeat)return;
  if(target.closest('input,textarea,[contenteditable="true"]')||document.querySelector('dialog[open]')||$('capturePanel').hidden||!current)return;
  event.preventDefault();finishText(true);finishFreeform(true);
  try{await window.captureAPI.copyImage(current.data);status('선택한 이미지를 클립보드에 복사했습니다.');}
  catch(error){status('이미지 복사 실패: '+error.message);}
});

document.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown'].includes(event.key)||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.isComposing)return;
  if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||document.querySelector('dialog[open]')||$('capturePanel').hidden||busy||saving||drawing||freeform||textDraft||!captures.length)return;
  event.preventDefault();
  const index=captures.indexOf(current),next=captures[index<0?0:Math.max(0,Math.min(captures.length-1,index+(event.key==='ArrowDown'?1:-1)))];
  if(next===current)return;
  openItem(next).then(()=>{
    if(current!==next)return;
    $('gallery').querySelector('.capture.selected')?.scrollIntoView({block:'nearest',inline:'nearest'});
    canvas.focus({preventScroll:true});
  });
});
