const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createPinnedStore}=require('../src/pinned-store');
const png='data:image/png;base64,aGVsbG8=';
const item={id:'test-123',name:'캡처',data:png,originalData:png,baseData:png};
async function temp(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'capture-pin-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
test('pinned images and edited/original data survive store recreation and unpin removes persisted copy',async t=>{
  const dir=await temp(t),store=createPinnedStore(dir);assert.deepEqual(await store.list(),{items:[],failed:0});await store.put(item);
  const edited={...item,data:'data:image/png;base64,d29ybGQ='};await store.put(edited);const restarted=createPinnedStore(dir);assert.deepEqual((await restarted.list()).items,[{...edited,pinned:true}]);await restarted.remove(item.id);assert.equal((await createPinnedStore(dir).list()).items.length,0);
});
test('pending edits and deletion stay ordered and damaged files do not block healthy images',async t=>{
  const dir=await temp(t),store=createPinnedStore(dir);await Promise.all([store.put(item),store.put({...item,name:'edited'}),store.remove(item.id)]);await store.flush();assert.equal((await store.list()).items.length,0);
  await store.put(item);await fs.writeFile(path.join(dir,'broken.json'),'{');const result=await store.list();assert.equal(result.items.length,1);assert.equal(result.failed,1);assert.equal((await fs.readdir(dir)).some(f=>f.endsWith('.tmp')),false);
});
test('pin storage rejects unsafe IDs and malformed payloads',async t=>{
  const store=createPinnedStore(await temp(t));await assert.rejects(store.put({...item,id:'../escape'}));await assert.rejects(store.remove('../escape'));await assert.rejects(store.put({...item,data:'not image'}));assert.equal((await store.list()).items.length,0);
});
