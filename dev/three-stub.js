// recursive permissive THREE stand-in: any class, any method, any property
(function(){
const mk=()=>{const f=function(){};return new Proxy(f,{
 construct(){return mk()},
 apply(){return mk()},
 get(t,k){if(k===Symbol.toPrimitive)return()=>0;if(k==='then')return undefined;if(k==='length')return 0;if(k==='isMesh'||k==='isMeshLambertMaterial')return false;
  if(k==='forEach'||k==='traverse')return()=>{};if(k in t)return t[k];return t[k]=mk()},
 set(t,k,v){t[k]=v;return true}})};
window.THREE=new Proxy({},{get(t,k){return t[k]||(t[k]=mk())}});
})();
