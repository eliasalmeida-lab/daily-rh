import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import{getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import{getFirestore,doc,getDoc,setDoc,collection,getDocs,addDoc,deleteDoc,onSnapshot,deleteField}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── CONFIG ───────────────────────────────────────────────────────────────
const fbCfg={apiKey:"AIzaSyA84hE7DlSkp-KqAi72H1KXWVEx-bw_sqA",authDomain:"daily-rh.firebaseapp.com",projectId:"daily-rh",storageBucket:"daily-rh.firebasestorage.app",messagingSenderId:"933947456380",appId:"1:933947456380:web:317245d871e259a4e082f9"};
const app=initializeApp(fbCfg);
const db=getFirestore(app);
const auth=getAuth(app);

// ─── AREAS CONFIG ─────────────────────────────────────────────────────────
const AREAS={
  dp:{name:'Depto. Pessoal',short:'DP',person:'Elias',color:'#f97316'},
  bp:{name:'Business Partner',short:'BP',person:'Amanda',color:'#3b82f6'},
  rs:{name:'R&S',short:'RS',person:'Melissa',color:'#8b5cf6'},
  est:{name:'Estratégico',short:'EST',person:'Ursula',color:'#22c55e'}
};

// ─── FIELD MAP ────────────────────────────────────────────────────────────
const FIELD_MAP={
  dp:[
    {section:'Movimentações da Semana',fields:[{key:'dp_admissoes',label:'Admissões'},{key:'dp_rescisoes',label:'Rescisões'},{key:'dp_ferias',label:'Férias Relevantes'},{key:'dp_alteracoes',label:'Alterações Contratuais'},{key:'dp_folha',label:'Folha e Benefícios'}]},
    {section:'Pendências com a Tako',fields:[{key:'dp_ajustes',label:'Ajustes Necessários'},{key:'dp_prazos',label:'Prazos Críticos'},{key:'dp_outros',label:'Outros Assuntos'}]},
    {section:'Compliance e Riscos Trabalhistas',fields:[{key:'dp_notificacoes',label:'Notificações / Ações'},{key:'dp_documentacao',label:'Documentação Pendente'}]},
    {section:'Experiência do Colaborador',fields:[{key:'dp_reclamacoes',label:'Reclamações Recorrentes'},{key:'dp_problemas',label:'Problemas com Benefícios ou Processos'}]},
  ],
  bp:[
    {section:'Agfintech',fields:[{key:'bp_ag_clima',label:'Clima e Engajamento'},{key:'bp_ag_percepcoes',label:'Principais Percepções'},{key:'bp_ag_conflitos',label:'Conflitos ou Tensões'},{key:'bp_ag_movimentacoes',label:'Movimentações de Pessoas'},{key:'bp_ag_promocoes',label:'Promoções em Discussão'},{key:'bp_ag_desligamentos',label:'Possíveis Desligamentos'}]},
    {section:'Clicou, Fechou!',fields:[{key:'bp_cf_clima',label:'Clima e Engajamento'},{key:'bp_cf_percepcoes',label:'Principais Percepções'},{key:'bp_cf_conflitos',label:'Conflitos ou Tensões'},{key:'bp_cf_movimentacoes',label:'Movimentações de Pessoas'},{key:'bp_cf_promocoes',label:'Promoções em Discussão'},{key:'bp_cf_desligamentos',label:'Possíveis Desligamentos'}]},
    {section:'Anotações Gerais',fields:[{key:'bp_anotacoes_gerais',label:'Anotações'}]},
  ],
  rs:[{section:'Pipeline de Vagas',fields:[{key:'rs_vagas_abertas',label:'Vagas em Aberto'},{key:'rs_vagas_fechadas',label:'Vagas Fechadas na Semana'},{key:'rs_onboarding',label:'Onboarding em Curso'},{key:'rs_info_importantes',label:'Informações Importantes'},{key:'rs_outros',label:'Outros Assuntos'}]}],
  est:[
    {section:'Projetos Estratégicos',fields:[{key:'est_projetos',label:'Projetos em Andamento'},{key:'est_marcos',label:'Marcos / Entregas'}]},
    {section:"KR's",fields:[{key:'est_kr_info',label:'Informações Importantes'},{key:'est_kr_demandas',label:'Demandas a Serem Discutidas'}]},
    {section:'Outros Assuntos',fields:[{key:'est_anotacoes',label:'Anotações'}]},
  ],
};

const ALL_PAUTA_FIELDS=Object.values(FIELD_MAP).flatMap(secs=>secs.flatMap(s=>s.fields.map(f=>f.key)));

// --- DEBOUNCE UTILITY ---
function debounce(fn,delay){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),delay);};}


// ─── STATE ────────────────────────────────────────────────────────────────
let store={};
let avatars={},curTab='dp',currentUser=null,isAdmin=false;
let cropState={area:null,img:null,canvas:null,ctx:null,zoom:1,x:0,y:0,drag:false,lx:0,ly:0};
let prioStatus={};
let dirtyTabs=new Set();
let layoutConfig={};
let presentSlides=[],presentIdx=0;

// ─── UTILITIES ────────────────────────────────────────────────────────────
function trunc(s,l){if(!s)return'';return s.length>l?s.substring(0,l)+'…':s;}
function setEl(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function formatText(t){if(!t)return'';t=t.replace(/</g,'&lt;').replace(/>/g,'&gt;');const lines=t.split('\n');let out='',inList=false;for(let l of lines){const c=l.trim();if(c.startsWith('- ') || c.startsWith('* ')){if(!inList){out+='<ul style="margin:4px 0 4px 20px;padding-left:0;list-style-type:disc;">';inList=true;}out+='<li>'+c.substring(2)+'</li>';}else{if(inList){out+='</ul>';inList=false;}out+=c?c+'<br>':'<br>';}}if(inList)out+='</ul>';return out.replace(/(<br>)+$/,'');}
function toast(msg,icon='✓',dur=3200){
  const t=document.getElementById('toast');
  document.getElementById('toast-msg').textContent=msg;
  const ic=document.getElementById('toast-icon');if(ic)ic.textContent=icon;
  t.classList.add('show');clearTimeout(t._tid);t._tid=setTimeout(()=>t.classList.remove('show'),dur);
}
function getAreaPerson(a){return layoutConfig[`${a}_person`]||AREAS[a].person;}

// ─── FIREBASE ─────────────────────────────────────────────────────────────
async function fbSet(a,type,d){try{await setDoc(doc(db,'rh-daily',a),{[type]:d},{merge:true});}catch(e){console.warn('[fbSet]',e);}}
async function fbHist(a,d){try{await addDoc(collection(db,'rh-daily',a,'history'),d);}catch(e){console.warn('[fbHist]',e);}}
async function loadFb(){
  try{
    ['dp','bp','rs','est'].forEach(a => {
      onSnapshot(doc(db, 'rh-daily', a), (dd) => {
        if(!store[a]) store[a] = {};
        if(dd.exists()){
          const newData = dd.data();
          store[a].draft = newData.draft || null;
          store[a].current = newData.current || null;
          store[a].pautaHistory = newData.pautaHistory || [];
          store[a].prioHistory = newData.prioHistory || [];
        }
        if(document.getElementById('app-container').classList.contains('active')){
          updateOverview(); updateMetrics(); renderPautaHistory();
          // Restaura do banco somente se quem estiver usando NÃO tiver começado a digitar por cima
          if(!dirtyTabs.has(a) && curTab === a) restoreForm(a);
          localStorage.setItem('rh-store',JSON.stringify(store));
        }
      });
      onSnapshot(collection(db, 'rh-daily', a, 'history'), (snap) => {
        if(!store[a]) store[a] = {};
        store[a].history = snap.docs.map(hd => hd.data()).sort((x,y)=>new Date(y.savedAt)-new Date(x.savedAt));
        if(document.getElementById('app-container').classList.contains('active')) {
          renderHistory(); updateMetrics();
        }
      });
    });
    onSnapshot(doc(db, 'rh-daily', '_meta'), (m) => {
      if(m.exists()){if(!store._meta)store._meta={};Object.assign(store._meta,m.data()); updateMetrics();}
    });
  }catch(e){
    console.warn('[loadFb] Using localStorage fallback:',e);
    const lc=localStorage.getItem('rh-store');if(lc)store=JSON.parse(lc);
  }
  localStorage.setItem('rh-store',JSON.stringify(store));
  updateOverview();renderHistory();renderPautaHistory();restoreForm('dp');restorePrioStatus();
}

// ─── AUTH / LOGIN ─────────────────────────────────────────────────────────
let USER_MAP={
  'elias.almeida@graodireto.com.br':{name:'Elias',admin:true},
  'amanda@graodireto.com':{name:'Amanda',admin:false},
  'melissa@graodireto.com':{name:'Melissa',admin:false},
  'ursula@graodireto.com':{name:'Ursula',admin:false},
};

let _loginInProgress=false;

onAuthStateChanged(auth, async usuario=>{
  if(usuario){
    if(_loginInProgress)return;
    _loginInProgress=true;
    try {
      const uSnap = await getDocs(collection(db, 'rh-daily-users'));
      if(!uSnap.empty) {
        USER_MAP = {}; 
        uSnap.forEach(d => USER_MAP[d.id] = d.data());
      } else {
        for(let email in USER_MAP) await setDoc(doc(db, 'rh-daily-users', email), USER_MAP[email]);
      }
    } catch(e){}
    const u=USER_MAP[usuario.email]||{name:usuario.email.split('@')[0],admin:false};
    finishLogin(u.name,u.admin);
  }else{
    _loginInProgress=false;
    currentUser=null;isAdmin=false;
    const ls=document.getElementById('login-screen');
    if(ls){ls.style.display='';ls.classList.remove('hidden');ls.style.opacity='1';ls.style.transform='';}
    document.getElementById('app-container')?.classList.remove('active');
    const btn=document.getElementById('login-btn');if(btn){btn.disabled=false;btn.textContent='Entrar';}
    const er=document.getElementById('login-erro');if(er)er.style.display='none';
  }
});

let myPresenceId = null;
function startPresence() {
   myPresenceId = currentUser;
   const pRef = doc(db, 'rh-daily', '_presence');
   const updateP = () => { try{ setDoc(pRef, { [myPresenceId]: { tab: curTab, time: Date.now(), name: currentUser } }, {merge:true}); }catch(e){} };
   
   // Atualização mais frequente e limpeza ao sair
   const presenceInterval = setInterval(updateP, 10000); 
   updateP();
   window.addEventListener('beforeunload', () => {
     // Tentativa de limpar presença ao fechar a aba
     setDoc(pRef, { [myPresenceId]: deleteField() }, {merge:true});
   });
   
   onSnapshot(pRef, snap => {
     if(snap.exists()) {
       const data = snap.data();
       const now = Date.now();
       const trTab = {'dp':'DP','bp':'BP','rs':'RS','est':'EST','overview':'OV'};
       let html = '';
       for(let u in data) {
         if(u === myPresenceId || !data[u]) continue;
         if(now - data[u].time < 40000) {
           const initials = data[u].name ? data[u].name.substring(0,2).toUpperCase() : u.substring(0,2).toUpperCase();
           html += `<div class="presence-avatar" title="${data[u].name || u} na aba ${trTab[data[u].tab]||data[u].tab}" style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;border:2px solid var(--topbar);box-shadow:0 0 0 2px var(--primary-light);margin-left:-8px;z-index:10;cursor:help;transition:transform 0.2s;" onmouseover="this.style.transform='translateY(-2px) scale(1.1)'" onmouseout="this.style.transform=''"> ${initials} </div>`;
         }
       }
       const cont = document.getElementById('live-presence-container');
       if(cont) cont.innerHTML = html;
     }
   });
}

function finishLogin(name,admin=false){
  if(!name)return;
  currentUser=name;
  isAdmin=admin||name.toLowerCase()==='elias';
  setEl('welcome-name',name);
  const loginScreen=document.getElementById('login-screen');
  const welcomeScreen=document.getElementById('welcome-screen');
  const appContainer=document.getElementById('app-container');
  loginScreen.classList.add('hidden');
  setTimeout(()=>loginScreen.style.display='none',300);
  welcomeScreen.classList.add('active');
  const ma=document.getElementById('mnav-admin');if(ma)ma.style.display=isAdmin?'':'none';
  setTimeout(()=>{
    welcomeScreen.classList.remove('active');welcomeScreen.style.display='none';
    appContainer.classList.add('active');
    setEl('user-name-display',name);
    const av=document.getElementById('user-avatar');if(av)av.textContent=name.substring(0,2).toUpperCase();
    if(isAdmin){document.getElementById('admin-btn').classList.add('show');}
    init();
    startPresence();
  },2500);
}

window.doLogin=async()=>{
  const email=document.getElementById('login-email').value.trim();
  const senha=document.getElementById('login-senha').value;
  const erro=document.getElementById('login-erro');
  const btn=document.getElementById('login-btn');
  erro.style.display='none';
  if(!email||!senha){erro.textContent='Preencha e-mail e senha.';erro.style.display='block';return;}
  btn.disabled=true;btn.textContent='Entrando...';
  try{
    await signInWithEmailAndPassword(auth,email,senha);
    // onAuthStateChanged cuida do resto automaticamente
  }catch(e){
    erro.textContent='E-mail ou senha incorretos.';
    erro.style.display='block';
    btn.disabled=false;btn.textContent='Entrar';
  }
};

window.fazerLogout=async()=>{
  if(!confirm('Deseja sair do sistema?'))return;
  _loginInProgress=false;
  await signOut(auth);
};

// Enter nos campos de login
document.getElementById('login-email')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('login-senha')?.focus();});
document.getElementById('login-senha')?.addEventListener('keydown',e=>{if(e.key==='Enter')window.doLogin();});

async function init(){
  setEl('last-update',new Date().toLocaleDateString('pt-BR'));
  const la=localStorage.getItem('rh-avatars');if(la){avatars=JSON.parse(la);Object.entries(avatars).forEach(([a,src])=>applyAvatar(a,src));}
  const lp=localStorage.getItem('rh-prio-status');if(lp)prioStatus=JSON.parse(lp);
  const lc=localStorage.getItem('rh-layout-config');if(lc){layoutConfig=JSON.parse(lc);applyLayoutConfig();}
  const savedTheme=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',savedTheme);setThemeIcon();
  await loadFb();
  updateMetrics();buildPrioOverview();bindAutoGrow();initDateWidget();updateRSIndicators();
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────
window.showScreen=s=>{
  if(s==='admin'&&!isAdmin){toast('⛔ Acesso restrito a administradores.','⛔');return;}
  document.querySelectorAll('.screen').forEach(sc=>sc.classList.remove('active'));
  document.getElementById('screen-'+s).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const nb=document.getElementById('nav-'+s);if(nb)nb.classList.add('active');
  document.querySelectorAll('.mobile-nav-btn').forEach(b=>b.classList.remove('active'));
  const mb=document.getElementById('mnav-'+s);if(mb)mb.classList.add('active');
  if(s==='admin')updateAdminStats();
  if(s==='metrics')updateMetrics();
};
window.toggleTheme=()=>{const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',next);localStorage.setItem('theme',next);setThemeIcon();};
function setThemeIcon(){const btn=document.getElementById('theme-btn');if(btn)btn.textContent=document.documentElement.getAttribute('data-theme')==='dark'?'🌙':'☀️';}
function initDateWidget(){function update(){const now=new Date();const str=now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});const cap=str.charAt(0).toUpperCase()+str.slice(1);const el=document.getElementById('date-widget');if(el)el.innerHTML=`<span class="date-widget-icon">📅</span><span>${cap}</span>`;}update();const now=new Date();setTimeout(()=>{update();setInterval(update,86400000);},new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)-now);}

// ─── MOBILE ───────────────────────────────────────────────────────────────
window.toggleMobileMenu=()=>{const drawer=document.getElementById('mobile-drawer'),overlay=document.getElementById('mobile-overlay'),btn=document.getElementById('hamburger-btn');const isOpen=drawer.classList.contains('open');drawer.classList.toggle('open');overlay.classList.toggle('open');btn.classList.toggle('open');btn.setAttribute('aria-expanded',String(!isOpen));document.body.style.overflow=isOpen?'':'hidden';};
window.mobileNav=s=>{window.showScreen(s);toggleMobileMenu();};

// ─── TABS ─────────────────────────────────────────────────────────────────
window.switchTab=a=>{curTab=a;document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));document.getElementById('tab-'+a).classList.add('active');document.querySelectorAll('.aform').forEach(f=>f.classList.remove('active'));document.getElementById('form-'+a).classList.add('active');document.getElementById('sbar-area').innerHTML=`<strong>${AREAS[a].short} — ${getAreaPerson(a)}</strong>`;restoreForm(a);
  if(myPresenceId) { try { setDoc(doc(db, 'rh-daily', '_presence'), { [myPresenceId]: { tab: a, time: Date.now() } }, {merge:true}); } catch(e){} }
};

// ─── DIRTY STATE ──────────────────────────────────────────────────────────
// ─── DIRTY STATE & AUTO-SAVE ──────────────────────────────────────────────
const autoSave = debounce(async (area) => {
  const d = collect(area);
  if(!store[area]) store[area] = {};
  store[area].draft = d;
  await fbSet(area, 'draft', d);
  console.log(`[AutoSave] ${area} saved.`);
  const sbar = document.getElementById('save-bar');
  if(sbar) {
    const info = sbar.querySelector('.save-bar-info');
    const original = info.innerHTML;
    info.innerHTML = `<span style="color:var(--primary-light)">✔ Alterações salvas automaticamente</span>`;
    setTimeout(() => { if(info) info.innerHTML = original; }, 2000);
  }
}, 3000);

function markDirty(a){
  dirtyTabs.add(a);
  const dot=document.getElementById('dirty-'+a);if(dot)dot.classList.add('show');
  const pdot=document.getElementById('dirty-pautas');if(pdot)pdot.classList.add('show');
  document.getElementById('save-bar')?.classList.add('has-changes');
  autoSave(a);
}
function clearDirty(a){dirtyTabs.delete(a);const dot=document.getElementById('dirty-'+a);if(dot)dot.classList.remove('show');if(!dirtyTabs.size){const pdot=document.getElementById('dirty-pautas');if(pdot)pdot.classList.remove('show');document.getElementById('save-bar')?.classList.remove('has-changes');}}

// ─── AUTO-GROW ────────────────────────────────────────────────────────────
function autoResizeField(el){if(!el||el.tagName!=='TEXTAREA')return;el.style.height='auto';el.style.height=Math.max(el.scrollHeight,72)+'px';}
function bindAutoGrow(){document.querySelectorAll('.auto-grow').forEach(el=>{autoResizeField(el);el.addEventListener('input',()=>autoResizeField(el));});}

// ─── FORMS ────────────────────────────────────────────────────────────────
function collect(a){
  const d={savedAt:new Date().toISOString()};
  document.querySelectorAll(`#form-${a} [data-field]`).forEach(el=>d[el.dataset.field]=el.value||'');
  if(a==='rs'){const rows=[];document.querySelectorAll('#rs-tbody tr').forEach(tr=>{const c=tr.querySelectorAll('input,select');if(c.length>=7)rows.push({time:c[0].value,area:c[1].value,gestor:c[2].value,vaga:c[3].value,etapa:c[4].value,tempo:c[5].value,risco:c[6].value});});d.rs_vagas=rows;}
  return d;
}
function restoreForm(a){
  const d=store[a]?.draft||store[a]?.current;if(!d)return;
  document.querySelectorAll(`#form-${a} [data-field]`).forEach(el=>{if(d[el.dataset.field]!==undefined)el.value=d[el.dataset.field];if(el.classList.contains('auto-grow'))autoResizeField(el);});
  if(a==='rs'&&d.rs_vagas?.length){
    const tb=document.getElementById('rs-tbody');tb.innerHTML='';
    const etapas=['Triagem','Entrevista RH','Entrevista Gestor','Proposta','Contratado','Onboarding','Pausada'];
    d.rs_vagas.forEach(v=>{const tr=document.createElement('tr');tr.innerHTML=`<td><input value="${v.time||''}"/></td><td><input value="${v.area||''}"/></td><td><input value="${v.gestor||''}"/></td><td><input value="${v.vaga||''}"/></td><td><select>${etapas.map(o=>`<option${o===v.etapa?' selected':''}>${o}</option>`).join('')}</select></td><td><input value="${v.tempo||''}"/></td><td><input value="${v.risco||''}" placeholder="Risco/Gargalo"/></td><td><button onclick="rmRow(this)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:4px;">🗑</button></td>`;tb.appendChild(tr);});
    updateRSIndicators();
  }
  restorePrioStatus();
}
window.addRow=()=>{const tb=document.getElementById('rs-tbody');const tr=document.createElement('tr');const etapas=['Triagem','Entrevista RH','Entrevista Gestor','Proposta','Contratado','Onboarding','Pausada'];tr.innerHTML=`<td><input placeholder="Time"/></td><td><input placeholder="Área"/></td><td><input placeholder="Gestor"/></td><td><input placeholder="Vaga"/></td><td><select>${etapas.map(o=>`<option>${o}</option>`).join('')}</select></td><td><input placeholder="Ex: 15 dias"/></td><td><input placeholder="Risco ou gargalo..."/></td><td><button onclick="rmRow(this)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:4px;">🗑</button></td>`;tb.appendChild(tr);updateRSIndicators();markDirty(curTab);};
window.rmRow=btn=>{btn.closest('tr')?.remove();updateRSIndicators();markDirty(curTab);};

// ─── SAVE ─────────────────────────────────────────────────────────────────
window.saveDraft=async()=>{const d=collect(curTab);if(!store[curTab])store[curTab]={};store[curTab].draft=d;localStorage.setItem('rh-store',JSON.stringify(store));clearDirty(curTab);toast('Rascunho salvo','☁️');await fbSet(curTab,'draft',d);updateOverview();updateMetrics();};

window.saveDailyWithValidation=()=>{
  const d=collect(curTab);const sections=FIELD_MAP[curTab]||[];const emptyFields=[];
  sections.forEach(sec=>{sec.fields.forEach(f=>{const val=d[f.key]?.trim();if(!val)emptyFields.push({section:sec.section,label:f.label});});});
  if(emptyFields.length>0){const list=document.getElementById('val-field-list');list.innerHTML=emptyFields.map(f=>`<div class="val-field-item">${f.section} → ${f.label}</div>`).join('');document.getElementById('validation-overlay').classList.add('active');}else{window.saveDaily();}
};
window.closeValidationModal=()=>document.getElementById('validation-overlay').classList.remove('active');
window.confirmSaveDaily=()=>{closeValidationModal();window.saveDaily();};

window.saveDaily=async()=>{
  const d=collect(curTab);d.finalized=true;d.date=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  if(!store[curTab])store[curTab]={};store[curTab].current=d;
  if(!store[curTab].pautaHistory)store[curTab].pautaHistory=[];
  const td=new Date().toDateString();if(!store[curTab].pautaHistory.find(h=>h.savedAt&&new Date(h.savedAt).toDateString()===td))store[curTab].pautaHistory.unshift(d);
  localStorage.setItem('rh-store',JSON.stringify(store));clearDirty(curTab);toast('Pautas finalizadas','✅');
  await fbSet(curTab,'current',d);updateOverview();renderPautaHistory();updateMetrics();
};

// ─── PRIORITIES ───────────────────────────────────────────────────────────
window.setStatus=(btn,field)=>{const status=btn.dataset.status;btn.parentElement.querySelectorAll('.psbtn').forEach(b=>b.className='psbtn');btn.classList.add('active-'+status);prioStatus[field]=status;localStorage.setItem('rh-prio-status',JSON.stringify(prioStatus));markDirty(curTab);};
function restorePrioStatus(){['dp','bp','rs','est'].forEach(a=>[1,2,3].forEach(n=>{const field=`${a}_p${n}`;const status=prioStatus[field];if(!status)return;const ta=document.querySelector(`textarea[data-field="${field}"]`);if(!ta)return;const card=ta.closest('.prio-form-card');if(!card)return;card.querySelectorAll('.psbtn').forEach(b=>b.className='psbtn');const target=card.querySelector(`.psbtn[data-status="${status}"]`);if(target)target.classList.add('active-'+status);}));}
window.novaPrioridade=async(area,num)=>{const field=`${area}_p${num}`;const inp=document.querySelector(`[data-field="${field}"]`);const val=inp?.value?.trim();if(!val){toast('Prioridade já está vazia.','ℹ️');return;}if(!confirm(`Arquivar a Prioridade ${num} e limpar para uma nova?`))return;if(!store[area])store[area]={};if(!store[area].prioHistory)store[area].prioHistory=[];store[area].prioHistory.unshift({text:val,status:prioStatus[field]||'pending',num,archivedAt:new Date().toISOString(),date:new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})});inp.value='';delete prioStatus[field];localStorage.setItem('rh-prio-status',JSON.stringify(prioStatus));inp.closest('.prio-form-card')?.querySelectorAll('.psbtn').forEach(b=>b.className='psbtn');localStorage.setItem('rh-store',JSON.stringify(store));try{await fbSet(area,'prioHistory',store[area].prioHistory);}catch(e){}updateMetrics();buildPrioOverview();toast(`Prioridade ${num} arquivada`,'📦');};

// ─── AVATARS / CROP ───────────────────────────────────────────────────────
window.triggerUpload=a=>document.getElementById('file-'+a).click();
window.openCrop=(e,area)=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const img=new Image();img.onload=()=>{cropState={...cropState,area,img,zoom:1,x:0,y:0};const canvas=document.getElementById('crop-canvas');cropState.canvas=canvas;cropState.ctx=canvas.getContext('2d');canvas.width=400;canvas.height=280;document.getElementById('crop-zoom').value=1;document.getElementById('crop-overlay').classList.add('active');updateCrop();const wrap=document.getElementById('crop-canvas-wrap');wrap.onmousedown=we=>{cropState.drag=true;cropState.lx=we.clientX;cropState.ly=we.clientY;};wrap.onmousemove=we=>{if(!cropState.drag)return;cropState.x+=we.clientX-cropState.lx;cropState.y+=we.clientY-cropState.ly;cropState.lx=we.clientX;cropState.ly=we.clientY;updateCrop();};wrap.onmouseup=()=>cropState.drag=false;wrap.onmouseleave=()=>cropState.drag=false;};img.src=ev.target.result;};r.readAsDataURL(f);e.target.value='';};
window.updateCrop=()=>{const{canvas,ctx,img}=cropState;if(!canvas||!img)return;cropState.zoom=parseFloat(document.getElementById('crop-zoom').value);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#111';ctx.fillRect(0,0,canvas.width,canvas.height);const sc=(Math.min(canvas.width/img.width,canvas.height/img.height))*cropState.zoom;ctx.drawImage(img,canvas.width/2-img.width*sc/2+cropState.x,canvas.height/2-img.height*sc/2+cropState.y,img.width*sc,img.height*sc);};
window.applyCrop=()=>{const{canvas,area}=cropState;if(!canvas)return;const sz=200,off=document.createElement('canvas');off.width=sz;off.height=sz;const oc=off.getContext('2d');oc.beginPath();oc.arc(sz/2,sz/2,sz/2,0,Math.PI*2);oc.clip();oc.drawImage(canvas,canvas.width/2-sz/2,canvas.height/2-sz/2,sz,sz,0,0,sz,sz);const url=off.toDataURL('image/jpeg',0.85);avatars[area]=url;localStorage.setItem('rh-avatars',JSON.stringify(avatars));applyAvatar(area,url);closeCrop();toast('Foto atualizada','📷');};
window.closeCrop=()=>document.getElementById('crop-overlay').classList.remove('active');
function applyAvatar(a,src){['av-img-'+a,'tav-img-'+a,'pc-img-'+a].forEach(id=>{const el=document.getElementById(id);if(el){el.src=src;el.style.display='block';}});['av-init-'+a,'tav-init-'+a,'pc-init-'+a].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});}
function clearAvatar(a){['av-img-'+a,'tav-img-'+a,'pc-img-'+a].forEach(id=>{const el=document.getElementById(id);if(el){el.src='';el.style.display='none';}});['av-init-'+a,'tav-init-'+a,'pc-init-'+a].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='';});}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────
function updateOverview(){['dp','bp','rs','est'].forEach(a=>buildOv(a,store[a]?.current||store[a]?.draft||{}));buildPrioOverview();}
function buildOv(a,d){
  const el=document.getElementById(a+'-ov');if(!el)return;
  const secs={dp:[{t:'Movimentações',f:[['Admissões','dp_admissoes'],['Rescisões','dp_rescisoes'],['Férias','dp_ferias'],['Folha','dp_folha']]},{t:'Tako/Compliance',f:[['Ajustes','dp_ajustes'],['Prazos','dp_prazos'],['Notificações','dp_notificacoes']]}],bp:[{t:'Agfintech',f:[['Clima','bp_ag_clima'],['Percepções','bp_ag_percepcoes'],['Conflitos','bp_ag_conflitos']]},{t:'Clicou, Fechou!',f:[['Clima','bp_cf_clima'],['Percepções','bp_cf_percepcoes'],['Conflitos','bp_cf_conflitos']]}],rs:[{t:'Vagas',f:[['Em Aberto','rs_vagas_abertas'],['Fechadas','rs_vagas_fechadas'],['Onboarding','rs_onboarding']]},{t:'Outros',f:[['Info.','rs_info_importantes'],['Outros','rs_outros']]}],est:[{t:'Projetos',f:[['Andamento','est_projetos'],['Marcos','est_marcos']]},{t:"KR's",f:[['Info.','est_kr_info'],['Demandas','est_kr_demandas']]}]};
  let html='',has=false;
  (secs[a]||[]).forEach(sec=>{const its=sec.f.filter(([,k])=>d[k]?.trim());if(!its.length)return;has=true;html+=`<div class="ov-section"><div class="ov-sec-lbl">${sec.t}</div>${its.map(([l,k])=>`<div class="ov-item"><span class="ov-k">${l}</span><span>${trunc(d[k],56)}</span></div>`).join('')}</div>`;});
  el.innerHTML=has?html:'<div class="ov-empty">Sem dados registrados.</div>';
  const dot=document.getElementById('dot-'+a);if(dot)dot.classList.toggle('on',has);
}
function buildPrioOverview(){
  const grid=document.getElementById('prio-overview-grid');if(!grid)return;
  const sm={pending:{c:'status-pending',l:'Pendente'},progress:{c:'status-progress',l:'Andamento'},done:{c:'status-done',l:'Concluído'}};
  grid.innerHTML=['dp','bp','rs','est'].map(a=>{const d=store[a]?.current||store[a]?.draft||{};const prios=[1,2,3].map(n=>{const field=`${a}_p${n}`;return{t:d[field],s:prioStatus[field]||'pending'};}).filter(p=>p.t?.trim());const items=prios.length?prios.map((p,i)=>`<div class="prio-item"><div class="prio-num" style="background:${AREAS[a].color}20;color:${AREAS[a].color}">${i+1}</div><div class="prio-txt">${p.t}</div><span class="prio-status ${sm[p.s].c}">${sm[p.s].l}</span></div>`).join(''):`<div class="prio-empty">Nenhuma prioridade.</div>`;return`<div class="prio-card"><div class="prio-card-head abar-${a}"></div><div class="prio-card-body"><div class="prio-card-title" style="color:${AREAS[a].color}">${AREAS[a].short} · ${getAreaPerson(a)}</div>${items}</div></div>`;}).join('');
}

// ─── DAILY HTML BUILDER ───────────────────────────────────────────────────
function buildDailyBodyHTML(areas_data){
  const sm={pending:{c:'status-pending',l:'Pendente'},progress:{c:'status-progress',l:'Andamento'},done:{c:'status-done',l:'Concluído'}};
  return['dp','bp','rs','est'].map(a=>{
    const d=areas_data[a]||{};const savedPS=d.prioStatus||{};
    const prios=[1,2,3].map(n=>{const field=`${a}_p${n}`;const val=d[field]?.trim();if(!val)return null;const s=savedPS[field]||prioStatus[field]||'pending';return{t:val,s};}).filter(Boolean);
    const sections=FIELD_MAP[a]||[];
    const sectionHTML=sections.map(sec=>{const filledFields=sec.fields.filter(f=>d[f.key]?.trim());if(!filledFields.length)return'';return`<div class="daily-pauta-group"><div class="daily-group-title">${sec.section}</div>${filledFields.map(f=>`<div class="daily-field-row"><div class="daily-field-label">${f.label}</div><div class="daily-field-value">${formatText(d[f.key])}</div></div>`).join('')}</div>`;}).join('');
    let vagasHTML='';if(a==='rs'&&d.rs_vagas?.length){vagasHTML=`<div class="daily-pauta-group"><div class="daily-group-title">Pipeline de Vagas</div>${d.rs_vagas.map(v=>`<div class="daily-field-row"><div class="daily-field-label">${v.vaga||'Vaga'}</div><div class="daily-field-value">Time: ${v.time||'—'} · Gestor: ${v.gestor||'—'} · Etapa: ${v.etapa||'—'} · Risco: ${v.risco||'—'}</div></div>`).join('')}</div>`;}
    const hasContent=prios.length||sectionHTML||vagasHTML;
    return`<div class="daily-section"><div class="daily-section-head"><div class="daily-section-av av-${a}">${getAreaPerson(a).substring(0,2).toUpperCase()}</div><div><div class="daily-section-title">${getAreaPerson(a)}</div><div class="daily-section-role">${AREAS[a].name}</div></div></div>${prios.length?`<div class="daily-pauta-group"><div class="daily-group-title">Prioridades da Semana</div><div class="daily-prios">${prios.map((p,i)=>`<div class="daily-prio"><div class="daily-prio-num" style="background:${AREAS[a].color}20;color:${AREAS[a].color}">${i+1}</div><div class="daily-prio-txt">${p.t}</div><span class="prio-status ${sm[p.s].c}">${sm[p.s].l}</span></div>`).join('')}</div></div>`:''}${sectionHTML}${vagasHTML}${!hasContent?`<div style="color:var(--muted);font-size:13px;padding:12px 0;">Nenhuma informação registrada.</div>`:''}</div>`;
  }).join('');
}

// ─── DAILY MODAL ──────────────────────────────────────────────────────────
window.openDailyModal=()=>{
  try{
    const body=document.getElementById('daily-modal-body');if(!body)return;
    const areasData={};
    ['dp','bp','rs','est'].forEach(a=>{const stored=store[a]?.current||store[a]?.draft||{};const live={};document.querySelectorAll(`#form-${a} [data-field]`).forEach(el=>live[el.dataset.field]=el.value||'');areasData[a]={...stored,...live};if(a==='rs'){const rows=[];document.querySelectorAll('#rs-tbody tr').forEach(tr=>{const c=tr.querySelectorAll('input,select');if(c.length>=7)rows.push({time:c[0].value,area:c[1].value,gestor:c[2].value,vaga:c[3].value,etapa:c[4].value,tempo:c[5].value,risco:c[6].value});});areasData[a].rs_vagas=rows.length?rows:stored.rs_vagas;}});
    const today=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});document.getElementById('daily-date').textContent=today.charAt(0).toUpperCase()+today.slice(1);
    body.innerHTML=buildDailyBodyHTML(areasData);document.getElementById('daily-overlay').classList.add('active');
  }catch(e){console.error('[openDailyModal]',e);toast('Erro ao abrir daily: '+e.message,'❌');}
};
window.closeDailyModal=()=>document.getElementById('daily-overlay').classList.remove('active');

// ─── FINALIZE DAILY ───────────────────────────────────────────────────────
window.finalizarDaily=async()=>{
  if(!confirm('Deseja finalizar a Daily desta semana? Os campos de pauta serão resetados.'))return;
  const date=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const areasData={};
  ['dp','bp','rs','est'].forEach(a=>{
    const stored=store[a]?.current||store[a]?.draft||{};
    let merged={...stored};
    if (a === curTab || dirtyTabs.has(a)) {
      document.querySelectorAll(`#form-${a} [data-field]`).forEach(el=>merged[el.dataset.field]=el.value||'');
      if(a==='rs'){
        const rows=[];document.querySelectorAll('#rs-tbody tr').forEach(tr=>{const c=tr.querySelectorAll('input,select');if(c.length>=7)rows.push({time:c[0].value,area:c[1].value,gestor:c[2].value,vaga:c[3].value,etapa:c[4].value,tempo:c[5].value,risco:c[6].value});});
        merged.rs_vagas=rows.length?rows:stored.rs_vagas;
      }
    }
    areasData[a]=merged;
  });
  for(const a of['dp','bp','rs','est']){
    const areaPrios = {};
    Object.keys(prioStatus).forEach(k => { if(k.startsWith(a)) areaPrios[k] = prioStatus[k]; });
    const d={...areasData[a],finalized:true,date,savedAt:new Date().toISOString(),prioStatus:areaPrios};
    if(!store[a])store[a]={};if(!store[a].history)store[a].history=[];
    store[a].current=d;try{await fbSet(a,'current',d);await fbSet(a,'draft',null);await fbHist(a,d);}catch(e){}
  }
  if(!store._meta)store._meta={};store._meta.dailysCount=(store._meta.dailysCount||0)+1;
  localStorage.setItem('rh-store',JSON.stringify(store));
  try{await setDoc(doc(db,'rh-daily','_meta'),{dailysCount:store._meta.dailysCount},{merge:true});}catch(e){}
  ['dp','bp','rs','est'].forEach(a=>{document.querySelectorAll(`#form-${a} [data-field]`).forEach(el=>{if(!el.dataset.field.match(/^(dp|bp|rs|est)_p[123]$/))el.value='';});if(a==='rs'){const tb=document.getElementById('rs-tbody');if(tb)tb.innerHTML='';}store[a].draft=null;store[a].current=null;clearDirty(a);});
  closeDailyModal();updateOverview();renderHistory();renderPautaHistory();updateMetrics();updateRSIndicators();toast('Daily finalizada e salva no histórico','✅');
};

// ─── HISTORY ──────────────────────────────────────────────────────────────
function renderHistory(){
  const el=document.getElementById('history-list');if(!el)return;
  const entries=[];['dp','bp','rs','est'].forEach(a=>(store[a]?.history||[]).forEach(h=>entries.push({...h,_area:a})));
  const byDate={};entries.forEach(e=>{const d=e.date||(e.savedAt?new Date(e.savedAt).toLocaleDateString('pt-BR'):'—');if(!byDate[d])byDate[d]=[];byDate[d].push(e);});
  const dates=Object.keys(byDate).sort((a,b)=>{const pa=a.split('/').reverse().join('-'),pb=b.split('/').reverse().join('-');return pb.localeCompare(pa);});
  if(!dates.length){el.innerHTML='<div class="hist-item" style="justify-content:center;cursor:default"><span style="color:var(--muted)">Nenhuma daily finalizada ainda.</span></div>';return;}
  el.innerHTML=dates.map(d=>{const areas=[...new Set(byDate[d].map(g=>g._area))];return`<div class="hist-item" onclick="openHistoryModal('${d}')"><div class="hdot"></div><div class="hinfo"><div class="hdate">Daily — ${d}</div><div class="htags">${areas.map(a=>`<span class="atag atag-${a}">${AREAS[a].short}</span>`).join('')}</div></div><div class="hact">Ver →</div></div>`;}).join('');
}
window.openHistoryModal=date=>{
  const areasData={};
  ['dp','bp','rs','est'].forEach(a=>{const entry=(store[a]?.history||[]).find(h=>{const hd=h.date||(h.savedAt?new Date(h.savedAt).toLocaleDateString('pt-BR'):'');return hd===date;});areasData[a]=entry||{};});
  document.getElementById('history-date').textContent=date;document.getElementById('history-modal-body').innerHTML=buildDailyBodyHTML(areasData);document.getElementById('history-overlay').classList.add('active');
};
window.closeHistoryModal=()=>document.getElementById('history-overlay').classList.remove('active');
function renderPautaHistory(){
  ['dp','bp','rs','est'].forEach(a=>{const el=document.getElementById('pauta-history-'+a);if(!el)return;const entries=store[a]?.pautaHistory||[];if(!entries.length){el.innerHTML='<div style="color:var(--muted);font-size:13px;font-style:italic;padding:12px 0;">Nenhuma pauta finalizada ainda.</div>';return;}el.innerHTML=entries.map((e,idx)=>{const date=e.date||'—';const sections=FIELD_MAP[a]||[];const filled=sections.flatMap(s=>s.fields.filter(f=>e[f.key]?.trim()).map(f=>f.label));const preview=filled.slice(0,3).join(' · ')||'Sem detalhes';return`<div class="hist-item" onclick="openPautaHistDetail('${a}',${idx})"><div class="hdot" style="background:${AREAS[a].color}"></div><div class="hinfo"><div class="hdate">Pauta — ${date}</div><div style="font-size:12px;color:var(--text2);margin-top:4px;">${preview}</div></div><div class="hact">Ver →</div></div>`;}).join('');});
}
window.openPautaHistDetail=(area,idx)=>{const e=store[area]?.pautaHistory?.[idx];if(!e)return;document.getElementById('history-date').textContent=e.date||'—';const areasData={[area]:e};['dp','bp','rs','est'].filter(a=>a!==area).forEach(a=>areasData[a]={});document.getElementById('history-modal-body').innerHTML=buildDailyBodyHTML(areasData);document.getElementById('history-overlay').classList.add('active');};

// ─── PRESENTATION MODE ────────────────────────────────────────────────────
window.openPresentation=()=>{
  closeDailyModal();
  const areasData={};
  ['dp','bp','rs','est'].forEach(a=>{const stored=store[a]?.current||store[a]?.draft||{};const live={};document.querySelectorAll(`#form-${a} [data-field]`).forEach(el=>live[el.dataset.field]=el.value||'');areasData[a]={...stored,...live};if(a==='rs'){const rows=[];document.querySelectorAll('#rs-tbody tr').forEach(tr=>{const c=tr.querySelectorAll('input,select');if(c.length>=7)rows.push({time:c[0].value,area:c[1].value,gestor:c[2].value,vaga:c[3].value,etapa:c[4].value,tempo:c[5].value,risco:c[6].value});});areasData[a].rs_vagas=rows.length?rows:stored.rs_vagas;}});
  presentSlides=buildPresentationSlides(areasData);presentIdx=0;renderPresentationSlide();document.getElementById('present-overlay').classList.add('active');
};
function buildPresentationSlides(areasData){
  const sm={pending:{c:'status-pending',l:'Pendente'},progress:{c:'status-progress',l:'Andamento'},done:{c:'status-done',l:'Concluído'}};
  return['dp','bp','rs','est'].map(a=>{const d=areasData[a]||{};const savedPS=d.prioStatus||{};const prios=[1,2,3].map(n=>{const field=`${a}_p${n}`;const val=d[field]?.trim();if(!val)return null;return{t:val,s:savedPS[field]||prioStatus[field]||'pending'};}).filter(Boolean);const sections=FIELD_MAP[a]||[];const sectionHTML=sections.map(sec=>{const filled=sec.fields.filter(f=>d[f.key]?.trim());if(!filled.length)return'';return`<div class="present-group"><div class="present-group-title">${sec.section}</div>${filled.map(f=>`<div class="present-field-item"><div class="present-field-label">${f.label}</div><div class="present-field-value">${formatText(d[f.key])}</div></div>`).join('')}</div>`;}).join('');let vagasHTML='';if(a==='rs'&&d.rs_vagas?.length){vagasHTML=`<div class="present-group"><div class="present-group-title">Pipeline de Vagas</div>${d.rs_vagas.map(v=>`<div class="present-field-item"><div class="present-field-label">${v.vaga||'Vaga'}</div><div class="present-field-value">Time: ${v.time||'—'} · Gestor: ${v.gestor||'—'} · Etapa: ${v.etapa||'—'} · Risco: ${v.risco||'—'}</div></div>`).join('')}</div>`;}return{area:a,person:getAreaPerson(a),prios,sectionHTML,vagasHTML,sm};});
}
function renderPresentationSlide(){
  const content=document.getElementById('present-content');const counter=document.getElementById('present-counter');const prev=document.getElementById('present-prev');const next=document.getElementById('present-next');const prog=document.getElementById('present-progress');if(!content||!presentSlides.length)return;
  const slide=presentSlides[presentIdx];const sm={pending:{c:'status-pending',l:'Pendente'},progress:{c:'status-progress',l:'Andamento'},done:{c:'status-done',l:'Concluído'}};const a=slide.area;
  content.innerHTML=`<div class="present-slide active"><div class="present-person"><div class="present-person-av av-${a}">${slide.person.substring(0,2).toUpperCase()}</div><div><div class="present-person-name">${slide.person}</div><div class="present-person-role">${AREAS[a].name}</div></div></div>${slide.prios.length?`<div class="present-prios"><div class="present-section-label">⭐ Prioridades da Semana</div>${slide.prios.map((p,i)=>`<div class="present-prio-item"><div class="present-prio-num" style="background:${AREAS[a].color}30;color:${AREAS[a].color}">${i+1}</div><div class="present-prio-txt">${p.t}</div><span class="prio-status ${sm[p.s].c}">${sm[p.s].l}</span></div>`).join('')}</div>`:''}<div class="present-fields">${slide.sectionHTML}${slide.vagasHTML}</div></div>`;
  counter.textContent=`${presentIdx+1} / ${presentSlides.length}`;prev.disabled=presentIdx===0;next.textContent=presentIdx===presentSlides.length-1?'Encerrar apresentação ✓':'Próximo →';
  prog.innerHTML=presentSlides.map((_,i)=>`<div class="present-dot${i===presentIdx?' active':''}"></div>`).join('');
}
window.presentNav=dir=>{if(dir===1&&presentIdx===presentSlides.length-1){closePresentation();return;}presentIdx=Math.max(0,Math.min(presentSlides.length-1,presentIdx+dir));renderPresentationSlide();};
window.closePresentation=()=>{document.getElementById('present-overlay').classList.remove('active');};

// ─── LAYOUT CONFIG ────────────────────────────────────────────────────────
function applyLayoutConfig(){
  if(!layoutConfig)return;
  ['dp','bp','rs','est'].forEach(a=>{const person=layoutConfig[`${a}_person`];if(person){setEl(`pc-name-${a}`,person);setEl(`ov-name-${a}`,person);}});
  if(layoutConfig.empresa1)setEl('fc-empresa1',layoutConfig.empresa1);
  if(layoutConfig.empresa2)setEl('fc-empresa2',layoutConfig.empresa2);
  if(layoutConfig.pautasTitle)setEl('pautas-main-title','📋 '+layoutConfig.pautasTitle);
  updateMetrics();updateOverview();
}

// ─── METRICS ──────────────────────────────────────────────────────────────
function updateMetrics(){
  const setV=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  let gPending=0,gProgress=0,gDone=0;const areaStats={};
  ['dp','bp','rs','est'].forEach(a=>{const d=store[a]?.current||store[a]?.draft||{};let pending=0,progress=0,done=0;[1,2,3].forEach(n=>{const field=`${a}_p${n}`;const inp=document.querySelector(`[data-field="${field}"]`);const val=inp?.value?.trim()||d[field]?.trim();if(val){const s=prioStatus[field]||'pending';if(s==='pending'){pending++;gPending++;}else if(s==='progress'){progress++;gProgress++;}else{done++;gDone++;}}});areaStats[a]={pending,progress,done,total:pending+progress+done};});
  const barsChart=document.getElementById('prio-bars-chart');
  if(barsChart){const colors={dp:'#f97316',bp:'#3b82f6',rs:'#8b5cf6',est:'#22c55e'};barsChart.innerHTML=['dp','bp','rs','est'].map(a=>{const s=areaStats[a];const pct=s.total>0?Math.round(s.done/s.total*100):0;return`<div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div style="display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:50%;background:${colors[a]}"></div><span style="font-size:13px;font-weight:700;color:var(--text);">${AREAS[a].short} · ${getAreaPerson(a)}</span></div><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;color:var(--muted);">${s.done}/${s.total}</span><span style="font-size:14px;font-weight:800;color:${colors[a]};">${pct}%</span></div></div><div style="height:10px;border-radius:5px;background:var(--surface3);overflow:hidden;display:flex;"><div style="width:${s.total>0?Math.round(s.done/s.total*100):0}%;background:${colors[a]};border-radius:5px 0 0 5px;transition:width .8s ease;"></div><div style="width:${s.total>0?Math.round(s.progress/s.total*100):0}%;background:${colors[a]}55;transition:width .8s ease;"></div></div><div style="display:flex;gap:14px;margin-top:5px;"><span style="font-size:10px;color:#d97706;font-weight:700;">⏳ ${s.pending}</span><span style="font-size:10px;color:#2563eb;font-weight:700;">🔄 ${s.progress}</span><span style="font-size:10px;color:var(--primary-dark);font-weight:700;">✅ ${s.done}</span></div></div>`;}).join('');}

  // Donut chart with Chart.js
  const total=gPending+gProgress+gDone;
  setV('prio-donut-total',total);setV('prio-donut-pending',gPending);setV('prio-donut-progress',gProgress);setV('prio-donut-done',gDone);
  
  const ctx = document.getElementById('prio-donut-canvas');
  if(ctx && total > 0) {
    if(window.myDonut) window.myDonut.destroy();
    window.myDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Pendente', 'Andamento', 'Concluído'],
        datasets: [{
          data: [gPending, gProgress, gDone],
          backgroundColor: ['#fbbf24', '#38bdf8', '#7CB342'],
          borderWidth: 0,
          cutout: '75%'
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: 'easeOutQuart' }
      }
    });
  }

  // Pauta fill metrics
  const fieldCounts={dp:10,bp:13,rs:5,est:5};
  ['dp','bp','rs','est'].forEach(a=>{
    const d=store[a]?.current||store[a]?.draft||{};
    const fields=FIELD_MAP[a].flatMap(s=>s.fields.map(f=>f.key));
    const filled=fields.filter(k=>d[k]?.trim()).length;
    const total=fieldCounts[a];
    const pct=total>0?Math.round(filled/total*100):0;
    const bar=document.getElementById(`met-${a}-bar`);if(bar)bar.style.width=pct+'%';
    const pctEl=document.getElementById(`met-${a}-pct`);if(pctEl)pctEl.textContent=pct+'%';
    const cnt=document.getElementById(`met-${a}-count`);if(cnt)cnt.textContent=`${filled}/${total} campos`;
  });

  // KPIs
  const hist=[];['dp','bp','rs','est'].forEach(a=>(store[a]?.history||[]).forEach(h=>hist.push(h)));
  const byDate={};hist.forEach(h=>{const d=h.date||'';if(!byDate[d])byDate[d]=true;});
  const dailyCount=store._meta?.dailysCount||Object.keys(byDate).length;
  setV('kpi-daily',dailyCount);setV('hist-mes',dailyCount);
  setV('admin-dailys-count',dailyCount);

  const allFields=ALL_PAUTA_FIELDS;
  let filledCount=0;
  ['dp','bp','rs','est'].forEach(a=>{const d=store[a]?.current||store[a]?.draft||{};allFields.forEach(k=>{if(d[k]?.trim())filledCount++;});});
  setV('kpi-pautas',`${filledCount} / ${allFields.length}`);
  setV('admin-pautas-count',filledCount);

  const allPrios=[];['dp','bp','rs','est'].forEach(a=>{[1,2,3].forEach(n=>{const f=`${a}_p${n}`;const inp=document.querySelector(`[data-field="${f}"]`);const val=inp?.value?.trim()||(store[a]?.current||store[a]?.draft||{})[f]?.trim();if(val)allPrios.push({field:f,status:prioStatus[f]||'pending'});});});
  const doneCount=allPrios.filter(p=>p.status==='done').length;
  const conclusao=allPrios.length>0?Math.round(doneCount/allPrios.length*100):0;
  setV('kpi-conclusao',conclusao+'%');
  setV('admin-prios-count',allPrios.filter(p=>p.status!=='done').length);

  // Health score
  const pautaScore=allFields.length>0?Math.round(filledCount/allFields.length*100):0;
  const prioScore=allPrios.length>0?Math.round(doneCount/allPrios.length*100):0;
  const healthScore=Math.round((pautaScore+prioScore)/2);
  const ring=document.getElementById('health-ring');
  if(ring)ring.setAttribute('stroke-dasharray',`${healthScore}, 100`);
  setV('health-score',healthScore+'%');
  const lbl=document.getElementById('health-label');
  if(lbl)lbl.textContent=healthScore>=80?'Excelente 🌟':healthScore>=60?'Bom 👍':healthScore>=40?'Regular ⚠️':'Precisa atenção 🔴';

  const breakdown=document.getElementById('health-breakdown');
  if(breakdown){breakdown.innerHTML=[
    {l:'Preenchimento de Pautas',v:pautaScore,c:'#38bdf8'},
    {l:'Conclusão de Prioridades',v:prioScore,c:'#7CB342'},
  ].map(({l,v,c})=>`<div><div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span style="font-size:12px;color:var(--text2);">${l}</span><span style="font-size:13px;font-weight:800;color:${c};">${v}%</span></div><div style="height:7px;border-radius:4px;background:var(--surface3);overflow:hidden;"><div style="width:${v}%;height:100%;background:${c};border-radius:4px;transition:width .8s ease;"></div></div></div>`).join('');}

  // RS metrics
  const rsVagas=store.rs?.current?.rs_vagas||store.rs?.draft?.rs_vagas||[];
  const abertas=rsVagas.filter(v=>!['Contratado','Onboarding'].includes(v.etapa)).length;
  const fechadas=rsVagas.filter(v=>v.etapa==='Contratado').length;
  const onboard=rsVagas.filter(v=>v.etapa==='Onboarding').length;
  setV('rs-met-abertas',abertas);setV('rs-met-fechadas',fechadas);
  const onbEl=document.getElementById('rs-met-onboard');if(onbEl)onbEl.textContent=onboard||'—';
  const alto=rsVagas.filter(v=>(v.risco||'').toLowerCase().includes('alto')).length;
  const medio=rsVagas.filter(v=>(v.risco||'').toLowerCase().includes('médio')||v.risco?.toLowerCase().includes('medio')).length;
  setV('rs-risco-alto',alto);setV('rs-risco-medio',medio);setV('rs-risco-baixo',rsVagas.length-alto-medio);

  // BP alerts
  ['ag','cf'].forEach(emp=>{
    const el=document.getElementById(`bp-alerts-${emp}`);if(!el)return;
    const d=store.bp?.current||store.bp?.draft||{};
    const fields=[
      {k:`bp_${emp}_clima`,l:'Clima e Engajamento'},
      {k:`bp_${emp}_conflitos`,l:'Conflitos/Tensões'},
      {k:`bp_${emp}_desligamentos`,l:'Possíveis Desligamentos'},
    ];
    const alerts=fields.filter(f=>d[f.k]?.trim());
    el.innerHTML=alerts.length?alerts.map(f=>`<div class="bp-alert-row"><div class="bp-alert-dot" style="background:#f59e0b"></div><span class="bp-alert-txt">${f.l}</span><span class="bp-alert-badge" style="background:rgba(245,158,11,.12);color:#d97706">Atenção</span></div>`).join(''):`<div style="color:var(--muted);font-size:13px;font-style:italic;">Sem alertas registrados.</div>`;
  });

  // Archived prios
  const archEl=document.getElementById('archived-prios');
  if(archEl){
    const all=[];['dp','bp','rs','est'].forEach(a=>(store[a]?.prioHistory||[]).forEach(p=>all.push({...p,area:a})));
    const colors={dp:'#f97316',bp:'#3b82f6',rs:'#8b5cf6',est:'#22c55e'};
    archEl.innerHTML=all.length?all.slice(0,20).map(p=>`<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--surface2);border-radius:12px;"><div style="width:8px;height:8px;border-radius:50%;background:${colors[p.area]};flex-shrink:0;"></div><div style="flex:1;font-size:13px;color:var(--text);">${p.text}</div><span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:6px;background:var(--surface3);color:var(--muted);">${AREAS[p.area].short} · ${p.date||'—'}</span></div>`).join(''):`<div style="color:var(--muted);font-size:13px;font-style:italic;padding:12px 0;">Nenhuma prioridade arquivada ainda.</div>`;
    setV('admin-archived-count',all.length);
  }

  // Proxima daily (próxima sexta)
  const now=new Date();const day=now.getDay();const daysToFri=day<=5?(5-day):(12-day);
  const fri=new Date(now);fri.setDate(now.getDate()+daysToFri);
  setV('hist-proxima',fri.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));

  // Ultima daily
  const allDates=[];['dp','bp','rs','est'].forEach(a=>(store[a]?.history||[]).forEach(h=>{if(h.date)allDates.push(h.date);}));
  if(allDates.length){
    const sorted=allDates.sort((a,b)=>{const pa=a.split('/').reverse().join('-'),pb=b.split('/').reverse().join('-');return pb.localeCompare(pa);});
    setV('hist-last-data',sorted[0]);
  }
}

// ─── RS INDICATORS ────────────────────────────────────────────────────────
function updateRSIndicators(){
  const rows=document.querySelectorAll('#rs-tbody tr');
  const abertas=[...rows].filter(tr=>{const sel=tr.querySelector('select');return sel&&!['Contratado','Onboarding'].includes(sel.value);}).length;
  const fechadas=[...rows].filter(tr=>{const sel=tr.querySelector('select');return sel&&sel.value==='Contratado';}).length;
  const onboard=[...rows].filter(tr=>{const sel=tr.querySelector('select');return sel&&sel.value==='Onboarding';}).length;
  setEl('rs-ind-abertas',abertas);setEl('rs-ind-fechadas',fechadas);setEl('rs-ind-onboarding',onboard);
}

// ─── ADMIN ────────────────────────────────────────────────────────────────
async function loadAdminUsers() {
  const cont = document.querySelector('.admin-users');
  if(!cont) return;
  try {
    const snap = await getDocs(collection(db, 'rh-daily-users'));
    let html = '';
    snap.forEach(d => {
       const u = d.data();
       html += `<div class="admin-user"><div class="admin-user-av">${u.name.substring(0,2).toUpperCase()}</div><div class="admin-user-info"><div class="admin-user-name">${u.name}</div><div class="admin-user-role">${d.id}</div></div><span class="admin-user-badge ${u.admin?'admin':'user'}">${u.admin?'Admin':'Usuário'}</span><button onclick="rmUser('${d.id}')" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:16px;padding:4px;">🗑</button></div>`;
    });
    cont.innerHTML = html + `<button class="btn-new-prio" style="margin-top:10px;width:100%;padding:10px;" onclick="addNewUser()">+ Convidar Novo Usuário</button>`;
  } catch(e) {}
}

window.addNewUser = async () => {
   const email = prompt("E-mail corporativo do usuário (ex: amanda@graodireto.com.br):");
   if(!email) return;
   const nome = prompt("Nome de exibição (ex: Amanda):");
   if(!nome) return;
   const admin = confirm("O usuário será um Administrador Geral?");
   await setDoc(doc(db, 'rh-daily-users', email.trim()), { name: nome.trim(), admin: admin });
   toast('Usuário adicionado', '✅');
   loadAdminUsers();
};

window.rmUser = async (email) => {
   if(!confirm(`Excluir o usuário ${email}? Ele perderá acesso ao painel.`)) return;
   await deleteDoc(doc(db, 'rh-daily-users', email));
   toast('Usuário excluído', '🗑️');
   loadAdminUsers();
};

function updateAdminStats(){updateMetrics();loadAdminUsers();}
window.clearLocalData=()=>{localStorage.clear();toast('Cache local limpo','🗑️');};
window.syncFirebase=async()=>{await loadFb();toast('Sincronizado com Firebase','🔄');};
window.clearAllData=async()=>{
  if(!confirm('ATENÇÃO: Isso vai apagar TODOS os dados do Firebase permanentemente. Tem certeza?'))return;
  if(!confirm('Segunda confirmação: todos os históricos e pautas serão perdidos para sempre. Continuar?'))return;
  try{
    for(const a of['dp','bp','rs','est']){
      await setDoc(doc(db,'rh-daily',a),{},{});
      const hs=await getDocs(collection(db,'rh-daily',a,'history'));
      for(const hd of hs.docs)await deleteDoc(hd.ref);
    }
    store={};localStorage.clear();
    updateOverview();renderHistory();renderPautaHistory();updateMetrics();
    toast('Todos os dados foram excluídos','🗑️');
  }catch(e){toast('Erro ao excluir: '+e.message,'❌');}
};

// ─── EXPORT ───────────────────────────────────────────────────────────────
window.exportData=()=>{
  const rows=[['Data','Área','Campo','Valor']];
  ['dp','bp','rs','est'].forEach(a=>{
    (store[a]?.history||[]).forEach(h=>{
      FIELD_MAP[a].forEach(sec=>sec.fields.forEach(f=>{if(h[f.key]?.trim())rows.push([h.date||'',AREAS[a].short,f.label,h[f.key]]);}));
    });
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='rh-daily-historico.csv';a.click();
};
window.exportHistory=window.exportData;
window.exportPDF=()=>{
  if(!window.html2pdf){ window.print(); return; }
  const opt = {
    margin: [10, 10, 10, 10],
    filename: 'relatorio-rh.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };
  const appCont = document.getElementById('app-container');
  toast('Gerando PDF de alta resolução...', '📄', 3000);
  document.body.style.overflow = 'visible'; // Evita scroll bugs no html2canvas
  html2pdf().set(opt).from(appCont).save().then(() => {
    toast('PDF Exportado', '✅');
    document.body.style.overflow = ''; // Restaura
  });
};

// ─── AI SUMMARY (HEURISTIC) ───────────────────────────────────────────────
window.generateAISummary = () => {
  const body = document.getElementById('daily-modal-body');
  if(!body) return;
  
  toast('Analisando dados com IA...', '✨', 2000);
  
  setTimeout(() => {
    const areas = ['dp', 'bp', 'rs', 'est'];
    let summaryHTML = `<div style="background:var(--glow); border:1.5px solid var(--primary-light); border-radius:14px; padding:20px; margin-bottom:24px; animation: fadeUp 0.5s ease;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
        <span style="font-size:20px;">✨</span>
        <strong style="font-size:16px; color:var(--primary-dark);">Resumo Executivo da Semana (Beta)</strong>
      </div>
      <div style="font-size:14px; line-height:1.6; color:var(--text);">`;
    
    let highlights = [];
    areas.forEach(a => {
      const d = store[a]?.current || store[a]?.draft || {};
      // Pegar as prioridades concluídas ou em andamento
      [1,2,3].forEach(n => {
        const field = `${a}_p${n}`;
        if(d[field] && prioStatus[field] === 'done') highlights.push(`✅ <b>${AREAS[a].short}:</b> ${d[field]}`);
      });
    });
    
    if(highlights.length === 0) {
      summaryHTML += `<p>Nenhuma prioridade concluída esta semana. Foco principal nas pautas operacionais de cada área.</p>`;
    } else {
      summaryHTML += `<p>Principais entregas da semana:</p><ul style="margin:10px 0 10px 20px;">${highlights.slice(0, 5).map(h => `<li>${h}</li>`).join('')}</ul>`;
    }
    
    // Insights baseados em volume de dados
    const rsVagas = store.rs?.current?.rs_vagas || store.rs?.draft?.rs_vagas || [];
    if(rsVagas.length > 5) summaryHTML += `<p>⚠️ <b>Insight:</b> Volume alto de vagas no Pipeline (${rsVagas.length}). Recomenda-se foco em triagem para evitar gargalos.</p>`;
    
    summaryHTML += `</div></div>`;
    
    // Inserir no topo do modal
    const existing = body.querySelector('.ai-summary-box');
    if(existing) existing.remove();
    
    const div = document.createElement('div');
    div.className = 'ai-summary-box';
    div.innerHTML = summaryHTML;
    body.prepend(div);
    
    toast('Resumo gerado com sucesso!', '✨');
  }, 1500);
};

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='d'){e.preventDefault();window.openDailyModal();}
  if(e.key==='Escape'){
    document.querySelectorAll('.overlay.active').forEach(o=>o.classList.remove('active'));
    closePresentation();
  }
});
