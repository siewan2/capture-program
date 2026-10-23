const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {saveImage}=require('../src/storage');
test('concurrent saves keep distinct files and preserve encoded bytes and format',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'capture-save-'));
  try{
    const png=Buffer.from([137,80,78,71,13,10,26,10]),jpeg=Buffer.from([255,216,255,217]);
    const folder=path.join(root,'한글 이미지');
    const payload={format:'png',data:'data:image/png;base64,'+png.toString('base64')};
    const files=await Promise.all([saveImage(folder,payload),saveImage(folder,payload),saveImage(folder,{format:'jpeg',data:'data:image/jpeg;base64,'+jpeg.toString('base64')})]);
    assert.equal(new Set(files).size,3);assert.equal((await fs.readdir(folder)).length,3);
    assert.deepEqual(await fs.readFile(files[0]),png);assert.deepEqual(await fs.readFile(files[2]),jpeg);assert.equal(path.extname(files[2]),'.jpg');
    await assert.rejects(saveImage(folder,{format:'jpeg',data:payload.data}));
    const blocked=path.join(root,'not-a-directory');await fs.writeFile(blocked,'original');
    await assert.rejects(saveImage(blocked,payload));assert.equal(await fs.readFile(blocked,'utf8'),'original');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
