// Stage 1a checks (updated for the HUD repair: the in-page self-test is now expected to report no FAIL lines): the in-page Self-test and Benchmark tools are safe (dev progress preserved, cleanup on success / Stop / failure,
// production untouched, normal play afterwards).
// MOCKED ENGINE: uses three-stub.js instead of Three.js. FPS and renderer numbers produced here are NOT performance evidence;
// this suite only proves the tools' safety logic. Real numbers must come from the in-page tools on real devices.
// Run: serve the repository root on BASE (default http://localhost:8765), then: node dev/tests/stage1a.test.js
const {chromium}=require('playwright');const fs=require('fs');
const BASE=process.env.BASE||'http://localhost:8765',STUB=fs.readFileSync(__dirname+'/three-stub.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
// realistic dev progress and production saves, both seeded before any page loads
const DEVSEED={'bloodrushDEV-st':JSON.stringify({bank:4242,hearts:2,own:[0,15,16],tut:1,pk:1,v:3,runs:9}),'bloodrushDEV-best':'3131','bloodrushDEV-cfg':JSON.stringify({hq:true,sfx:true}),'bloodrushDEV-char':'15'};
const PROD={'bloodrush-st':JSON.stringify({bank:777,hearts:3,own:[0,15],tut:1,v:3}),'bloodrush-best':'12345','bloodrush-cfg':JSON.stringify({hq:true}),'bloodrush-char':'15'};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route(/three(\.min)?\.js/,r=>r.fulfill({contentType:'application/javascript',body:STUB}));await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
await ctx.addInitScript(()=>{const g=Storage.prototype.getItem,k=Storage.prototype.key;const sI=Storage.prototype.setItem,rI=Storage.prototype.removeItem;window.__wr=[];Storage.prototype.setItem=function(a,v){__wr.push('set '+a);return sI.call(this,a,v)};Storage.prototype.removeItem=function(a){__wr.push('remove '+a);return rI.call(this,a)};window.__raw=()=>{const o={};for(let i=0;i<localStorage.length;i++){const n=k.call(localStorage,i);o[n]=g.call(localStorage,n)}return o}});
const seed=await ctx.newPage();await seed.goto(BASE+'/manifest.webmanifest');await seed.evaluate(s=>{localStorage.clear();for(const k in s)localStorage.setItem(k,s[k])},Object.assign({},DEVSEED,PROD));await seed.close();
const pg=await ctx.newPage();const pageErrs=[];pg.on('pageerror',e=>pageErrs.push(e.message));
const open=async()=>{await pg.goto(BASE+'/dev/?debug=1');await pg.waitForFunction(()=>typeof state!=='undefined'&&state==='menu'&&!document.getElementById('splash'),null,{timeout:20000})};
const raw=()=>pg.evaluate(()=>__raw());
const sameAs=(o,seed)=>Object.keys(seed).every(k=>o[k]===seed[k]);
const outText=()=>pg.evaluate(()=>document.getElementById('brdev-s1-out').textContent);
const waitOut=(re,ms)=>pg.waitForFunction(r=>new RegExp(r).test(document.getElementById('brdev-s1-out').textContent),re.source,{timeout:ms});
await open();
ok(sameAs(await raw(),DEVSEED),'dev progress seeded and loaded unchanged at startup');
ok(await pg.evaluate(()=>ST.bank)===4242,'dev copy loads the dev save (bank 4242), not production (777)');
ok(await pg.evaluate(()=>['self','menu','run','stop'].every(s=>!!document.querySelector('#brdev-s1 [data-s="'+s+'"]'))),'overlay has Self-test, menu benchmark, run benchmark and Stop controls');
ok(await pg.evaluate(()=>document.querySelector('#brdev-s1 [data-s="stop"]').hidden),'Stop button hidden while idle');
// 1) refuses to start outside the main menu, changes nothing
await pg.evaluate(()=>{document.getElementById('go').click()});await pg.waitForFunction(()=>state==='play',null,{timeout:4000});
await pg.click('#brdev-s1 [data-s="self"]');await pg.waitForTimeout(200);
ok(/not started: open the main menu/.test(await outText())&&!(await pg.evaluate(()=>document.getElementById('brdev-badge').classList.contains('paused'))),'self-test refuses to start during a run and freezes nothing');
await pg.evaluate(()=>toMenu());await pg.waitForTimeout(600);
// 2) menu benchmark: no freeze, no reload, real frame sampling, renderer rows marked unavailable under the stand-in
const w0=await pg.evaluate(()=>__wr.length);await pg.click('#brdev-s1 [data-s="menu"]');await waitOut(/MEASURED frame timing/,15000);const wMenu=await pg.evaluate(n=>__wr.slice(n),w0);
const mb=await outText();
ok(/average FPS \d/.test(mb)&&/unavailable on this device\/engine/.test(mb),'menu benchmark: frame timing measured; renderer metrics reported as unavailable (stand-in has no real renderer)');
ok(/NOT valid: measured without the real Three\.js engine/.test(mb),'menu benchmark report flags that the engine is not real Three.js');
ok(!(await pg.evaluate(()=>document.getElementById('brdev-badge').classList.contains('paused'))),'menu benchmark does not freeze saving');
ok(wMenu.length===0,'menu benchmark wrote nothing to storage'+(wMenu.length?': '+wMenu.join('; '):''));
// baseline = dev storage immediately before the self-test starts
const base1=await raw();
// 3) self-test full run -> automatic reload -> post-reload checks
const nav1=pg.waitForNavigation({timeout:60000});await pg.click('#brdev-s1 [data-s="self"]');
await pg.waitForTimeout(400);ok(await pg.evaluate(()=>document.getElementById('brdev-badge').classList.contains('paused')),'self-test freezes saving while it runs (label turns orange)');
await nav1;await pg.waitForFunction(()=>/After reload:[\s\S]*Saving: active again/.test((document.getElementById('brdev-s1-out')||{}).textContent||''),null,{timeout:40000});
const st=await outText();console.log('--- self-test report (mocked engine) ---\n'+st.split('\n').filter(l=>/^(PASS|FAIL|SKIPPED|INFO)|passed,|Engine:/.test(l)).join('\n')+'\n---');
const fails=(st.match(/^FAIL .*$/mg)||[]);
ok(fails.length===0&&/^PASS  HUD shows the distance/m.test(st),'self-test: no FAIL lines; HUD distance check passes after the HUD repair ('+fails.length+' FAIL lines)');
ok(/^PASS  pause: distance frozen/m.test(st)&&/^PASS  resume/m.test(st)&&/^PASS  run advances/m.test(st),'self-test: run, pause and resume checks pass independently of the HUD bug');
ok((st.match(/^PASS /mg)||[]).length>=21,'self-test reported at least 21 PASS lines (19 gameplay/save checks + storage + after-reload startup)');
ok(/PASS  normal startup: main menu reached/.test(st),'after reload: normal startup confirmed');
{const now=await raw(),d=[...new Set(Object.keys(base1).concat(Object.keys(now)))].filter(k=>base1[k]!==now[k]);if(d.length)console.log('   differing keys vs baseline:',d.map(k=>k+' '+String(base1[k]).slice(0,80)+' -> '+String(now[k]).slice(0,80)).join(' || '));
ok(d.length===0,'dev progress identical to before the self-test (byte-for-byte)')}
ok(sameAs(await raw(),PROD),'production keys untouched by the self-test');
// 4) normal gameplay after the self-test: run starts and saving works again
await pg.evaluate(()=>{const s=[...document.querySelectorAll('#pn button')].find(b=>b.textContent.trim()==='Skip');if(s)s.click()});
await pg.evaluate(()=>document.getElementById('go').click());ok(await pg.waitForFunction(()=>state==='play',null,{timeout:4000}).then(()=>true,()=>false),'normal run starts after the self-test');
ok(await pg.evaluate(()=>{localStorage.setItem('bloodrushDEV-zz','1');const v=localStorage.getItem('bloodrushDEV-zz');localStorage.removeItem('bloodrushDEV-zz');return v==='1'}),'saving works normally again after the reload');
ok(await pg.evaluate(()=>typeof hit==='function'&&/inv>0/.test(String(hit))),'collision function is the original game function after the self-test');
await pg.evaluate(()=>toMenu());await pg.waitForTimeout(600);const base2=await raw();
// 5) gameplay benchmark, stopped by the user after ~3 s -> cleanup + reload
const nav2=pg.waitForNavigation({timeout:60000});await pg.click('#brdev-s1 [data-s="run"]');await pg.waitForTimeout(3000);
ok(await pg.evaluate(()=>!document.querySelector('#brdev-s1 [data-s="stop"]').hidden&&state==='play'),'run benchmark running, Stop visible');
await pg.click('#brdev-s1 [data-s="stop"]');await nav2;await pg.waitForFunction(()=>/After reload:[\s\S]*Saving: active again/.test((document.getElementById('brdev-s1-out')||{}).textContent||''),null,{timeout:40000});
const rb=await outText();ok(/INCOMPLETE: stopped by user/.test(rb)&&/PASS  dev progress untouched/.test(rb),'stopped benchmark: reported as incomplete, dev progress untouched');
ok(sameAs(await raw(),base2)&&sameAs(await raw(),PROD),'after stopped benchmark: dev and production storage unchanged');
ok(await pg.evaluate(()=>/inv>0/.test(String(hit))),'after stopped benchmark: original collision function in place');
// 5b) full 30 s gameplay benchmark -> completes, reports, cleans up, reloads; then normal play works
await pg.waitForFunction(()=>state==='menu',null,{timeout:10000});const base4=await raw();
const nav4=pg.waitForNavigation({timeout:90000});await pg.click('#brdev-s1 [data-s="run"]');await nav4;
await pg.waitForFunction(()=>/After reload:[\s\S]*Saving: active again/.test((document.getElementById('brdev-s1-out')||{}).textContent||''),null,{timeout:40000});
const fb=await outText();console.log('--- full run benchmark report (mocked engine: numbers are NOT evidence) ---\n'+fb.split('\n').slice(0,16).join('\n')+'\n---');
ok(!/INCOMPLETE/.test(fb)&&/over (29|30)\.\d s/.test(fb),'full gameplay benchmark ran the whole 30 s');
ok(/Would-be collisions during the run: \d+/.test(fb)&&/PASS  dev progress untouched/.test(fb),'full benchmark: collisions counted, dev progress untouched');
ok(/draw calls: unavailable/.test(fb)&&/NOT valid/.test(fb),'full benchmark: stand-in renderer numbers reported as unavailable / not valid');
ok(sameAs(await raw(),base4)&&sameAs(await raw(),PROD),'after full benchmark: dev and production storage unchanged');
await pg.evaluate(()=>document.getElementById('go').click());ok(await pg.waitForFunction(()=>state==='play',null,{timeout:4000}).then(()=>true,()=>false)&&await pg.evaluate(()=>/inv>0/.test(String(hit))),'after full benchmark: normal run starts with the original collision function');
await pg.evaluate(()=>toMenu());await pg.waitForTimeout(500);
// 6) failure path: break a step on purpose; failure must be reported (not swallowed) and cleanup must still happen
await open();const base3=await raw();
await pg.evaluate(()=>{const b=document.getElementById('brs');b.id='brs-hidden-by-test'});// Resume button can no longer be found
const nav3=pg.waitForNavigation({timeout:60000});await pg.click('#brdev-s1 [data-s="self"]');await nav3;
await pg.waitForFunction(()=>/After reload:/.test((document.getElementById('brdev-s1-out')||{}).textContent||''),null,{timeout:40000});
const fr=await outText();console.log('--- forced-failure report lines ---\n'+fr.split('\n').filter(l=>/^(FAIL|SKIPPED)/.test(l)).join('\n')+'\n---');
ok(/^FAIL  resume .*error:/m.test(fr),'forced failure is reported as FAIL with the error message');
ok(/^SKIPPED/m.test(fr)||/^FAIL/m.test(fr),'dependent checks reported (FAIL/SKIPPED) instead of silently passing');
ok(sameAs(await raw(),base3)&&sameAs(await raw(),PROD),'after a failing self-test: dev and production storage unchanged');
ok(await pg.evaluate(()=>/inv>0/.test(String(hit))),'after a failing self-test: original collision function in place');
// 7) production page has none of this
const pp=await ctx.newPage();await pp.goto(BASE+'/');await pp.waitForTimeout(2500);
ok(await pp.evaluate(()=>!document.getElementById('brdev-s1')&&typeof BR_DEV==='undefined'&&ST.bank===777),'production page: no Stage 1a tools, still loads its own save');
const unexpected=pageErrs.filter(e=>!/stage0 test/.test(e));ok(unexpected.length===0,'no unexpected page errors '+JSON.stringify(unexpected.slice(0,3)));
console.log(`\n${pass} passed, ${fail} failed (mocked engine)`);await b.close();process.exit(fail?1:0)})();
