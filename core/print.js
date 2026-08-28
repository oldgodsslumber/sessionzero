function dcSheetCSS(){return `@page{size:letter portrait;margin:.5in}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #111;padding-bottom:5px;margin-bottom:8px}
.h-name{font-size:22pt;font-weight:900;line-height:1}.h-civ{font-size:10pt;color:#555;margin-top:2px}
.h-right{text-align:right}.h-title{font-size:14pt;font-weight:900;letter-spacing:2px;color:#c00}.h-sub{font-size:7pt;color:#bbb;letter-spacing:1px}
.meta{display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap}
.meta-box{border:1px solid #bbb;border-radius:4px;padding:3px 8px;font-size:9pt}
.meta-l{font-weight:700;text-transform:uppercase;font-size:7.5pt;color:#888;letter-spacing:.5px}.meta-v{font-weight:700;font-size:12pt}
.body{display:flex;gap:0}.col{padding:0 8px}.col:first-child{padding-left:0;width:40%;border-right:1px solid #ddd}.col:last-child{flex:1;padding-right:0}
.sec{margin-bottom:8px}.sec-t{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#999;border-bottom:1px solid #ddd;margin-bottom:4px;padding-bottom:1px}
.asp{font-size:9.5pt;margin-bottom:3px;line-height:1.3}.al{font-weight:700}
.sk-tier{font-size:8pt;font-weight:700;text-transform:uppercase;color:#999;margin-top:4px;margin-bottom:1px;letter-spacing:.3px}
.sk-item{font-size:10pt;padding:1px 0 1px 8px;border-bottom:1px solid #f0f0f0}
.sk-desc{display:block;font-size:7.5pt;color:#999;line-height:1.2;margin-top:0}
.sb{display:inline-block;width:16px;height:16px;border:1.5px solid #222;border-radius:2px;text-align:center;font-size:8pt;line-height:16px;margin-right:2px}
.stress-row{margin-bottom:4px}
.stress-l{font-size:8pt;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:2px}
.con-row{display:flex;align-items:baseline;gap:4px;margin-bottom:3px;font-size:9.5pt}
.con-l{font-weight:700;font-size:8.5pt;text-transform:uppercase;color:#888;min-width:80px}
.con-v{flex:1}.con-line{display:block;border-bottom:1px solid #bbb;width:100%;height:12px}
.ps-card{border:1.5px solid #8e44ad;border-radius:4px;padding:6px;margin-bottom:6px}
.ps-name{font-size:11pt;font-weight:900;color:#8e44ad}.ps-asp{font-size:8.5pt;color:#888;font-style:italic;margin-bottom:3px}
.form-hdr{font-size:10pt;font-weight:900;text-transform:uppercase;letter-spacing:.8px;color:#444;margin:8px 0 4px;padding-bottom:2px;border-bottom:1.5px solid #444}
.gear-block{border:1px solid #777;border-radius:4px;padding:5px;margin-bottom:6px}
.gear-h{font-size:9pt;font-weight:700;text-transform:uppercase;color:#555;margin-bottom:3px;letter-spacing:.5px}
.gear-item{font-size:9pt;padding:1px 0;border-bottom:1px dotted #ddd}
.gear-n{font-weight:700}.gear-c{color:#888;font-size:8pt}.gear-stat{color:#c00;font-weight:600;font-size:8.5pt}.gear-special{color:#666;font-size:8pt;font-style:italic}
.pw-item{padding:2px 0;font-size:9.5pt;border-bottom:1px solid #f0f0f0}
.pw-n{font-weight:700}.pw-lv{color:#c00;font-weight:600}.pw-c{color:#888;font-size:8.5pt}
.pw-desc{font-size:8pt;color:#666;line-height:1.3;margin-top:1px}
.pw-lvd{font-size:8pt;color:#c00;font-weight:600;margin-top:1px}
.pw-flavor{font-size:8.5pt;color:#3a6791;font-style:italic;margin-top:3px;padding:3px 5px;background:#eef4f9;border-left:2px solid #3a6791;border-radius:2px}
.pw-tags{margin-top:1px}.tg{display:inline-block;padding:0 4px;border-radius:6px;font-size:7.5pt;font-weight:700;margin-right:2px}
.tg-se{background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}.tg-lm{background:#ffebee;color:#c62828;border:1px solid #ef9a9a}
.tg-desc{font-size:7pt;color:#888;font-weight:400}
.st-item{padding:2px 0;font-size:9.5pt;border-bottom:1px solid #f0f0f0}.st-n{font-weight:700}.st-d{font-size:8.5pt;color:#666}
.cast-item{display:flex;gap:6px;font-size:9pt;padding:1px 0;border-bottom:1px solid #f0f0f0}.cast-n{font-weight:700}.cast-d{color:#666}
.gear{font-size:9pt;white-space:pre-wrap;color:#444}
@media print{@page{size:letter portrait;margin:.5in}body{margin:0}}
/* ── print centre additions ──────────────────────────────────────────── */
.sheet{break-after:page;page-break-after:always}
.sheet:last-child{break-after:auto;page-break-after:auto}
.sheet-half{break-after:auto;page-break-after:auto;border:1.5px solid #444;border-radius:5px;padding:10px;margin-bottom:10px;break-inside:avoid;page-break-inside:avoid}
.sheet-half .hdr{margin-bottom:6px;padding-bottom:3px;border-bottom-width:1.5px}
.sheet-half .h-name{font-size:16pt}.sheet-half .h-sub{font-size:6.5pt}
.sheet-half .meta{margin-bottom:6px;gap:6px}
.sec,.sec-t,.ps-card,.gear-block,.st-item,.cast-item{break-inside:avoid;page-break-inside:avoid}
.sec-t{break-after:avoid;page-break-after:avoid}
.pg{break-after:page;page-break-after:always}
.pg:last-child{break-after:auto;page-break-after:auto}
.pg-h{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #111;padding-bottom:4px;margin-bottom:10px}
.pg-h-t{font-size:17pt;font-weight:900;line-height:1}
.pr-id{display:flex;flex-wrap:wrap;gap:3px 20px;margin:5px 0 9px;padding-bottom:6px;border-bottom:1.5pt solid #101410}
.pr-id-f{font-size:9pt}
.pr-id-l{font-family:'Oswald',sans-serif;text-transform:uppercase;font-size:7pt;letter-spacing:.9px;color:#68786a;margin-right:5px;font-weight:500}
.pr-id-v{font-weight:600}
.pr-note{font-size:8pt;line-height:1.35;color:#333;margin-bottom:8px;padding:5px 7px;border:.75pt solid #bbb;border-radius:3px}
.pr-cols{column-count:2;column-gap:14px}
.pr-blk{break-inside:avoid;page-break-inside:avoid;margin-bottom:9px}
.pr-gear{margin-top:4px}
.pr-gear th{background:#101410;color:#f7f9f6;font-family:'Oswald',sans-serif;font-size:7.5pt;
  letter-spacing:1.1px;text-transform:uppercase;text-align:left;padding:3pt 5pt}
.pr-gear td{padding:3.5pt 5pt;border-bottom:.5pt solid #b9c3ba;vertical-align:top}
.pr-gear td.pr-w{width:86pt;font-family:'Oswald',sans-serif;font-size:8pt;letter-spacing:.4px;color:#3d4a3e}
.pr-gear td.pr-box{width:26pt;border-left:.5pt solid #b9c3ba}
.pr-gear td.pr-empty{height:15pt}
.pr-sub{font-size:7.5pt;color:#4a5a4c;line-height:1.35;margin-top:1pt}
.pr-q{color:#4a5a4c}
.pr-tot{margin-top:7pt;font-family:'Oswald',sans-serif;font-size:9pt;letter-spacing:.6px;
  text-transform:uppercase;border-top:1.5pt solid #101410;padding-top:4pt}
.pr-tot strong{font-size:12pt}
.pr-note-sm{font-family:'Inter',sans-serif;font-size:7.5pt;text-transform:none;letter-spacing:0;
  color:#68786a;margin-left:8pt}
.pr-blk-t{font-family:'Oswald',sans-serif;font-size:8pt;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;
  color:#101410;border-bottom:1pt solid #101410;padding-bottom:1.5pt;margin-bottom:3px}
.pr-t{width:100%;border-collapse:collapse;font-size:8.5pt}
.pr-t td{padding:1px 0;vertical-align:top;border-bottom:.4pt dotted #ccc}
.pr-t td.pr-n{font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:7.6pt;
  text-align:right;white-space:nowrap;padding-left:6px;font-variant-numeric:tabular-nums}
.pg-h-s{font-size:7pt;letter-spacing:1.5px;color:#999;text-transform:uppercase}
/* 4-up cast cards */
.grid4{display:grid;grid-template-columns:1fr 1fr;gap:0}
.card4{border:1px dashed #aaa;padding:9px 10px;min-height:2.35in;break-inside:avoid;page-break-inside:avoid}
.c4-n{font-size:13pt;font-weight:900;line-height:1.1}
.c4-r{font-size:7.5pt;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:4px}
.c4-d{font-size:9pt;color:#333;line-height:1.35;margin-bottom:4px}
.c4-l{font-size:7.5pt;font-weight:700;text-transform:uppercase;color:#999;letter-spacing:.5px;margin-top:5px}
.c4-v{font-size:9pt}
.rule{display:block;border-bottom:1px solid #ccc;height:11px}
/* nameless strip */
.strip{display:flex;align-items:flex-start;gap:8px;border:1px solid #999;border-radius:4px;padding:6px 8px;margin-bottom:6px;break-inside:avoid;page-break-inside:avoid}
.strip-n{font-size:11pt;font-weight:900;min-width:1.5in}
.strip-o{font-size:11pt;font-weight:900;color:#c00;min-width:.85in}
.strip-d{flex:1;font-size:8.5pt;color:#444;line-height:1.3}
.strip-s{flex-shrink:0}
/* region maps */
.map{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;width:5.6in;margin:0 auto 8px}
.mc{aspect-ratio:1;border:1px solid #999;border-radius:3px;padding:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden}
.mc-void{border:1px dotted #e0e0e0}
.mc-cur{border:2.5px solid #c00}
.mc-i{width:26px;height:26px;object-fit:contain}
.mc-n{font-size:7pt;line-height:1.15;margin-top:1px}
.mc-x{font-size:6pt;color:#aaa;position:absolute}
.map-key{font-size:8.5pt;line-height:1.4}
.map-key div{padding:1px 0;border-bottom:1px solid #f0f0f0}
.map-key b{font-weight:700}
/* issue log */
.iss{font-size:13pt;font-weight:900;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #111;margin:10px 0 6px;padding-bottom:2px;break-after:avoid;page-break-after:avoid}
.log-e{margin-bottom:7px;padding-left:8px;border-left:2.5px solid #999;break-inside:avoid;page-break-inside:avoid}
.log-t{font-size:10pt;font-weight:700}
.log-m{font-size:7.5pt;text-transform:uppercase;letter-spacing:.6px;color:#999}
.log-b{font-size:9.5pt;line-height:1.4;white-space:pre-wrap;color:#222}
/* gear reference table */
.gt{width:100%;border-collapse:collapse;font-size:9pt}
.gt th{text-align:left;font-size:7.5pt;text-transform:uppercase;letter-spacing:.6px;color:#888;border-bottom:1.5px solid #999;padding:2px 4px}
.gt td{padding:2px 4px;border-bottom:1px solid #eee;vertical-align:top}
.gt tr{break-inside:avoid;page-break-inside:avoid}
/* contents page */
.toc{font-size:10pt;line-height:1.6}
.toc-g{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;margin-top:8px;border-bottom:1px solid #ddd}
/* cut guides for multi-up pages, toggled from the toolbar */
body.no-guides .card4{border-color:transparent}
body.guides .card4{border-style:dashed;border-color:#999}
/* ink saver drops every fill and heavy rule */
body.ink-saver .ps-card{border-color:#999}
body.ink-saver .pw-flavor{background:none;border-left-color:#999;color:#444}
body.ink-saver .tg-se,body.ink-saver .tg-lm{background:none;border-color:#999;color:#333}
body.ink-saver .h-title,body.ink-saver .strip-o,body.ink-saver .ps-name,body.ink-saver .gear-stat,body.ink-saver .pw-lv,body.ink-saver .pw-lvd{color:#333}
body.ink-saver .mc-cur{border-color:#333}
/* screen-only preview chrome; never printed */
#pv-bar{position:fixed;top:0;left:0;right:0;background:#111;color:#eee;font:600 11px/1 Arial,sans-serif;padding:9px 14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;z-index:99;box-shadow:0 1px 6px rgba(0,0,0,.4)}
#pv-bar .pv-t{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#e63946;font-weight:900}
#pv-bar label{display:inline-flex;align-items:center;gap:5px;cursor:pointer;font-weight:600;color:#ccc}
#pv-bar button{background:#222;border:1px solid #555;color:#eee;font:inherit;padding:5px 12px;border-radius:50vh;cursor:pointer;letter-spacing:.5px}
#pv-bar button:hover{border-color:#e63946;color:#fff}
#pv-bar select{background:#222;border:1px solid #555;color:#eee;font:inherit;padding:4px 6px;border-radius:4px}
#pv-pages{color:#888;font-weight:400}
body.previewing{padding-top:44px}
@media screen{
  body.previewing{background:#4a4a4a}
  body.previewing .sheet,body.previewing .pg{background:#fff;max-width:8.5in;margin:0 auto 14px;padding:.5in;box-shadow:0 2px 10px rgba(0,0,0,.5)}
  body.previewing .sheet-half{max-width:none;margin:0 0 10px;padding:10px;box-shadow:none}
}
@media print{#pv-bar{display:none!important}body.previewing{padding-top:0;background:#fff}
  body.previewing .sheet,body.previewing .pg{max-width:none;margin:0;padding:0;box-shadow:none}
  body.previewing .sheet-half{padding:10px}}
@page{size:letter portrait;margin:.5in}
body.a4 .sheet,body.a4 .pg{max-width:8.27in}
`;}

// One character-shaped object rendered as a sheet body. Feed it S.char, a hero
// state from another save slot, or any NPC run through npcToCharacter().
//   opts.series   {tone,level,exp} — overrides the global config, so heroes from
//                 other slots print with their own tone rather than this save's.
//   opts.kicker   the small label under DARING COMICS (default CHARACTER SHEET)
//   opts.half     render as a half-page block instead of a full page
function sheetBodyHTML(ch,opts){
  opts=opts||{};
  const{tone,level,exp}=opts.series||getSeriesConfig();
  const _kick=opts.kicker||'CHARACTER SHEET';
  function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  syncHardiness(ch);
  // Stress boxes
  function stressBoxes(arr){return arr.map((_,i)=>`<span class="sb">${i+1}</span>`).join('');}
  // Skills sorted
  const sortedSk=SKILLS.filter(sk=>(ch.skills[sk]||0)>0).sort((a,b)=>(ch.skills[b]||0)-(ch.skills[a]||0));
  let skillsHtml='';
  let prevLv=99;
  sortedSk.forEach(sk=>{const v=ch.skills[sk];if(v<prevLv){skillsHtml+=`<div class="sk-tier">${ladderName(v)} (+${v})</div>`;prevLv=v;}skillsHtml+=`<div class="sk-item">${e(sk)}<span class="sk-desc">${e(SKILL_DESC[sk]||'')}</span></div>`;});
  // Aspects
  let aspHtml=`<div class="asp"><span class="al">Concept:</span> ${e(ch.aspects.concept)}</div><div class="asp"><span class="al">Motivation:</span> ${e(ch.aspects.motivation)}</div>`;
  ch.aspects.contingent.forEach(ct=>{if(ct.text)aspHtml+=`<div class="asp"><span class="al">${e(ct.cat||'Aspect')}:</span> ${e(ct.text)}</div>`;});
  // Power Sets + Gear (across all forms; label when more than one)
  let powHtml='';
  const _printForms=ch.forms||[{name:'',powerSets:ch.powerSets||[]}];
  _printForms.forEach(form=>{
    if(_printForms.length>1)powHtml+=`<div class="form-hdr">◆ ${e(form.name||'Form')}</div>`;
    (form.powerSets||[]).forEach(ps=>{
      powHtml+=`<div class="ps-card"><div class="ps-name">${e(ps.name||'Power Set')}</div><div class="ps-asp">${e(ps.aspect)}</div>`;
      (ps.powers||[]).forEach(pw=>{const pd=POWERS.find(p=>p.id===pw.powerId);powHtml+=`<div class="pw-item">${pw.icon?'<img src="https://api.iconify.design/'+encodeURIComponent(pw.icon)+'.svg" width="24" height="24" style="vertical-align:middle;margin-right:5px">':''}<span class="pw-n">${e(pw.customName||pd?.name||pw.powerId)}</span>${pw.level>1?' <span class="pw-lv">Lv'+pw.level+'</span>':''} <span class="pw-c">(${pw.totalCost} HP)</span>${pd?.desc?`<div class="pw-desc">${e(pd.desc)}</div>`:''}${pd?.levelDesc&&pd.levelDesc[pw.level]?`<div class="pw-lvd">${e(pd.levelDesc[pw.level])}</div>`:''}${pw.selectedSE.length?'<div class="pw-tags">'+pw.selectedSE.map(s=>{const def=[...(pd?.se||[]),...GENERAL_SE].find(x=>x.name===s);return'<span class="tg tg-se">'+e(s)+'</span>'+(def?' <span class="tg-desc">'+e(def.desc)+'</span>':'');}).join('<br>')+'</div>':''}${pw.selectedLim.length?'<div class="pw-tags">'+pw.selectedLim.map(l=>{const def=[...(pd?.lim||[]),...GENERAL_LIMITS].find(x=>x.name===l);return'<span class="tg tg-lm">'+e(l)+'</span>'+(def?' <span class="tg-desc">'+e(def.desc)+'</span>':'');}).join('<br>')+'</div>':''}${pw.flavor?'<div class="pw-flavor">'+e(pw.flavor)+'</div>':''}</div>`;});
      powHtml+='</div>';
    });
    if(form.gear&&form.gear.length){
      powHtml+=`<div class="gear-block"><div class="gear-h">Gear</div>`;
      form.gear.forEach(it=>{
        const g=it.custom?null:GEAR.find(x=>x.id===it.gearId);
        const name=it.customName||(g?g.name:(it.name||'Item'));
        const cat=g?g.cat:(it.cat||'');
        const stat=g?(g.cat==='Armor'?`Armor ${g.armor}`:(g.rating!==undefined?`Weapon ${g.rating}${g.range!==undefined?' · Range '+g.range:''}`:'')):'';
        const special=g?g.special:(it.special||[]);
        powHtml+=`<div class="gear-item"><span class="gear-n">${e(name)}</span> <span class="gear-c">[${e(cat)}]</span>${stat?` <span class="gear-stat">${e(stat)}</span>`:''}${special&&special.length?` <span class="gear-special">${e(special.join(', '))}</span>`:''}</div>`;
      });
      powHtml+=`</div>`;
    }
  });
  // Stunts
  let stuntHtml='';
  (ch.stunts||[]).forEach(st=>{stuntHtml+=`<div class="st-item"><span class="st-n">${e(st.name)}</span> <span class="pw-c">(${st.cost} HP)</span><div class="st-d">${e(st.desc)}</div></div>`;});
  // Consequences
  const consHtml=`<div class="con-row"><span class="con-l">Mild (2):</span><span class="con-v">${e(ch.consequences.mild)||'<span class="con-line"></span>'}</span></div><div class="con-row"><span class="con-l">Moderate (4):</span><span class="con-v">${e(ch.consequences.moderate)||'<span class="con-line"></span>'}</span></div><div class="con-row"><span class="con-l">Severe (6):</span><span class="con-v">${e(ch.consequences.severe)||'<span class="con-line"></span>'}</span></div>${(function(){var o='';var hc=ch.hardCons||{};[['mild','Mild (2)'],['moderate','Moderate (4)'],['severe','Severe (6)']].forEach(function(p){(hc[p[0]]||[]).forEach(function(v){o+='<div class="con-row"><span class="con-l">'+p[1]+' +:</span><span class="con-v">'+(e(v)||'<span class="con-line"></span>')+'</span></div>';});});return o;})()}`;
  // Supporting cast & rogues
  let castHtml='';
  (ch.supportingCast||[]).forEach(sc=>{if(sc.name)castHtml+=`<div class="cast-item"><span class="cast-n">${e(sc.name)}</span><span class="cast-d">${e(sc.desc)}</span></div>`;});
  let rogueHtml='';
  (ch.roguesGallery||[]).forEach(rg=>{if(rg.name)rogueHtml+=`<div class="cast-item"><span class="cast-n">${e(rg.name)}</span><span class="cast-d">${e(rg.desc)}</span></div>`;});

  return `<section class="sheet${opts.half?' sheet-half':''}"><div class="hdr">
  <div><div class="h-name">${e(ch.costumedName)}</div><div class="h-civ">${e(ch.civilianName)}</div></div>
  <div class="h-right"><div class="h-title">DARING COMICS</div><div class="h-sub">${_kick}</div></div>
</div>
<div class="meta">
  <div class="meta-box"><div class="meta-l">Refresh</div><div class="meta-v">${ch.refresh}</div></div>
  <div class="meta-box"><div class="meta-l">Fate Points</div><div class="meta-v">${ch.fatePoints}</div></div>
  <div class="meta-box"><div class="meta-l">Tone</div><div class="meta-v" style="font-size:9pt">${e(tone?.name||'')}</div></div>
  <div class="meta-box"><div class="meta-l">Level</div><div class="meta-v" style="font-size:9pt">${e(level?.name||'')}</div></div>
  <div class="meta-box"><div class="meta-l">Experience</div><div class="meta-v" style="font-size:9pt">${e(exp?.name||'')}</div></div>
</div>
<div class="body">
  <div class="col">
    <div class="sec"><div class="sec-t">Aspects</div>${aspHtml}</div>
    <div class="sec"><div class="sec-t">Skills</div>${skillsHtml}</div>
    <div class="sec"><div class="sec-t">Stress</div>
      <div class="stress-row"><div class="stress-l">Physical</div>${stressBoxes((ch.stress.physical||[]).concat(ch.hardStress||[]))}</div>
      <div class="stress-row"><div class="stress-l">Mental</div>${stressBoxes(ch.stress.mental)}</div>
    </div>
    <div class="sec"><div class="sec-t">Consequences</div>${consHtml}</div>
    ${castHtml?`<div class="sec"><div class="sec-t">Supporting Cast</div>${castHtml}</div>`:''}
    ${rogueHtml?`<div class="sec"><div class="sec-t">Rogues Gallery</div>${rogueHtml}</div>`:''}
  </div>
  <div class="col">
    ${powHtml?`<div class="sec"><div class="sec-t">Power Sets</div>${powHtml}</div>`:''}
    ${stuntHtml?`<div class="sec"><div class="sec-t">Stunts</div>${stuntHtml}</div>`:''}
    <div class="sec"><div class="sec-t">Gear &amp; Notes</div><div class="gear">${e(ch.gear||'')}</div></div>
  </div>
</div>
</section>`;
}

function printCharSheet(){
  const ch=S.char;if(!ch)return;
  const nm=String(ch.costumedName||'Hero').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  dcOpenPrintDoc(nm+' \u2014 Daring Comics',sheetBodyHTML(ch,{}),{autoPrint:true});
}

// ═══════════════════════════════════════════════════════════
// PRINT CENTRE  (desktop only — see #nb-print in the stylesheet)
// ═══════════════════════════════════════════════════════════
// Pick anything you've made — heroes, the team, rogues, cast, goons, region
// maps, the issue log — and collate it into one paper document for table play.
// Wiki/lore entries are deliberately excluded; they're reference, not play aids.
//
// A selection is an ordered list of {k,id,d}: category key, item id, density.
// Density decides the layout class, and consecutive items sharing a layout are
// packed onto shared pages (2 halves, 4 cards, 8 strips) without losing order.

const PR_DENS={full:{label:'Full page',per:1},half:{label:'Half page',per:2},card:{label:'Quarter card',per:4},strip:{label:'Stat strip',per:8},flow:{label:'Flowed text',per:1},table:{label:'Table',per:1}};
let _prSel=null,_prOpts=null,_prDragFrom=null;

function prLoadPrefs(){
  if(_prSel)return;
  try{const p=JSON.parse(localStorage.getItem('dc_print_prefs'))||{};
    _prSel=Array.isArray(p.items)?p.items:[];
    _prOpts=Object.assign({toc:true,guides:true,ink:false,paper:'letter'},p.opts||{});
  }catch(e){_prSel=[];_prOpts={toc:true,guides:true,ink:false,paper:'letter'};}
}
function prSavePrefs(){try{localStorage.setItem('dc_print_prefs',JSON.stringify({items:_prSel,opts:_prOpts}));}catch(e){}}

// ─── what's available to print ───────────────────────────────────────────
// Each category yields {key,label,hint,dens[],def,items[{id,name,sub,tag}]}.
function prCatalog(){
  const cats=[],np=S.npcs||[];
  const mine=n=>!n.fromHero;
  const heroDens=['full','half','card'];
  if(S.char)cats.push({key:'hero',label:'Hero',hint:'The hero in this save slot',dens:heroDens,def:'full',
    // sysCharName reads whichever identity field the pack declares, so a
    // crawler stops printing as "Unnamed Hero".
    items:[{id:'@self',name:(typeof sysCharName==='function'&&sysCharName(S.char))||S.char.costumedName||('Unnamed '+(typeof lexU==='function'?lexU('hero'):'Hero')),sub:S.char.civilianName||''}]});
  // Heroes parked in other save slots bound to the same universe
  const others=(S.universeId?listSaves(S.universeId):listSaves()).filter(s=>s.started&&s.id!==currentSaveId);
  if(others.length)cats.push({key:'slot',label:'Other heroes',hint:'Other save slots in this universe — printed with their own tone',dens:heroDens,def:'full',
    items:others.map(s=>({id:s.id,name:s.name||'Unnamed Hero',sub:s.civilianName||''}))});
  // Multiplayer: teammates' heroes mirrored into the roster
  const players=np.filter(n=>n.fromHero&&!(S.char&&n.heroId===S.char.heroId));
  if(players.length)cats.push({key:'player',label:'Player heroes',hint:'Mirrored from other players at your table',dens:heroDens,def:'full',
    items:players.map(n=>({id:n.id,name:n.name,sub:n.desc||''}))});
  if(S.team){const it=[{id:'@team',name:S.team.name||'Super Team',sub:S.team.charter||''}];
    if(S.team.expanded)it.push({id:'@expanded',name:(S.team.name||'Team')+' — Expanded Roster',sub:'Peripheral-adventure statblock'});
    cats.push({key:'team',label:'Super team',hint:'Charter, friction, stunts and complications',dens:['full'],def:'full',items:it});}
  const grp=(t,label,hint,dens,def)=>{const l=np.filter(n=>n.type===t&&mine(n));
    if(l.length)cats.push({key:t,label,hint,dens,def,items:l.map(n=>({id:n.id,name:n.name,sub:n.desc||'',tag:t==='nameless'?('Obstacle '+(n.obstacle||'+0')):''}))});};
  grp('main','Main NPCs','Built like heroes — full sheets',heroDens,'full');
  grp('rogue','Rogues / villains','Half a page each, two to a sheet',['half','full','card'],'half');
  grp('supporting','Supporting cast','Four index cards to a sheet',['card','half','full'],'card');
  grp('nameless','Nameless goons','Eight stat strips to a sheet',['strip','card'],'strip');
  const regs=[];
  (S.regions||[]).forEach((r,ri)=>{regs.push({id:'r'+ri,name:r.name||('Region '+(ri+1)),sub:'5×5 region map'});
    (r.cells||[]).forEach((c,ci)=>{if(c.subZone)regs.push({id:'r'+ri+'z'+ci,name:c.subZone.name||c.name||('Area '+(ci+1)),sub:'Sub-zone of '+(r.name||'region')});});});
  if(regs.length)cats.push({key:'region',label:'Region maps',hint:'Grid plus a key of every named location',dens:['full','half'],def:'full',items:regs});
  const iss=parseIssues(S.notes||[]);
  const withEntries=iss.map((g,i)=>({g,i})).filter(x=>x.g.entries.length);
  if(withEntries.length)cats.push({key:'log',label:'Issue log',hint:'Your campaign log, one section per issue',dens:['flow'],def:'flow',
    items:withEntries.map(x=>({id:'i'+x.i,name:x.g.label,sub:x.g.entries.length+' entr'+(x.g.entries.length===1?'y':'ies')}))});
  cats.push({key:'ref',label:'Reference',hint:'Built from whatever else you selected',dens:['table'],def:'table',
    items:[{id:'@gear',name:'Gear table',sub:'Every item carried by the sheets in this document'},
           {id:'@blank',name:'Blank notes page',sub:'Ruled page for session notes'}]});
  return cats;
}
function prFindCat(cats,k){return cats.find(c=>c.key===k);}
function prItemName(cats,s){const c=prFindCat(cats,s.k);const it=c&&c.items.find(i=>i.id===s.id);return it?it.name:null;}
function prSelIdx(k,id){prLoadPrefs();return _prSel.findIndex(s=>s.k===k&&s.id===id);}

// ─── selection mutators ──────────────────────────────────────────────────
function prToggle(k,id,def){prLoadPrefs();const i=prSelIdx(k,id);
  if(i>=0)_prSel.splice(i,1);else _prSel.push({k,id,d:def});prSavePrefs();renderPrintCentre();}
function prSetDens(k,id,d){const i=prSelIdx(k,id);if(i>=0)_prSel[i].d=d;prSavePrefs();renderPrintCentre();}
function prCatAll(k,on){prLoadPrefs();const c=prFindCat(prCatalog(),k);if(!c)return;
  if(!on){_prSel=_prSel.filter(s=>s.k!==k);}
  else c.items.forEach(it=>{if(prSelIdx(k,it.id)<0)_prSel.push({k,id:it.id,d:c.def});});
  prSavePrefs();renderPrintCentre();}
function prSelectAll(){prLoadPrefs();_prSel=[];prCatalog().forEach(c=>{if(c.key==='ref')return;
  c.items.forEach(it=>_prSel.push({k:c.key,id:it.id,d:c.def}));});prSavePrefs();renderPrintCentre();}
function prClear(){_prSel=[];prSavePrefs();renderPrintCentre();}
function prMove(i,d){prLoadPrefs();const j=i+d;if(j<0||j>=_prSel.length)return;
  const it=_prSel.splice(i,1)[0];_prSel.splice(j,0,it);prSavePrefs();renderPrintCentre();}
function prRemove(i){prLoadPrefs();_prSel.splice(i,1);prSavePrefs();renderPrintCentre();}
function prOpt(name,v){prLoadPrefs();_prOpts[name]=v;prSavePrefs();renderPrintCentre();}
// Drag-reorder of the assembled list (same handler shape as the log reorder)
function prDS(e,i){_prDragFrom=i;e.dataTransfer.effectAllowed='move';e.currentTarget.style.opacity='.4';}
function prDO(e){e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.classList.add('pr-over');}
function prDL(e){e.currentTarget.classList.remove('pr-over');}
function prDD(e,t){e.preventDefault();e.currentTarget.classList.remove('pr-over');
  const s=_prDragFrom;_prDragFrom=null;if(s==null||s===t)return;
  prLoadPrefs();const it=_prSel.splice(s,1)[0];_prSel.splice(s<t?t-1:t,0,it);prSavePrefs();renderPrintCentre();}

// Runs of consecutive same-layout items share pages, so the estimate has to walk
// the list in order rather than just totalling per-item fractions.
function prPageCount(){prLoadPrefs();const runs=prRuns();let n=_prOpts.toc?1:0;
  runs.forEach(r=>{const per=(PR_DENS[r.d]||PR_DENS.full).per;n+=Math.ceil(r.items.length/per);});return n;}
function prRuns(){prLoadPrefs();const runs=[];
  _prSel.forEach(s=>{const last=runs[runs.length-1];
    if(last&&last.d===s.d&&s.d!=='full'&&s.d!=='flow'&&s.d!=='table')last.items.push(s);
    else runs.push({d:s.d,items:[s]});});
  return runs;}

// ─── the picker page ─────────────────────────────────────────────────────
function renderPrintCentre(){
  const el=document.getElementById('print-content');if(!el)return;
  prLoadPrefs();
  if(window.matchMedia&&!window.matchMedia('(min-width:700px)').matches){
    el.innerHTML=`<div class="card tac"><div class="pg-title" style="font-size:18px">Desktop only</div><div class="pg-sub">The print centre needs a wider screen — open the app on a computer to collate sheets.</div></div>`;return;}
  const cats=prCatalog();
  // prune selections whose source is gone (deleted NPC, disbanded team, …)
  const before=_prSel.length;
  _prSel=_prSel.filter(s=>prItemName(cats,s)!==null);
  if(_prSel.length!==before)prSavePrefs();

  let h=`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:4px"><div><div class="pg-title">Print</div><div class="pg-sub">Collate sheets for in-person play</div></div><div style="display:flex;gap:6px"><button class="btn btn-secondary btn-xs" onclick="prSelectAll()">Select everything</button><button class="btn btn-secondary btn-xs" onclick="prClear()">Clear</button></div></div>`;
  h+=`<div class="pr-wrap">`;

  // ── left: catalogue ──
  h+=`<div class="pr-col">`;
  if(!cats.length)h+=`<div class="card tac text-muted">Nothing to print yet — make a hero, some NPCs or a map first.</div>`;
  cats.forEach(c=>{
    const chosen=c.items.filter(it=>prSelIdx(c.key,it.id)>=0).length;
    h+=`<div class="card" style="padding:11px">`;
    h+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px"><div class="label" style="margin:0;flex:1">${esc(c.label)} <span class="text-muted" style="font-weight:400">${chosen}/${c.items.length}</span></div>`;
    h+=`<button class="btn btn-secondary btn-xs" onclick="prCatAll('${c.key}',${chosen<c.items.length})">${chosen<c.items.length?'All':'None'}</button></div>`;
    h+=`<div style="font-size:10px;color:var(--muted);margin-bottom:7px">${esc(c.hint)}</div>`;
    c.items.forEach(it=>{
      const si=prSelIdx(c.key,it.id),on=si>=0;
      h+=`<div class="pr-item${on?' on':''}">`;
      h+=`<label style="display:flex;gap:8px;align-items:flex-start;flex:1;cursor:pointer;min-width:0"><input type="checkbox" ${on?'checked':''} onchange="prToggle('${c.key}','${it.id}','${c.def}')" style="margin-top:2px">`;
      h+=`<div style="min-width:0"><div class="fw-700" style="font-size:13px">${esc(it.name)}</div>`;
      if(it.sub)h+=`<div style="font-size:11px;color:var(--muted)">${esc(it.sub)}</div>`;
      if(it.tag)h+=`<div style="font-size:10px;color:var(--accent)">${esc(it.tag)}</div>`;
      h+=`</div></label>`;
      if(on&&c.dens.length>1){
        h+=`<select onchange="prSetDens('${c.key}','${it.id}',this.value)" style="flex:0 0 auto;font-size:11px;padding:3px 5px">`;
        c.dens.forEach(d=>{h+=`<option value="${d}" ${_prSel[si].d===d?'selected':''}>${PR_DENS[d].label}</option>`;});
        h+=`</select>`;
      }
      h+=`</div>`;
    });
    h+=`</div>`;
  });
  h+=`</div>`;

  // ── right: assembled document ──
  h+=`<div class="pr-col pr-doc">`;
  h+=`<div class="card" style="padding:11px"><div class="label mb-1">Document <span class="text-muted" style="font-weight:400">${_prSel.length} item${_prSel.length===1?'':'s'} · ≈${prPageCount()} page${prPageCount()===1?'':'s'}</span></div>`;
  if(!_prSel.length)h+=`<div style="font-size:11px;color:var(--muted);padding:14px 0;text-align:center;border:1px dashed var(--border);border-radius:var(--radius-card)">Tick things on the left. Drag to reorder them here.</div>`;
  _prSel.forEach((s,i)=>{
    const nm=prItemName(cats,s)||'—';
    h+=`<div class="pr-row" draggable="true" ondragstart="prDS(event,${i})" ondragend="this.style.opacity=''" ondragover="prDO(event)" ondragleave="prDL(event)" ondrop="prDD(event,${i})">`;
    h+=`<span class="pr-grip">⋮⋮</span><div style="flex:1;min-width:0"><div class="fw-700" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(nm)}</div><div style="font-size:10px;color:var(--muted)">${PR_DENS[s.d]?PR_DENS[s.d].label:s.d}</div></div>`;
    h+=`<button class="btn btn-secondary btn-xs" onclick="prMove(${i},-1)" ${i===0?'disabled':''}>↑</button><button class="btn btn-secondary btn-xs" onclick="prMove(${i},1)" ${i===_prSel.length-1?'disabled':''}>↓</button><button class="btn btn-danger btn-xs" onclick="prRemove(${i})">✕</button></div>`;
  });
  h+=`</div>`;
  h+=`<div class="card" style="padding:11px"><div class="label mb-1">Paper</div>`;
  h+=`<label class="pr-opt"><input type="checkbox" ${_prOpts.toc?'checked':''} onchange="prOpt('toc',this.checked)"> Contents page</label>`;
  h+=`<label class="pr-opt"><input type="checkbox" ${_prOpts.guides?'checked':''} onchange="prOpt('guides',this.checked)"> Cut guides on card sheets</label>`;
  h+=`<label class="pr-opt"><input type="checkbox" ${_prOpts.ink?'checked':''} onchange="prOpt('ink',this.checked)"> Ink saver</label>`;
  h+=`<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span style="font-size:11px;color:var(--muted)">Size</span><select onchange="prOpt('paper',this.value)" style="font-size:11px;padding:3px 5px"><option value="letter" ${_prOpts.paper==='letter'?'selected':''}>Letter</option><option value="a4" ${_prOpts.paper==='a4'?'selected':''}>A4</option></select></div>`;
  h+=`<div style="font-size:10px;color:var(--muted);margin-top:6px">All four can also be flipped in the preview window before you print.</div></div>`;
  h+=`<button class="btn btn-primary btn-full" ${_prSel.length?'':'disabled'} onclick="prOpenDoc()">🖨 Open print preview</button>`;
  h+=`</div></div>`;
  el.innerHTML=h;
}

// ─── page builders ───────────────────────────────────────────────────────
function prE(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function prBoxes(n){let o='';for(let i=0;i<n;i++)o+=`<span class="sb">${i+1}</span>`;return o;}
function prRules(n){let o='';for(let i=0;i<n;i++)o+='<span class="rule"></span>';return o;}
// ─── printing a block-based pack ────────────────────────────────────────────
// Everything else in this file is Daring Comics' sheet: Aspects, Stress,
// Consequences, the Fate ladder. A pack that builds its character from blocks
// has none of that, and printing one threw on the first Daring Comics global it
// reached ("SKILLS is not defined"), so the preview came out empty and the game
// had no way to print a character at all.
//
// This renders from the pack's own schema, so it serves any block pack rather
// than being a second hard-coded layout.
function prBlockRows(block, ctx) {
  const d = ctx.data || {};
  const rows = [];
  const val = spec => blockValue(spec, ctx, null);
  if (block.type === 'traitGrid') {
    (block.traits || []).forEach(function (tr) {
      const cell = d[tr.id] || {};
      const base = cell.base || 0, bonus = cell.bonus || 0;
      const modFn = sysDerive(block.mod);
      const mod = modFn ? modFn(base + bonus, ctx) : null;
      rows.push([tr.name || tr.id,
                 block.layers ? (base + ' / ' + (base + bonus)) : String(base),
                 mod === null ? '' : (mod >= 0 ? '+' + mod : String(mod))]);
    });
  } else if (block.type === 'track') {
    const slots = val(block.slots) || 0;
    const each = val(block.slotValue);
    const marked = d.marked || 0;
    rows.push(['Slots', slots + (each ? ' x ' + each : ''), (slots - marked) + ' left']);
  } else if (block.type === 'pool') {
    const max = block.max === undefined ? null : val(block.max);
    rows.push([block.label || block.id, (d.current || 0) + (max === null ? '' : ' / ' + max), '']);
  } else if (block.type === 'readout') {
    (block.items || []).forEach(function (it) {
      rows.push([it.label, String(blockValue(it.value, ctx, '')), '']);
    });
  } else if (block.type === 'skillList') {
    (d.skills || []).slice().sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); })
      .forEach(function (sk) { rows.push([sk.name, 'Rank ' + (sk.rank || 0), sk.stat || '']); });
  } else if (block.type === 'inventory') {
    (block.containers || []).forEach(function (cn) {
      // A 'slots' container is an object of slot-name -> array of items, so it
      // needs flattening; a 'stack' or 'list' is already a flat array. Mapping
      // the object's values straight out produced one empty string per empty
      // slot, which printed as a row of bare commas.
      const held = d[cn.id];
      let items = [];
      if (Array.isArray(held)) items = held;
      else if (held && typeof held === 'object') {
        Object.keys(held).forEach(function (k) {
          const v = held[k];
          if (Array.isArray(v)) items = items.concat(v);
          else if (v) items.push(v);
        });
      }
      const listed = items.filter(Boolean).map(function (i) {
        return (i && i.name ? i.name : String(i)) + (i && i.qty > 1 ? ' x' + i.qty : '');
      }).filter(function (n) { return n.trim(); }).join(', ');
      rows.push([cn.label || cn.id, listed || '-', '']);
    });
    (block.counters || []).forEach(function (ct) {
      rows.push([ct.label || ct.id, String((d.counters && d.counters[ct.id]) || 0), '']);
    });
  } else if (block.type === 'entityList') {
    (d.entries || []).forEach(function (e) {
      const read = sysDerive(block.readout);
      const line = read ? (read(ctx.char, e) || []).join(' - ') : '';
      rows.push([e.name || '-', e.kind || '', line]);
    });
  }
  return rows;
}


// ─── what you are carrying ──────────────────────────────────────────────────
// Worn gear and the Hotlist each get a page. On the crawler sheet they are the
// two things you actually reach for mid-fight, and a comma-separated line in
// the corner of page one does not survive contact with a table.
function prCarriedRow(item, extra) {
  const line = (typeof invReadout === 'function')
    ? invReadout(sysBlock('gear') || {}, item, S.char) : '';
  return '<tr><td class="pr-w">' + prE(extra || '') + '</td>' +
    '<td>' + prE(item && item.name ? item.name : '—') +
    (item && item.qty > 1 ? ' <span class="pr-q">×' + item.qty + '</span>' : '') +
    (line ? '<div class="pr-sub">' + prE(line) + '</div>' : '') +
    '</td><td class="pr-box"></td></tr>';
}

function prCarriedPages(char, name, kick) {
  // Floor and Level identify a loose page face-down on a table; the sheet's own
  // name is already the heading, so it does not need repeating in the kicker.
  const marks = (kick.indexOf('·') >= 0) ? kick.slice(kick.indexOf('·') - 1) : '';
  const block = (SYS.schema && SYS.schema.blocks || []).filter(function (b) {
    return b.type === 'inventory';
  })[0];
  if (!block) return '';
  const d = (char.blocks && char.blocks[block.id]) || {};
  let out = '';

  // ── worn and held ─────────────────────────────────────────────────────────
  const slots = (block.containers || []).filter(function (c) { return c.kind === 'slots'; });
  if (slots.length) {
    let h = '<table class="pr-t pr-gear"><thead><tr><th>Slot</th><th>Item</th><th class="pr-box">Used</th></tr></thead><tbody>';
    slots.forEach(function (c) {
      (c.slots || []).forEach(function (sl) {
        const items = ((d[c.id] || {})[sl.id]) || [];
        if (!items.length) {
          h += '<tr><td class="pr-w">' + prE(sl.name) + '</td><td class="pr-empty"></td><td class="pr-box"></td></tr>';
          return;
        }
        items.forEach(function (it, n) {
          h += prCarriedRow(it, n === 0 ? sl.name : '');
        });
      });
    });
    h += '</tbody></table>';
    // Damage Resistance is the number this page exists to answer.
    const dr = sysDerive('derive.dr');
    if (dr) {
      let n = 0;
      try { n = dr(char) || 0; } catch (e) { n = 0; }
      h += '<div class="pr-tot">Damage Resistance <strong>' + prE(String(n)) + '</strong>' +
           '<span class="pr-note-sm">only what is in a slot counts</span></div>';
    }
    out += prPage(name, 'WORN AND HELD' + marks, h);
  }

  // ── the Hotlist, and everything else ──────────────────────────────────────
  (block.containers || []).filter(function (c) { return c.kind !== 'slots'; }).forEach(function (c) {
    const items = d[c.id] || [];
    const size = c.kind === 'stack' ? (c.size || 10) : Math.max(items.length + 6, 12);
    let h = '';
    if (c.note) h += '<div class="pr-note">' + prE(c.note) + '</div>';
    h += '<table class="pr-t pr-gear"><thead><tr><th class="pr-w">#</th><th>Item</th><th class="pr-box">Used</th></tr></thead><tbody>';
    for (let i = 0; i < size; i++) {
      const it = items[i];
      // Empty rows are deliberate: this is a sheet you write on.
      h += it ? prCarriedRow(it, String(i + 1))
              : '<tr><td class="pr-w">' + (i + 1) + '</td><td class="pr-empty"></td><td class="pr-box"></td></tr>';
    }
    h += '</tbody></table>';
    if ((block.counters || []).length && c.kind !== 'stack') {
      h += '<div class="pr-tot">' + block.counters.map(function (ct) {
        return prE(ct.label || ct.id) + ' <strong>' + prE(String((d.counters || {})[ct.id] || 0)) + '</strong>';
      }).join('  ') + '</div>';
    }
    out += prPage(name, String(c.label || c.id).toUpperCase() + marks, h);
  });
  return out;
}

function prBlockSheetHTML(char, opts) {
  opts = opts || {};
  const ids = (SYS.schema && SYS.schema.identity) || [];
  const LABELS = { name: 'Name', crawlerNumber: 'Crawler Number', race: 'Race', class: 'Class', level: 'Level' };
  const name = (typeof sysCharName === 'function' && sysCharName(char)) || 'Unnamed';
  let h = '<div class="pr-id">';
  ids.forEach(function (f) {
    const v = char[f];
    h += '<div class="pr-id-f"><span class="pr-id-l">' + prE(LABELS[f] || f) + '</span> ' +
         '<span class="pr-id-v">' + prE(v === undefined || v === null || v === '' ? '-' : String(v)) + '</span></div>';
  });
  h += '</div>';
  if (typeof SYS.sheetExtra === 'function') {
    try {
      const extra = SYS.sheetExtra(char) || '';
      // The pack's prose is already HTML-escaped, so decode it before prE puts
      // it back — otherwise "Race &amp; Class" prints as "Race &amp;amp; Class".
      const text = extra.replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ').trim();
      if (text) h += '<div class="pr-note">' + prE(text) + '</div>';
    } catch (e) { /* prose is optional; never let it stop the sheet */ }
  }
  h += '<div class="pr-cols">';
  // Inventory gets pages of its own: squeezed into a column of this one it
  // printed as a run-on comma list with none of the mechanics, which is no use
  // at a table.
  ((SYS.schema && SYS.schema.blocks) || []).filter(function (b) {
    return b.type !== 'inventory';
  }).forEach(function (b) {
    let rows;
    try { rows = prBlockRows(b, blockCtx(b, char)); }
    catch (e) { rows = [['-', 'could not be printed', '']]; }
    if (!rows.length) return;
    // Not every block declares a label; an id is a poor heading, so tidy it.
    const heading = b.label || String(b.id).replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); });
    h += '<div class="pr-blk"><div class="pr-blk-t">' + prE(heading) + '</div><table class="pr-t">';
    rows.forEach(function (r) {
      h += '<tr><td>' + prE(r[0]) + '</td><td class="pr-n">' + prE(r[1]) + '</td><td class="pr-n">' + prE(r[2]) + '</td></tr>';
    });
    h += '</table></div>';
  });
  h += '</div>';
  let kick = opts.kicker || String(typeof lexU === 'function' ? lexU('sheet') : 'Character Sheet').toUpperCase();
  // Floor and Level go in the kicker: a sheet has to be identifiable at a
  // glance across a table, and those two answer "whose turn is this".
  const marks = [];
  if (char.floor !== undefined && char.floor !== null) {
    marks.push(String(typeof lexU === 'function' ? lexU('logBreak') : 'Floor') + ' ' + char.floor);
  }
  if (char.level !== undefined && char.level !== null && char.level !== '') marks.push('Level ' + char.level);
  if (marks.length) kick += ' · ' + marks.join(' · ');
  // The sheet, then a page for what you are carrying, then the Hotlist.
  return prPage(name, kick, h) + prCarriedPages(char, name, kick);
}

function prPage(title,kicker,body){return `<section class="pg"><div class="pg-h"><div class="pg-h-t">${prE(title)}</div><div class="pg-h-s">${prE(kicker||'Daring Comics')}</div></div>${body}</section>`;}

// A character-shaped object as a quarter-page index card.
function prCharCard(ch,role){
  const sk=SKILLS.filter(s=>(ch.skills&&ch.skills[s])>0).sort((a,b)=>ch.skills[b]-ch.skills[a]).slice(0,5);
  const asp=[ch.aspects&&ch.aspects.concept,ch.aspects&&ch.aspects.motivation].filter(Boolean);
  const pw=[];(ch.forms||[]).forEach(f=>(f.powerSets||[]).forEach(ps=>(ps.powers||[]).forEach(p=>{
    const pd=POWERS.find(x=>x.id===p.powerId);pw.push((p.customName||(pd&&pd.name)||p.name||'Power')+(p.level>1?' Lv'+p.level:''));})));
  const nPhys=((ch.stress&&ch.stress.physical)||[]).length+((ch.hardStress||[]).length),nMent=((ch.stress&&ch.stress.mental)||[]).length;
  let h=`<div class="card4"><div class="c4-n">${prE(ch.costumedName)}</div><div class="c4-r">${prE(role||'')}${ch.civilianName?' · '+prE(ch.civilianName):''}</div>`;
  if(asp.length)h+=`<div class="c4-d">${asp.map(prE).join(' · ')}</div>`;
  if(sk.length)h+=`<div class="c4-l">Skills</div><div class="c4-v">${sk.map(s=>prE(s)+' +'+ch.skills[s]).join(', ')}</div>`;
  if(pw.length)h+=`<div class="c4-l">Powers</div><div class="c4-v">${pw.slice(0,6).map(prE).join(', ')}${pw.length>6?' …':''}</div>`;
  if((ch.stunts||[]).length)h+=`<div class="c4-l">Stunts</div><div class="c4-v">${ch.stunts.map(s=>prE(s.name)).join(', ')}</div>`;
  h+=`<div class="c4-l">Stress</div><div class="c4-v">P ${prBoxes(nPhys||3)} &nbsp; M ${prBoxes(nMent||3)}</div>`;
  h+=`<div class="c4-l">Notes</div>${prRules(2)}</div>`;
  return h;
}
// A raw roster NPC as a quarter-page index card (cast and goons never get built
// out in the full builder, so this reads the stored fields directly).
function prNpcCard(n){
  const role=NPC_TYPE_LABELS[n.type]||'NPC';
  const sk=Object.entries(n.skills||{}).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,5);
  let h=`<div class="card4"><div class="c4-n">${prE(n.name)}</div><div class="c4-r">${prE(role)}${n.obstacle?' · Obstacle '+prE(n.obstacle):''}</div>`;
  if(n.desc)h+=`<div class="c4-d">${prE(n.desc)}</div>`;
  if((n.aspects||[]).length)h+=`<div class="c4-l">Aspects</div><div class="c4-v">${n.aspects.map(prE).join(' · ')}</div>`;
  if(sk.length)h+=`<div class="c4-l">Skills</div><div class="c4-v">${sk.map(x=>prE(x[0])+' +'+x[1]).join(', ')}</div>`;
  else if(n.skillText)h+=`<div class="c4-l">Skills</div><div class="c4-v">${prE(n.skillText)}</div>`;
  if(n.powers)h+=`<div class="c4-l">Powers</div><div class="c4-v">${prE(n.powers)}</div>`;
  h+=`<div class="c4-l">Stress</div><div class="c4-v">${prBoxes((n.stress||[]).length||2)}</div>`;
  h+=`<div class="c4-l">Notes</div>${prRules(2)}</div>`;
  return h;
}
function prNpcStrip(n){
  const sk=Object.entries(n.skills||{}).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4)
    .map(x=>prE(x[0])+' +'+x[1]).join(', ');
  const bits=[sk||prE(n.skillText||''),prE(n.desc||''),prE(n.powers||'')].filter(Boolean).join(' — ');
  return `<div class="strip"><div class="strip-n">${prE(n.name)}</div><div class="strip-o">${prE(n.obstacle||'+0')}</div><div class="strip-d">${bits||'&nbsp;'}</div><div class="strip-s">${prBoxes((n.stress||[]).length||2)}</div></div>`;
}
// Team sheet — the charter block, plus the expanded roster as its own statblock.
function prTeamHTML(which){
  const t=S.team;if(!t)return'';
  const{tone}=getSeriesConfig();
  if(which==='@team'){
    const mx=(S.char?1:0)+(t.rogues||[]).length;
    let l='',r='';
    l+=`<div class="sec"><div class="sec-t">Charter</div><div class="asp">${prE(t.charter)||'<span class="con-line"></span>'}</div></div>`;
    l+=`<div class="sec"><div class="sec-t">Friction</div><div class="asp">${prE(t.friction)||'<span class="con-line"></span>'}</div></div>`;
    l+=`<div class="sec"><div class="sec-t">Team Rogues</div>`;
    if((t.rogues||[]).length)t.rogues.forEach(x=>{l+=`<div class="cast-item"><span class="cast-n">${prE(x.name)}</span><span class="cast-d">${prE(x.desc)}</span></div>`;});
    else l+=`<div class="c4-v">${prRules(3)}</div>`;
    l+=`</div>`;
    l+=`<div class="sec"><div class="sec-t">Roster</div>`;
    if(S.char)l+=`<div class="cast-item"><span class="cast-n">${prE(S.char.costumedName)}</span><span class="cast-d">${prE(S.char.civilianName||'')}</span></div>`;
    (S.npcs||[]).filter(n=>n.fromHero&&!(S.char&&n.heroId===S.char.heroId)).forEach(n=>{
      l+=`<div class="cast-item"><span class="cast-n">${prE(n.name)}</span><span class="cast-d">${prE(n.desc||'')}</span></div>`;});
    l+=`</div>`;
    r+=`<div class="sec"><div class="sec-t">Team Stunts (${(t.stunts||[]).length}/${mx})</div>`;
    (t.stunts||[]).forEach(id=>{const d=TEAM_STUNTS.find(x=>x.id===id);if(d)r+=`<div class="st-item"><span class="st-n">${prE(d.name)}</span><div class="st-d">${prE(d.desc)}</div></div>`;});
    if(!(t.stunts||[]).length)r+=`<div class="c4-v">${prRules(2)}</div>`;
    r+=`</div><div class="sec"><div class="sec-t">Complications</div>`;
    (t.complications||[]).forEach(id=>{const d=TEAM_COMPLICATIONS.find(x=>x.id===id);if(d)r+=`<div class="st-item"><span class="st-n">${prE(d.name)}</span><div class="st-d">${prE(d.desc)}</div></div>`;});
    if(!(t.complications||[]).length)r+=`<div class="c4-v">—</div>`;
    r+=`</div>`;
    return `<section class="sheet"><div class="hdr"><div><div class="h-name">${prE(t.name)}</div><div class="h-civ">Super Team</div></div><div class="h-right"><div class="h-title">DARING COMICS</div><div class="h-sub">TEAM SHEET</div></div></div><div class="body"><div class="col">${l}</div><div class="col">${r}</div></div></section>`;
  }
  const ex=t.expanded;if(!ex)return'';
  const smax=tone?2+tone.stressBonus:4;
  const exSk=['Combat','Expertise','Social','Undercover'];
  let l=`<div class="sec"><div class="sec-t">Aspects</div><div class="asp">${prE(ex.aspect1)||'<span class="con-line"></span>'}</div><div class="asp">${prE(ex.aspect2)||'<span class="con-line"></span>'}</div></div>`;
  l+=`<div class="sec"><div class="sec-t">Team Skills</div>`;
  exSk.forEach(s=>{const v=(ex.skills||{})[s]||0;l+=`<div class="sk-item">${s} <span class="pw-lv">+${v}</span><span class="sk-desc">${prE(ladderName(v))}</span></div>`;});
  l+=`</div><div class="sec"><div class="sec-t">Stress</div><div class="stress-row"><div class="stress-l">Physical</div>${prBoxes(smax)}</div><div class="stress-row"><div class="stress-l">Mental</div>${prBoxes(smax)}</div></div>`;
  l+=`<div class="sec"><div class="sec-t">Consequences</div>`;
  [['mild','Mild (2)'],['moderate','Moderate (4)'],['severe','Severe (6)']].forEach(p=>{
    l+=`<div class="con-row"><span class="con-l">${p[1]}:</span><span class="con-v">${prE((ex.consequences||{})[p[0]])||'<span class="con-line"></span>'}</span></div>`;});
  l+=`</div>`;
  let r=`<div class="sec"><div class="sec-t">Stunts &amp; Powers</div>`;
  (ex.stunts||[]).forEach(s=>{r+=`<div class="st-item"><span class="st-n">${prE(s.name)}</span> <span class="pw-c">(${s.cost||0} HP)</span><div class="st-d">${prE(s.desc||'')}</div></div>`;});
  (ex.powers||[]).forEach(p=>{const pd=p.powerId?POWERS.find(x=>x.id===p.powerId):null;
    r+=`<div class="pw-item"><span class="pw-n">${prE(p.customName||(pd&&pd.name)||p.name||'Power')}</span>${p.level>1?' <span class="pw-lv">Lv'+p.level+'</span>':''} <span class="pw-c">(${p.totalCost||p.cost||0} HP)</span>${pd&&pd.desc?`<div class="pw-desc">${prE(pd.desc)}</div>`:(p.desc?`<div class="pw-desc">${prE(p.desc)}</div>`:'')}</div>`;});
  if(!(ex.stunts||[]).length&&!(ex.powers||[]).length)r+=`<div class="c4-v">${prRules(3)}</div>`;
  r+=`</div>`;
  return `<section class="sheet"><div class="hdr"><div><div class="h-name">${prE(t.name)}</div><div class="h-civ">Expanded Super Team</div></div><div class="h-right"><div class="h-title">DARING COMICS</div><div class="h-sub">TEAM STATBLOCK</div></div></div><div class="meta"><div class="meta-box"><div class="meta-l">Refresh</div><div class="meta-v">${(tone&&tone.refresh)||5}</div></div><div class="meta-box"><div class="meta-l">Fate Points</div><div class="meta-v">${ex.fp==null?((tone&&tone.refresh)||5):ex.fp}</div></div></div><div class="body"><div class="col">${l}</div><div class="col">${r}</div></div></section>`;
}
// Region / sub-zone map: the grid, then a key of every named cell.
function prMapHTML(id,half){
  const m=/^r(\d+)(?:z(\d+))?$/.exec(id);if(!m)return'';
  const reg=(S.regions||[])[+m[1]];if(!reg)return'';
  let cells,name,kicker,cur;
  if(m[2]!==undefined){const c=(reg.cells||[])[+m[2]];const sz=c&&c.subZone;if(!sz)return'';
    cells=sz.cells||[];name=sz.name||c.name||'Sub-zone';kicker='SUB-ZONE OF '+(reg.name||'').toUpperCase();
    cur=sz.currentCell;}
  else{cells=reg.cells||[];name=reg.name||'Region';kicker='REGION MAP';cur=reg.currentCell;}
  let g='<div class="map">';
  for(let i=0;i<25;i++){const c=cells[i]||{};
    let cls='mc';if(c.isVoid)cls+=' mc-void';else if(i===cur)cls+=' mc-cur';
    let ico='';
    if(c.icon)ico=isGiSlug(c.icon)
      ?`<img class="mc-i" src="${pdIconUrl(c.icon.indexOf(':')>=0?c.icon:'game-icons:'+c.icon)}">`
      :`<span style="font-size:19pt;line-height:1">${prE(c.icon)}</span>`;
    g+=`<div class="${cls}">${ico}${c.name?`<span class="mc-n">${prE(c.name)}</span>`:''}</div>`;}
  g+='</div>';
  let key='';
  cells.forEach((c,i)=>{if(!c||c.isVoid||(!c.name&&!c.notes&&!c.feature))return;
    key+=`<div><b>${i+1}. ${prE(c.name||'Unnamed')}</b>${c.feature?' — '+prE(c.feature):''}${c.notes?' · '+prE(c.notes):''}${c.subZone?' <span class="pw-c">[sub-zone]</span>':''}</div>`;});
  if(!key)key='<div class="text-muted">No locations named yet.</div>';
  const body=`${g}<div class="sec"><div class="sec-t">Key</div><div class="map-key">${key}</div></div>`;
  if(half)return `<section class="sheet sheet-half"><div class="hdr"><div><div class="h-name">${prE(name)}</div></div><div class="h-right"><div class="h-sub">${prE(kicker)}</div></div></div>${body}</section>`;
  return prPage(name,kicker,body);
}
function prLogHTML(id){
  const iss=parseIssues(S.notes||[]);const g=iss[+String(id).slice(1)];if(!g)return'';
  let b=`<div class="iss">${prE(g.label)}</div>`;
  g.entries.forEach(en=>{b+=`<div class="log-e"><div class="log-t">${prE(en.emoji||'')} ${prE(en.title||'Entry')}</div><div class="log-m">${prE((LOG_TYPES.find(t=>t.key===en.type)||{}).label||en.type||'')}${en.date?' · '+prE(en.date):''}</div>${en.body?`<div class="log-b">${prE(en.body)}</div>`:''}</div>`;});
  return b;
}
// Gear table, built from every character sheet in the assembled document.
function prGearHTML(chars){
  const rows=[];
  chars.forEach(c=>{(c.ch.forms||[]).forEach(f=>{(f.gear||[]).forEach(it=>{
    const g=it.custom?null:GEAR.find(x=>x.id===it.gearId);
    rows.push({who:c.name,form:(c.ch.forms||[]).length>1?(f.name||''):'',
      name:it.customName||(g?g.name:(it.name||'Item')),cat:g?g.cat:(it.cat||''),
      stat:g?(g.cat==='Armor'?'Armor '+g.armor:(g.rating!==undefined?'Weapon '+g.rating+(g.range!==undefined?' · Range '+g.range:''):'')):'',
      special:(g?g.special:it.special)||[]});});});});
  if(!rows.length)return prPage('Gear','REFERENCE','<div class="map-key text-muted">None of the selected sheets carry gear.</div>');
  rows.sort((a,b)=>a.who.localeCompare(b.who)||a.name.localeCompare(b.name));
  let t=`<table class="gt"><tr><th>Carried by</th><th>Item</th><th>Type</th><th>Rating</th><th>Special</th></tr>`;
  rows.forEach(r=>{t+=`<tr><td>${prE(r.who)}${r.form?' <span class="pw-c">('+prE(r.form)+')</span>':''}</td><td class="gear-n">${prE(r.name)}</td><td>${prE(r.cat)}</td><td class="gear-stat">${prE(r.stat)}</td><td class="gear-special">${prE(r.special.join(', '))}</td></tr>`;});
  t+='</table>';
  return prPage('Gear','REFERENCE',t);
}
function prBlankHTML(){return prPage('Session Notes','','<div class="map-key">'+prRules(30)+'</div>');}

// Resolve one selection entry into the character object a sheet needs.
function prResolveChar(s){
  if(s.k==='hero')return S.char?{ch:S.char,series:null,role:'Hero'}:null;
  if(s.k==='slot'){const st=getSaveData(s.id);if(!st||!st.char)return null;
    const _ids=seriesIdsFor(st);
    return{ch:st.char,role:'Hero',series:{tone:SERIES_TONES.find(t=>t.id===_ids.tone),
      level:SERIES_LEVELS.find(l=>l.id===_ids.level),exp:EXP_LEVELS.find(e=>e.id===_ids.experience)}};}
  const n=(S.npcs||[]).find(x=>x.id===s.id);if(!n)return null;
  if(s.k==='player')return{ch:npcToCharacter(n),role:'Player hero',series:null};
  return{ch:npcToCharacter(n),role:NPC_TYPE_LABELS[n.type]||'NPC',series:null,npc:n};
}
function prRawNpc(s){return (S.npcs||[]).find(x=>x.id===s.id)||null;}

// ─── assemble & open ─────────────────────────────────────────────────────
function prBuildBody(){
  prLoadPrefs();
  const runs=prRuns(),toc=[];
  let out='';
  const noteTOC=(g,n)=>{toc.push({g,n});};
  // Resolved up front so the gear table is complete wherever it sits in the order.
  const chars=[];
  _prSel.forEach(s=>{if(s.k==='team'||s.k==='region'||s.k==='log'||s.k==='ref')return;
    if(s.k==='supporting'||s.k==='nameless')return;
    const r=prResolveChar(s);
    if(r)chars.push({name:(typeof sysCharName==='function'&&sysCharName(r.ch))||r.ch.costumedName||'Sheet',ch:r.ch});});
  runs.forEach(run=>{
    const d=run.d;
    if(d==='full'||d==='half'){
      let buf=[];
      run.items.forEach(s=>{
        let html='',title='';
        if(s.k==='team'){html=prTeamHTML(s.id);title=((S.team&&S.team.name)||'Team')+(s.id==='@expanded'?' — Expanded Roster':'');noteTOC('Team',title);}
        else if(s.k==='region'){html=prMapHTML(s.id,d==='half');const mm=/^r(\d+)(?:z(\d+))?$/.exec(s.id);
          const reg=(S.regions||[])[+mm[1]];title=mm[2]!==undefined?(((reg.cells||[])[+mm[2]]||{}).subZone||{}).name||'Sub-zone':(reg&&reg.name)||'Region';
          noteTOC('Maps',title);}
        else{const r=prResolveChar(s);if(!r)return;
          html=(typeof sysUsesBlocks==='function'&&sysUsesBlocks())
            ? prBlockSheetHTML(r.ch,{kicker:(r.role||'').toUpperCase()+' SHEET'})
            : sheetBodyHTML(r.ch,{series:r.series,half:d==='half',kicker:(r.role||'').toUpperCase()+' SHEET'});
          title=(typeof sysCharName==='function'&&sysCharName(r.ch))||r.ch.costumedName||'Sheet';
          noteTOC(r.role==='Hero'||r.role==='Player hero'?'Heroes':'NPCs',title);}
        if(!html)return;
        if(d==='full')out+=html;
        else{buf.push(html);if(buf.length===2){out+=`<section class="pg">${buf.join('')}</section>`;buf=[];}}
      });
      if(buf.length)out+=`<section class="pg">${buf.join('')}</section>`;
      return;
    }
    if(d==='card'){
      const cards=[];
      run.items.forEach(s=>{
        if(s.k==='supporting'||s.k==='nameless'){const n=prRawNpc(s);if(n){cards.push(prNpcCard(n));noteTOC('Cards',n.name);}return;}
        const r=prResolveChar(s);if(!r)return;
        const useBlocks=(typeof sysUsesBlocks==='function'&&sysUsesBlocks());
        cards.push(useBlocks?prBlockSheetHTML(r.ch,{kicker:'REFERENCE'}):prCharCard(r.ch,r.role));
        noteTOC('Cards',(typeof sysCharName==='function'&&sysCharName(r.ch))||r.ch.costumedName);});
      for(let i=0;i<cards.length;i+=4)out+=prPage(i===0?'Reference Cards':'Reference Cards (cont.)','CUT ALONG THE DASHED LINES','<div class="grid4">'+cards.slice(i,i+4).join('')+'</div>');
      return;
    }
    if(d==='strip'){
      const strips=[];
      run.items.forEach(s=>{const n=prRawNpc(s);if(n){strips.push(prNpcStrip(n));noteTOC('Goons',n.name);}});
      for(let i=0;i<strips.length;i+=8)out+=prPage(i===0?'Nameless Goons':'Nameless Goons (cont.)','OBSTACLE · STRESS',strips.slice(i,i+8).join(''));
      return;
    }
    if(d==='flow'){
      run.items.forEach(s=>{const b=prLogHTML(s.id);if(!b)return;
        const iss=parseIssues(S.notes||[])[+String(s.id).slice(1)];
        noteTOC('Issue log',iss?iss.label:'Issue');out+=prPage('Issue Log','CAMPAIGN RECORD',b);});
      return;
    }
    if(d==='table'){
      run.items.forEach(s=>{
        if(s.id==='@gear'){out+=prGearHTML(chars);noteTOC('Reference','Gear table');}
        else if(s.id==='@blank'){out+=prBlankHTML();noteTOC('Reference','Session notes');}});
      return;
    }
  });
  if(_prOpts.toc&&toc.length){
    const groups={};toc.forEach(t=>{(groups[t.g]=groups[t.g]||[]).push(t.n);});
    let b='<div class="toc">';
    Object.keys(groups).forEach(g=>{b+=`<div class="toc-g">${prE(g)}</div>`;groups[g].forEach(n=>{b+=`<div>${prE(n)}</div>`;});});
    b+='</div>';
    const title=(currentUniverse()&&currentUniverse().name)||'Daring Comics';
    out=prPage(title,'CONTENTS',b)+out;
  }
  return out||'<div class="pg">Nothing selected.</div>';
}

function prOpenDoc(){
  prLoadPrefs();
  if(!_prSel.length)return;
  const body=prBuildBody();
  const n=prPageCount();
  const cls=['previewing',_prOpts.ink?'ink-saver':'',_prOpts.guides?'guides':'no-guides',_prOpts.paper==='a4'?'a4':''].filter(Boolean).join(' ');
  const bar=`<div id="pv-bar"><span class="pv-t">Daring Comics · Print</span><span id="pv-pages">≈${n} sheet${n===1?'':'s'}</span>`
    +`<label><input type="checkbox" ${_prOpts.ink?'checked':''} onchange="document.body.classList.toggle('ink-saver',this.checked)"> Ink saver</label>`
    +`<label><input type="checkbox" ${_prOpts.guides?'checked':''} onchange="document.body.classList.toggle('guides',this.checked);document.body.classList.toggle('no-guides',!this.checked)"> Cut guides</label>`
    +`<select onchange="pvPaper(this.value)"><option value="letter" ${_prOpts.paper==='letter'?'selected':''}>Letter</option><option value="a4" ${_prOpts.paper==='a4'?'selected':''}>A4</option></select>`
    +`<button onclick="window.print()">🖨 Print</button><style id="pv-page"></style></div>`;
  const script='function pvPaper(v){document.body.classList.toggle("a4",v==="a4");'
    +'document.getElementById("pv-page").textContent="@page{size:"+(v==="a4"?"A4":"letter")+" portrait;margin:.5in}";}'
    +'pvPaper('+JSON.stringify(_prOpts.paper)+');';
  const title=((currentUniverse()&&currentUniverse().name)||'Daring Comics')+' — Print';
  dcOpenPrintDoc(prE(title),bar+body,{bodyClass:cls,script:script});
}

// Shared window opener for every printed document.
function dcOpenPrintDoc(title,body,opts){
  opts=opts||{};
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>`+
    // The preview is its own document, so it has to load the faces itself.
    // Without this the sheet silently falls back — the same way the app spent
    // months rendering its headings in Comic Sans.
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`+
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;600;700&family=Oswald:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&family=Bangers&family=Comic+Neue:wght@400;700&display=swap">`+
    `<style>${dcSheetCSS()}</style></head><body class="${opts.bodyClass||''}">${body}`
    +(opts.script?`<scr`+`ipt>${opts.script}</scr`+`ipt>`:'')+`</body></html>`;
  const w=window.open('','_blank');
  if(!w){alert('Please allow popups to print.');return null;}
  w.document.write(html);w.document.close();w.focus();
  if(opts.autoPrint)setTimeout(()=>{try{w.print();}catch(e){}},500);
  return w;
}


// ═══════════════════════════════════════════════════════════
// TEAM
// ═══════════════════════════════════════════════════════════
