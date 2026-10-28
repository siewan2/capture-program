const {_electron:electron}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'capture-gallery-'));let app;
  try{
    app=await electron.launch({executablePath:process.env.CAPTURE_TEST_EXE||require('electron'),args:[...(process.env.CAPTURE_TEST_EXE?[]:[path.resolve(__dirname,'..')]),`--user-data-dir=${profile}`],timeout:60000});
    const page=await app.firstWindow();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>document.querySelector('#region')?.onclick);
    const fixture=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,320,240);const data=c.toDataURL();for(let i=0;i<18;i++)await addCapture(data);return data;});
    const target=page.locator('.capture-select').nth(12);await target.scrollIntoViewIfNeeded();
    const scroll=await page.locator('aside').evaluate(el=>el.scrollTop);assert.ok(scroll>0);
    await target.click();await page.waitForFunction(()=>!document.querySelector('#rotate').disabled);
    assert.equal(await page.locator('aside').evaluate(el=>el.scrollTop),scroll,'selection preserves list position');
    assert.equal(await page.locator('.capture-select').nth(12).evaluate(el=>el===document.activeElement),true,'selection preserves thumbnail focus');
    const states=[await page.locator('#editor').evaluate(c=>c.toDataURL())];
    for(const tool of ['highlighter','rect']){
      await page.click(`[data-tool=${tool}]`);const box=await page.locator('#editor').boundingBox();
      await page.mouse.move(box.x+35,box.y+35);await page.mouse.down();await page.mouse.move(box.x+150,box.y+110,{steps:8});await page.mouse.up();
      states.push(await page.locator('#editor').evaluate(c=>c.toDataURL()));assert.notEqual(states.at(-1),states.at(-2));
    }
    for(const expected of [states[1],states[0]]){await page.keyboard.press('Control+z');await page.waitForFunction(()=>!document.querySelector('#rotate').disabled);assert.equal(await page.locator('#editor').evaluate(c=>c.toDataURL()),expected,'Ctrl+Z undoes one edit');}
    await page.locator('.capture-select').nth(12).focus();
    await app.evaluate(({clipboard,nativeImage},data)=>clipboard.writeImage(nativeImage.createFromDataURL(data)),fixture);
    const before=await page.evaluate(()=>({ids:captures.map(c=>c.id),selected:current.id}));
    await page.keyboard.press('Control+v');await page.waitForFunction(()=>document.querySelector('#count').textContent==='19'&&!pasting&&!loadingImage);
    const after=await page.evaluate(()=>({ids:captures.map(c=>c.id),selected:current.id,data:current.data}));
    assert.equal(after.ids.indexOf(after.selected),12);assert.equal(after.ids[13],before.selected);assert.deepEqual(after.ids.filter(id=>id!==after.selected),before.ids);assert.deepEqual(await page.locator('#editor').evaluate(c=>({width:c.width,height:c.height,pixel:[...c.getContext('2d').getImageData(0,0,1,1).data]})),{width:320,height:240,pixel:[255,255,255,255]});
    assert.equal(await page.locator('.capture.selected .capture-select').evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Control+v');await page.waitForFunction(()=>document.querySelector('#count').textContent==='20'&&!pasting&&!loadingImage);
    await app.evaluate(({clipboard})=>clipboard.writeText('plain text'));
    await page.keyboard.press('Control+v');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('이미지가 없습니다'));assert.equal(await page.locator('#count').textContent(),'20');
    await app.evaluate(({clipboard,nativeImage},data)=>clipboard.writeImage(nativeImage.createFromDataURL(data)),fixture);
    await page.click('#settingsTab');await page.keyboard.press('Control+v');assert.equal(await page.locator('#count').textContent(),'20');
    await page.click('#captureTab');await page.locator('#weight').focus();await page.keyboard.press('Control+v');assert.equal(await page.locator('#count').textContent(),'20');
    assert.deepEqual(errors,[]);console.log('PASS: real Electron Ctrl+Z stepwise edits, stable thumbnail scroll/focus, native clipboard insertion order and repeated paste, text-only clipboard and settings/input guards');
  }finally{if(app)await app.close();await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});
