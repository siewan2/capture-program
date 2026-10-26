const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-desktop-'));
  let application;
  const executablePath=process.env.CAPTURE_TEST_EXE||require('electron');
  const launch=hidden=>electron.launch({executablePath,args:[...(process.env.CAPTURE_TEST_EXE?[]:[path.resolve(__dirname,'..')]),...(hidden?['--startup-hidden']:[]),`--user-data-dir=${profile}`],timeout:60000});
  try {
    application = await launch(true);
    if(process.platform==='win32')await application.evaluate(({app})=>{
      const options={path:process.execPath,args:['--startup-hidden']};
      try{
        app.setLoginItemSettings({...options,openAtLogin:true});
        if(!app.getLoginItemSettings(options).openAtLogin)throw new Error('Windows startup registration failed');
      }finally{app.setLoginItemSettings({...options,openAtLogin:false});}
      if(app.getLoginItemSettings(options).openAtLogin)throw new Error('Windows startup removal failed');
    });
    const page = await application.firstWindow();page.setDefaultTimeout(20000);
    assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false,'Login startup must keep the main window hidden');
    await application.evaluate(({BrowserWindow})=>{const main=BrowserWindow.getAllWindows()[0];main.show();main.focus();});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.waitForFunction(()=>typeof window.captureAPI?.onPresetsUpdated==='function'&&document.querySelector('#region')?.onclick);
    await page.click('#settingsTab');assert.equal(await page.locator('#captureShadeEnabled').isChecked(),false);
    await page.locator('#captureShadeEnabled').check();await page.reload();await page.waitForFunction(()=>document.querySelector('#region')?.onclick);assert.equal(await page.locator('#captureShadeEnabled').isChecked(),true);await page.click('#captureTab');
    assert.equal(await page.locator('[data-tool=select]').count(),0);assert.equal(await page.locator('[data-tool=highlighter]').getAttribute('class'),'active');
    await application.evaluate(({globalShortcut})=>{
      const register=globalShortcut.register.bind(globalShortcut);globalThis.galleryTestCallbacks={};globalShortcut.register=(key,callback)=>{globalThis.galleryTestCallbacks[key]=callback;return register(key,callback);};
    });
    await page.click('#settingsTab');await page.locator('#shortcut-gallery').focus();await page.keyboard.press('Control+Shift+4');await page.waitForFunction(()=>document.querySelector('#shortcut-status-gallery').textContent==='등록됨');
    assert.equal(await application.evaluate(({globalShortcut})=>globalShortcut.isRegistered('Control+Shift+4')),true);
    await application.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].hide();globalThis.galleryTestCallbacks['Control+Shift+4']();});
    await page.waitForFunction(()=>!document.querySelector('#capturePanel').hidden);
    assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
    const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#d6e6fa';x.fillRect(0,0,800,600);x.fillStyle='#e34466';x.fillRect(0,0,100,80);const data=c.toDataURL();addCapture(data);return data;});
    await page.waitForFunction(()=>!document.querySelector('#rotate').disabled);
    const original=await page.locator('#editor').evaluate(c=>c.toDataURL());
    await page.locator('#editor').focus();await page.keyboard.press('Escape');
    assert.equal(await application.evaluate(async({BrowserWindow})=>{const main=BrowserWindow.getAllWindows()[0];for(let i=0;i<40&&main.isVisible();i++)await new Promise(resolve=>setTimeout(resolve,50));return main.isVisible();}),false,'Escape must hide the main window');
    assert.equal(await application.evaluate(({globalShortcut})=>globalShortcut.isRegistered('Control+Shift+4')),true);
    await application.evaluate(()=>globalThis.galleryTestCallbacks['Control+Shift+4']());await page.waitForFunction(()=>!document.querySelector('#capturePanel').hidden);
    assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
    assert.equal(await page.locator('#editor').evaluate(c=>c.toDataURL()),original);assert.equal(await page.locator('#count').textContent(),'1');
    const before=await page.locator('#editor').boundingBox(),area=await page.locator('#workspace').boundingBox();
    await page.keyboard.down('Control');await page.mouse.move(area.x+5,area.y+8);await page.mouse.down();await page.mouse.move(area.x+145,area.y+8,{steps:10});await page.mouse.up();await page.keyboard.up('Control');
    const enlarged=await page.locator('#editor').boundingBox();assert.ok(enlarged.width>before.width*1.3,'Ctrl+horizontal drag from workspace must enlarge the image');
    await page.keyboard.down('Control');await page.mouse.move(enlarged.x+30,enlarged.y+30);await page.mouse.down();await page.mouse.move(enlarged.x+30,enlarged.y+210,{steps:10});await page.mouse.up();await page.keyboard.up('Control');
    assert.ok((await page.locator('#editor').boundingBox()).width<enlarged.width*.7,'Ctrl+vertical drag must shrink the image');
    assert.equal(await page.locator('#editor').evaluate(c=>c.toDataURL()),original);assert.equal(await page.locator('#undo').isDisabled(),true);
    await page.mouse.move(area.x+30,area.y+30);await page.keyboard.down('Control');const wheelBefore=await page.locator('#editor').boundingBox();await page.mouse.wheel(0,-160);await page.waitForFunction(w=>document.querySelector('#editor').getBoundingClientRect().width>w,wheelBefore.width);const wheelLarger=await page.locator('#editor').boundingBox();await page.mouse.wheel(0,160);await page.waitForFunction(w=>document.querySelector('#editor').getBoundingClientRect().width<w,wheelLarger.width);await page.keyboard.up('Control');
    assert.equal(await page.locator('#editor').evaluate(c=>c.toDataURL()),original);
    await page.click('#rotateLeft');assert.deepEqual(await page.locator('#editor').evaluate(c=>({width:c.width,height:c.height})),{width:600,height:800});
    assert.deepEqual(await page.locator('#editor').evaluate(c=>Array.from(c.getContext('2d').getImageData(20,780,1,1).data)),[227,68,102,255]);
    await page.click('#rotate');assert.equal(await page.locator('#editor').evaluate(c=>c.toDataURL()),original);
    await page.click('#undo');await page.waitForFunction(()=>!document.querySelector('#rotate').disabled);assert.equal(await page.locator('#editor').evaluate(c=>c.width),600);
    await page.click('#reset');await page.waitForFunction(()=>!document.querySelector('#rotate').disabled);assert.equal(await page.locator('#editor').evaluate(c=>c.toDataURL()),original);
    // Only screen pixels are substituted; the Electron windows, preload, IPC,
    // native bitmap composition, keyboard handling and preset storage are real.
    await application.evaluate(({desktopCapturer,screen,nativeImage},data)=>{
      desktopCapturer.getSources=async()=>screen.getAllDisplays().map(d=>({display_id:String(d.id),id:'screen:'+d.id,thumbnail:nativeImage.createFromDataURL(data).resize({width:Math.round(d.bounds.width*d.scaleFactor),height:Math.round(d.bounds.height*d.scaleFactor)})}));
    },fixture);
    const opened=application.waitForEvent('window');await page.click('#fixed');const overlay=await opened;overlay.setDefaultTimeout(20000);overlay.on('pageerror',error=>errors.push(error.message));
    await overlay.waitForFunction(()=>!document.querySelector('#fixedControls').hidden);
    assert.equal(await overlay.locator('#shade').isVisible(),true);
    assert.equal(await overlay.locator('#surface').evaluate(c=>c.getContext('2d').getImageData(0,0,1,1).data[3]),0,'No shade or repeated screenshot painting on guide canvas');
    assert.equal(await overlay.locator('#backdrop').evaluate(img=>img.complete&&img.naturalWidth>0),true);
    await overlay.fill('#captureWidth','321');await overlay.fill('#captureHeight','213');await overlay.locator('#captureHeight').press('Enter');
    await overlay.waitForFunction(()=>document.querySelector('#hint').textContent.includes('321 × 213'));
    await overlay.click('#addCapturePreset');await overlay.waitForFunction(()=>document.querySelector('#fixedStatus').textContent.includes('프리셋을 저장'));
    assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('presets')).some(p=>p.width===321&&p.height===213)));
    const selected=await overlay.inputValue('#capturePresets');await overlay.selectOption('#capturePresets','0');await overlay.selectOption('#capturePresets',selected);
    await overlay.click('#fixedCapture');await page.waitForFunction(()=>document.querySelector('#count').textContent==='2'&&!document.querySelector('#rotate').disabled);
    assert.deepEqual(await page.locator('#editor').evaluate(c=>({width:c.width,height:c.height})),{width:321,height:213});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('클립보드에 복사'));
    assert.deepEqual(await application.evaluate(({clipboard})=>clipboard.readImage().getSize()),{width:321,height:213});
    assert.equal(await application.evaluate(({clipboard,nativeImage},data)=>clipboard.readImage().toBitmap().equals(nativeImage.createFromDataURL(data).toBitmap()),await page.locator('#editor').evaluate(c=>c.toDataURL())),true);
    await page.selectOption('#presets','0');
    const repeated=application.waitForEvent('window');await page.click('#fixed');const repeatedOverlay=await repeated;await repeatedOverlay.waitForFunction(()=>document.querySelector('#captureWidth').value==='321'&&document.querySelector('#captureHeight').value==='213');
    await repeatedOverlay.fill('#captureWidth','287');await repeatedOverlay.click('#applyCaptureSize');await repeatedOverlay.evaluate(()=>document.activeElement.blur());await repeatedOverlay.keyboard.press('Shift+ArrowRight');await repeatedOverlay.keyboard.press('Shift+ArrowDown');await repeatedOverlay.click('#fixedCancel').catch(error=>{if(!repeatedOverlay.isClosed())throw error;});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('취소'));
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('settings')).lastFixedSize),{width:287,height:213});
    const rememberedFixedRect=await page.evaluate(()=>JSON.parse(localStorage.getItem('settings')).lastFixedRect);
    const cancelled=application.waitForEvent('window');await page.click('#region');const cancelledOverlay=await cancelled;await cancelledOverlay.waitForFunction(()=>document.querySelector('#surface').width>300);await cancelledOverlay.keyboard.press('Escape').catch(error=>{if(!cancelledOverlay.isClosed())throw error;});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('취소'));
    assert.deepEqual(await application.evaluate(({clipboard})=>clipboard.readImage().getSize()),{width:321,height:213});
    await page.locator('#editor').focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.querySelector('#editor').width===800&&!document.querySelector('#rotate').disabled);
    await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#editor').evaluate(c=>c.width),800);
    await page.keyboard.press('ArrowUp');await page.waitForFunction(()=>document.querySelector('#editor').width===321&&!document.querySelector('#rotate').disabled);
    await page.keyboard.press('ArrowUp');assert.equal(await page.locator('#editor').evaluate(c=>c.width),321);
    await page.click('#settingsTab');await page.locator('#shortcut-region').focus();await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#editor').evaluate(c=>c.width),321);await page.click('#captureTab');
    await page.click('[data-tool=highlighter]');await page.fill('#weight','41');await page.locator('#opacity').evaluate(e=>{e.value='48';e.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.click('[data-tool=pen]');await page.fill('#weight','7');await page.click('#colorSwatches [data-color="#000000"]');
    await page.locator('.capture-pin').first().click();await page.waitForFunction(()=>document.querySelector('.capture-pin').getAttribute('aria-pressed')==='true'&&!document.querySelector('.capture-pin').disabled);
    assert.equal((await page.evaluate(()=>captureAPI.listPinned())).items.length,1);
    await page.locator('.capture-pin').first().click();await page.waitForFunction(()=>document.querySelector('.capture-pin').getAttribute('aria-pressed')==='false'&&!document.querySelector('.capture-pin').disabled);
    assert.equal((await page.evaluate(()=>captureAPI.listPinned())).items.length,0);
    await page.locator('.capture-pin').first().click();await page.waitForFunction(()=>!document.querySelector('.capture-pin').disabled);await page.click('#rotate');
    const edited=await page.locator('#editor').evaluate(c=>c.toDataURL());assert.equal((await page.evaluate(()=>captureAPI.listPinned())).items[0].data,edited);
    await application.close();application=await launch(false);
    const restored=await application.firstWindow();await restored.waitForFunction(()=>document.querySelector('#count').textContent==='1'&&!document.querySelector('#rotate').disabled);
    assert.equal(await restored.locator('[data-tool=highlighter]').getAttribute('class'),'active');assert.equal(await restored.inputValue('#weight'),'41');assert.equal(await restored.inputValue('#opacity'),'48');
    await restored.click('[data-tool=pen]');assert.equal(await restored.inputValue('#weight'),'7');assert.equal(await restored.inputValue('#color'),'#000000');
    assert.equal(await restored.locator('#editor').evaluate(c=>c.toDataURL()),edited);assert.equal(await restored.locator('.capture-pin').getAttribute('aria-pressed'),'true');
    await application.evaluate(({desktopCapturer,screen,nativeImage},data)=>{desktopCapturer.getSources=async()=>screen.getAllDisplays().map(d=>({display_id:String(d.id),id:'screen:'+d.id,thumbnail:nativeImage.createFromDataURL(data).resize({width:Math.round(d.bounds.width*d.scaleFactor),height:Math.round(d.bounds.height*d.scaleFactor)})}));},fixture);
    const resumed=application.waitForEvent('window');await restored.click('#fixed');const resumedOverlay=await resumed;await resumedOverlay.waitForFunction(()=>document.querySelector('#captureWidth').value==='287'&&document.querySelector('#captureHeight').value==='213');
    assert.deepEqual(await resumedOverlay.evaluate(()=>({x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)})),await resumedOverlay.evaluate(saved=>({x:saved.x-config.desktopOrigin.x,y:saved.y-config.desktopOrigin.y,width:saved.width,height:saved.height}),rememberedFixedRect));await resumedOverlay.click('#fixedCancel').catch(error=>{if(!resumedOverlay.isClosed())throw error;});await restored.waitForFunction(()=>document.querySelector('#status').textContent.includes('취소'));
    await restored.locator('.capture-delete').click();await restored.waitForFunction(()=>document.querySelector('#count').textContent==='0');assert.equal((await restored.evaluate(()=>captureAPI.listPinned())).items.length,0);
    await restored.reload();await restored.waitForFunction(()=>document.querySelector('#region')?.onclick);assert.equal((await restored.evaluate(()=>captureAPI.listPinned())).items.length,0);
    assert.deepEqual(errors,[]);console.log('PASS actual Electron: Ctrl-drag horizontal/vertical zoom and workspace capture, unchanged bitmap/history, real overlay dimensions/preset IPC/persistence and native crop, automatic native clipboard copy, Ctrl-wheel zoom, hidden login startup, native login registration, pinned edit persistence across process restart, unpin and deletion. Screen pixels substituted.');
  } finally {
    if(application)await application.close();
    await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
