// EXPLORATORY gameplay checks (19). Status: exploratory until confirmed against the real Three.js game on real devices.
// MOCKED ENGINE: uses three-stub.js instead of Three.js. Nothing is rendered, and obstacles do not collide realistically,
// so the runner is kept invincible during the movement checks. These results are NOT evidence of real-device behaviour or performance.
// Run: serve the repository root on BASE (default http://localhost:8765), then: node dev/tests/exploratory-controls.test.js [runs]
const {chromium}=require('playwright');const fs=require('fs');
const BASE=process.env.BASE||'http://localhost:8765',STUB=fs.readFileSync(__dirname+'/three-stub.js','utf8'),N=+process.argv[2]||3;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const tally={};
for(let r=0;r<N;r++){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.route(/three(\.min)?\.js/,q=>q.fulfill({contentType:'application/javascript',body:STUB}));await ctx.route(/fonts\.(googleapis|gstatic)/,q=>q.abort());
 const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(BASE+'/dev/');await pg.waitForTimeout(2500);
 await pg.click('#pn button:text-is("Skip")',{timeout:4000}).catch(()=>{});await pg.waitForTimeout(300);
 const res={};const ok=(k,c)=>{res[k]=!!c};
 ok('startup: menu reached',await pg.evaluate(()=>state==='menu'&&!document.getElementById('splash')));
 ok('main menu: Rise visible',await pg.evaluate(()=>{const g=document.getElementById('go').getBoundingClientRect();return g.width>0&&g.height>0}));
 // keep the runner alive during the probe so collisions under the stand-in don't end the run
 await pg.click('#go',{force:true});await pg.waitForTimeout(600);
 ok('start run: state play',await pg.evaluate(()=>state==='play'));
 await pg.evaluate(()=>{window.__keep=setInterval(()=>{try{inv=5;strikes=0}catch(e){}},50)});
 const d0=await pg.evaluate(()=>dist);await pg.waitForTimeout(800);ok('run advances: distance increases',await pg.evaluate(d=>dist>d,d0));
 // lane change by keyboard (same handler as swipes call)
 const l0=await pg.evaluate(()=>ln);await pg.keyboard.press('ArrowLeft');await pg.waitForTimeout(400);
 const l1=await pg.evaluate(()=>[ln,p.x,LN[ln]]);ok('lane change left: ln decreases and x moves toward lane',l1[0]===Math.max(0,l0-1)&&Math.abs(l1[1]-l1[2])<0.6);
 await pg.keyboard.press('ArrowRight');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(500);ok('lane change right x2: ends in lane 2',await pg.evaluate(()=>ln===2));
 // jump: y rises then lands
 await pg.keyboard.press('ArrowUp');await pg.waitForTimeout(150);const jy=await pg.evaluate(()=>p.y);await pg.waitForTimeout(1500);const ly=await pg.evaluate(()=>p.y);
 ok('jump: player rises',jy>0.3);ok('jump: player lands again',ly<0.02);
 // slide
 await pg.keyboard.press('ArrowDown');await pg.waitForTimeout(80);ok('slide: slide timer active',await pg.evaluate(()=>sl>0));
 await pg.waitForTimeout(1000);ok('slide: ends by itself',await pg.evaluate(()=>sl<=0));
 // swipe (pointer events on the canvas)
 const s0=await pg.evaluate(()=>ln);await pg.mouse.move(200,500);await pg.mouse.down();await pg.mouse.move(110,505,{steps:4});await pg.mouse.up();await pg.waitForTimeout(300);
 ok('swipe left: lane changes',await pg.evaluate(s=>ln===Math.max(0,s-1),s0));
 // pause / resume
 await pg.keyboard.press('Escape');await pg.waitForTimeout(200);const dp=await pg.evaluate(()=>dist);await pg.waitForTimeout(500);
 ok('pause: state paused + menu shown',await pg.evaluate(()=>state==='paused'&&!document.getElementById('pm').classList.contains('h')));
 ok('pause: distance frozen',await pg.evaluate(d=>dist===d,dp));
 await pg.evaluate(()=>document.getElementById('brs').click());await pg.waitForTimeout(400);ok('resume: state play again',await pg.evaluate(()=>state==='play'));
 // death -> results -> run again (restart)
 await pg.evaluate(()=>{clearInterval(window.__keep);try{die()}catch(e){window.__dieErr=e.message}});await pg.waitForTimeout(2500);
 ok('death: state dead',await pg.evaluate(()=>state==='dead'||!!document.querySelector('#rra')&&document.querySelector('#rra').offsetParent!==null));
 const again=await pg.evaluate(()=>{const b=document.getElementById('rra');return !!b&&b.offsetParent!==null});ok('results: Run again button shown',again);
 if(again){await pg.click('#rra',{force:true});await pg.waitForTimeout(800);ok('restart: new run in play with distance reset',await pg.evaluate(()=>state==='play'&&dist<50))}
 ok('dev save keys only',await pg.evaluate(()=>BR_DEV.rewrites===0));
 ok('no page errors',errs.length===0);
 for(const k in res){tally[k]=tally[k]||[0,0];tally[k][res[k]?0:1]++}
 if(r===0&&errs.length)console.log('errors:',errs.slice(0,3));
 await ctx.close()}
let bad=0;for(const k in tally){if(tally[k][1])bad++;console.log((tally[k][1]?'FLAKY/FAIL ':'PASS       ')+tally[k][0]+'/'+N+'  '+k)}
console.log('\n'+(Object.keys(tally).length-bad)+' of '+Object.keys(tally).length+' exploratory checks passed in every run (mocked engine)');
await b.close();process.exit(bad?1:0)})();
