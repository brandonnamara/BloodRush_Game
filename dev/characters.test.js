// Stage B character checks: faces/expressions follow game state, blended animation, gameplay untouched, portraits.
// MOCKED ENGINE: three-stub.js instead of Three.js. Proves logic and state wiring only, not how the characters look on a real GPU.
// Run: serve repo root on BASE (default http://localhost:8765): node dev/tests/characters.test.js
const {chromium}=require('playwright');const fs=require('fs');
const BASE=process.env.BASE||'http://localhost:8765',STUB=fs.readFileSync(__dirname+'/three-stub.js','utf8');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
const PROD={'bloodrush-st':JSON.stringify({bank:777,hearts:3,own:[0,15],tut:1,v:3}),'bloodrush-best':'12345'};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route(/three(\.min)?\.js/,r=>r.fulfill({contentType:'application/javascript',body:STUB}));await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
await ctx.addInitScript(()=>{const g=Storage.prototype.getItem,k=Storage.prototype.key;window.__raw=()=>{const o={};for(let i=0;i<localStorage.length;i++){const n=k.call(localStorage,i);o[n]=g.call(localStorage,n)}return o}});
const seed=await ctx.newPage();await seed.goto(BASE+'/manifest.webmanifest');await seed.evaluate(s=>{localStorage.clear();for(const k in s)localStorage.setItem(k,s[k]);localStorage.setItem('bloodrushDEV-st',JSON.stringify({bank:500,hearts:0,own:[0,15,16],tut:1,pk:1,v:3}))},PROD);await seed.close();
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(BASE+'/dev/');await pg.waitForFunction(()=>typeof state!=='undefined'&&state==='menu'&&!document.getElementById('splash'),null,{timeout:20000});await pg.waitForTimeout(800);
const E=(f,a)=>pg.evaluate(f,a);const exNow=()=>E(()=>VXP.face.ex);
// build every character
ok((await E(()=>{const bad=[];for(let i=0;i<CH.length;i++){try{applyChar(i);if(!VXP.face)bad.push(i+':no face')}catch(e){bad.push(i+':'+e.message)}}applyChar(15);return bad})).length===0,'all 23 characters apply in the game with a face plate');
ok(await E(()=>{try{const g=new THREE.Group();buildVamp(g,CH[16]);return true}catch(e){return e.message}})===true,'dungeon chaser still builds');
// portrait faces include the pixel face (rgb() rects are only emitted for face pixels)
ok(await E(()=>/rgb\(/.test(decodeURIComponent(document.getElementById('abi').style.backgroundImage))),'ability-button portrait includes the pixel face');
// menu: idle face, blinks happen
const seen=new Set();for(let i=0;i<70;i++){seen.add(await exNow());await pg.waitForTimeout(100)}
ok(seen.has('idle'),'menu: idle expression');ok(seen.has('blink'),'menu: blinks within 7 s ('+[...seen].join(',')+')');
// run: focus face, run pose dominates
// stand-in obstacles sit at z=0 and would hit at once, so (as in the other suites) the runner is kept invincible;
// __str lets a check hold a werewolf strike on purpose. The stub has no real vectors, so the visual root and the player
// group get plain x/y/z holders here; that lets the checks read back what the game and the character code write each frame.
const HIT=await E(()=>String(hit));
await E(()=>{window.__str=0;window.__k=setInterval(()=>{try{inv=5;strikes=window.__str}catch(e){}},16)});
await pg.evaluate(()=>document.getElementById('go').click());await pg.waitForFunction(()=>state==='play',null,{timeout:4000});
await E(()=>{const V=()=>({x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;return this},setScalar(v){return this.set(v,v,v)}});VXP.root.position=V();VXP.root.scale=V().set(1,1,1);P.position=V()});
await pg.waitForTimeout(700);
const r1=await E(()=>({ex:VXP.face.ex,run:VXAN.w.run,idle:VXAN.w.idle}));ok(['focus','blink'].includes(r1.ex),'run: determined face ('+r1.ex+')');ok(r1.run>.9&&r1.idle<.1,'run: blended into the run pose (run weight '+r1.run.toFixed(2)+')');
// jump: air pose blends in, landing squash fires
await pg.keyboard.press('ArrowUp');await pg.waitForTimeout(250);const j=await E(()=>({air:VXAN.w.air,y:p.y}));ok(j.y>.3&&j.air>.5,'jump: air pose blends in (air weight '+j.air.toFixed(2)+')');
const sq=await pg.waitForFunction(()=>VXAN.sq>0,null,{timeout:2500,polling:16}).then(()=>true,()=>false);ok(sq,'landing: squash triggers on touchdown');
await pg.waitForTimeout(400);ok(await E(()=>Math.abs(VXP.root.scale.y-1)<.02),'landing squash recovers to normal scale');
// slide pose
await pg.keyboard.press('ArrowDown');await pg.waitForTimeout(200);ok(await E(()=>VXAN.w.slide>.6),'slide: slide pose blends in');
await pg.waitForTimeout(900);
// gameplay untouched: the visual root never moves the gameplay group; collision function unchanged
await pg.keyboard.press('ArrowLeft');await pg.waitForTimeout(120);{const g=await E(()=>({Px:P.position.x,px:p.x,rx:VXP.root.position.x,rz:VXP.root.position.z,ln}));
ok(Math.abs(g.Px-g.px)<1e-6&&g.rx===0&&g.rz===0,'mid lane change: player group follows the game position exactly; character visuals add no sideways/forward offset ('+JSON.stringify(g)+')')}
await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(300);
ok(/inv>0/.test(HIT)&&!/VXP|VXAN|vx[A-Z]/.test(HIT)&&HIT===await E(()=>String(hit)),'collision code unchanged and independent of the character visuals');
// expressions react to gameplay
await E(()=>{window.__str=1});await pg.waitForTimeout(150);{const x=await exNow();ok(x==='scared'||x==='blink','werewolf close (strike): scared face ('+x+')')}await E(()=>{window.__str=0});await pg.waitForTimeout(100);
await E(()=>grab(2));await pg.waitForTimeout(150);ok(['grin','blink'].includes(await exNow()),'power-up pickup: grin ('+await exNow()+')');
// aura is quieter
const lit=await E(()=>{let n=0;for(let i=0;i<VXA.N;i++)if(VXA.col[i*3]+VXA.col[i*3+1]+VXA.col[i*3+2]>0)n++;return n});ok(lit<=16,'run: at most 16 aura fragments ('+lit+')');
// death: KO face
await E(()=>{clearInterval(window.__k);die()});await pg.waitForTimeout(300);ok(await exNow()==='ko','death: knocked-out face');
// saves
const raw=await E(()=>__raw());ok(Object.keys(PROD).every(k=>raw[k]===PROD[k]),'production keys untouched');ok(await E(()=>BR_DEV.rewrites===0),'Stage 0 guard redirected no keys');
ok(errs.length===0,'no page errors '+JSON.stringify(errs.slice(0,3)));
console.log(`\n${pass} passed, ${fail} failed (mocked engine)`);await b.close();process.exit(fail?1:0)})();
