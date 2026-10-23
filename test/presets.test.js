const {test}=require('node:test');const assert=require('node:assert/strict');const {updatePresets}=require('../src/presets');
test('preset updates preserve existing sizes, deduplicate and validate entries',()=>{
  const initial=[{width:640,height:480}];const next=updatePresets(initial,{type:'add',preset:{width:321,height:213}});
  assert.equal(next.selected,1);assert.equal(initial.length,1);assert.deepEqual(updatePresets(next.presets,{type:'add',preset:{width:321,height:213}}),next);
  assert.throws(()=>updatePresets(initial,{type:'add',preset:{width:0,height:20}}));assert.throws(()=>updatePresets(initial,{type:'select',index:10}));
});
