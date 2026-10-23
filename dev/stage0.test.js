// Stage 0 checks (33). Unchanged from Stage 0 except: build-label pattern accepts any 0.1.0-dev.N, and BASE can be set by env.
// MOCKED ENGINE: uses three-stub.js instead of Three.js, so it tests page logic only, never rendering or performance.
// Stage 0 verification: storage isolation, relative paths, overlay toggles, error capture, production untouched.
// Three.js is replaced by a stand-in (the sandbox cannot download it), so real renderer numbers are NOT verified here.
const {chromium}=require('playwright');const fs=require('fs');
const BASE=process.env.BASE||'http://localhost:8765',STUB=fs.readFileSync(__dirname+'/three-stub.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
const SEED={'bloodrush-st':JSON.stringify({bank:777,hearts:3,own:[0,15],tut:1,v:3,sentinel:'PROD'}),'bloodrush-best':'12345','bloodrush-cfg':JSON.stringify({hq:true,sentinel:'PROD'}),'bloodrush-char':'15','bloodrush-bat':JSON.stringify({body:2,sentinel:'PROD'})};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route(/three(\.min)?\.js/,r=>r.fulfill({contentType:'application/javascript',body:STUB}));await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
// seed production save on the shared origin, then log every raw storage write/remove made by any page
const seed=await ctx.newPage();await seed.goto(BASE+'/manifest.webmanifest');await seed.evaluate(s=>{localStorage.clear();for(const k in s)localStorage.setItem(k,s[k])},SEED);await seed.close();
await ctx.addInitScript(()=>{const P=Storage.prototype,s=P.setItem,r=P.removeItem,g=P.getItem;window.__ops=[];window.__rawGet=g;P.setItem=function(k,v){__ops.push('set '+k);return s.call(this,k,v)};P.removeItem=function(k){__ops.push('remove '+k);return r.call(this,k)};P.getItem=function(k){__ops.push('get '+k);return g.call(this,k)}});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));const resp={};pg.on('response',r=>{resp[new URL(r.url()).pathname]=r.status()});
await pg.goto(BASE+'/dev/');await pg.waitForTimeout(2500);
// --- relative paths from /dev/
const man=await pg.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]');const j=await (await fetch(l.href)).json();const u=new URL(j.start_url,l.href).pathname;const icons=await Promise.all(j.icons.map(async i=>{const x=new URL(i.src,l.href);return x.pathname+':'+(await fetch(x)).status}));const at=document.querySelector('link[rel=apple-touch-icon]').href,fav=document.querySelector('link[rel=icon]').href;const ms=(await fetch(l.href)).status;return {ms,mpath:new URL(l.href).pathname,name:j.name,start:u,icons,at:new URL(at).pathname+':'+(await fetch(at)).status,fav:new URL(fav).pathname+':'+(await fetch(fav)).status}});
ok(man.ms===200&&man.mpath==='/dev/manifest.webmanifest','manifest link resolves to '+man.mpath+' ('+man.ms+')');
ok(man.name==='Bloodrush DEV'&&man.start==='/dev/index.html','dev manifest name "'+man.name+'", start_url resolves to '+man.start);
ok(man.icons.every(x=>x.endsWith(':200')),'manifest icons resolve: '+man.icons.join(', '));
ok(man.at==='/icon-180.png:200'&&man.fav==='/icon-192.png:200','apple-touch-icon '+man.at+', favicon '+man.fav);
ok(await pg.title()==='Bloodrush DEV','page title is "Bloodrush DEV"');
// --- label + overlay default state
const st0=await pg.evaluate(()=>({badge:!!document.getElementById('brdev-badge')&&getComputedStyle(document.getElementById('brdev-badge')).display!=='none',txt:document.getElementById('brdev-badge').textContent,panel:document.getElementById('brdev-panel').hidden,timers:BR_DEV.timersRunning||false,guard:BR_DEV.guard}));
ok(st0.badge&&/DEVELOPMENT/.test(st0.txt),'DEVELOPMENT label visible');ok(st0.panel===true&&!st0.timers,'overlay hidden by default, no overlay timers running');ok(st0.guard===true,'storage guard installed');
// --- play through save-writing paths: skip tutorial, start run, pause, change a setting, pick a character
await pg.click('#pn button:text-is("Skip")',{timeout:5000}).catch(e=>console.log('note: welcome panel not shown'));await pg.waitForTimeout(400);
const devBank=await pg.evaluate(()=>ST.bank);ok(devBank!==777,'dev copy did NOT load the production save (dev bank '+devBank+', prod bank 777)');
ok(await pg.evaluate(()=>best)!==12345,'dev copy did NOT read production best score');
await pg.click('#go',{force:true,timeout:5000}).catch(e=>console.log('Rise click: '+e.message.split('\n')[0]));await pg.waitForTimeout(1500);ok(['play','tut','dead'].includes(await pg.evaluate(()=>state)),'a run starts in the dev copy (state '+await pg.evaluate(()=>state)+')');await pg.evaluate(()=>{try{pauseGame()}catch(e){}});await pg.waitForTimeout(200);
await pg.evaluate(()=>{try{gems=5;dist=300;finishRun(score())}catch(e){}try{sv()}catch(e){}try{svc()}catch(e){}try{sb()}catch(e){}try{applyChar(16)}catch(e){}try{localStorage.setItem('bloodrushDEV-char',16)}catch(e){}});
// reset-progress code path (the same expression the Settings 'Erase everything' button runs)
await pg.evaluate(()=>{['st','best','char','bat','cfg'].forEach(k=>localStorage.removeItem('bloodrushDEV-'+k))});
const ops=await pg.evaluate(()=>__ops);const writes=ops.filter(o=>!o.startsWith('get '));
const bad=ops.filter(o=>!/ bloodrushDEV-/.test(o));
ok(ops.length>5,'recorded '+ops.length+' storage operations ('+writes.length+' writes/removes)');
ok(bad.length===0,'every storage read/write/remove used a bloodrushDEV- key'+(bad.length?' BAD: '+bad.slice(0,5).join('; '):''));
ok(await pg.evaluate(()=>BR_DEV.rewrites)===0,'guard redirected 0 keys (no unprefixed key left in dev code)');
// --- guard catches a stray production key (simulated future mistake)
const g=await pg.evaluate(()=>{localStorage.setItem('bloodrush-best','999');const v=localStorage.getItem('bloodrush-best');localStorage.removeItem('bloodrush-st');return {v,rew:BR_DEV.rewrites,keys:BR_DEV.devKeys()}});
ok(g.v==='999'&&g.rew===3&&g.keys.includes('bloodrushDEV-bloodrush-best'),'guard redirects a stray production key into the dev namespace ('+g.rew+' redirects logged)');
await pg.evaluate(()=>{localStorage.clear()});// dev clear() must only clear dev keys
// --- production keys byte-identical
const after=await pg.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=__rawGet.call(localStorage,k)}return o});
for(const k in SEED)ok(after[k]===SEED[k],'production key '+k+' unchanged');
// --- overlay toggles: badge tap, backtick, F8, ?debug=1
await pg.click('#brdev-badge');await pg.waitForTimeout(700);
const o1=await pg.evaluate(()=>({open:!document.getElementById('brdev-panel').hidden,timers:BR_DEV.timersRunning,txt:document.getElementById('brdev-stats').textContent}));
ok(o1.open&&o1.timers,'tap on DEVELOPMENT label opens overlay');ok(/Build: 0\.1\.0-dev\.\d+/.test(o1.txt)&&/Draw calls:/.test(o1.txt)&&/Triangles:/.test(o1.txt)&&/Geometries:/.test(o1.txt)&&/Textures:/.test(o1.txt)&&/FPS smoothed:/.test(o1.txt),'overlay shows build, FPS, draw calls, triangles, geometries, textures');
await pg.keyboard.press('`');await pg.waitForTimeout(100);const o2=await pg.evaluate(()=>({open:!document.getElementById('brdev-panel').hidden,timers:BR_DEV.timersRunning}));ok(!o2.open&&!o2.timers,'backtick hides overlay and stops its timers');
await pg.keyboard.press('F8');await pg.waitForTimeout(100);ok(await pg.evaluate(()=>!document.getElementById('brdev-panel').hidden),'F8 shows overlay');
// --- error capture
await pg.evaluate(()=>{setTimeout(()=>{throw new Error('stage0 test uncaught')},0);Promise.reject(new Error('stage0 test rejection'));console.error(new Error('stage0 test console'))});await pg.waitForTimeout(400);
const e=await pg.evaluate(()=>({list:BR_DEV.errors.map(x=>x.k+':'+x.m),errs:document.getElementById('brdev-errs').textContent,badge:document.querySelector('#brdev-badge b').textContent}));
ok(e.list.some(x=>/^error:.*stage0 test uncaught/.test(x)),'uncaught error captured');ok(e.list.some(x=>/^promise:.*stage0 test rejection/.test(x)),'unhandled promise rejection captured');ok(e.list.some(x=>/^console:.*stage0 test console/.test(x)),'console.error (game loop catches) captured');
ok(/stage0 test uncaught/.test(e.errs)&&/err/.test(e.badge),'errors listed in overlay and counted on label ('+e.badge+')');
const fr=await pg.evaluate(()=>document.getElementById('brdev-stats').textContent.match(/FPS 1s avg: ([^S]*?)Slowest/));ok(fr&&!/…/.test(fr[1]),'FPS timer produced a 1-second average ('+(fr&&fr[1].trim())+' in headless browser)');
await pg.close();
// --- ?debug=1 opens overlay on load; production page has no overlay and still sees its own save
const p2=await ctx.newPage();await p2.goto(BASE+'/dev/?debug=1');await p2.waitForTimeout(1500);ok(await p2.evaluate(()=>!document.getElementById('brdev-panel').hidden),'?debug=1 opens overlay on load');await p2.close();
const pp=await ctx.newPage();await pp.goto(BASE+'/');await pp.waitForTimeout(2500);
const prod=await pp.evaluate(()=>({badge:!!document.getElementById('brdev-badge'),dev:typeof BR_DEV,bank:typeof ST!=='undefined'?ST.bank:null,best:typeof best!=='undefined'?best:null,title:document.title}));
ok(!prod.badge&&prod.dev==='undefined'&&prod.title==='Bloodrush','production page has no DEV label, overlay or guard');ok(prod.bank===777&&prod.best===12345,'production page still loads its own save (bank '+prod.bank+', best '+prod.best+')');
const real=errs.filter(x=>!/stage0 test/.test(x));ok(real.length===0,'no unexpected page errors in dev run '+JSON.stringify(real.slice(0,3)));
console.log(`\n${pass} passed, ${fail} failed`);await b.close();process.exit(fail?1:0)})();
