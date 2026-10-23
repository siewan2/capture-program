const $ = id => document.getElementById(id);
const canvas=$('editor'), ctx=canvas.getContext('2d');
const crop=$('crop'), cropCtx=crop.getContext('2d');
let captures=[], current=null, tool='select', drawing=null, cropImage=null, cropStart=null, cropRect=null, captureMode='region', busy=false;
let presets;
try {presets=JSON.parse(localStorage.getItem('presets'));} catch {}
if(!Array.isArray(presets)||!presets.length||!presets.every(p=>presetSize(p.width,p.height))) presets=[{width:640,height:480},{width:1280,height:720},{width:1920,height:1080}];
function status(message){$('status').textContent=message;}
let settings;
try { settings=JSON.parse(localStorage.getItem('settings')); } catch {}
settings={format:settings?.format==='jpeg'?'jpeg':'png',shortcuts:{region:'Control+Shift+1',window:'Control+Shift+2',fixed:'Control+Shift+3',...settings?.shortcuts}};
function persistSettings(){localStorage.setItem('settings',JSON.stringify(settings));}
function showTab(name){
  $('capturePanel').hidden=name!=='capture';$('settingsPanel').hidden=name!=='settings';
  for(const tab of ['capture','settings']){ $(tab+'Tab').classList.toggle('active',name===tab);$(tab+'Tab').setAttribute('aria-selected',String(name===tab)); }
}
$('captureTab').onclick=()=>showTab('capture');$('settingsTab').onclick=()=>showTab('settings');
function updateFormat(){ $('save').textContent=settings.format.toUpperCase()+' 저장 ↗';$('imageFormat').value=settings.format; }
updateFormat();$('imageFormat').onchange=()=>{settings.format=$('imageFormat').value;persistSettings();updateFormat();$('settingsStatus').textContent='저장 형식을 저장했습니다.';};
let shortcutRevision=0;
async function registerShortcuts(){
  const revision=++shortcutRevision;
  try{const result=await window.captureAPI.shortcuts(settings.shortcuts);if(revision!==shortcutRevision)return;for(const mode of ['region','window','fixed'])$('shortcut-status-'+mode).textContent=result[mode];}
  catch(e){$('settingsStatus').textContent='단축키 등록 실패: '+e.message;}
}
for(const mode of ['region','window','fixed']){
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
      if(Object.entries(settings.shortcuts).some(([other,value])=>other!==mode&&value===key)){$('shortcut-status-'+mode).textContent='다른 캡처 방식에서 이미 사용하는 단축키입니다.';return;}
    }
    settings.shortcuts[mode]=key;input.value=key;persistSettings();registerShortcuts();
  };
}
registerShortcuts();
window.captureAPI.onCapture(mode=>{if(!['region','window','fixed'].includes(mode)||busy||document.querySelector('dialog[open]'))return;showTab('capture');begin(mode);});
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
    const label=document.createElement('small');label.textContent=`${item.name} · ${item.width} × ${item.height}`;
    select.append(img,label);select.onclick=()=>openItem(item);
    const save=document.createElement('button');save.className='capture-save';save.textContent='이 이미지 저장';save.setAttribute('aria-label',item.name+' 저장');save.disabled=saving;save.onclick=()=>saveItems([item]);
    card.append(select,save);return card;
  }));
  for(const id of ['save','rotate','undo','delete'])$(id).disabled=!current || (id==='undo'&&!current.history.length) || (id==='save'&&saving);
  $('saveAll').disabled=!captures.length||saving;
  $('chooseSaveDirectory').disabled=saving;

}
async function openItem(item){current=item;const img=await loadImage(item.data);if(current!==item)return;item.width=img.width;item.height=img.height;canvas.width=img.width;canvas.height=img.height;ctx.drawImage(img,0,0);canvas.hidden=false;$('empty').hidden=true;renderGallery();status(`${item.name} · ${img.width} × ${img.height} px`);}
function checkpoint(){current.history.push(current.data);if(current.history.length>20)current.history.shift();}
function commit(){current.data=canvas.toDataURL('image/png');current.width=canvas.width;current.height=canvas.height;renderGallery();}
function addCapture(data){const item={data,name:`캡처 ${new Date().toLocaleTimeString('ko-KR')}`,history:[]};captures.unshift(item);openItem(item);}
function point(event,target){const r=target.getBoundingClientRect();return{x:Math.max(0,Math.min(target.width,(event.clientX-r.left)*target.width/r.width)),y:Math.max(0,Math.min(target.height,(event.clientY-r.top)*target.height/r.height))};}
async function begin(mode){if(busy||document.querySelector('dialog[open]'))return;busy=true;captureMode=mode;try{status('화면을 가져오는 중…');const sources=await window.captureAPI.sources(mode==='window'?'window':'screen');if(!sources.length){status('캡처 가능한 화면이 없습니다. 최소화된 창과 보호된 콘텐츠는 캡처할 수 없습니다.');return;}$('pickerTitle').textContent=mode==='window'?'캡처할 창 선택':'캡처할 모니터 선택';$('sources').replaceChildren(...sources.map(source=>{const b=document.createElement('button'),img=document.createElement('img'),label=document.createElement('span');img.src=source.image;label.textContent=source.name;b.append(img,label);b.onclick=async()=>{$('picker').close();if(mode==='window'){addCapture(source.image);return;}cropImage=await loadImage(source.image);crop.width=cropImage.width;crop.height=cropImage.height;cropRect=null;cropStart=null;paintCrop();$('confirmCrop').disabled=true;$('cropTitle').textContent=mode==='fixed'?'원하는 위치를 클릭하세요 · 크기는 원본 화면 픽셀 기준':'마우스로 캡처 영역을 드래그하세요';$('cropDialog').showModal();};return b;}));$('picker').showModal();status('화면 또는 창을 선택하세요.');}catch(error){status(`캡처 실패: ${error.message}`);}finally{busy=false;}}
$('region').onclick=()=>begin('region');$('window').onclick=()=>begin('window');$('fixed').onclick=()=>begin('fixed');$('closePicker').onclick=()=>$('picker').close();$('cancelCrop').onclick=()=>$('cropDialog').close();
function paintCrop(){cropCtx.clearRect(0,0,crop.width,crop.height);cropCtx.drawImage(cropImage,0,0);cropCtx.fillStyle='#0008';cropCtx.fillRect(0,0,crop.width,crop.height);if(cropRect){const r=cropRect;cropCtx.drawImage(cropImage,r.x,r.y,r.width,r.height,r.x,r.y,r.width,r.height);cropCtx.strokeStyle='#a99bff';cropCtx.lineWidth=3;cropCtx.strokeRect(r.x,r.y,r.width,r.height);}}
crop.onpointerdown=e=>{crop.setPointerCapture(e.pointerId);cropStart=point(e,crop);if(captureMode==='fixed'){const p=presets[Number($('presets').value)];if(p.width>crop.width||p.height>crop.height){status('이 프리셋은 선택한 모니터보다 큽니다. 더 작은 크기를 선택하세요.');return;}cropRect={x:Math.round(Math.min(cropStart.x,crop.width-p.width)),y:Math.round(Math.min(cropStart.y,crop.height-p.height)),width:p.width,height:p.height};paintCrop();$('confirmCrop').disabled=false;}};
crop.onpointermove=e=>{if(!cropStart||captureMode==='fixed')return;cropRect=selection(cropStart,point(e,crop),crop.width,crop.height);paintCrop();$('confirmCrop').disabled=cropRect.width<1||cropRect.height<1;};crop.onpointerup=()=>{cropStart=null;};crop.onpointercancel=()=>{cropStart=null;};
$('confirmCrop').onclick=()=>{if(!cropRect||cropRect.width<1||cropRect.height<1)return;const r=cropRect,c=document.createElement('canvas');c.width=Math.round(r.width);c.height=Math.round(r.height);c.getContext('2d').drawImage(cropImage,r.x,r.y,r.width,r.height,0,0,c.width,c.height);addCapture(c.toDataURL());$('cropDialog').close();};
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));canvas.style.cursor=tool==='select'?'default':'crosshair';});
function style(){ctx.strokeStyle=$('color').value;ctx.fillStyle=$('color').value;ctx.lineWidth=Number($('weight').value);ctx.lineCap='round';ctx.lineJoin='round';}
canvas.onpointerdown=e=>{if(!current||tool==='select')return;const p=point(e,canvas);if(tool==='text'){$('textInput').value='';$('textDialog').showModal();$('textInput').focus();$('textDialog').onclose=()=>{if($('textDialog').returnValue!=='ok'||!$('textInput').value)return;checkpoint();style();ctx.font=`${Number($('weight').value)*4+16}px "Segoe UI"`;ctx.fillText($('textInput').value,p.x,p.y);commit();};return;}checkpoint();style();drawing={start:p,last:p,base:ctx.getImageData(0,0,canvas.width,canvas.height),tool};canvas.setPointerCapture(e.pointerId);if(tool==='pen'){ctx.beginPath();ctx.arc(p.x,p.y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}};
canvas.onpointermove=e=>{if(!drawing)return;const p=point(e,canvas);style();if(drawing.tool==='pen'){ctx.beginPath();ctx.moveTo(drawing.last.x,drawing.last.y);ctx.lineTo(p.x,p.y);ctx.stroke();drawing.last=p;}else{ctx.putImageData(drawing.base,0,0);const r=selection(drawing.start,p,canvas.width,canvas.height);ctx.beginPath();if(drawing.tool==='rect')ctx.rect(r.x,r.y,r.width,r.height);else ctx.ellipse(r.x+r.width/2,r.y+r.height/2,r.width/2,r.height/2,0,0,Math.PI*2);ctx.stroke();}};
function finishDrawing(){if(drawing){drawing=null;commit();}}canvas.onpointerup=finishDrawing;canvas.onpointercancel=finishDrawing;
$('undo').onclick=()=>{if(!current?.history.length)return;current.data=current.history.pop();openItem(current);};
$('rotate').onclick=()=>{if(!current)return;checkpoint();const temp=document.createElement('canvas');temp.width=canvas.height;temp.height=canvas.width;const c=temp.getContext('2d');c.translate(temp.width,0);c.rotate(Math.PI/2);c.drawImage(canvas,0,0);canvas.width=temp.width;canvas.height=temp.height;ctx.drawImage(temp,0,0);commit();};
$('delete').onclick=()=>{if(!current)return;captures=captures.filter(c=>c!==current);current=null;if(captures.length)openItem(captures[0]);else{canvas.hidden=true;$('empty').hidden=false;renderGallery();status('캡처가 없습니다.');}};
let saving=false;
async function encodeItem(item,format){
  if(format==='png')return item.data;
  const image=await loadImage(item.data),output=document.createElement('canvas');
  output.width=image.width;output.height=image.height;
  const c=output.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,output.width,output.height);c.drawImage(image,0,0);
  return output.toDataURL('image/jpeg',0.92);
}
async function saveItems(items){
  if(saving||!items.length)return;
  const snapshots=items.map(item=>({data:item.data,name:item.name})),format=settings.format;
  saving=true;renderGallery();let saved=0;const failures=[];
  try{
    for(const [index,item] of snapshots.entries()){
      status(`저장 중… ${index+1} / ${snapshots.length}`);
      try{const data=await encodeItem(item,format);if(await window.captureAPI.save({data,format}))saved++;else failures.push(item.name+': 저장이 취소되었습니다.');}
      catch(error){failures.push(item.name+': '+error.message);}
    }
    status(failures.length?`${saved}개 저장, ${failures.length}개 실패 · ${failures.join(' / ')}`:`${format.toUpperCase()} 이미지 ${saved}개를 저장했습니다.`);
  }finally{saving=false;renderGallery();}
}
$('save').onclick=()=>{if(current)saveItems([current]);};
$('saveAll').onclick=()=>saveItems(captures);
async function loadDirectory(){try{$('saveDirectory').value=await window.captureAPI.saveDirectory();}catch(error){$('directoryStatus').textContent='저장 폴더 확인 실패: '+error.message;}}
$('chooseSaveDirectory').onclick=async()=>{
  $('chooseSaveDirectory').disabled=true;
  try{const directory=await window.captureAPI.chooseSaveDirectory();if(directory){$('saveDirectory').value=directory;$('directoryStatus').textContent='저장 폴더를 변경했습니다.';}else $('directoryStatus').textContent='폴더 선택을 취소했습니다.';}
  catch(error){$('directoryStatus').textContent='저장 폴더 변경 실패: '+error.message;}
  finally{$('chooseSaveDirectory').disabled=saving;}
};
loadDirectory();
renderGallery();
