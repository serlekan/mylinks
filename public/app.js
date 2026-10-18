"use strict";
(function(){
  const $=id=>document.getElementById(id);
  function secureUrl(value){try{const u=new URL(value);return (u.protocol==="https:"||u.protocol==="http:")&&!u.username&&!u.password?u.href:null}catch{return null}}
  function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n}
  async function start(){
    $("year").textContent=String(new Date().getFullYear());
    try{
      const resp=await fetch("./data.json",{cache:"no-store"});if(!resp.ok)throw Error("HTTP "+resp.status);
      const data=await resp.json();const p=data.profile||{};
      const name=(typeof p.name==="string"&&p.name.trim())?p.name.trim():"MyLinks";
      document.title=name+" — Links";$("name").textContent=name+".";$("brand").textContent=name+" / Link Hub";$("footer-name").textContent=name;
      $("eyebrow").textContent=p.eyebrow||"";$("status").textContent=p.status||"";$("intro").textContent=p.intro||"";$("footer-note").textContent=p.footer||"";
      const nav=$("links");nav.replaceChildren();let count=0;
      for(const item of Array.isArray(data.links)?data.links:[]){
        if(!item||item.enabled===false||!item.title||!secureUrl(item.url))continue;
        count++;const a=el("a","card");a.href=secureUrl(item.url);a.target="_blank";a.rel="noopener noreferrer";
        a.append(el("span","num",String(count).padStart(2,"0")));
        const copy=el("div");copy.append(el("h2","",item.title),el("p","",item.description||""));a.append(copy,el("span","arrow","↗"));nav.append(a);
      }
      if(!count){$("notice").textContent="No links are published yet.";$("notice").hidden=false;}
    }catch(e){$("notice").textContent="Could not load links. Serve this folder over HTTP and check data.json."; $("notice").hidden=false;console.error("MyLinks load failed",e)}
    $("links").setAttribute("aria-busy","false");
  }
  start();
})();
