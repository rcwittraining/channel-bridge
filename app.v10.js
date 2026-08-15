/* RCW Channel Bridge — app logic (client-side; AI + YouTube via official APIs) */
(function(){
"use strict";
const $=id=>document.getElementById(id);
let state={
  tab:'create', slides:[], recording:false, mediaRec:null, chunks:[], autoTimer:null,
  blob:null, videoUrl:null, aiKey:'', slideIdx:0
};
const SAVE_KEY='rcw-bridge-state';
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify({slides:state.slides,aiKey:state.aiKey})); }catch(e){} }
function load(){ try{ const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'); if(d.slides)state.slides=d.slides; if(d.aiKey)state.aiKey=d.aiKey; }catch(e){} }

/* ---------- tabs ---------- */
function showTab(t){
  state.tab=t;
  document.querySelectorAll('.tab,.bn').forEach(el=>el.classList.toggle('on',el.dataset.t===t));
  ['create','record','publish','bridge'].forEach(p=>{ const el=$('page-'+p); if(el)el.style.display=(p===t)?'block':'none'; });
  if(t==='publish') fillPublish();
  if(t==='record') renderTele();
}
document.querySelectorAll('.tab,.bn').forEach(el=>el.addEventListener('click',()=>showTab(el.dataset.t)));

/* ---------- AI script generation (Gemini) ---------- */
$('btnGen').addEventListener('click', async ()=>{
  const key=$('geminiKey').value.trim(), prompt=$('prompt').value.trim();
  if(!key){ alert('Add your free Gemini API key (aistudio.google.com) — stored only on this phone.'); return; }
  if(!prompt){ alert('Describe the lab topic first (e.g. "RHCSA: reset root password on RHEL 10").'); return; }
  state.aiKey=key; save();
  $('btnGen').disabled=true; $('btnGen').textContent='Generating script…';
  try{
    const sys='You create step-by-step LAB EXERCISE video scripts for IT training (Linux/RHCSA, AWS, Azure, VMware). Reply ONLY with JSON: {"title":"...","description":"... (2-3 sentences + link www.rcwittraining.in)","tags":["..."],"slides":[{"heading":"...","body":"2-4 short lines with commands/steps"}]}. 4-8 slides. Commands on their own lines. No markdown.';
    // Ask Google which models this key can use, then pick the best available.
    // (Model names change/get retired — never hardcode them.)
    $('btnGen').textContent='Contacting Gemini…';
    const model=await pickModel(key);
    $('btnGen').textContent='Generating with '+model+'…';
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+encodeURIComponent(key),{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:sys+'\n\nTopic: '+prompt}]}]})
    });
    if(!r.ok){ let msg='AI request failed ('+r.status+')'; try{ const ej=await r.json(); msg+=' — '+(ej.error&&(ej.error.message||ej.error.status)||''); }catch(_){} throw new Error(msg); }
    if(!r.ok){ let msg='AI request failed ('+r.status+')'; try{ const ej=await r.json(); msg+=' — '+(ej.error&&(ej.error.message||ej.error.status)||''); }catch(_){} throw new Error(msg); }
    const j=await r.json();
    const txt=j.candidates[0].content.parts[0].text;
    const data=JSON.parse(txt.replace(/```json|```/g,'').trim());
    const raw=data.slides||data.slides_list||[];
    state.slides=raw.map(s=>({h:(s.heading||s.h||s.title||'Step'),b:(s.body||s.b||s.content||s.text||'')}));
    if(!state.slides.length) state.slides=[{h:'Lab Exercise',b:prompt}];
    $('vTitle').value=data.title||prompt;
    $('vDesc').value=(data.description||'Hands-on lab exercise from RCW IT Training.\n\nPractice free: www.rcwittraining.in')+'\n\n#RHCSA #Linux #AWS #Azure #ITTraining';
    $('vTags').value=(data.tags||[]).join(', ');
    $('scriptCard').style.display='block';
    renderSlides();
    showTab('record');
  }catch(e){ alert('AI generation failed: '+e.message); }
  $('btnGen').disabled=false; $('btnGen').textContent='✨ Generate script with AI';
});
// Discover the best available model for this API key (no hardcoded names)
async function pickModel(key){
  // Current lineup (Aug 2026): Gemini 3.x is the latest; older models get retired.
  const prefs=['gemini-3.5-flash','gemini-3.1-flash-lite','gemini-3-flash-preview','gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.5-pro','gemini-2.0-flash','gemini-2.0-flash-lite','gemini-flash-latest','gemini-1.5-flash-latest','gemini-1.5-flash'];
  try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?key='+encodeURIComponent(key));
    if(r.ok){
      const j=await r.json();
      const avail=(j.models||[])
        .filter(m=>m.supportedGenerationMethods&&m.supportedGenerationMethods.indexOf('generateContent')>-1)
        .map(m=>m.name.replace('models/',''));
      for(const p of prefs){ if(avail.indexOf(p)>-1) return p; }
      const anyFlash=avail.find(m=>/flash/i.test(m));
      if(anyFlash) return anyFlash;
      if(avail.length) return avail[0];
    }
  }catch(_){}
  return 'gemini-3.5-flash'; // last-resort default
}

$('btnManual').addEventListener('click', ()=>{ $('scriptCard').style.display='block'; if(!state.slides.length) state.slides=[{h:'Lab Exercise',b:'Step 1: …\nStep 2: …'}]; renderSlides(); });

function renderSlides(){
  const box=$('slides'); box.innerHTML='';
  state.slides.forEach((s,i)=>{
    const d=document.createElement('div'); d.className='slide-card';
    d.innerHTML='<button class="x" data-i="'+i+'">✕</button><div class="h">Slide '+(i+1)+'</div>'+
      '<label>Heading</label><input type="text" class="sh" data-i="'+i+'" value="'+s.h.replace(/"/g,'&quot;')+'">'+
      '<label>Content (steps / commands)</label><textarea class="sb" data-i="'+i+'" rows="4">'+s.b.replace(/</g,'&lt;')+'</textarea>';
    box.appendChild(d);
  });
  box.querySelectorAll('.sh').forEach(el=>el.addEventListener('input',e=>{state.slides[+e.target.dataset.i].h=e.target.value;save();}));
  box.querySelectorAll('.sb').forEach(el=>el.addEventListener('input',e=>{state.slides[+e.target.dataset.i].b=e.target.value;save();}));
  box.querySelectorAll('.x').forEach(el=>el.addEventListener('click',e=>{state.slides.splice(+e.target.dataset.i,1);renderSlides();save();}));
}
$('btnAddSlide').addEventListener('click', ()=>{ state.slides.push({h:'New Slide',b:'Step: …'}); renderSlides(); save(); });
$('btnToRecord').addEventListener('click', ()=>{ save(); showTab('record'); });

/* ---------- CLOUD RENDER + YOUTUBE UPLOAD (creds in GitHub secrets) ---------- */
$('btnCloudRender').addEventListener('click', async ()=>{
  const title=$('vTitle').value.trim()||'RCW Lab Exercise';
  if(!state.slides.length){ alert('No slides to render.'); return; }
  let pat=localStorage.getItem('rcw-bridge-pat')||'';
  if(!pat){
    pat=prompt('GitHub PAT (Actions read/write on channel-bridge-renderer):');
    if(!pat) return;
    localStorage.setItem('rcw-bridge-pat', pat);
  }
  const script={title:title, description:$('vDesc').value, tags:($('vTags').value||'').split(',').map(s=>s.trim()).filter(Boolean), slides:state.slides.map(s=>({heading:s.h, body:s.b, narration:s.b}))};
  const b64=btoa(unescape(encodeURIComponent(JSON.stringify(script))));
  const privacy=$('pPrivacy')?$('pPrivacy').value:'private';
  const playlist=$('pPlaylist').value.trim();
  $('cloudStatus').textContent='Rendering video with audio + uploading to YouTube…';
  try{
    const r=await fetch('https://api.github.com/repos/rcwittraining/channel-bridge-renderer/actions/workflows/render.yml/dispatches',{
      method:'POST',
      headers:{'Authorization':'Bearer '+pat,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
      body:JSON.stringify({ref:'main',inputs:{script:b64, privacy:privacy, playlist:playlist}})
    });
    if(!r.ok){ if(r.status===401||r.status===403){ localStorage.removeItem('rcw-bridge-pat'); $('cloudStatus').textContent='❌ PAT rejected — cleared. Tap Render again and paste a valid PAT.'; return; } throw new Error('Dispatch failed ('+r.status+')'); }
    $('cloudStatus').innerHTML='✅ Rendering with natural voice + uploading… (2-4 min)';
    let tries=0;
    const poll=setInterval(async ()=>{
      tries++;
      try{
        const runs=await (await fetch('https://api.github.com/repos/rcwittraining/channel-bridge-renderer/actions/runs?event=workflow_dispatch&per_page=1',{headers:{'Authorization':'Bearer '+pat,'Accept':'application/vnd.github+json'}})).json();
        const run=runs.workflow_runs&&runs.workflow_runs[0];
        if(!run) return;
        if(run.status==='completed'){
          clearInterval(poll);
          if(run.conclusion==='success'){
            try{
              const logs=await (await fetch('https://api.github.com/repos/rcwittraining/channel-bridge-renderer/actions/runs/'+run.id+'/logs',{headers:{'Authorization':'Bearer '+pat}})).text();
              const m=logs.match(/https:\/\/youtu\.be\/[A-Za-z0-9_-]+/);
              if(m) $('cloudStatus').innerHTML='🎉 <b>Video published to YouTube!</b><br><a href="'+m[0]+'" target="_blank" rel="noopener">'+m[0]+'</a><br><span class="small">Cleanup done: no artifacts kept.</span>';
              else $('cloudStatus').innerHTML='✅ Render finished. <a href="https://github.com/rcwittraining/channel-bridge-renderer/actions" target="_blank" rel="noopener">View run</a>';
            }catch(e){ $('cloudStatus').innerHTML='✅ Render finished. <a href="https://github.com/rcwittraining/channel-bridge-renderer/actions" target="_blank" rel="noopener">View run</a>'; }
          }else{
            $('cloudStatus').innerHTML='❌ Render/upload failed. <a href="https://github.com/rcwittraining/channel-bridge-renderer/actions" target="_blank" rel="noopener">Check logs</a>';
          }
        }else if(tries>60){ clearInterval(poll); $('cloudStatus').textContent='Still running… check Actions page.'; }
      }catch(e){ if(tries>60){clearInterval(poll);} }
    },10000);
  }catch(e){ $('cloudStatus').textContent='❌ '+e.message; }
});

$('btnThumbFromSlide').addEventListener('click', ()=>{ drawSlide(0); window.__thumbDataUrl=$('recCanvas').toDataURL('image/jpeg',0.9); alert('Thumbnail set from slide 1.'); });
$('btnThumbFile').addEventListener('click', ()=>$('thumbFile').click());
$('thumbFile').addEventListener('change', e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=()=>{window.__thumbDataUrl=r.result; alert('Thumbnail chosen.');}; r.readAsDataURL(f);} });

$('btnConnect').addEventListener('click', ()=>{
  alert('1) Create OAuth Client ID in Google Cloud (Web application) with your site URL as Authorized JS origin.\n2) Paste the Client ID in the field, tap Connect — Google shows the official consent screen (scoped to your YouTube channel).\nThe access token is kept in this phone only.');
});
$('btnUpload').addEventListener('click', async ()=>{
  if(!state.blob){ alert('No recorded video yet.'); return; }
  const token=state.token;
  if(!token){ alert('Connect YouTube first.'); return; }
  $('btnUpload').disabled=true; $('upStatus').textContent='Uploading…';
  try{
    const meta={snippet:{title:$('pTitle').value,description:$('pDesc').value,tags:$('pTags').value.split(',').map(s=>s.trim()).filter(Boolean)},status:{privacyStatus:$('pPrivacy').value}};
    const form=new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)],{type:'application/json; charset=UTF-8'}));
    form.append('file', state.blob, 'lab-video.webm');
    const r=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',{
      method:'POST', headers:{'Authorization':'Bearer '+token}, body:form
    });
    if(!r.ok) throw new Error('Upload failed: '+r.status);
    const j=await r.json();
    $('upBar').style.width='100%';
    $('upStatus').textContent='✅ Published: https://youtu.be/'+j.id;
    alert('Video published: https://youtu.be/'+j.id);
  }catch(e){ $('upStatus').textContent='❌ '+e.message; }
  $('btnUpload').disabled=false;
});

/* ---------- BRIDGE to RCW assistant ---------- */
$('btnTestBridge').addEventListener('click', async ()=>{
  const rt=$('bridgeRefresh').value.trim(), cid=$('bridgeClientId').value.trim(), cs=$('bridgeSecret').value.trim();
  if(!rt||!cid||!cs){ alert('Fill refresh token + Client ID + Client secret (from your OAuth client).'); return; }
  $('bridgeStatus').textContent='Testing connection to your channel…';
  try{
    const r=await fetch('https://oauth2.googleapis.com/token',{
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:'client_id='+encodeURIComponent(cid)+'&client_secret='+encodeURIComponent(cs)+'&refresh_token='+encodeURIComponent(rt)+'&grant_type=refresh_token'
    });
    const j=await r.json();
    if(!r.ok) throw new Error(j.error_description||j.error);
    const me=await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{'Authorization':'Bearer '+j.access_token}});
    const ch=await me.json();
    $('bridgeStatus').innerHTML='✅ Connected to channel: <b>'+(ch.items[0].snippet.title||'?')+'</b>. Copy the 3 values below into the RCW assistant chat — then I can generate &amp; upload videos for you from this account.';
    window.__bridge={rt:rt,cid:cid,cs:cs};
  }catch(e){ $('bridgeStatus').textContent='❌ '+e.message; }
});
$('btnCopyBridge').addEventListener('click', ()=>{
  if(!window.__bridge){ alert('Test the connection first.'); return; }
  const s='BRIDGE_CREDENTIALS\nrefresh_token='+window.__bridge.rt+'\nclient_id='+window.__bridge.cid+'\nclient_secret='+window.__bridge.cs;
  (navigator.clipboard?navigator.clipboard.writeText(s):Promise.reject()).then(()=>alert('Copied! Paste it into the RCW assistant chat.')).catch(()=>{ prompt('Copy this block into the RCW assistant chat:', s); });
});

/* ---------- init ---------- */
load();
if($('geminiKey'))$('geminiKey').value=state.aiKey;
renderSlides();
showTab('create');
})();
