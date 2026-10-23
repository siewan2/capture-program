const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {imageBytes,saveImage}=require('./storage');
function createSaveDialogs({dialog,main,initialDirectory}){
  let lastDirectory=initialDirectory;
  const batches=new Map();
  return {
    async save(payload){
      const {bytes,extension}=imageBytes(payload);
      const result=await dialog.showSaveDialog(main,{title:'이미지 저장',defaultPath:path.join(lastDirectory,`capture-${Date.now()}.${extension}`),filters:[{name:payload.format==='jpeg'?'JPEG 이미지':'PNG 이미지',extensions:payload.format==='jpeg'?['jpg','jpeg']:['png']}]});
      if(result.canceled||!result.filePath)return false;
      await fs.writeFile(result.filePath,bytes);lastDirectory=path.dirname(result.filePath);return true;
    },
    async chooseBatch(){
      const result=await dialog.showOpenDialog(main,{title:'모든 이미지를 저장할 폴더 선택',defaultPath:lastDirectory,properties:['openDirectory','createDirectory']});
      if(result.canceled||!result.filePaths?.length)return null;
      const token=randomUUID();lastDirectory=result.filePaths[0];batches.set(token,lastDirectory);return token;
    },
    async saveBatch(token,payload){
      const directory=batches.get(token);if(!directory)throw new Error('저장 폴더를 다시 선택하세요.');
      await saveImage(directory,payload);return true;
    },
    endBatch(token){batches.delete(token);}
  };
}
module.exports={createSaveDialogs};
