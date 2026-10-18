"use strict";
(function(){
  const $=id=>document.getElementById(id);
  let model=null,baseline=null,working=false;
  const show=(msg,bad=false)=>{const n=$("feedback");n.hidden=false;n.className="feedback"+(bad?" error":"");n.textContent=msg;};
  const fields=[["name","profile-name"],["eyebrow","profile-eyebrow"],["status","profile-status"],["intro","profile-intro"],["footer","profile-footer"]];
  const repoOk=s=>/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s||"");
  const validUrl=s=>{try{const u=new URL(s);return ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password}catch{return false}};
  const clone=o=>JSON.parse(JSON.stringify(o));
  const newId=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"link-"+Date.now()+"-"+Math.floor(Math.random()*100000);
  function validate(d){
    if(!d||!d.profile||!Array.isArray(d.links))throw Error("Expected a profile object and links array.");
    if(!String(d.profile.name||"").trim())throw Error("Profile name is required.");
    if(!repoOk(d.repository))throw Error("Repository must be in owner/name format.");
    const ids=new Set();
    d.links.forEach((l,i)=>{if(!l.id||ids.has(l.id))throw Error("Link "+(i+1)+" must have a unique ID.");ids.add(l.id);
      if(!String(l.title||"").trim())throw Error("Link "+(i+1)+" needs a title.");
      if(!validUrl(l.url))throw Error("Link "+(i+1)+" must have an http:// or https:// URL without embedded credentials.");
      if(typeof l.enabled!=="boolean")throw Error("Link "+(i+1)+" needs an enabled flag.");
    });
    return d;
  }
  function readForm(){
    const out=clone(model);
    fields.forEach(([key,id])=>out.profile[key]=$(id).value.trim());
    out.repository=$("repository").value.trim();out.links=[];
    document.querySelectorAll(".editor-card").forEach(card=>{
      const get=key=>card.querySelector('[data-field="'+key+'"]');
      out.links.push({id:card.dataset.id,title:get("title").value.trim(),description:get("description").value.trim(),url:get("url").value.trim(),enabled:get("enabled").checked});
    });
    return validate(out);
  }
  function move(index,dir){try{model=readForm();const other=index+dir;if(other<0||other>=model.links.length)return;
    [model.links[index],model.links[other]]=[model.links[other],model.links[index]];render();}catch(e){show(e.message,true)}}
  function input(tag,field,value){const n=document.createElement(tag);n.dataset.field=field;
    if(tag==="textarea"){n.value=value||"";n.rows=2;}else{n.type=field==="enabled"?"checkbox":field==="url"?"url":"text";if(field==="enabled")n.checked=value;else n.value=value||"";}
    return n;
  }
  function appendField(card,text,field,value){const lab=document.createElement("label");lab.className="field"+(field==="description"?" wide":"");lab.append(document.createTextNode(text),input(field==="description"?"textarea":"input",field,value));card.append(lab)}
  function renderLinks(){
    const holder=$("editor-links");holder.replaceChildren();
    model.links.forEach((link,index)=>{
      const card=document.createElement("div");card.className="editor-card";card.dataset.id=link.id;
      const head=document.createElement("div");head.className="editor-card-head";
      const title=document.createElement("strong");title.textContent="Link "+String(index+1).padStart(2,"0");
      const controls=document.createElement("div");controls.className="bar";
      for(const [label,dir] of [["↑",-1],["↓",1]]){const b=document.createElement("button");b.type="button";b.className="btn";b.textContent=label;b.disabled=(dir===-1&&index===0)||(dir===1&&index===model.links.length-1);b.setAttribute("aria-label",dir===-1?"Move link up":"Move link down");b.onclick=()=>move(index,dir);controls.append(b);}
      const del=document.createElement("button");del.type="button";del.className="btn danger";del.textContent="Remove";del.onclick=()=>{if(!confirm("Remove this link from the draft?"))return;try{model=readForm()}catch(e){show(e.message,true);return;}model.links.splice(index,1);render();};controls.append(del);
      head.append(title,controls);card.append(head);
      const fieldsNode=document.createElement("div");fieldsNode.className="form-grid";appendField(fieldsNode,"Title","title",link.title);appendField(fieldsNode,"URL","url",link.url);appendField(fieldsNode,"Description","description",link.description);
      const label=document.createElement("label");label.className="checkline";label.append(input("input","enabled",link.enabled),document.createTextNode("Visible to visitors"));fieldsNode.append(label);card.append(fieldsNode);holder.append(card);
    });
  }
  function render(){fields.forEach(([key,id])=>$(id).value=model.profile[key]||"");$("repository").value=model.repository||"";renderLinks();}
  function fileDownload(text,filename){const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function encodeBase64(s){const bytes=new TextEncoder().encode(s);let binary="";for(let i=0;i<bytes.length;i+=8192){binary+=String.fromCharCode(...bytes.subarray(i,i+8192))}return btoa(binary)}
  function decodeBase64(s){const bytes=Uint8Array.from(atob(s.replace(/\s/g,"")),c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}
  async function gh(url,token,init={}){
    const response=await fetch(url,{...init,headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28",...(init.headers||{})},credentials:"omit"});
    if(!response.ok){let text="GitHub HTTP "+response.status;try{const d=await response.json();text+=": "+(d.message||"Request rejected")}catch{}throw Error(text)}
    return response.json();
  }
  async function publish(){
    if(working)return;let data;try{data=readForm()}catch(e){show(e.message,true);return}
    const token=$("github-token").value.trim();if(!token){show("Enter a fine-grained GitHub token with Contents: Read and write for "+data.repository+".",true);return}
    working=true;$("publish").disabled=true;show("Checking GitHub for newer changes...");
    try{
      const [owner,repo]=data.repository.split("/");const path="public/data.json";
      const endpoint="https://api.github.com/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo)+"/contents/"+path;
      const current=await gh(endpoint,token);if(current.encoding!=="base64"||!current.sha)throw Error("GitHub did not return a file SHA.");
      const remote=JSON.parse(decodeBase64(current.content));
      if(JSON.stringify(remote)!==JSON.stringify(baseline))throw Error("GitHub data.json changed since this editor loaded. Download your changes, then reload and reapply them before publishing.");
      const body=JSON.stringify({message:"Update MyLinks profile and links",content:encodeBase64(JSON.stringify(data,null,2)+"\n"),sha:current.sha,branch:"main"});
      const result=await gh(endpoint,token,{method:"PUT",headers:{"Content-Type":"application/json"},body});
      baseline=clone(data);model=clone(data);
      localStorage.removeItem("mylinks-draft-"+data.repository);
      show("GitHub commit created: "+result.commit.sha.slice(0,12)+". Cloudflare deployment is pending; check the repository Actions tab. The live page is not updated until deployment succeeds.");
    }catch(e){show(e.message||"Publish failed",true)}finally{working=false;$("publish").disabled=false;$("github-token").value=""}
  }
  async function init(){
    try{const r=await fetch("./data.json",{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);model=validate(await r.json());baseline=clone(model);render()}
    catch(e){show("Could not read data.json: "+e.message+". Serve the public/ folder through HTTP.",true);document.querySelectorAll("button").forEach(b=>b.disabled=true);return}
    $("add-link").onclick=()=>{try{model=readForm();model.links.push({id:newId(),title:"New link",url:"https://example.com/",description:"",enabled:false});render();document.querySelector(".editor-card:last-child input")?.focus()}catch(e){show(e.message,true)}};
    $("save-draft").onclick=()=>{try{const d=readForm();localStorage.setItem("mylinks-draft-"+d.repository,JSON.stringify(d));show("Draft saved in this browser. It is not public.")}catch(e){show(e.message,true)}};
    $("restore-draft").onclick=()=>{try{const text=localStorage.getItem("mylinks-draft-"+$("repository").value.trim());if(!text)throw Error("No saved draft found for this repository.");model=validate(JSON.parse(text));render();show("Draft restored. Publish to GitHub when ready.")}catch(e){show(e.message,true)}};
    $("download-json").onclick=()=>{try{fileDownload(JSON.stringify(readForm(),null,2)+"\n","data.json");show("JSON downloaded. Commit it as public/data.json to publish manually.")}catch(e){show(e.message,true)}};
    $("import-json").onclick=()=>$("import-file").click();
    $("import-file").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{model=validate(JSON.parse(await file.text()));render();show("JSON imported into editor. Not yet published.")}catch(err){show(err.message,true)}e.target.value=""};
    $("publish").onclick=publish;
  }
  init();
})();
