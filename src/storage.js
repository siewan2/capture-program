const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
function imageBytes({data,format}) {
  if (!['png','jpeg'].includes(format)) throw new Error('지원하지 않는 저장 형식입니다.');
  if (typeof data !== 'string' || !new RegExp(`^data:image/${format};base64,[A-Za-z0-9+/=]+$`).test(data)) throw new Error('잘못된 이미지입니다.');
  return {bytes:Buffer.from(data.split(',')[1],'base64'),extension:format==='jpeg'?'jpg':'png'};
}
async function saveImage(directory, payload) {
  const {bytes,extension}=imageBytes(payload);
  await fs.mkdir(directory,{recursive:true});
  // Exclusive creation preserves existing files, including simultaneous saves.
  for(let attempt=0;attempt<5;attempt++){
    const destination=path.join(directory,`capture-${Date.now()}-${randomUUID()}.${extension}`);
    try{await fs.writeFile(destination,bytes,{flag:'wx'});return destination;}
    catch(error){if(error.code!=='EEXIST')throw error;}
  }
  throw new Error('겹치지 않는 파일명을 생성하지 못했습니다. 다시 시도하세요.');
}
module.exports={imageBytes,saveImage};
