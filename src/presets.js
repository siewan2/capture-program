const {presetSize}=require('./geometry');
function updatePresets(presets,action){
  const next=presets.map(p=>({width:p.width,height:p.height}));let selected;
  if(action?.type==='add'){
    const p=action.preset;if(!presetSize(p?.width,p?.height))throw new Error('크기는 1~16384 사이의 정수로 입력하세요.');
    selected=next.findIndex(item=>item.width===p.width&&item.height===p.height);
    if(selected<0){selected=next.length;next.push({width:p.width,height:p.height});}
  }else if(action?.type==='select'&&Number.isInteger(action.index)&&action.index>=0&&action.index<next.length)selected=action.index;
  else throw new Error('올바른 프리셋을 선택하세요.');
  return{presets:next,selected};
}
module.exports={updatePresets};
