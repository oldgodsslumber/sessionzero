// ============================================================
// core/mp.js — Multiplayer layer (system-agnostic)
// ============================================================
// Wraps Firebase Auth (Google) + Realtime Database and exposes everything on
// the single global `MP`. The host page must load firebase-app-compat.js,
// firebase-auth-compat.js and firebase-database-compat.js BEFORE this file —
// dcLoadFirebase() in index.html does that lazily, so the offline app never
// pays for the SDK.
//
// The shared unit is a UNIVERSE, not a character. Daring Comics already had a
// universe object (a named world with a roster and a wiki that several local
// save files bind to); multiplayer moves that container from localStorage to
// Firebase so other people can bind to it too. Save files stay local and
// personal — only the world is shared.
//
// GM SECRETS ARE NOT A UI FILTER HERE. Wiki entries flagged `hidden`, and the
// `secret` field on otherwise-public entries, live in a separate `loreGM`
// subtree that the security rules make readable ONLY by the GM. Players'
// clients never receive the bytes. See splitLore()/mergeLore() below and the
// rules in MULTIPLAYER.md.
// ============================================================

window.MP = (function(){
  let app=null, auth=null, db=null, user=null;
  let currentCode=null, currentMeta=null;
  let unsub=[];        // active database subscriptions
  let authCbs=[];      // onAuth callbacks
  let inited=false;

  // ---- Init ----------------------------------------------------------------
  function init(cfg){
    if(inited) return;
    if(!window.firebase) throw new Error('Firebase SDK not loaded before core/mp.js');
    app  = firebase.initializeApp(cfg);
    auth = firebase.auth();
    db   = firebase.database();
    // Ask for the strongest persistence available. Firebase downgrades to
    // SESSION → NONE by itself where storage is partitioned or blocked.
    try{
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e){
        console.warn('[mp] setPersistence LOCAL failed, falling back:', e&&e.message);
      });
    }catch(e){ /* older SDK without the persistence API */ }
    auth.onAuthStateChanged(function(u){
      user = u||null;
      authCbs.slice().forEach(function(cb){try{cb(user);}catch(e){console.error(e);}});
    });
    // Pick up a redirect-based sign-in coming back (see signInGoogle).
    try{
      auth.getRedirectResult().catch(function(e){
        if(e&&e.code&&e.code!=='auth/no-auth-event')console.warn('[mp] getRedirectResult:',e.code,e.message);
      });
    }catch(e){}
    inited = true;
  }
  function isInited(){return inited;}
  // RTDB exposes a synthetic `.info/connected` node. A wrong databaseURL (the
  // easiest thing to get wrong during setup — the region changes the domain)
  // otherwise produces silence rather than an error, so watch it and let the
  // caller say something useful.
  function onConnectionState(cb){
    try{
      const ref=db.ref('.info/connected');
      const h=ref.on('value',function(s){cb(s.val()===true);});
      return function(){ref.off('value',h);};
    }catch(e){cb(false);return function(){};}
  }
  function onAuth(cb){authCbs.push(cb);if(inited)cb(user);return function(){authCbs=authCbs.filter(function(x){return x!==cb;});};}

  // ---- Auth ----------------------------------------------------------------
  // Popup is faster when it works, but it is broken by default in several
  // common environments: Chrome/Edge storage partitioning, mobile Safari,
  // popup blockers, in-app webviews. Without the redirect fallback those all
  // present to the user as "the sign-in button does nothing".
  const REDIRECT_FALLBACK_CODES = {
    'auth/popup-blocked':1,'auth/popup-closed-by-user':1,'auth/cancelled-popup-request':1,
    'auth/operation-not-supported-in-this-environment':1,'auth/web-storage-unsupported':1,
    'auth/internal-error':1
  };
  function signInGoogle(){
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({prompt:'select_account'});
    return auth.signInWithPopup(p).catch(function(err){
      const code = err&&err.code;
      if(code && REDIRECT_FALLBACK_CODES[code]){
        console.warn('[mp] popup sign-in failed ('+code+'), falling back to redirect');
        return auth.signInWithRedirect(p);
      }
      throw err;
    });
  }
  function signOut(){return auth.signOut();}
  function currentUser(){return user;}
  function currentUid(){return user&&user.uid;}
  function displayName(){return (user&&(user.displayName||user.email))||'Player';}

  // ---- Universe CRUD ------------------------------------------------------
  function _randomCode(){return String(Math.floor(Math.random()*10000)).padStart(4,'0');}
  // Claim via transaction so two people creating at the same moment can't take
  // the same code.
  async function _claimCode(uid){
    for(let attempt=0; attempt<25; attempt++){
      const code=_randomCode();
      const ref=db.ref('codes/'+code);
      const res=await ref.transaction(function(v){return v==null?uid:undefined;});
      if(res.committed && res.snapshot.val()===uid) return code;
    }
    throw new Error('Could not allocate a free 4-digit code — try again.');
  }

  // The active system's id. Defaulted inside MP rather than at each call site,
  // so there is no way to create an unstamped world or to join without the
  // cross-game check running.
  function _sysId(){ return (typeof SYS!=='undefined'&&SYS&&SYS.id)?SYS.id:''; }

  async function createUniverse(opts){
    if(!user) throw new Error('Sign in first.');
    opts=opts||{};
    const code=await _claimCode(user.uid);
    const meta={
      gmUid:user.uid, gmName:displayName(),
      name:(opts.name||'Untitled World'),
      // Which game this world belongs to. Join refuses a mismatch: the code is
      // only four digits, so without this a Daring Comics client could join a
      // Dungeon Crawler Carl crawl and sync a comic roster into it. The rules
      // make this field immutable once written.
      systemId:(opts.systemId||_sysId()),
      // Whatever else the active pack wants to travel with the world. Daring
      // Comics puts its tone and power level here, so a joining player inherits
      // the table's setting; a pack with no such settings sends nothing.
      packMeta:(opts.packMeta||null),
      createdAt:firebase.database.ServerValue.TIMESTAMP
    };
    await db.ref('universes/'+code+'/meta').set(meta);
    await db.ref('universes/'+code+'/members/'+user.uid).set({
      name:displayName(), photoURL:(user.photoURL||null),
      joinedAt:firebase.database.ServerValue.TIMESTAMP, heroId:null
    });
    await db.ref('users/'+user.uid+'/universes/'+code).set({
      name:meta.name, role:'gm', joinedAt:firebase.database.ServerValue.TIMESTAMP
    });
    return code;
  }
  async function joinUniverse(code,opts){
    if(!user) throw new Error('Sign in first.');
    code=String(code).padStart(4,'0');
    const snap=await db.ref('universes/'+code+'/meta').get();
    if(!snap.exists()) throw new Error('No world with code '+code+'.');
    const meta=snap.val();
    // Refuse a cross-game join rather than corrupting both sides' data. Worlds
    // created before systemId existed have no stamp; treat those as compatible
    // so an existing table is not locked out by an upgrade.
    const want=(opts&&opts.systemId!==undefined)?opts.systemId:_sysId();
    if(want&&meta.systemId&&meta.systemId!==want){
      throw new Error('Code '+code+' belongs to a different game ('+meta.systemId+'). Open that game\u2019s app to join it.');
    }
    // A GM rejoining through the join path must stay GM, or their saved list
    // mislabels them after create → join.
    const role=(meta.gmUid===user.uid)?'gm':'player';
    await db.ref('universes/'+code+'/members/'+user.uid).set({
      name:displayName(), photoURL:(user.photoURL||null),
      joinedAt:firebase.database.ServerValue.TIMESTAMP, heroId:null
    });
    await db.ref('users/'+user.uid+'/universes/'+code).set({
      name:meta.name||'', role:role, joinedAt:firebase.database.ServerValue.TIMESTAMP
    });
    return meta;
  }
  // Stop syncing locally but stay a member, so it still shows in the lobby list.
  function leaveUniverse(){unbind();currentCode=null;currentMeta=null;}
  async function forgetUniverse(code){
    if(!user) return;
    code=String(code).padStart(4,'0');
    if(currentCode===code)leaveUniverse();
    try{await db.ref('universes/'+code+'/members/'+user.uid).remove();}catch(e){}
    try{await db.ref('users/'+user.uid+'/universes/'+code).remove();}catch(e){}
  }
  async function deleteUniverse(code){
    if(!user) throw new Error('Sign in first.');
    code=String(code).padStart(4,'0');
    const snap=await db.ref('universes/'+code+'/meta').get();
    if(!snap.exists()) throw new Error('No universe with code '+code+'.');
    if(snap.val().gmUid!==user.uid) throw new Error('Only the GM can delete this universe.');
    if(currentCode===code)leaveUniverse();
    await db.ref('universes/'+code).remove();
    try{await db.ref('codes/'+code).remove();}catch(e){}
    try{await db.ref('users/'+user.uid+'/universes/'+code).remove();}catch(e){}
  }
  async function universeExists(code){
    if(!user) return false;
    code=String(code).padStart(4,'0');
    try{const s=await db.ref('universes/'+code+'/meta').get();return s.exists();}
    catch(e){return true;} // transient error — don't drop the row
  }
  async function listMyUniverses(){
    if(!user) return [];
    const s=await db.ref('users/'+user.uid+'/universes').get();
    if(!s.exists()) return [];
    const v=s.val()||{};
    return Object.keys(v).map(function(code){return Object.assign({code:code},v[code]);});
  }

  // ---- Subscriptions ------------------------------------------------------
  // callbacks: {meta, members, heroes, roster, lore, loreGM, conflict, regions, rolls, notes}
  // loreGM only ever fires for the GM — the rules reject the listener for
  // anyone else, and the error is swallowed rather than surfaced as a scary
  // permission warning for players.
  function bind(code, callbacks){
    unbind();
    currentCode=String(code).padStart(4,'0');
    const base=db.ref('universes/'+currentCode);
    const watch=function(path,cb,quietFail){
      const ref=base.child(path);
      const h=ref.on('value',function(s){try{cb(s.val());}catch(e){console.error(e);}},
        function(err){if(!quietFail)console.warn('[mp] subscription '+path+' failed:',err&&err.message);});
      unsub.push(function(){ref.off('value',h);});
    };
    if(callbacks.meta)     watch('meta',    function(v){currentMeta=v;callbacks.meta(v);});
    if(callbacks.members)  watch('members', callbacks.members);
    if(callbacks.heroes)   watch('heroes',  callbacks.heroes);
    if(callbacks.roster)   watch('roster',  callbacks.roster);
    if(callbacks.items)    watch('items',   callbacks.items);
    if(callbacks.lore)     watch('lore',    callbacks.lore);
    if(callbacks.loreGM)   watch('loreGM',  callbacks.loreGM, true);
    if(callbacks.conflict) watch('conflict',callbacks.conflict);
    if(callbacks.regions)  watch('regions', callbacks.regions);
    if(callbacks.notes)    watch('notes',   callbacks.notes);
    if(callbacks.rolls){
      const ref=base.child('rolls').orderByChild('ts').limitToLast(20);
      const h=ref.on('value',function(s){
        const v=s.val()||{};
        const list=Object.keys(v).map(function(k){return Object.assign({_id:k},v[k]);})
          .sort(function(a,b){return (a.ts||0)-(b.ts||0);});
        try{callbacks.rolls(list);}catch(e){console.error(e);}
      });
      unsub.push(function(){ref.off('value',h);});
    }
  }
  function unbind(){unsub.forEach(function(fn){try{fn();}catch(e){}});unsub=[];}

  function _need(){if(!currentCode)throw new Error('Not in a shared universe.');}
  function _ref(suffix){_need();return db.ref('universes/'+currentCode+'/'+suffix);}
  function isGM(){return !!(user&&currentMeta&&currentMeta.gmUid===user.uid);}
  function currentUniverse(){return{code:currentCode,meta:currentMeta};}
  function inUniverse(){return !!currentCode;}

  // Stamped on every shared write so the table can see who last touched a
  // thing — the table is fully collaborative, so attribution is the cheapest
  // form of accountability.
  function _stamp(obj){
    return Object.assign({},obj,{
      updatedBy:user?user.uid:null,
      updatedByName:displayName(),
      updatedAt:firebase.database.ServerValue.TIMESTAMP
    });
  }

  // ---- Heroes (personal — your sheet stays yours) --------------------------
  async function setMyHeroId(heroId){_need();await _ref('members/'+user.uid+'/heroId').set(heroId||null);}
  async function writeHero(char){
    _need();
    await _ref('heroes/'+user.uid).set(_stamp(Object.assign({},char,{ownerUid:user.uid})));
  }
  async function clearMyHero(){_need();await _ref('heroes/'+user.uid).remove();}

  // ---- Roster (collaborative) ---------------------------------------------
  async function writeRoster(id,entry){_need();await _ref('roster/'+id).set(_stamp(entry));}
  // Soft delete: a fully collaborative table means anyone can remove a villain
  // the GM spent an hour statting. Tombstone it instead so it can be restored.
  async function deleteRoster(id){
    _need();
    await _ref('roster/'+id+'/deletedAt').set(firebase.database.ServerValue.TIMESTAMP);
    await _ref('roster/'+id+'/deletedBy').set(displayName());
  }
  async function restoreRoster(id){
    _need();
    await _ref('roster/'+id+'/deletedAt').remove();
    await _ref('roster/'+id+'/deletedBy').remove();
  }
  async function purgeRoster(id){_need();await _ref('roster/'+id).remove();}

  // ---- The item catalogue (collaborative) ---------------------------------
  // What the table has made, as opposed to what the pack ships. Plain and
  // public: an item is a thing everyone can hold, so unlike the wiki there is
  // no GM half to withhold. Deleting tombstones rather than removes, for the
  // same reason the roster does — anyone can delete, and a GM's afternoon of
  // statting should not go with one tap.
  async function writeItem(id,entry){_need();await _ref('items/'+id).set(_stamp(entry));}
  async function deleteItem(id){
    _need();
    await _ref('items/'+id+'/deletedAt').set(firebase.database.ServerValue.TIMESTAMP);
    await _ref('items/'+id+'/deletedBy').set(displayName());
  }
  async function purgeItem(id){_need();await _ref('items/'+id).remove();}

  // ---- Wiki, split public / GM-only ---------------------------------------
  // splitLore is the whole security boundary. Everything a player must not see
  // goes into the second half, which lands under `loreGM`.
  function splitLore(entry){
    const pub={
      id:entry.id, type:entry.type, name:entry.name,
      aliases:entry.aliases||[], tags:entry.tags||[],
      body:entry.body||'', npcId:entry.npcId||null,
      createdBy:entry.createdBy||'user'
    };
    const gm={};
    if(entry.hidden===true){
      // The ENTIRE entry is GM-only — nothing at all goes public.
      return {pub:null, gm:Object.assign({},entry,{hidden:true})};
    }
    if(entry.secret&&String(entry.secret).trim())gm.secret=String(entry.secret).trim();
    return {pub:pub, gm:(Object.keys(gm).length?Object.assign({id:entry.id},gm):null)};
  }
  // Rejoin for the GM's own client. Players never call this with anything in
  // gmMap, because their subscription to loreGM is rejected by the rules.
  function mergeLore(pubMap, gmMap){
    const out=[];
    const seen={};
    Object.keys(pubMap||{}).forEach(function(id){
      const e=Object.assign({},pubMap[id],{id:id});
      const g=(gmMap||{})[id];
      if(g&&g.secret)e.secret=g.secret;
      e.hidden=false;
      seen[id]=true;
      out.push(e);
    });
    Object.keys(gmMap||{}).forEach(function(id){
      if(seen[id])return;
      out.push(Object.assign({},gmMap[id],{id:id,hidden:true}));
    });
    return out;
  }
  async function writeLore(entry){
    _need();
    const s=splitLore(entry);
    const id=entry.id;
    if(s.pub) await _ref('lore/'+id).set(_stamp(s.pub));
    else      await _ref('lore/'+id).remove();          // became fully hidden
    if(s.gm){
      if(!isGM()) throw new Error('Only the GM can store hidden or secret lore.');
      await _ref('loreGM/'+id).set(_stamp(s.gm));
    }else if(isGM()){
      await _ref('loreGM/'+id).remove();                // secret cleared
    }
  }
  async function deleteLore(id){
    _need();
    await _ref('lore/'+id+'/deletedAt').set(firebase.database.ServerValue.TIMESTAMP);
    await _ref('lore/'+id+'/deletedBy').set(displayName());
    if(isGM()){try{await _ref('loreGM/'+id+'/deletedAt').set(firebase.database.ServerValue.TIMESTAMP);}catch(e){}}
  }
  async function restoreLore(id){
    _need();
    await _ref('lore/'+id+'/deletedAt').remove();
    await _ref('lore/'+id+'/deletedBy').remove();
    if(isGM()){try{await _ref('loreGM/'+id+'/deletedAt').remove();}catch(e){}}
  }
  async function purgeLore(id){
    _need();
    await _ref('lore/'+id).remove();
    if(isGM()){try{await _ref('loreGM/'+id).remove();}catch(e){}}
  }
  // Reveal: move GM-only content into the public half. With a split store this
  // is a real operation rather than unticking a box, which is also better UX —
  // you choose what becomes known.
  async function revealLore(id, entry){
    if(!isGM()) throw new Error('Only the GM can reveal hidden lore.');
    const pub=Object.assign({},entry,{hidden:false});
    delete pub.secret;
    await _ref('lore/'+id).set(_stamp(splitLore(pub).pub));
    await _ref('loreGM/'+id).remove();
  }

  // ---- Shared table state -------------------------------------------------
  async function writeConflict(conflict){_need();await _ref('conflict').set(_stamp({data:conflict}));}
  async function writeRegions(regions,activeRegion){_need();await _ref('regions').set(_stamp({data:regions,active:activeRegion||0}));}

  async function appendRoll(roll){
    _need();
    await _ref('rolls').push(Object.assign({name:displayName()},roll,{
      uid:user.uid, ts:firebase.database.ServerValue.TIMESTAMP
    }));
  }
  async function appendNote(note){
    _need();
    const ref=await _ref('notes').push(Object.assign({},note,{
      authorUid:user.uid, authorName:displayName(),
      ts:firebase.database.ServerValue.TIMESTAMP
    }));
    return ref.key;
  }
  async function updateNote(nid,patch){_need();await _ref('notes/'+nid).update(patch);}
  async function deleteNote(nid){_need();await _ref('notes/'+nid).remove();}
  async function writeMeta(patch){
    if(!isGM()) throw new Error('Only the GM can change universe settings.');
    await _ref('meta').update(patch);
  }

  return {
    init, isInited, onAuth, onConnectionState,
    signInGoogle, signOut, currentUser, currentUid, displayName,
    createUniverse, joinUniverse, leaveUniverse, forgetUniverse, deleteUniverse,
    universeExists, listMyUniverses,
    bind, unbind, isGM, currentUniverse, inUniverse,
    setMyHeroId, writeHero, clearMyHero,
    writeRoster, deleteRoster, restoreRoster, purgeRoster,
    writeItem, deleteItem, purgeItem,
    splitLore, mergeLore, writeLore, deleteLore, restoreLore, purgeLore, revealLore,
    writeConflict, writeRegions,
    appendRoll, appendNote, updateNote, deleteNote, writeMeta
  };
})();
