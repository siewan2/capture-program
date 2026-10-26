const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const ID=/^[a-zA-Z0-9-]{1,80}$/;
function validate(item){
  if(!item||typeof item.id!=='string'||!ID.test(item.id)||typeof item.name!=='string'||item.name.length>200)throw new Error('잘못된 고정 이미지입니다.');
  for(const key of ['data','originalData','baseData'])if(typeof item[key]!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(item[key]))throw new Error('잘못된 이미지 데이터입니다.');
  return{id:item.id,name:item.name,data:item.data,originalData:item.originalData,baseData:item.baseData,pinned:true};
}
function createPinnedStore(directory){
  let queue=Promise.resolve();
  const serial=operation=>{const result=queue.then(operation);queue=result.catch(()=>{});return result;};
  return{
    flush:()=>queue,
    put:item=>serial(async()=>{
      const data=validate(item);await fs.mkdir(directory,{recursive:true});
      const file=path.join(directory,data.id+'.json'),temp=file+'.'+crypto.randomUUID()+'.tmp';
      try{await fs.writeFile(temp,JSON.stringify(data),'utf8');await fs.rename(temp,file);}
      finally{await fs.rm(temp,{force:true});}return true;
    }),
    remove:id=>serial(async()=>{if(typeof id!=='string'||!ID.test(id))throw new Error('잘못된 이미지 ID입니다.');await fs.rm(path.join(directory,id+'.json'),{force:true});return true;}),
    list:()=>serial(async()=>{
      let entries;try{entries=await fs.readdir(directory);}catch(error){if(error.code==='ENOENT')return{items:[],failed:0};throw error;}
      const items=[];let failed=0;
      for(const entry of entries.filter(name=>name.endsWith('.json')).sort()){
        try{const item=validate(JSON.parse(await fs.readFile(path.join(directory,entry),'utf8')));if(entry!==item.id+'.json')throw new Error('ID mismatch');items.push(item);}catch{failed++;}
      }return{items,failed};
    })
  };
}
module.exports={createPinnedStore};
