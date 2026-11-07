// The AI settings, including the Gemini API key, are per game. They used to
// live on a flat 'dc_llm' key that every pack read and wrote, so all three
// games shared one key and one backend. storeKey() returns 'dc_llm' for Daring
// Comics, so its existing settings are found exactly where they already are.
function llmConfig(){if(_llmCfg)return _llmCfg;try{_llmCfg=Object.assign({},LLM_DEFAULTS,JSON.parse(localStorage.getItem(storeKey('llm')))||{});}catch(e){_llmCfg=Object.assign({},LLM_DEFAULTS);}if(LLM_RETIRED_MODELS.indexOf(_llmCfg.geminiModel)>=0)_llmCfg.geminiModel=LLM_DEFAULTS.geminiModel;return _llmCfg;}
function saveLLMConfig(patch){const c=Object.assign(llmConfig(),patch||{});try{localStorage.setItem(storeKey('llm'),JSON.stringify(c));}catch(e){}_llmCfg=c;return c;}
function llmReady(){const c=llmConfig();return c.backend==='gemini'?!!c.geminiKey.trim():!!c.localUrl.trim();}
function llmBackendLabel(){const c=llmConfig();return c.backend==='gemini'?('Gemini · '+c.geminiModel):('Local · '+(c.localModel||'default model'));}

// One non-streaming completion. Returns the reply text. Throws with a message
// worth showing the user — this is the only AI surface in the app, so a silent
// failure here reads as "the button is broken".
async function llmChat(opts){
  const c=llmConfig();
  if(!llmReady())throw new Error('No AI backend configured — open AI Setup from the Wiki tab.');
  return c.backend==='gemini'?llmGemini(c,opts):llmLocal(c,opts);
}
async function llmGemini(c,opts){
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(c.geminiModel)+':generateContent?key='+encodeURIComponent(c.geminiKey.trim());
  const body={
    systemInstruction:{parts:[{text:opts.system||''}]},
    contents:[{role:'user',parts:[{text:opts.user||''}]}],
    generationConfig:{temperature:opts.temperature==null?0.2:opts.temperature,maxOutputTokens:opts.maxTokens||8192}
  };
  if(opts.jsonMode)body.generationConfig.responseMimeType='application/json';
  // Gemini 3.x thinks by default and that thinking spends the same output
  // budget, which can truncate a large lore-intake reply. Extraction needs
  // no visible reasoning. thinkingLevel is the 3.x knob — gemini-3.5-flash-lite
  // rejects thinkingBudget with INVALID_ARGUMENT. Verified live 2026-08-21.
  if(opts.jsonMode&&/^gemini-3/i.test(c.geminiModel))body.generationConfig.thinkingConfig={thinkingLevel:'low'};
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(function(){return null;});
  if(!r.ok){
    const msg=(data&&data.error&&data.error.message)||('HTTP '+r.status);
    if(r.status===400&&/API key/i.test(msg))throw new Error('Gemini rejected the API key. Check it in AI Setup.');
    if(r.status===429)throw new Error('Gemini rate limit hit. Wait a minute and try again.');
    throw new Error('Gemini error: '+msg);
  }
  const cand=(data&&data.candidates&&data.candidates[0])||null;
  if(!cand){
    const blocked=data&&data.promptFeedback&&data.promptFeedback.blockReason;
    throw new Error(blocked?('Gemini blocked the request ('+blocked+'). Try rewording the notes.'):'Gemini returned no result.');
  }
  if(cand.finishReason==='MAX_TOKENS')console.warn('[wiki] Gemini hit the token cap — the reply may be truncated.');
  return ((cand.content&&cand.content.parts)||[]).map(function(p){return p.text||'';}).join('');
}
async function llmLocal(c,opts){
  const base=c.localUrl.trim().replace(/\/+$/,'');
  const headers={'Content-Type':'application/json'};
  if(c.localKey.trim())headers['Authorization']='Bearer '+c.localKey.trim();
  const body={
    messages:[{role:'system',content:opts.system||''},{role:'user',content:opts.user||''}],
    temperature:opts.temperature==null?0.2:opts.temperature,
    max_tokens:opts.maxTokens||8192,stream:false
  };
  if(c.localModel.trim())body.model=c.localModel.trim();
  if(opts.jsonMode)body.response_format={type:'json_object'};
  let r;
  try{r=await fetch(base+'/chat/completions',{method:'POST',headers:headers,body:JSON.stringify(body)});}
  catch(e){throw new Error('Couldn\'t reach '+base+'. Is the local server running, and does it allow requests from this page (CORS)?');}
  const data=await r.json().catch(function(){return null;});
  if(!r.ok)throw new Error('Local model error: '+((data&&data.error&&(data.error.message||data.error))||('HTTP '+r.status)));
  const ch=(data&&data.choices&&data.choices[0])||null;
  if(!ch)throw new Error('The local model returned no result.');
  return (ch.message&&ch.message.content)||ch.text||'';
}

function openAISetup(){
  const m=document.getElementById('ai-modal');m.classList.add('open');renderAISetup();
}
function closeAISetup(){document.getElementById('ai-modal').classList.remove('open');if(document.getElementById('wiki-content'))renderWiki();}
function renderAISetup(){
  const c=llmConfig();
  let h=`<div class="pg-title" style="font-size:22px">AI Setup</div><div class="pg-sub" style="margin-bottom:10px">Powers the Wiki's plain-language intake. Stored on this device only — never in a save file.</div>`;
  h+=`<div style="display:flex;gap:6px;margin-bottom:12px">`;
  h+=`<button class="btn btn-${c.backend==='gemini'?'primary':'secondary'} btn-sm" style="flex:1" onclick="saveLLMConfig({backend:'gemini'});renderAISetup()">Gemini</button>`;
  h+=`<button class="btn btn-${c.backend==='local'?'primary':'secondary'} btn-sm" style="flex:1" onclick="saveLLMConfig({backend:'local'});renderAISetup()">Local / Custom</button></div>`;
  if(c.backend==='gemini'){
    h+=`<div class="form-group"><label>API Key</label><input type="password" id="ai-gk" value="${esc(c.geminiKey)}" placeholder="AIza..." autocomplete="off"></div>`;
    h+=`<div class="form-group"><label>Model</label><input id="ai-gm" value="${esc(c.geminiModel)}" list="ai-gm-options" placeholder="gemini-3.7-flash"><datalist id="ai-gm-options">${LLM_MODEL_SUGGESTIONS.map(m=>`<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('')}</datalist></div>`;
    h+=`<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Get a free key at <span style="color:var(--blue)">aistudio.google.com/apikey</span>. The free tier is plenty for filing notes.</div>`;
  }else{
    h+=`<div class="form-group"><label>Base URL</label><input id="ai-lu" value="${esc(c.localUrl)}" placeholder="http://localhost:5000/v1"></div>`;
    h+=`<div class="form-group"><label>Model <span style="font-weight:400;text-transform:none;color:var(--muted)">(optional)</span></label><input id="ai-lm" value="${esc(c.localModel)}" placeholder="leave blank to use whatever is loaded"></div>`;
    h+=`<div class="form-group"><label>API Key <span style="font-weight:400;text-transform:none;color:var(--muted)">(optional)</span></label><input type="password" id="ai-lk" value="${esc(c.localKey)}" placeholder="only if your server requires one" autocomplete="off"></div>`;
    h+=`<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Any OpenAI-compatible <code>/chat/completions</code> endpoint — text-generation-webui, Ollama, LM Studio, llama.cpp. The server must allow cross-origin requests from this page.</div>`;
  }
  h+=`<div id="ai-test-status" style="font-size:12px;min-height:16px;margin-bottom:8px"></div>`;
  h+=`<div style="display:flex;gap:6px"><button class="btn btn-secondary" style="flex:1" onclick="closeAISetup()">Close</button><button class="btn btn-secondary" onclick="testLLM()">Test</button><button class="btn btn-primary" style="flex:1" onclick="applyAISetup(true)">Save</button></div>`;
  document.getElementById('ai-modal-body').innerHTML=h;
}
function applyAISetup(close){
  const c=llmConfig(),g=function(id){const el=document.getElementById(id);return el?el.value:null;};
  if(c.backend==='gemini')saveLLMConfig({geminiKey:g('ai-gk')||'',geminiModel:(g('ai-gm')||'').trim()||LLM_DEFAULTS.geminiModel});
  else saveLLMConfig({localUrl:(g('ai-lu')||'').trim(),localModel:(g('ai-lm')||'').trim(),localKey:g('ai-lk')||''});
  if(close){flashSaved();closeAISetup();}
}
async function testLLM(){
  applyAISetup(false);
  const st=document.getElementById('ai-test-status');if(st){st.style.color='var(--muted)';st.textContent='Testing…';}
  try{
    const t=await llmChat({system:'Reply with exactly the word: OK',user:'Say OK.',maxTokens:16,jsonMode:false});
    if(st){st.style.color='var(--green)';st.textContent='Connected. Model replied: '+String(t).trim().slice(0,40);}
  }catch(e){if(st){st.style.color='var(--accent)';st.textContent=e.message;}}
}

// ═══════════════════════════════════════════════════════════
// WIKI — universe-wide lore, browsable as cards, fed by plain language
// ═══════════════════════════════════════════════════════════
