// Main-menu layout checks across phone viewports (Rise placement, overlaps, thumb zone).
// Headless Chromium with three-stub.js: checks DOM layout boxes only. It cannot simulate iPhone safe-area insets
// (env() is 0 here) or Safari's collapsing toolbars, so real-device checks are still required.
// Run: serve repo root on BASE (default http://localhost:8765): node dev/tests/layout.test.js [path, default /dev/]
const {chromium}=require('playwright');const fs=require('fs');
const BASE=process.env.BASE||'http://localhost:8765',PATH=process.argv[2]||'/dev/',STUB=fs.readFileSync(__dirname+'/three-stub.js','utf8');
// width x height = visible web content area (portrait sizes include Safari's bars where noted)
const VP=[['iPhone SE, Safari',375,553],['iPhone SE, Home Screen',375,667],['iPhone 13/14, Safari',390,664],['iPhone 15 Pro, Safari',393,659],['iPhone 15 Pro, Home Screen',393,852],
 ['iPhone Pro Max, Safari',430,739],['small Android',360,640],['landscape iPhone SE',667,325],['landscape iPhone 14',844,340],['landscape Pro Max',932,380]];
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const [name,w,h] of VP){const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true});
 await ctx.route(/three(\.min)?\.js/,r=>r.fulfill({contentType:'application/javascript',body:STUB}));await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
 await ctx.addInitScript(()=>{try{localStorage.setItem('bloodrushDEV-st',JSON.stringify({bank:48210,hearts:7,own:[0,15],tut:1,pk:1,v:3}))}catch(e){}});
 const pg=await ctx.newPage();await pg.goto(BASE+PATH);await pg.waitForFunction(()=>typeof state!=='undefined'&&state==='menu'&&!document.getElementById('splash'),null,{timeout:20000});await pg.waitForTimeout(1500);
 const r=await pg.evaluate(()=>{const R=e=>{if(!e)return null;const b=e.getBoundingClientRect();if(!b.width||!b.height||getComputedStyle(e).visibility==='hidden')return null;return{l:b.left,t:b.top,r:b.right,b:b.bottom}};
  const side=[...document.querySelectorAll('#msd .msb')].filter(e=>getComputedStyle(document.getElementById('msd')).display!=='none').map(e=>({btn:R(e),lab:R(e.querySelector('small')),id:e.dataset.t}));
  return{go:R(document.getElementById('go')),info:R(document.getElementById('minfo')),tab:R(document.getElementById('mtab')),h1:R(document.querySelector('#ov h1')),sub:R(document.querySelector('#ov .sub')),bank:R(document.getElementById('bank')),side}});
 const X=(a,b)=>a&&b&&a.l<b.r-1&&b.l<a.r-1&&a.t<b.b-1&&b.t<a.b-1;const inVP=a=>a&&a.l>=-1&&a.t>=-1&&a.r<=w+1&&a.b<=h+1;
 const tag=`[${name} ${w}×${h}]`;
 ok(inVP(r.go),`${tag} Rise fully on screen`);
 const portrait=h>w;if(portrait){const cy=(r.go.t+r.go.b)/2;ok(cy>=h*.6,`${tag} Rise in lower thumb zone (centre at ${(cy/h*100).toFixed(0)}% of height, want ≥60%)`)}
 const hitSide=r.side.filter(s=>X(r.go,s.btn)||X(r.go,s.lab)||X(r.info,s.btn)||X(r.info,s.lab)).map(s=>s.id);ok(hitSide.length===0,`${tag} Rise/best-score line clear of side buttons${hitSide.length?' (overlaps '+hitSide.join(',')+')':''}`);
 ok(!X(r.go,r.tab)&&!X(r.info,r.tab),`${tag} Rise clear of the tab bar`);
 const hitTitle=r.side.filter(s=>X(s.btn,r.sub)||X(s.btn,r.h1)).map(s=>s.id);ok(hitTitle.length===0,`${tag} side buttons clear of title/subtitle${hitTitle.length?' (overlaps '+hitTitle.join(',')+')':''}`);
 ok(r.side.every(s=>inVP(s.btn)&&inVP(s.lab)),`${tag} all side buttons and labels on screen`);
 const pairs=[];for(let i=0;i<r.side.length;i++)for(let j=i+1;j<r.side.length;j++)if(X(r.side[i].btn,r.side[j].btn)||X(r.side[i].lab,r.side[j].btn)||X(r.side[i].btn,r.side[j].lab))pairs.push(r.side[i].id+'/'+r.side[j].id);ok(pairs.length===0,`${tag} side buttons do not overlap each other${pairs.length?' ('+pairs.join(',')+')':''}`);
 // touch: tapping Rise starts a run
 await pg.tap('#go',{force:true});const st=await pg.waitForFunction(()=>state==='play',null,{timeout:4000}).then(()=>true,()=>false);ok(st,`${tag} tapping Rise starts a run`);
 await ctx.close()}
console.log(`\n${pass} passed, ${fail} failed (layout boxes in headless Chromium; no safe-area insets)`);await b.close();process.exit(fail?1:0)})();
