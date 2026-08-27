const FIREBASE_SDK='https://www.gstatic.com/firebasejs/10.8.0/';
let _mpLoading=null;
function mpConfigured(){return !!(window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey&&window.FIREBASE_CONFIG.databaseURL);}
function _loadScript(src){
  return new Promise(function(res,rej){
    const s=document.createElement('script');
    s.src=src;s.async=false;
    s.onload=res;s.onerror=function(){rej(new Error('Could not load '+src));};
    document.head.appendChild(s);
  });
}
// Lazy: the Firebase SDK is ~300KB and most sessions are solo, so nothing is
// fetched until the player actually asks for multiplayer.
// Best-effort: a fork may have removed firebase-config.js to point elsewhere,
// and file:// gives it no origin to load from, so a failure here is handled
// rather than thrown — the offline app carries on regardless.
let _cfgTried=false;
async function _loadLocalConfig(){
  if(_cfgTried)return;
  _cfgTried=true;
  try{await _loadScript(shellPath('firebase-config.js'));}catch(e){}
}
function openMultiplayer(){
  if(window.MP&&window.DC_BOOT_MP){DC_MP.openLobby();return;}
  if(_mpLoading)return;
  _mpLoading=(async function(){
    await _loadLocalConfig();
    if(!mpConfigured()){
      _mpLoading=null;
      alert('Multiplayer could not start \u2014 firebase-config.js did not load.\n\nIf you opened index.html straight from disk, that is why: Google sign-in needs a real origin. Serve this folder over http instead (run \"npx serve\" in it), or use the hosted copy.\n\nIf this is your own fork, copy firebase-config.example.js to firebase-config.js and fill in your Firebase web config, then paste the security rules from MULTIPLAYER.md into the Firebase console.\n\nEverything else in the app works without it.');
      return;
    }
    try{
      await _loadScript(FIREBASE_SDK+'firebase-app-compat.js');
      await _loadScript(FIREBASE_SDK+'firebase-auth-compat.js');
      await _loadScript(FIREBASE_SDK+'firebase-database-compat.js');
      await _loadScript(shellPath('core/mp.js'));
      await _loadScript(shellPath('core/app-mp.js'));
      DC_BOOT_MP(window.FIREBASE_CONFIG);
    }catch(e){
      _mpLoading=null;
      alert('Could not load multiplayer: '+e.message+'\n\nCheck your connection — the rest of the app still works offline.');
    }
  })();
}

(function boot(){
  // Pick the active system first: every render below reads SYS and the lexicon.
  // Defaults to Daring Comics, so existing installs are untouched.
  sysActivate(null);
  // The nav, pages and modals live in core/chrome.js now that each game has
  // its own entry file. Build them before any render touches the DOM.
  buildShellChrome();
  loadUniverses();
  if(U.universes.length===0){openUniverseSetup(true);return;}
  migrateSlotsToSaves();
  loadSaves();
  if(!saveIndexHealthy())rebuildSaveIndex();
  migrateUniverseSeries();
  if(SV.activeId&&getSaveData(SV.activeId))loadSave(SV.activeId);
  else{
    const first=listSaves().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
    if(first)loadSave(first.id);
  }
  renderHero();
  if(currentSaveId===null)openSlotModal();
})();
