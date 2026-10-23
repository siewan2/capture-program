const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createSaveDialogs}=require('../src/save-dialogs');
const payload={format:'png',data:'data:image/png;base64,iVBORw0KGgo=',jpegData:'data:image/jpeg;base64,/9j/2Q=='};
test('individual saves ask for a file every time and cancellation writes nothing',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'capture-dialog-'));
  try{
    const paths=[path.join(root,'first.png'),path.join(root,'second.png')];let calls=0;
    const service=createSaveDialogs({initialDirectory:root,main:{},dialog:{async showSaveDialog(_,options){assert.deepEqual(options.filters[0].extensions,['png']);const filePath=paths[calls++];return filePath?{filePath,canceled:false}:{canceled:true};}}});
    assert.equal(await service.save(payload),true);assert.equal(await service.save(payload),true);assert.equal(await service.save(payload),false);
    assert.equal(calls,3);assert.deepEqual((await fs.readdir(root)).sort(),['first.png','second.png']);assert.deepEqual(await fs.readFile(paths[0]),Buffer.from('iVBORw0KGgo=','base64'));
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('each bulk save asks for one folder, sessions stay isolated and ended sessions cannot write',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'capture-bulk-'));
  try{
    let calls=0;const folders=[path.join(root,'one'),path.join(root,'two')];
    const service=createSaveDialogs({initialDirectory:root,main:{},dialog:{async showMessageBox(){return{response:0};},async showOpenDialog(){const folder=folders[calls++];return folder?{canceled:false,filePaths:[folder]}:{canceled:true,filePaths:[]};}}});
    const first=await service.chooseBatch();await service.saveBatch(first.token,payload);await service.saveBatch(first.token,payload);service.endBatch(first.token);
    await assert.rejects(service.saveBatch(first.token,payload));
    const second=await service.chooseBatch();await service.saveBatch(second.token,payload);service.endBatch(second.token);
    assert.equal((await fs.readdir(folders[0])).length,2);assert.equal((await fs.readdir(folders[1])).length,1);assert.equal(await service.chooseBatch(),null);assert.equal(calls,3);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('save format dropdown offers PNG and JPEG and filename determines the matching encoded bytes',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'capture-formats-'));
  try{
    let index=0;const paths=[path.join(root,'chosen.jpg'),path.join(root,'chosen.png')];
    const service=createSaveDialogs({initialDirectory:root,main:{},dialog:{async showSaveDialog(_,options){assert.equal(options.filters.length,2);assert.equal(path.extname(options.defaultPath),'');return{filePath:paths[index++],canceled:false};}}});
    await service.save(payload);await service.save({...payload,format:'jpeg'});
    assert.deepEqual(await fs.readFile(paths[0]),Buffer.from('/9j/2Q==','base64'));assert.deepEqual(await fs.readFile(paths[1]),Buffer.from('iVBORw0KGgo=','base64'));
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('bulk JPEG choice applies to every file and format cancellation does not open folder chooser',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'capture-format-choice-'));let choice=1,folders=0;
  try{
    const service=createSaveDialogs({initialDirectory:root,main:{},dialog:{async showMessageBox(_,options){assert.deepEqual(options.buttons,['PNG','JPEG','취소']);return{response:choice};},async showOpenDialog(){folders++;return{canceled:false,filePaths:[root]};}}});
    const batch=await service.chooseBatch('png');assert.equal(batch.format,'jpeg');await service.saveBatch(batch.token,{format:'jpeg',data:payload.jpegData});
    const names=await fs.readdir(root);assert.equal(names.length,1);assert.match(names[0],/\.jpg$/);assert.deepEqual(await fs.readFile(path.join(root,names[0])),Buffer.from('/9j/2Q==','base64'));
    await assert.rejects(service.saveBatch(batch.token,payload));service.endBatch(batch.token);choice=2;assert.equal(await service.chooseBatch(),null);assert.equal(folders,1);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
