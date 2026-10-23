const $ = id => document.getElementById(id);
const canvas=$('editor'), ctx=canvas.getContext('2d');
let captures=[], current=null, tool='select', drawing=null, busy=false;
let presets;
try {presets=JSON.parse(localStorage.getItem('presets'));} catch {}
if(!Array.isArray(presets)||!presets.length||!presets.every(p=>presetSize(p.width,p.height))) presets=[{width:640,height:480},{width:1280,height:720},{width:1920,height:1080}];
function status(message){$('status').textContent=message;}
let settings;
try { settings=JSON.parse(localStorage.getItem('settings')); } catch {}
settings={theme:settings?.theme==='dark'?'dark':'light',magnifier:settings?.magnifier!==false,format:settings?.format==='jpeg'?'jpeg':'png',shortcuts:{region:'Control+Shift+1',window:'Control+Shift+2',fixed:'Control+Shift+3',...settings?.shortcuts}};
document.documentElement.dataset.theme=settings.theme;$('theme').value=settings.theme;
$('theme').onchange=()=>{settings.theme=$('theme').value;document.documentElement.dataset.theme=settings.theme;persistSettings();$('settingsStatus').textContent='화면 스타일을 저장했습니다.';};
function persistSettings(){localStorage.setItem('settings',JSON.stringify(settings));}
function showTab(name){
  finishText(true);
  $('capturePanel').hidden=name!=='capture';$('settingsPanel').hidden=name!=='settings';
  for(const tab of ['capture','settings']){ $(tab+'Tab').classList.toggle('active',name===tab);$(tab+'Tab').setAttribute('aria-selected',String(name===tab)); }
}
$('magnifierEnabled').checked=settings.magnifier;
$('magnifierEnabled').onchange=()=>{settings.magnifier=$('magnifierEnabled').checked;persistSettings();$('settingsStatus').textContent='돋보기 설정을 저장했습니다.';};
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
  for(const id of ['save','rotate','undo','delete'])$(id).disabled=!current || (id==='undo'&&!current.history.length&&!textDraft) || (id==='save'&&saving);
  $('saveAll').disabled=!captures.length||saving;
  $('chooseSaveDirectory').disabled=saving;

}
async function openItem(item){finishText(true);current=item;const img=await loadImage(item.data);if(current!==item)return;item.width=img.width;item.height=img.height;canvas.width=img.width;canvas.height=img.height;ctx.drawImage(img,0,0);canvas.hidden=false;$('empty').hidden=true;renderGallery();status(`${item.name} · ${img.width} × ${img.height} px`);}
function checkpoint(){current.history.push(current.data);if(current.history.length>20)current.history.shift();}
function commit(){current.data=canvas.toDataURL('image/png');current.width=canvas.width;current.height=canvas.height;renderGallery();}
function addCapture(data){const item={data,name:`캡처 ${new Date().toLocaleTimeString('ko-KR')}`,history:[]};captures.unshift(item);openItem(item);}
function point(event,target){const r=target.getBoundingClientRect();return{x:Math.max(0,Math.min(target.width,(event.clientX-r.left)*target.width/r.width)),y:Math.max(0,Math.min(target.height,(event.clientY-r.top)*target.height/r.height))};}
async function begin(mode){
  if(busy||document.querySelector('dialog[open]'))return;
  finishText(true);busy=true;
  try{
    const preset=presets[Number($('presets').value)];
    const data=await window.captureAPI.captureOverlay(mode,preset,{magnifier:settings.magnifier});
    if(data){showTab('capture');addCapture(data);}else status('캡처를 취소했습니다.');
  }catch(error){status(`캡처 실패: ${error.message}`);}finally{busy=false;}
}
$('region').onclick=()=>begin('region');$('window').onclick=()=>begin('window');$('fixed').onclick=()=>begin('fixed');
const toolOptions={
  pen:{color:'#ff524f',width:3},highlighter:{color:'#ffeb3b',width:28,opacity:0.35},
  rect:{color:'#ff524f',width:3},ellipse:{color:'#ff524f',width:3},text:{color:'#000000',size:32,bold:false,italic:false,underline:false}
};
let textDraft=null;
const swatches=[['검정','#000000'],['노랑','#ffeb3b'],['초록','#64e572'],['하늘','#43d9ff'],['분홍','#ff77b7'],['주황','#ffad42'],['보라','#b18aff'],['빨강','#ff524f']];
for(const [name,color] of swatches){const button=document.createElement('button');button.title=name;button.setAttribute('aria-label',name);button.dataset.color=color;button.style.backgroundColor=color;button.onmousedown=event=>{if(textDraft)event.preventDefault();};button.onclick=()=>{$('color').value=color;changeOptions();if(textDraft)$('inlineText').focus({preventScroll:true});};$('colorSwatches').append(button);}
function syncOptions(){
  const options=toolOptions[tool]||toolOptions.pen;
  $('color').value=options.color;$('weight').value=options.width||3;
  syncTextColor();
  for(const [id,key] of [['textBold','bold'],['textItalic','italic'],['textUnderline','underline']])$(id).setAttribute('aria-pressed',String(toolOptions.text[key]));
  $('textSize').value=toolOptions.text.size;$('opacity').value=Math.round(toolOptions.highlighter.opacity*100);$('opacityValue').textContent=$('opacity').value+'%';
  $('drawingColorOption').hidden=tool==='text';$('widthOption').hidden=tool==='text'||tool==='select';$('opacityOption').hidden=tool!=='highlighter';$('widthLabel').textContent=tool==='highlighter'?'형광펜 두께':'선 두께';
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
  syncTextColor();
  if(textDraft)previewText();
}
for(const id of ['color','weight','textSize','opacity'])$(id).oninput=changeOptions;
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{finishText(true);tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));canvas.style.cursor=tool==='text'?'text':tool==='select'?'default':'crosshair';syncOptions();});
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
  $(id).onclick=()=>{toolOptions.text[key]=!toolOptions.text[key];$(id).setAttribute('aria-pressed',String(toolOptions.text[key]));previewText();$('inlineText').focus();};
}
$('inlineText').onpointerdown=event=>{if(event.button===0&&textDraft){event.preventDefault();finishText(true);}};

$('inlineText').onkeydown=e=>{if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();finishText(false);}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishText(true);}};
$('applyText').onclick=()=>finishText(true);$('cancelText').onclick=()=>finishText(false);
new ResizeObserver(positionTextInput).observe(canvas);$('workspace').addEventListener('scroll',positionTextInput);window.addEventListener('resize',positionTextInput);
canvas.onpointerdown=e=>{
  if(!current||tool==='select'||e.button!==0)return;
  const p=point(e,canvas);
  if(tool==='text'){
    e.preventDefault();
    if(textDraft){finishText(true);return;}
    textDraft={base:ctx.getImageData(0,0,canvas.width,canvas.height),point:p};
    $('inlineText').value='';$('inlineText').hidden=false;$('textActions').hidden=false;$('textFormatBar').hidden=false;positionTextInput();const draft=textDraft;$('inlineText').focus({preventScroll:true});renderGallery();
    requestAnimationFrame(()=>{if(textDraft===draft)$('inlineText').focus({preventScroll:true});});
    status('텍스트를 입력하고 크기·색상·서식을 조절하세요. 이미지를 다시 클릭하면 입력이 끝납니다.');return;
  }
  checkpoint();drawing={start:p,points:[p],base:ctx.getImageData(0,0,canvas.width,canvas.height),tool,options:{...toolOptions[tool]}};
  canvas.setPointerCapture(e.pointerId);
  if(tool==='pen'||tool==='highlighter')drawStroke(ctx,[p],{...drawing.options,highlight:tool==='highlighter'});
};
canvas.onpointermove=e=>{
  if(!drawing)return;
  const p=point(e,canvas),options=drawing.options;ctx.putImageData(drawing.base,0,0);
  if(drawing.tool==='pen'||drawing.tool==='highlighter'){
    drawing.points.push(p);drawStroke(ctx,drawing.points,{...options,highlight:drawing.tool==='highlighter'});
  }else{
    const r=selection(drawing.start,p,canvas.width,canvas.height);ctx.save();ctx.strokeStyle=options.color;ctx.lineWidth=options.width;ctx.lineJoin='round';ctx.beginPath();
    if(drawing.tool==='rect')ctx.rect(r.x,r.y,r.width,r.height);else ctx.ellipse(r.x+r.width/2,r.y+r.height/2,r.width/2,r.height/2,0,0,Math.PI*2);
    ctx.stroke();ctx.restore();
  }
};
function finishDrawing(){if(drawing){drawing=null;commit();}}canvas.onpointerup=finishDrawing;canvas.onpointercancel=finishDrawing;
syncOptions();
$('undo').onclick=()=>{if(textDraft){finishText(false);return;}if(!current?.history.length)return;current.data=current.history.pop();openItem(current);};
$('rotate').onclick=()=>{finishText(true);if(!current)return;checkpoint();const temp=document.createElement('canvas');temp.width=canvas.height;temp.height=canvas.width;const c=temp.getContext('2d');c.translate(temp.width,0);c.rotate(Math.PI/2);c.drawImage(canvas,0,0);canvas.width=temp.width;canvas.height=temp.height;ctx.drawImage(temp,0,0);commit();};
$('delete').onclick=()=>{finishText(false);if(!current)return;captures=captures.filter(c=>c!==current);current=null;if(captures.length)openItem(captures[0]);else{canvas.hidden=true;$('empty').hidden=false;renderGallery();status('캡처가 없습니다.');}};
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
  finishText(true);
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

document.addEventListener('keydown',async event=>{
  const target=event.target;
  if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='c'||event.altKey||event.shiftKey||event.repeat)return;
  if(target.closest('input,textarea,[contenteditable="true"]')||document.querySelector('dialog[open]')||$('capturePanel').hidden||!current)return;
  event.preventDefault();finishText(true);
  try{await window.captureAPI.copyImage(current.data);status('선택한 이미지를 클립보드에 복사했습니다.');}
  catch(error){status('이미지 복사 실패: '+error.message);}
});
