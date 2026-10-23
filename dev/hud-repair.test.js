// HUD repair regression checks: the five restored hook calls (ui2Tick, ui3Tick in vxTick; ui2Face, ui3Face, ui4Scroll in vxApply).
// MOCKED ENGINE: uses three-stub.js instead of Three.js. These checks prove the HUD/menu DOM is updated by the game loop;
// they cannot prove that anything renders correctly over the real 3D scene. See README for checks that need a real browser.
// Power-ups are triggered with the game's own pickup handler grab(t) (not by a real collision, which the stand-in cannot do).
// Run: serve the repository root on BASE (default http://localhost:8765), then: node dev/tests/hud-repair.test.js
const {chromium}=require('playwright');const fs=require('fs');
const BASE=process.env.BASE||'http://localhost:8765',STUB=fs.readFileSync(__dirname+'/three-stub.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
const DEVSEED={'bloodrushDEV-st':JSON.stringify({bank:4242,hearts:2,own:[0,15,16],tut:1,pk:1,v:3,runs:9}),'bloodrushDEV-char':'15'};
const PROD={'bloodrush-st':JSON.stringify({bank:777,hearts:3,own:[0,15],tut:1,v:3}),'bloodrush-best':'12345','bloodrush-char':'15'};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route(/three(\.min)?\.js/,r=>r.fulfill({contentType:'application/javascript',body:STUB}));await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
await ctx.addInitScript(()=>{const g=Storage.prototype.getItem,k=Storage.prototype.key;window.__raw=()=>{const o={};for(let i=0;i<localStorage.length;i++){const n=k.call(localStorage,i);o[n]=g.call(localStorage,n)}return o}});
const seed=await ctx.newPage();await seed.goto(BASE+'/manifest.webmanifest');await seed.evaluate(s=>{localStorage.clear();for(const k in s)localStorage.setItem(k,s[k])},Object.assign({},DEVSEED,PROD));await seed.close();
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(BASE+'/dev/');await pg.waitForFunction(()=>typeof state!=='undefined'&&state==='menu'&&!document.getElementById('splash'),null,{timeout:20000});await pg.waitForTimeout(1300);
const E=(f,a)=>pg.evaluate(f,a);
// ---- faces (ui2Face, ui3Face)
const f0=await E(()=>({abi:document.getElementById('abi').style.backgroundImage,mpf:document.getElementById('mpf').style.backgroundImage}));
ok(/^url\("data:image\/svg\+xml,/.test(f0.abi),'ability button face set at startup (voxel face image)');
ok(f0.mpf&&f0.mpf===f0.abi,'profile button shows the same face as the ability button');
// ---- menu subtitle, tab highlight, page-specific side buttons (ui3Tick)
ok(await E(()=>{const h=HER.find(x=>x.ci===ci);return document.querySelector('#ov .sub').textContent===h.n+' · '+h.t}),'menu subtitle shows the selected hero ("Bran · The Newborn")');
ok(await E(()=>(document.querySelector('#mtab button.on')||{}).textContent==='Home'),'tab bar highlights Home on the main page');
const tabs=[];for(const [p,name,side] of [[0,'Collection',false],[2,'Progress',false],[1,'Home',true]]){await pg.click('#mtab button[data-p="'+p+'"]');await pg.waitForTimeout(1200);
 tabs.push(await E(([name,side])=>{const on=(document.querySelector('#mtab button.on')||{}).textContent,vis=getComputedStyle(document.getElementById('msd')).display!=='none';return on===name&&vis===side},[name,side]))}
ok(tabs.every(Boolean),'tab highlight follows Collection / Progress / Home, side buttons shown only on Home ('+tabs.join(',')+')');
// ---- character change updates faces + subtitle; character select scrolls the chosen card into view (ui4Scroll)
await pg.click('#msd .msb[data-t="ch"]');await pg.waitForFunction(()=>state==='select',null,{timeout:4000});
await E(()=>{document.getElementById('cs').scrollLeft=0});await pg.evaluate(()=>document.getElementById('cs').children[22].click());await pg.waitForTimeout(400);
const sc=await E(()=>{const cs=document.getElementById('cs'),c=cs.children[22].getBoundingClientRect(),r=cs.getBoundingClientRect();return{left:cs.scrollLeft,inView:c.left>=r.left-1&&c.right<=r.right+1,abi:document.getElementById('abi').style.backgroundImage,mpf:document.getElementById('mpf').style.backgroundImage}});
ok(sc.left>0&&sc.inView,'character select scrolls the chosen card into view (scrollLeft '+sc.left+')');
ok(sc.abi!==f0.abi&&sc.mpf===sc.abi,'picking another character updates both faces');
await pg.evaluate(()=>document.getElementById('rt').click());await pg.waitForFunction(()=>state==='menu',null,{timeout:4000});await pg.waitForTimeout(1200);
ok(await E(()=>{const h=HER.find(x=>x.ci===ci);const want=h?h.n+' · '+h.t:CH[ci].n;return document.querySelector('#ov .sub').textContent===want&&document.getElementById('abi').style.backgroundImage===document.getElementById('mpf').style.backgroundImage}),'back on the menu: subtitle and faces match the current character');
// ---- distance HUD during a run (ui2Tick)
await pg.evaluate(()=>document.getElementById('go').click());await pg.waitForFunction(()=>state==='play',null,{timeout:4000});
await E(()=>{window.__k=setInterval(()=>{try{inv=5;strikes=0}catch(e){}},50)});
await pg.waitForTimeout(500);const h0=await E(()=>parseInt(document.getElementById('hdist').textContent.replace(/\D/g,''),10));await pg.waitForTimeout(1000);
const h1=await E(()=>({hud:parseInt(document.getElementById('hdist').textContent.replace(/\D/g,''),10),dist:Math.floor(dist)}));
ok(h1.hud>h0&&h1.hud>0,'HUD distance increases during a run ('+h0+' m → '+h1.hud+' m)');
ok(h1.hud>0&&Math.abs(h1.hud-h1.dist)<=30,'HUD distance tracks the game distance (HUD '+h1.hud+', game '+h1.dist+')');
// ---- power-up rings and ×2 badge (ui2Tick)
ok(await E(()=>document.getElementById('hmul').style.display==='none'&&document.querySelectorAll('#hpwr .pr').length===0),'no rings and no badge before any power-up');
await E(()=>grab(2));await pg.waitForTimeout(300);
const g1=await E(()=>{const r=document.querySelector('#hpwr .pr[data-k="gT"]'),m=document.getElementById('hmul');return{ring:!!r,off:r?parseFloat(r.querySelector('.fg').style.strokeDashoffset):null,badge:m.style.display!=='none'?m.textContent:''}});
ok(g1.ring,'Witches Grimoire pickup shows a timer ring');ok(g1.badge==='×2','Witches Grimoire pickup shows the ×2 badge ("'+g1.badge+'")');
await pg.waitForTimeout(1500);const off2=await E(()=>{const r=document.querySelector('#hpwr .pr[data-k="gT"] .fg');return r?parseFloat(r.style.strokeDashoffset):null});
ok(off2!==null&&g1.off!==null&&off2>g1.off,'ring empties as the power-up runs down (offset '+g1.off+' → '+off2+')');
await E(()=>grab(0));await pg.waitForTimeout(300);ok(await E(()=>document.querySelectorAll('#hpwr .pr').length===2&&!!document.querySelector('#hpwr .pr[data-k="cT"]')),'a second power-up (Chalice) adds its own ring');
await E(()=>{gT=.01;cT=.01});await pg.waitForTimeout(500);
ok(await E(()=>document.getElementById('hmul').style.display==='none'&&!document.querySelector('#hpwr .pr[data-k="gT"]')),'when the Grimoire runs out its ring and the ×2 badge disappear');
await E(()=>clearInterval(window.__k));
// ---- gameplay still works with the hooks running every frame
await pg.keyboard.press('ArrowLeft');await pg.waitForTimeout(400);ok(await E(()=>ln===0||ln===1),'lane change still works');
await pg.click('#bpause',{force:true});await pg.waitForTimeout(300);const dp=await E(()=>document.getElementById('hdist').textContent);await pg.waitForTimeout(600);
ok(await E(d=>state==='paused'&&document.getElementById('hdist').textContent===d,dp),'pause freezes the HUD distance');
await pg.evaluate(()=>document.getElementById('brs').click());await pg.waitForTimeout(800);ok(await E(d=>state==='play'&&document.getElementById('hdist').textContent!==d,dp),'resume: HUD distance moves again');
await E(()=>die());await pg.waitForFunction(()=>{const v=id=>{const e=document.getElementById(id);return e&&e.getBoundingClientRect().width>0};return v('rvp')||v('rra')},null,{timeout:5000});
await E(()=>{const e=document.getElementById('rvp');if(e&&e.getBoundingClientRect().width>0)document.getElementById('rvx').click()});
await pg.waitForFunction(()=>{const e=document.getElementById('rra');return e&&e.getBoundingClientRect().width>0},null,{timeout:5000});await pg.click('#rra',{force:true});
await pg.waitForFunction(()=>state==='play',null,{timeout:4000});await pg.waitForTimeout(600);
ok(await E(()=>parseInt(document.getElementById('hdist').textContent.replace(/\D/g,''),10)<60&&document.querySelectorAll('#hpwr .pr').length===0),'restart: HUD distance starts again from 0 and no leftover rings');
// ---- save isolation + no errors
const raw=await E(()=>__raw());ok(Object.keys(PROD).every(k=>raw[k]===PROD[k]),'production keys untouched');
ok(Object.keys(raw).every(k=>k.startsWith('bloodrushDEV-')||k in PROD),'no new non-dev keys created');
ok(await E(()=>BR_DEV.rewrites===0),'Stage 0 guard redirected no keys');
ok(errs.length===0,'no page errors '+JSON.stringify(errs.slice(0,3)));
console.log(`\n${pass} passed, ${fail} failed (mocked engine)`);await b.close();process.exit(fail?1:0)})();
