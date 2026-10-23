const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {imageBytes,saveImage}=require('./storage');
function createSaveDialogs({dialog,main,initialDirectory}){
  let lastDirectory=initialDirectory;
  const batches=new Map();
  return {
    async save(payload){
      if(!['png','jpeg'].includes(payload.format))throw new Error('지원하지 않는 이미지 형식입니다.');
      const variants={png:imageBytes({format:'png',data:payload.data}).bytes,jpeg:imageBytes({format:'jpeg',data:payload.jpegData}).bytes};
      const png={name:'PNG 이미지 (*.png)',extensions:['png']},jpeg={name:'JPEG 이미지 (*.jpg, *.jpeg)',extensions:['jpg','jpeg']};
      const result=await dialog.showSaveDialog(main,{title:'이미지 저장',defaultPath:path.join(lastDirectory,`capture-${Date.now()}`),filters:payload.format==='jpeg'?[jpeg,png]:[png,jpeg]});
      if(result.canceled||!result.filePath)return false;
      const extension=path.extname(result.filePath).toLowerCase();
      const format=extension==='.png'?'png':['.jpg','.jpeg'].includes(extension)?'jpeg':null;
      if(!format)throw new Error('파일 형식에서 PNG 또는 JPEG를 선택하고 .png, .jpg 또는 .jpeg 확장자로 저장하세요.');
      await fs.writeFile(result.filePath,variants[format]);lastDirectory=path.dirname(result.filePath);return true;
    },
    async chooseBatch(preferred='png'){
      const choice=await dialog.showMessageBox(main,{type:'question',title:'모두 저장 · 이미지 형식',message:'모든 이미지를 어떤 형식으로 저장할까요?',buttons:['PNG','JPEG','취소'],defaultId:preferred==='jpeg'?1:0,cancelId:2,noLink:true});
      if(choice.response===2)return null;
      const format=choice.response===1?'jpeg':'png';
      const result=await dialog.showOpenDialog(main,{title:'모든 이미지를 저장할 폴더 선택',defaultPath:lastDirectory,properties:['openDirectory','createDirectory']});
      if(result.canceled||!result.filePaths?.length)return null;
      const token=randomUUID();lastDirectory=result.filePaths[0];batches.set(token,{directory:lastDirectory,format});return{token,format};
    },
    async saveBatch(token,payload){
      const batch=batches.get(token);if(!batch)throw new Error('저장 폴더를 다시 선택하세요.');
      if(payload.format!==batch.format)throw new Error('선택한 저장 형식과 이미지 형식이 다릅니다.');
      await saveImage(batch.directory,payload);return true;
    },
    endBatch(token){batches.delete(token);}
  };
}
module.exports={createSaveDialogs};
