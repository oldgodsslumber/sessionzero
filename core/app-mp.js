// ============================================================
// core/app-mp.js — Multiplayer overlay (system-agnostic)
// ============================================================
// Loaded lazily, AFTER the inline app script. It never forks the app: it wraps
// the app's own mutators and render functions, exactly as og-app-mp.js does for
// Outgunned. Offline behaviour is untouched until someone joins a universe.
//
// The integration trick: a joined remote universe is mirrored as an ordinary
// LOCAL universe object carrying a `remoteCode`. Everything downstream —
// currentUniverse(), listLore(), the S.npcs alias set up by bindUniverse() —
// keeps working unchanged. This layer only moves bytes in and out of that
// object and re-renders.
// ============================================================

(function(){
  'use strict';

  let inShared=false;
  let rollFeed=[];
  let members={};
  // Guards the sync loop: while we are applying a remote snapshot we must not
  // push it straight back out. Without this the two clients ping-pong forever.
  let _applyingRemote=false;
  // Last value we pushed per entry, so a keystroke in the NPC builder pushes
  // one changed villain rather than the whole roster.
  const _pushed={roster:{},lore:{}};
  const _tomb={roster:{},lore:{}};
  let _pushT=null, _heroT=null;
  let wrapsInstalled=false;

  function $(id){return document.getElementById(id);}
  function _u(){return (typeof currentUniverse==='function')?currentUniverse():null;}
  function _err(e){console.error('[mp]',e);if(e&&e.message)_toast(e.message,true);}

  // ---- Boot ---------------------------------------------------------------
  window.DC_BOOT_MP=function(cfg){
    if(!cfg||!cfg.apiKey){_toast('Multiplayer is not configured — see MULTIPLAYER.md.',true);return;}
    try{MP.init(cfg);}catch(e){_err(e);return;}
    MP.onAuth(function(){_refreshBar();if($('dc-mp-lobby'))_renderLobby();});
    _installBar();
    _openLobby();
    _watchConnection();
    // Deep link: index.html#u=1234
    const m=/[#&]u=(\d{1,4})/.exec(location.hash||'');
    if(m)_pendingJoinCode=String(m[1]).padStart(4,'0');
  };
  let _pendingJoinCode='';
  let _connected=false;
  // If we never connect, the overwhelmingly likely cause is a databaseURL that
  // doesn't match the console (the region suffix is easy to get wrong). Say so
  // rather than letting the lobby sit there doing nothing.
  function _watchConnection(){
    MP.onConnectionState(function(ok){
      _connected=ok;
      const w=$('dc-mp-conn');
      if(ok&&w)w.remove();
    });
    setTimeout(function(){
      if(_connected||!$('dc-mp-lobby-card'))return;
      const card=$('dc-mp-lobby-card');
      if($('dc-mp-conn'))return;
      const d=el('div',{id:'dc-mp-conn',class:'card-sm',style:{borderColor:'var(--red)'}});
      d.innerHTML='<div class="label mb-1" style="color:var(--red)">Can\'t reach the database</div>'+
        '<div style="font-size:11px;color:var(--muted)">Check that <code>databaseURL</code> in index.html exactly matches the URL shown at the top of the Realtime Database page in the Firebase console — the region changes the domain. Also confirm this site\'s domain is listed under Authentication → Settings → Authorised domains.</div>';
      card.insertBefore(d,card.firstChild.nextSibling);
    },7000);
  }

  // ---- Small DOM helpers --------------------------------------------------
  function el(tag,attrs,kids){
    const n=document.createElement(tag);
    Object.keys(attrs||{}).forEach(function(k){
      if(k==='style')Object.assign(n.style,attrs[k]);
      else if(k==='onclick')n.addEventListener('click',attrs[k]);
      else if(k==='class')n.className=attrs[k];
      else n.setAttribute(k,attrs[k]);
    });
    (kids||[]).forEach(function(c){n.appendChild(typeof c==='string'?document.createTextNode(c):c);});
    return n;
  }
  let _toastT=null;
  function _toast(msg,bad){
    let t=$('dc-mp-toast');
    if(!t){t=el('div',{id:'dc-mp-toast',style:{position:'fixed',bottom:'70px',left:'50%',transform:'translateX(-50%)',zIndex:'9500',padding:'9px 14px',borderRadius:'10px',fontSize:'12px',maxWidth:'90vw',textAlign:'center',boxShadow:'0 4px 18px rgba(0,0,0,.5)'}});document.body.appendChild(t);}
    t.textContent=msg;
    t.style.background=bad?'var(--red)':'var(--surface2)';
    t.style.color=bad?'#fff':'var(--text)';
    t.style.border='1px solid '+(bad?'var(--red)':'var(--border)');
    t.style.display='block';
    clearTimeout(_toastT);_toastT=setTimeout(function(){t.style.display='none';},bad?4200:2200);
  }

  // ---- Top bar ------------------------------------------------------------
  function _installBar(){
    if($('dc-mp-bar'))return;
    document.body.appendChild(el('div',{id:'dc-mp-bar',style:{
      position:'fixed',top:'0',right:'0',zIndex:'400',padding:'5px 9px',
      display:'flex',gap:'6px',alignItems:'center',background:'var(--surface)',
      borderLeft:'1px solid var(--border)',borderBottom:'1px solid var(--border)',
      borderBottomLeftRadius:'10px',fontSize:'11px',maxWidth:'70vw',flexWrap:'wrap'
    }}));
    _refreshBar();
  }
  function _refreshBar(){
    const bar=$('dc-mp-bar');if(!bar)return;
    bar.innerHTML='';
    const u=MP.currentUser();
    if(!u){
      bar.appendChild(el('button',{class:'btn btn-primary btn-xs',onclick:function(){MP.signInGoogle().catch(_err);}},['Sign in']));
      return;
    }
    bar.appendChild(el('span',{style:{color:'var(--muted)',whiteSpace:'nowrap',maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis'}},[MP.displayName()]));
    if(inShared){
      const p=MP.currentUniverse();
      bar.appendChild(el('span',{style:{color:'var(--accent)',fontWeight:'700'}},['#'+p.code]));
      if(MP.isGM())bar.appendChild(el('span',{style:{background:'var(--gold)',color:'#000',padding:'1px 5px',borderRadius:'4px',fontWeight:'700',fontSize:'9px'}},['GM']));
      bar.appendChild(el('button',{class:'btn btn-secondary btn-xs',onclick:_leaveShared},['Leave']));
    }else{
      bar.appendChild(el('button',{class:'btn btn-secondary btn-xs',onclick:_openLobby},['Universes']));
    }
    bar.appendChild(el('button',{class:'btn btn-secondary btn-xs',onclick:function(){MP.signOut();}},['Sign out']));
  }

  // ---- Lobby --------------------------------------------------------------
  function _openLobby(){
    if($('dc-mp-lobby'))return;
    const root=el('div',{id:'dc-mp-lobby',style:{position:'fixed',inset:'0',zIndex:'9000',background:'rgba(8,10,18,.96)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px',overflow:'auto'}});
    root.appendChild(el('div',{id:'dc-mp-lobby-card',class:'card',style:{maxWidth:'520px',width:'100%',marginTop:'4vh'}}));
    document.body.appendChild(root);
    _renderLobby();
  }
  function _closeLobby(){const r=$('dc-mp-lobby');if(r)r.remove();}

  async function _renderLobby(){
    const card=$('dc-mp-lobby-card');if(!card)return;
    const u=MP.currentUser();
    let h='<div class="pg-title" style="font-size:24px">Shared Universes</div>';
    h+='<div class="pg-sub" style="margin-bottom:12px">Play in the same world as your table. Your hero and save files stay on your device — the universe is what everyone shares.</div>';
    if(!u){
      h+='<button class="btn btn-primary btn-full" onclick="DC_MP.signIn()">Sign in with Google</button>';
      h+='<div style="font-size:11px;color:var(--muted);margin-top:10px;text-align:center">Sign-in identifies who owns which hero. Nothing is shared until you create or join a universe.</div>';
      h+='<div class="divider"></div><button class="btn btn-secondary btn-full" onclick="DC_MP.playOffline()">Keep playing offline</button>';
      card.innerHTML=h;return;
    }
    h+='<div class="card-sm"><div class="label mb-1">Join a universe</div><div style="display:flex;gap:6px"><input id="dc-mp-code" inputmode="numeric" maxlength="4" placeholder="4-digit code" value="'+(_pendingJoinCode||'')+'" style="flex:1;font-family:var(--font-label);font-size:18px;letter-spacing:3px;text-align:center"><button class="btn btn-primary" onclick="DC_MP.join()">Join</button></div></div>';
    h+='<div class="card-sm"><div class="label mb-1">Start a new one</div><div style="display:flex;gap:6px"><input id="dc-mp-name" placeholder="Universe name, e.g. Earth-77" style="flex:1"><button class="btn btn-gold" onclick="DC_MP.create()">Create</button></div><div style="font-size:11px;color:var(--muted);margin-top:5px">You become the GM. Only the GM can see hidden wiki entries and secrets.</div></div>';
    h+='<div id="dc-mp-mine"><div style="font-size:11px;color:var(--muted);padding:6px">Loading your universes…</div></div>';
    h+='<div class="divider"></div><button class="btn btn-secondary btn-full" onclick="DC_MP.playOffline()">Keep playing offline</button>';
    card.innerHTML=h;

    let list=[];
    try{list=await MP.listMyUniverses();}catch(e){/* offline or rules */}
    const wrap=$('dc-mp-mine');if(!wrap)return;
    if(!list.length){wrap.innerHTML='';return;}
    // Drop rows whose universe the GM has since deleted.
    const alive=[];
    for(const row of list){
      if(await MP.universeExists(row.code))alive.push(row);
      else MP.forgetUniverse(row.code).catch(function(){});
    }
    if(!alive.length){wrap.innerHTML='';return;}
    let lh='<div class="label mb-1" style="margin-top:10px">Your universes</div>';
    alive.forEach(function(r){
      lh+='<div class="card-sm" style="display:flex;align-items:center;gap:8px">';
      lh+='<div style="flex:1;min-width:0"><div class="fw-700">'+esc(r.name||'Untitled')+'</div><div style="font-size:11px;color:var(--muted)">#'+esc(r.code)+(r.role==='gm'?' · GM':'')+'</div></div>';
      lh+='<button class="btn btn-primary btn-xs" onclick="DC_MP.join(\''+r.code+'\')">Open</button>';
      lh+=(r.role==='gm')
        ? '<button class="btn btn-danger btn-xs" onclick="DC_MP.destroy(\''+r.code+'\')" title="Delete this universe for everyone">Del</button>'
        : '<button class="btn btn-secondary btn-xs" onclick="DC_MP.forget(\''+r.code+'\')" title="Leave and remove from this list">×</button>';
      lh+='</div>';
    });
    wrap.innerHTML=lh;
  }

  // ---- Public lobby actions (referenced from inline onclick) ---------------
  window.DC_MP={
    signIn:function(){MP.signInGoogle().catch(_err);},
    playOffline:function(){_closeLobby();},
    create:async function(){
      const n=($('dc-mp-name')||{}).value||'';
      if(!n.trim())return _toast('Give the universe a name first.',true);
      // Carry the local universe's tone/level up if we have one, so a GM who
      // set the world up offline doesn't lose it when they share it.
      const lu=_u(),ls=(lu&&lu.series)||{};
      try{
        const code=await MP.createUniverse({name:n.trim(),series:{tone:ls.tone||'',level:ls.level||''}});
        _toast('Universe created — code '+code);
        await _enterShared(code,n.trim());
      }catch(e){_err(e);}
    },
    join:async function(code){
      code=code||(($('dc-mp-code')||{}).value||'').trim();
      if(!/^\d{1,4}$/.test(code))return _toast('Enter the 4-digit code.',true);
      code=String(code).padStart(4,'0');
      try{
        const meta=await MP.joinUniverse(code);
        await _enterShared(code,meta&&meta.name);
      }catch(e){_err(e);}
    },
    forget:async function(code){
      if(!confirm('Leave this universe? Your local copy of its roster and wiki stays on this device.'))return;
      try{await MP.forgetUniverse(code);_renderLobby();}catch(e){_err(e);}
    },
    destroy:async function(code){
      if(!confirm('Delete this universe for EVERYONE at the table? This cannot be undone.'))return;
      try{await MP.deleteUniverse(code);_toast('Universe deleted.');_renderLobby();}catch(e){_err(e);}
    },
    reveal:_revealCurrentLore,
    openLobby:_openLobby,
    restore:_openRecycleBin
  };

  // ---- Enter / leave ------------------------------------------------------
  // Mirror the remote universe as a local universe object so every existing
  // local helper keeps working against it.
  function _ensureLocalMirror(code,name){
    loadUniverses();
    let u=U.universes.find(function(x){return x.remoteCode===code;});
    if(!u){
      u=createUniverse(name||('Universe #'+code));
      u.remoteCode=code;
    }
    if(name)u.name=name;
    if(!Array.isArray(u.roster))u.roster=[];
    if(!Array.isArray(u.lore))u.lore=[];
    U.activeUniverseId=u.id;
    saveUniverses();
    if(typeof S!=='undefined'&&S){S.universeId=u.id;bindUniverse();}
    return u;
  }

  async function _enterShared(code,name){
    if(!code){_err(new Error('No universe code — cannot join.'));return;}
    code=String(code).padStart(4,'0');
    _ensureLocalMirror(code,name);
    inShared=true;
    _pendingJoinCode='';
    _closeLobby();
    _installWraps();
    _refreshBar();

    // bind() first: it is what sets the current code, and every write below
    // needs it. Calling a write before this point targets universes/null.
    MP.bind(code,{
      meta:_onMeta, members:_onMembers, heroes:_onHeroes,
      roster:_onRoster, lore:_onLore, loreGM:_onLoreGM,
      conflict:_onConflict, regions:_onRegions,
      rolls:_onRolls, notes:_onNotes
    });
    MP.setMyHeroId(MP.currentUid()).catch(function(){});
    // Push whatever we already have so a fresh universe isn't empty.
    _pushShared(true);
    if(typeof S!=='undefined'&&S&&S.char)_pushHero();
    // Joining is a valid way out of the first-run "name your universe" gate —
    // a player invited to someone else's table has no universe of their own.
    if(typeof finishUniverseGate==='function')finishUniverseGate();
    _rerenderAll();
  }
  function _leaveShared(){
    MP.leaveUniverse();
    inShared=false;
    Object.keys(_pushed.roster).forEach(function(k){delete _pushed.roster[k];});
    Object.keys(_pushed.lore).forEach(function(k){delete _pushed.lore[k];});
    _refreshBar();_rerenderAll();_openLobby();
  }
  function _rerenderAll(){
    ['renderHero','renderNPCs','renderWiki','renderNotes','renderConflict','renderDice','renderMap'].forEach(function(fn){
      try{if(typeof window[fn]==='function'){
        if(fn==='renderWiki'&&!$('wiki-content'))return;
        if(fn==='renderNPCs'&&!$('npcs-content'))return;
        window[fn]();
      }}catch(e){}
    });
    _renderMembersPanel();
  }

  // ---- Remote → local -----------------------------------------------------
  function _withRemote(fn){_applyingRemote=true;try{fn();}finally{_applyingRemote=false;}}

  function _onMeta(meta){
    const had=!!MP.currentUniverse().meta;
    if(meta){
      const u=_u();
      if(u){
        let dirty=false;
        if(meta.name&&u.name!==meta.name){u.name=meta.name;dirty=true;}
        // The GM owns tone and power level; players inherit them.
        u.series=u.series||{tone:'',level:''};
        if(meta.tone&&u.series.tone!==meta.tone){u.series.tone=meta.tone;dirty=true;}
        if(meta.level&&u.series.level!==meta.level){u.series.level=meta.level;dirty=true;}
        if(dirty){_withRemote(function(){saveUniverses();});_rerenderAll();}
      }
    }
    // GM deleted the universe while we were in it.
    if(had&&!meta&&inShared){
      alert('The GM ended this universe.');
      MP.forgetUniverse(MP.currentUniverse().code).catch(function(){});
      _leaveShared();
      return;
    }
    _refreshBar();_rerenderAll();
  }
  function _onMembers(m){members=m||{};_renderMembersPanel();}

  function _onHeroes(map){
    // Other players' heroes appear in the roster as hero-mirrors, which is
    // what the offline app already does for your own via syncHeroToRoster().
    const u=_u();if(!u)return;
    const mine=MP.currentUid();
    _withRemote(function(){
      Object.keys(map||{}).forEach(function(uid){
        if(uid===mine)return;
        const ch=map[uid];if(!ch||!ch.costumedName)return;
        const id='hero_'+uid;
        const ent=Object.assign(characterToNpc(ch,id),{id:id,heroId:id,fromHero:true,remoteOwner:uid});
        const i=u.roster.findIndex(function(r){return r.id===id;});
        if(i>=0)u.roster[i]=ent;else u.roster.push(ent);
      });
      saveUniverses();
    });
    if($('npcs-content'))try{renderNPCs();}catch(e){}
    _renderMembersPanel();
  }

  function _onRoster(map){
    const u=_u();if(!u)return;
    map=map||{};
    _withRemote(function(){
      const keep=[];
      Object.keys(map).forEach(function(id){
        const e=map[id];
        _pushed.roster[id]=JSON.stringify(_strip(e));
        if(e.deletedAt){_tomb.roster[id]=e;return;}
        delete _tomb.roster[id];
        keep.push(Object.assign({},_strip(e),{id:id}));
      });
      // Local-only entries not yet pushed (offline edits) survive.
      (u.roster||[]).forEach(function(e){
        if(e&&e.id&&!map[e.id]&&!e.remoteOwner)keep.push(e);
      });
      u.roster=keep;
      if(typeof S!=='undefined'&&S)S.npcs=u.roster;
      saveUniverses();
    });
    if($('npcs-content'))try{renderNPCs();}catch(e){}
  }

  let _lorePub={}, _loreGM={};
  function _onLore(map){_lorePub=map||{};_applyLore();}
  function _onLoreGM(map){_loreGM=map||{};_applyLore();}
  function _applyLore(){
    const u=_u();if(!u)return;
    _withRemote(function(){
      const merged=MP.mergeLore(_lorePub,_loreGM);
      const live=[];
      merged.forEach(function(e){
        _pushed.lore[e.id]=JSON.stringify(_strip(e));
        const t=(_lorePub[e.id]&&_lorePub[e.id].deletedAt)||(_loreGM[e.id]&&_loreGM[e.id].deletedAt);
        if(t){_tomb.lore[e.id]=e;return;}
        delete _tomb.lore[e.id];
        live.push(_strip(e));
      });
      (u.lore||[]).forEach(function(e){
        if(e&&e.id&&!_lorePub[e.id]&&!_loreGM[e.id])live.push(e);
      });
      u.lore=live;
      saveUniverses();
    });
    if($('wiki-content'))try{renderWiki();}catch(e){}
  }
  // Drop the sync bookkeeping fields before they reach app code.
  function _strip(e){
    const o=Object.assign({},e);
    delete o.updatedBy;delete o.updatedByName;delete o.updatedAt;
    delete o.deletedAt;delete o.deletedBy;delete o.ownerUid;
    return o;
  }

  function _onConflict(v){
    if(!v||!v.data||typeof S==='undefined'||!S)return;
    _withRemote(function(){S.conflict=v.data;});
    if($('conflict-content'))try{renderConflict();}catch(e){}
  }
  function _onRegions(v){
    if(!v||!v.data||typeof S==='undefined'||!S)return;
    _withRemote(function(){S.regions=v.data;S.activeRegion=v.active||0;});
    if($('map-content'))try{renderMap();}catch(e){}
  }
  function _onRolls(list){rollFeed=list||[];_renderRollFeed();}
  function _onNotes(map){
    if(typeof S==='undefined'||!S)return;
    map=map||{};
    const remote=Object.keys(map).map(function(k){return Object.assign({},map[k],{id:k});})
      .sort(function(a,b){return (a.ts||0)-(b.ts||0);});
    const ids={};remote.forEach(function(n){ids[n.id]=1;});
    // Keep local notes that haven't been pushed yet.
    const localOnly=(S.notes||[]).filter(function(n){return n.id&&!ids[n.id];});
    _withRemote(function(){S.notes=remote.concat(localOnly);});
    // Never re-render over a textarea the user is typing in.
    const a=document.activeElement;
    if(a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT'))return;
    if($('notes-content'))try{renderNotes();}catch(e){}
  }

  // ---- Local → remote -----------------------------------------------------
  function _pushShared(force){
    if(!inShared||_applyingRemote)return;
    const u=_u();if(!u)return;
    const seenR={};
    (u.roster||[]).forEach(function(e){
      if(!e||!e.id)return;
      if(e.remoteOwner)return;          // someone else's hero mirror — not ours to push
      seenR[e.id]=1;
      const j=JSON.stringify(_strip(e));
      if(force||_pushed.roster[e.id]!==j){_pushed.roster[e.id]=j;MP.writeRoster(e.id,_strip(e)).catch(_err);}
    });
    Object.keys(_pushed.roster).forEach(function(id){
      if(seenR[id]||_tomb.roster[id])return;
      delete _pushed.roster[id];
      MP.deleteRoster(id).catch(function(){});
    });
    const seenL={};
    (u.lore||[]).forEach(function(e){
      if(!e||!e.id)return;
      seenL[e.id]=1;
      const j=JSON.stringify(_strip(e));
      if(force||_pushed.lore[e.id]!==j){_pushed.lore[e.id]=j;MP.writeLore(_strip(e)).catch(_err);}
    });
    Object.keys(_pushed.lore).forEach(function(id){
      if(seenL[id]||_tomb.lore[id])return;
      delete _pushed.lore[id];
      MP.deleteLore(id).catch(function(){});
    });
  }
  function _pushHero(){
    if(!inShared||typeof S==='undefined'||!S||!S.char)return;
    MP.writeHero(S.char).catch(_err);
  }

  function _installWraps(){
    if(wrapsInstalled)return;wrapsInstalled=true;

    // saveUniverses() is the single funnel for roster + wiki mutations — the
    // same reason og-app-mp.js hooks save() for enemies and NPCs.
    const origSaveU=window.saveUniverses;
    window.saveUniverses=function(){
      origSaveU.apply(this,arguments);
      if(!inShared||_applyingRemote)return;
      // S.npcs is normally the SAME array object as u.roster (bindUniverse
      // aliases them), but any code path that reassigns S.npcs instead of
      // mutating it would silently desync the two and we'd push stale data.
      // Re-alias when they diverge. Safe against save()'s temporary
      // `S.npcs=[]`, because save() restores it BEFORE it calls saveUniverses().
      const u=_u();
      if(u&&typeof S!=='undefined'&&S&&Array.isArray(S.npcs)&&S.npcs!==u.roster){
        u.roster=S.npcs;
      }
      clearTimeout(_pushT);_pushT=setTimeout(function(){_pushShared(false);},350);
    };

    // save() covers the hero sheet plus the shared table state.
    const origSave=window.save;
    window.save=function(){
      origSave.apply(this,arguments);
      if(!inShared||_applyingRemote)return;
      clearTimeout(_heroT);
      _heroT=setTimeout(function(){
        _pushHero();
        if(S.conflict)MP.writeConflict(S.conflict).catch(function(){});
        if(S.regions)MP.writeRegions(S.regions,S.activeRegion).catch(function(){});
      },350);
    };

    // Dice → shared feed, stamped with the HERO's name rather than the Google
    // account, so the log reads as fiction.
    ['doRoll','doSidebarRoll','doMobileRoll'].forEach(function(fn){
      const orig=window[fn];
      if(typeof orig!=='function')return;
      window[fn]=function(){
        const r=orig.apply(this,arguments);
        if(inShared&&S&&S.dice){
          MP.appendRoll({
            name:(S.char&&S.char.costumedName)||MP.displayName(),
            skill:S.dice.skill||'',total:S.dice.total,
            dice:S.dice.dice||[],mod:S.dice.mod||0,tn:S.dice.tn||0
          }).catch(function(){});
        }
        return r;
      };
    });

    // Notes need stable ids to sync — the offline app keys them by array index.
    const origSaveNew=window.saveNewEntry;
    if(typeof origSaveNew==='function'){
      window.saveNewEntry=function(){
        const before=(S.notes||[]).length;
        origSaveNew.apply(this,arguments);
        if(!inShared)return;
        const added=(S.notes||[])[ (S.notes||[]).length-1 ];
        if(added&&(S.notes||[]).length>before){
          if(!added.id)added.id=uid('n');
          MP.appendNote(added).catch(_err);
        }
      };
    }

    // The wiki editor is where GM secrets are entered — gate it in the DOM.
    const origLoreEd=window.renderLoreEditor;
    if(typeof origLoreEd==='function'){
      window.renderLoreEditor=function(){
        origLoreEd.apply(this,arguments);
        if(inShared)_gateLoreEditor();
      };
    }
    const origWiki=window.renderWiki;
    if(typeof origWiki==='function'){
      window.renderWiki=function(){
        origWiki.apply(this,arguments);
        if(inShared)_markWikiShared();
      };
    }
    const origDice=window.renderDice;
    if(typeof origDice==='function'){
      window.renderDice=function(){origDice.apply(this,arguments);if(inShared)_renderRollFeed();};
    }
    const origNPCs=window.renderNPCs;
    if(typeof origNPCs==='function'){
      window.renderNPCs=function(){origNPCs.apply(this,arguments);if(inShared)_renderMembersPanel();};
    }
  }

  // ---- GM-only UI ---------------------------------------------------------
  function _gateLoreEditor(){
    const body=$('lore-modal-body');if(!body)return;
    const chk=$('lore-hidden');
    if(chk&&!MP.isGM()){
      // Players cannot create GM-only lore: the rules would reject the write,
      // so don't offer the control at all.
      const row=chk.closest('label');if(row)row.style.display='none';
    }
    const sec=$('lore-secret');
    if(sec&&!MP.isGM()){
      const grp=sec.closest('.form-group');
      if(grp)grp.style.display='none';
    }
    if(MP.isGM()){
      const e=window._loreDraft;
      if(e&&(e.hidden||(e.secret&&e.secret.trim()))){
        const bar=document.createElement('div');
        bar.className='card-sm';
        bar.style.borderColor='var(--gold)';
        bar.innerHTML='<div class="label mb-1">GM only</div><div style="font-size:11px;color:var(--muted);margin-bottom:6px">'+
          (e.hidden?'This entire entry is hidden from your players — their app never receives it.':'The secret below is hidden from your players — their app never receives it.')+
          '</div><button class="btn btn-gold btn-sm" onclick="DC_MP.reveal()">Reveal to the table</button>';
        body.appendChild(bar);
      }
    }
  }
  async function _revealCurrentLore(){
    const e=window._loreDraft;if(!e||!e.id)return;
    if(!confirm('Reveal "'+(e.name||'this entry')+'" to everyone at the table? This cannot be undone.'))return;
    try{
      await MP.revealLore(e.id,e);
      e.hidden=false;e.secret='';
      if(typeof saveLoreEntry==='function')saveLoreEntry(e);
      _toast('Revealed to the table.');
      if(typeof closeLoreEditor==='function')closeLoreEditor();
    }catch(err){_err(err);}
  }
  function _markWikiShared(){
    const c=$('wiki-content');if(!c)return;
    if(c.querySelector('.dc-mp-wiki-note'))return;
    const n=document.createElement('div');
    n.className='dc-mp-wiki-note card-sm';
    n.style.borderColor='var(--accent)';
    n.style.marginBottom='8px';
    n.innerHTML='<div style="font-size:11px">🌐 Shared with the table (#'+MP.currentUniverse().code+'). '+
      (MP.isGM()?'Hidden entries and secrets stay on your device only.':'Your GM may be keeping some entries hidden.')+
      ' <button class="btn btn-secondary btn-xs" onclick="DC_MP.restore()">Recently deleted</button></div>';
    const first=c.querySelector('.uni-bar');
    if(first&&first.nextSibling)c.insertBefore(n,first.nextSibling);else c.insertBefore(n,c.firstChild);
  }

  // ---- Recycle bin (soft deletes) -----------------------------------------
  function _openRecycleBin(){
    const items=[];
    Object.keys(_tomb.roster).forEach(function(id){items.push({kind:'roster',id:id,e:_tomb.roster[id]});});
    Object.keys(_tomb.lore).forEach(function(id){items.push({kind:'lore',id:id,e:_tomb.lore[id]});});
    let h='<div class="pg-title" style="font-size:20px">Recently Deleted</div>';
    h+='<div class="pg-sub" style="margin-bottom:10px">Anyone at the table can delete shared content, so deletions are reversible.</div>';
    if(!items.length)h+='<div class="card tac"><div style="font-size:12px;color:var(--muted)">Nothing has been deleted.</div></div>';
    items.forEach(function(it){
      h+='<div class="card-sm" style="display:flex;align-items:center;gap:8px"><div style="flex:1"><div class="fw-700">'+esc(it.e.name||'(unnamed)')+'</div>'+
        '<div style="font-size:11px;color:var(--muted)">'+esc(it.kind==='lore'?'Wiki entry':'Roster')+(it.e.deletedBy?' · deleted by '+esc(it.e.deletedBy):'')+'</div></div>'+
        '<button class="btn btn-primary btn-xs" onclick="DC_MP.doRestore(\''+it.kind+'\',\''+it.id+'\')">Restore</button></div>';
    });
    h+='<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-secondary" style="flex:1" onclick="document.getElementById(\'lore-modal\').classList.remove(\'open\')">Close</button></div>';
    $('lore-modal-body').innerHTML=h;
    $('lore-modal').classList.add('open');
  }
  window.DC_MP.doRestore=async function(kind,id){
    try{
      if(kind==='lore')await MP.restoreLore(id);else await MP.restoreRoster(id);
      _toast('Restored.');
      _openRecycleBin();
    }catch(e){_err(e);}
  };

  // ---- Members + roll feed panels -----------------------------------------
  function _renderMembersPanel(){
    const host=$('npcs-content');
    if(!host||!inShared)return;
    let p=$('dc-mp-members');
    if(!p){p=document.createElement('div');p.id='dc-mp-members';p.className='card-sm';host.insertBefore(p,host.firstChild);}
    else if(p.parentNode!==host)host.insertBefore(p,host.firstChild);
    const ids=Object.keys(members);
    let h='<div class="label mb-1">At the table ('+ids.length+')</div><div style="display:flex;flex-wrap:wrap;gap:4px">';
    ids.forEach(function(uid){
      const m=members[uid]||{};
      const gm=MP.currentUniverse().meta&&MP.currentUniverse().meta.gmUid===uid;
      h+='<span class="tag" style="background:var(--surface3);color:var(--text);border:1px solid '+(gm?'var(--gold)':'var(--border)')+'">'+esc(m.name||'Player')+(gm?' · GM':'')+'</span>';
    });
    h+='</div>';
    p.innerHTML=h;
  }
  function _renderRollFeed(){
    const host=$('dice-content');
    if(!host||!inShared)return;
    let p=$('dc-mp-rolls');
    if(!p){p=document.createElement('div');p.id='dc-mp-rolls';p.className='card';host.appendChild(p);}
    else if(p.parentNode!==host)host.appendChild(p);
    let h='<div class="label mb-1">Table Rolls</div>';
    if(!rollFeed.length)h+='<div style="font-size:11px;color:var(--muted)">No rolls yet.</div>';
    rollFeed.slice().reverse().forEach(function(r){
      h+='<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:3px 0;border-bottom:1px solid var(--border)">'+
        '<span><span class="fw-700">'+esc(r.name||'Player')+'</span>'+(r.skill?' <span style="color:var(--muted)">'+esc(r.skill)+'</span>':'')+'</span>'+
        '<span class="fw-700" style="color:var(--accent)">'+(r.total!=null?r.total:'')+'</span></div>';
    });
    p.innerHTML=h;
  }

  // Called by the app when the GM edits universe settings, so tone/level reach
  // the table. No-op for players — writeMeta rejects them anyway.
  window.mpPushUniverseSeries=function(){
    if(!inShared||!MP.isGM())return;
    const u=_u(),s=(u&&u.series)||{};
    MP.writeMeta({name:(u&&u.name)||'',tone:s.tone||'',level:s.level||''}).catch(_err);
  };

  // Expose a little state for tests and debugging.
  window.DC_MP._state=function(){return{inShared:inShared,members:members,rollFeed:rollFeed,pushed:_pushed,tomb:_tomb};};
  window.DC_MP._enter=_enterShared;
  window.DC_MP._leave=_leaveShared;
})();
