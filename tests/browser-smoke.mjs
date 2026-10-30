// Browser end-to-end smoke tests: actual HTML modules, UI interactions and localStorage.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('.'), mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const content=await readFile(file);
  res.writeHead(200,{'Content-Type':(mime[extname(file)]||'application/octet-stream')+'; charset=utf-8'});
  res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url='http://127.0.0.1:'+server.address().port;
let browser;
const failures=[];
async function scenario(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failures.push(name+': '+e.stack);console.error('FAIL '+name+': '+e.message);}}
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 await scenario('Desktop bootstrap, first lab and durable retry',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});
  assert.notEqual(await page.locator('#equity').textContent(),'—','App did not render the account');
  assert.equal(await page.locator('#guidedStrip').isVisible(),true,'Onboarding hint is missing');
  await page.locator('[data-guide="start"]').click();
  assert.equal(await page.locator('#laboratory').isVisible(),true);
  await page.locator('#labStart').click();
  await page.locator('#labNumber').fill('0,5');
  await page.locator('#labSubmit').click();
  assert.match(await page.locator('#lessonBody').innerText(),/ВЫПОЛНЕНО/);
  let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('marketlab-education-workstation-v8')));
  assert.equal(state.labs.records.contract.everCompleted,true);
  await page.locator('#labStart').click();
  state=await page.evaluate(()=>JSON.parse(localStorage.getItem('marketlab-education-workstation-v8')));
  assert.equal(state.labs.records.contract.completed,false);
  assert.equal(state.labs.records.contract.everCompleted,true);
  assert.equal(errors.length,0,errors.join('; '));
  await context.close();
 });
 await scenario('Trade, replay, P&L snapshot and no scenario spoilers',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:900}}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url,{waitUntil:'networkidle'});
  assert.equal(await p.locator('#scenarios .scenario-impact').count(),0,'Exact scenario impact leaked before run');
  assert.equal(await p.locator('#scenarios .scenario-result').count(),0);
  await p.locator('[data-view="laboratory"]').click();
  await p.locator('[data-lesson-tab="2"]').click();
  await p.locator('#labStart').click();
  await p.locator('#labGoTerminal').click();
  await p.locator('#placeOrder').click();
  await p.locator('[data-guide="resume"]').click();
  let state=await p.evaluate(()=>JSON.parse(localStorage.getItem('marketlab-education-workstation-v8')));
  const fixed=state.labs.records['position-pnl'].snapshot;
  assert.ok(fixed?.position,'A real position must be snapshotted');
  const pnl=(fixed.price-fixed.position.entry)*2*fixed.position.qty*fixed.position.side;
  await p.locator('[data-view="terminal"]').click();
  await p.locator('#tickOne').click();
  await p.locator('[data-guide="resume"]').click();
  state=await p.evaluate(()=>JSON.parse(localStorage.getItem('marketlab-education-workstation-v8')));
  assert.equal(state.labs.records['position-pnl'].snapshot.price,fixed.price);
  await p.locator('#labNumber').fill(String(pnl).replace('.',','));
  await p.locator('#labSubmit').click();
  state=await p.evaluate(()=>JSON.parse(localStorage.getItem('marketlab-education-workstation-v8')));
  assert.equal(state.labs.records['position-pnl'].completed,true,'Original price must still grade correctly');
  await p.locator('[data-view="terminal"]').click();
  await p.locator('[data-scenario="1"]').click();
  assert.ok(await p.locator('#scenarios .scenario-result').count()>0);
  assert.equal(errors.length,0,errors.join('; '));
  await ctx.close();
 });
 await scenario('Mobile open, show trade details and retain basic operation',async()=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url,{waitUntil:'networkidle'});
  assert.notEqual(await p.locator('#equity').textContent(),'—');
  await p.locator('#priceChart').focus();
  await p.keyboard.press('ArrowLeft');
  assert.match(await p.locator('#priceChart').getAttribute('aria-label'),/Свеча/);
  await p.locator('#orderDetails summary').click();
  assert.equal(await p.locator('#notional').isVisible(),true);
  await p.locator('#placeOrder').click();
  assert.match(await p.locator('#activeOrderPosition').innerText(),/Покупка/);
  await p.locator('#closeSelected').click();
  assert.equal((await p.locator('#activeOrderPosition').innerText()).includes('нет'),true);
  assert.equal(errors.length,0,errors.join('; '));
  await ctx.close();
 });
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
if(failures.length){console.error(failures.join('\n\n'));process.exitCode=1;}
