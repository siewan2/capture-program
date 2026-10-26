const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-desktop-'));
  let application;
  try {
    application = await electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'..'),'--startup-hidden',`--user-data-dir=${profile}`],timeout:60000});
    if(process.platform==='win32')await application.evaluate(({app})=>{
      const options={name:'CaptureProgram',path:process.execPath,args:['--startup-hidden']};
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
    const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#d6e6fa';x.fillRect(0,0,800,600);const data=c.toDataURL();addCapture(data);return data;});
    await page.waitForFunction(()=>!document.querySelector('#rotate').disabled);
    const original=await page.locator('#editor').evaluate(c=>c.toDataURL());
    const before=await page.locator('#editor').boundingBox(),area=await page.locator('#workspace').boundingBox();
    await page.keyboard.down('Control');await page.mouse.move(area.x+5,area.y+8);await page.mouse.down();await page.mouse.move(area.x+145,area.y+8,{steps:10});await page.mouse.up();await page.keyboard.up('Control');
    const enlarged=await page.locator('#editor').boundingBox();assert.ok(enlarged.width>before.width*1.3,'Ctrl+horizontal drag from workspace must enlarge the image');
    await page.keyboard.down('Control');await page.mouse.move(enlarged.x+30,enlarged.y+30);await page.mouse.down();await page.mouse.move(enlarged.x+30,enlarged.y+210,{steps:10});await page.mouse.up();await page.keyboard.up('Control');
    assert.ok((await page.locator('#editor').boundingBox()).width<enlarged.width*.7,'Ctrl+vertical drag must shrink the image');
    assert.equal(await page.locator('#editor').evaluate(c=>c.toDataURL()),original);assert.equal(await page.locator('#undo').isDisabled(),true);
    // Only screen pixels are substituted; the Electron windows, preload, IPC,
    // native bitmap composition, keyboard handling and preset storage are real.
    await application.evaluate(({desktopCapturer,screen,nativeImage},data)=>{
      desktopCapturer.getSources=async()=>screen.getAllDisplays().map(d=>({display_id:String(d.id),id:'screen:'+d.id,thumbnail:nativeImage.createFromDataURL(data).resize({width:Math.round(d.bounds.width*d.scaleFactor),height:Math.round(d.bounds.height*d.scaleFactor)})}));
    },fixture);
    const opened=application.waitForEvent('window');await page.click('#fixed');const overlay=await opened;overlay.setDefaultTimeout(20000);overlay.on('pageerror',error=>errors.push(error.message));
    await overlay.waitForFunction(()=>!document.querySelector('#fixedControls').hidden);
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
    const cancelled=application.waitForEvent('window');await page.click('#region');const cancelledOverlay=await cancelled;await cancelledOverlay.waitForFunction(()=>document.querySelector('#surface').width>300);await cancelledOverlay.keyboard.press('Escape').catch(error=>{if(!cancelledOverlay.isClosed())throw error;});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('취소'));
    assert.deepEqual(await application.evaluate(({clipboard})=>clipboard.readImage().getSize()),{width:321,height:213});
    assert.deepEqual(errors,[]);console.log('PASS actual Electron: Ctrl-drag horizontal/vertical zoom and workspace capture, unchanged bitmap/history, real overlay dimensions/preset IPC/persistence and native crop, automatic native clipboard copy and cancellation preservation. Screen pixels substituted.');
  } finally {
    if(application)await application.close();
    await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
