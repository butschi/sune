class Component extends DCLogic {
  state = {
    ready:false, theme:'dark', wide:false, tab:'learn',
    lang:(typeof navigator!=='undefined'&&(navigator.language||'').toLowerCase().indexOf('de')===0)?'de':'en',
    set:'oll', stFilter:-1, view:'cards', modal:null, play:null,
    qcfg:{sets:{oll:true,pll:true,f2l:false},scope:'all',mode:'name',timed:false}, quiz:null,
    tmode:'random', tfilter:{sets:{},st:{}}, tpin:null, tcase:null, scr:'', showPreview:false, inspection:false,
    tsplit:false, laps:[],
    tstate:'idle', armed:false, t0:0, now:0, inspStart:0,
    status:{}, pref:{}, qstats:{},
    sessions:[{name:'Session 1', solves:[]}], cur:0
  };
  componentDidMount(){
    this._mq=window.matchMedia('(min-width:900px)');
    this._onMq=()=>this.setState({wide:this._mq.matches});
    this._mq.addEventListener('change',this._onMq);
    this.setState({wide:this._mq.matches});
    this._kd=(e)=>this.onKey(e,true); this._ku=(e)=>this.onKey(e,false);
    window.addEventListener('keydown',this._kd); window.addEventListener('keyup',this._ku);
    // Keep the screen awake — a mid-solve or mid-drill screen lock loses the moment.
    // Native wake lock where it works; iOS home-screen apps reject it before 18.4,
    // so fall back to a tiny looping video (playback keeps the screen on). Retried
    // on every tap because iOS also rejects requests made without user activation,
    // and the OS silently releases the lock whenever the app is hidden.
    this._wlOn=()=>{
      if(document.visibilityState!=='visible'){ if(this._wlv) this._wlv.pause(); return; }
      if(this._wl&&!this._wl.released) return;
      if(navigator.wakeLock) navigator.wakeLock.request('screen').then(l=>{ this._wl=l; }).catch(()=>this.wakeVideo());
      else this.wakeVideo();
    };
    document.addEventListener('visibilitychange',this._wlOn);
    document.addEventListener('pointerdown',this._wlOn,{passive:true});
    this._wlOn();
    this._boot=setInterval(()=>{ if(window.CUBE&&window.ALGS&&window.F2L){ clearInterval(this._boot); this.boot(); } },60);
  }
  componentWillUnmount(){
    clearInterval(this._boot); this._mq.removeEventListener('change',this._onMq);
    window.removeEventListener('keydown',this._kd); window.removeEventListener('keyup',this._ku);
    document.removeEventListener('visibilitychange',this._wlOn);
    document.removeEventListener('pointerdown',this._wlOn);
    if(this._wl){ this._wl.release().catch(()=>{}); this._wl=null; }
    if(this._wlv){ this._wlv.pause(); this._wlv.remove(); this._wlv=null; }
    clearInterval(this._run); clearInterval(this._insp); clearTimeout(this._hold); clearInterval(this._qt); clearTimeout(this._pt); clearTimeout(this._auto);
  }
  componentDidUpdate(prevProps,prevState){
    // iOS ignores overflow:hidden on body, so lock background scroll with position:fixed
    const open=!!this.state.modal, was=!!prevState.modal;
    if(open===was) return;
    const b=document.body.style;
    if(open){ this._scrollY=window.scrollY; b.position='fixed'; b.top=(-this._scrollY)+'px'; b.left='0'; b.right='0'; b.width='100%'; }
    else { b.position=''; b.top=''; b.left=''; b.right=''; b.width=''; window.scrollTo(0,this._scrollY||0); }
  }
  // ---------- backup ----------
  exportData(){
    this.persist();
    const blob=new Blob([localStorage.getItem('sune-cfop-v1')||'{}'],{type:'application/json'});
    const a=document.createElement('a'), d=new Date(), p=n=>String(n).padStart(2,'0');
    a.href=URL.createObjectURL(blob);
    a.download='sune-backup-'+d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  }
  importData(){
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='application/json,.json';
    inp.onchange=()=>{
      const f=inp.files&&inp.files[0]; if(!f) return;
      const rd=new FileReader();
      rd.onload=()=>{
        try{
          const obj=JSON.parse(rd.result);
          if(!obj||typeof obj!=='object'||Array.isArray(obj)) throw 0;
          if(!['status','pref','sessions','qstats','theme','lang'].some(k=>obj[k]!==undefined)) throw 0;
          if(!window.confirm(this.tr('Replace all data in this browser with the imported backup?'))) return;
          localStorage.setItem('sune-cfop-v1',JSON.stringify(obj));
          location.reload();
        }catch(e){ window.alert(this.tr('Not a valid SUNE backup file.')); }
      };
      rd.readAsText(f);
    };
    inp.click();
  }
  wakeVideo(){
    if(!this._wlv){
      const v=document.createElement('video');
      v.muted=true; v.loop=true; v.setAttribute('playsinline','');
      v.src='wake.mp4';
      v.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
      document.body.appendChild(v); this._wlv=v;
    }
    this._wlv.play().catch(()=>{});
  }
  boot(){
    const C=window.CUBE, A=window.ALGS;
    const cat={};
    cat.f2l=window.F2L.map(c=>({uid:'f2l'+c.n,set:'f2l',id:'F2L '+c.n,name:c.name,group:c.group,algs:c.algs,viz:'iso'}));
    cat.oll=A.oll.map(o=>({uid:'oll'+o.n,set:'oll',id:'OLL '+o.n,name:o.name,group:o.group,algs:o.algs,ft:o.ft,viz:'oll'}));
    cat.pll=A.pll.map(p=>({uid:'pll'+p.id,set:'pll',id:p.id+' perm',name:'',group:p.group,algs:p.algs,ft:p.ft,viz:'pll'}));
    const byOll=n=>cat.oll[n-1], byPll=id=>cat.pll.find(p=>p.uid==='pll'+id);
    cat.oll2=A.oll2.edges.map(e=>({uid:'eo'+e.id.replace(/\s/g,''),set:'oll2',id:e.id,name:e.name,group:'Edge orientation',algs:e.algs,hint:e.hint,viz:'eoll'}))
      .concat(A.oll2.corners.map(byOll));
    cat.pll2=A.pll2.corners.map(byPll).concat(A.pll2.edges.map(byPll));
    this.cat=cat; this._svgs={}; this._svgsA={};
    let saved={}; try{ saved=JSON.parse(localStorage.getItem('sune-cfop-v1'))||{}; }catch(e){}
    const st={ready:true};
    ['theme','lang','status','pref','qstats','cur','inspection','tmode','tpin','tsplit','view'].forEach(k=>{ if(saved[k]!==undefined) st[k]=saved[k]; });
    if(saved.tfilter) st.tfilter={sets:Object.assign({},this.state.tfilter.sets,saved.tfilter.sets),st:Object.assign({},this.state.tfilter.st,saved.tfilter.st)};
    if(saved.sessions&&saved.sessions.length) st.sessions=saved.sessions;
    if(saved.qcfg) st.qcfg=Object.assign({},this.state.qcfg,saved.qcfg);
    st.cur=Math.min(st.cur||0,(st.sessions||this.state.sessions).length-1);
    this.setState(st,()=>{ this.newScr(); document.documentElement.lang=this.state.lang; });
  }
  persist(){
    const s=this.state;
    try{ localStorage.setItem('sune-cfop-v1',JSON.stringify({theme:s.theme,lang:s.lang,status:s.status,pref:s.pref,qstats:s.qstats,sessions:s.sessions,cur:s.cur,inspection:s.inspection,tmode:s.tmode,tfilter:s.tfilter,tpin:s.tpin,tsplit:s.tsplit,qcfg:s.qcfg,view:s.view})); }catch(e){}
  }
  cube3d(state,anim,grayNoise){
    const C=window.CUBE,S=32,kids=[];
    const mask=grayNoise?C.grayMask(state):null;
    const rotFor=n=>n[2]===1?'':(n[2]===-1?' rotateY(180deg)':(n[0]===1?' rotateY(90deg)':(n[0]===-1?' rotateY(-90deg)':(n[1]===1?' rotateX(90deg)':' rotateX(-90deg)'))));
    const CS=2.08*S; // small enough that its corners never pierce the rotating sticker orbit (radius 1.5*S)
    ['','rotateY(180deg)','rotateY(90deg)','rotateY(-90deg)','rotateX(90deg)','rotateX(-90deg)'].forEach((f,i)=>{
      kids.push(React.createElement('div',{key:'c'+i,style:{position:'absolute',left:(-CS/2)+'px',top:(-CS/2)+'px',width:CS+'px',height:CS+'px',background:'#100d16',transform:f+' translateZ('+(CS/2)+'px)'}}));});
    C.stickers.forEach((st,i)=>{
      const p=st.p,n=st.n;
      const t='translate3d('+((p[0]+0.5*n[0])*S)+'px,'+(-(p[1]+0.5*n[1])*S)+'px,'+((p[2]+0.5*n[2])*S)+'px)'+rotFor(n);
      const sty={position:'absolute',left:(-S/2)+'px',top:(-S/2)+'px',width:S+'px',height:S+'px',boxSizing:'border-box',borderRadius:'5px',border:'2.5px solid #100d16',background:(mask&&mask[i])?C.GRAY:C.COL[state[i]],'--b':t,transform:'var(--b)'};
      if(anim&&anim.sel(p)) sty.animation='sp'+anim.axis+(anim.deg>0?'p':'n')+Math.abs(anim.deg)+' '+(Math.abs(anim.deg)>90?'.5s':'.34s')+' cubic-bezier(.45,.05,.35,1) forwards';
      kids.push(React.createElement('div',{key:'s'+i,style:sty}));});
    return React.createElement('div',{style:{width:'230px',height:'214px',margin:'0 auto',perspective:'1100px',overflow:'visible'}},
      React.createElement('div',{style:{position:'relative',width:'0',height:'0',margin:'104px auto 0',transformStyle:'preserve-3d',transform:'rotateX(-28deg) rotateY(-38deg)'}},kids));
  }
  playGo(dir){
    const C=window.CUBE,p=this.state.play; if(!p||p.anim) return;
    const tokens=C.parseAlg(p.alg);
    if(dir>0&&p.step>=tokens.length) return;
    if(dir<0&&p.step<=0) return;
    const tok=dir>0?tokens[p.step]:C.invert(tokens[p.step-1]);
    const plan=C.movePlan(tok);
    if(!plan){ this.setState({play:{alg:p.alg,step:p.step+dir,anim:null}}); return; }
    this.setState({play:{alg:p.alg,step:p.step,anim:plan}});
    clearTimeout(this._pt);
    this._pt=setTimeout(()=>{ const q=this.state.play;
      if(q) this.setState({play:{alg:q.alg,step:q.step+dir,anim:null}}); },Math.abs(plan.deg)>90?520:360);
  }
  el(html,style){ return React.createElement('div',{style:style||{width:'100%'},dangerouslySetInnerHTML:{__html:html}}); }
  prefIdx(it){ return Math.min(this.state.pref[it.uid]||0,it.algs.length-1); }
  prefAlg(it){ return it.algs[this.prefIdx(it)]; }
  // The alg whose caseState the case diagram shows exactly. For PLL that is the
  // starred alg plus the AUF that draws the fewest arrows (canonical case);
  // everywhere else it is the starred alg itself (F2L data is pre-aligned).
  diagAlg(it){ return window.CUBE.diagramAlg(this.prefAlg(it), it.viz==='pll'?'pll':''); }
  // Fit algs[i] to the diagram state: the smallest AUF prefix/suffix that makes it
  // solve exactly what the diagram shows. Rows render pre/post dimmed; the player
  // plays `full`, so its start position always matches the diagram.
  algFit(it,i){
    const C=window.CUBE, base=C.caseState(this.diagAlg(it)), A=['','U','U2',"U'"];
    for(const pre of A) for(const post of A){
      const full=(pre?pre+' ':'')+it.algs[i]+(post?' '+post:'');
      if(C.caseSolved(it.set,C.apply(base,full))) return {pre,post,full};
    }
    return {pre:'',post:'',full:it.algs[i]};
  }
  // Diagrams follow the starred alg (cache key includes it).
  svgFor(it){
    const alg=this.prefAlg(it), key=it.uid+'§'+alg;
    if(this._svgs[key]) return this._svgs[key];
    const C=window.CUBE, st=C.caseState(alg);
    const svg = it.viz==='iso'?C.svgIso(st):C.svgTop(st,it.viz);
    return this._svgs[key]=this.el(svg);
  }
  // PLL diagrams with piece-movement arrows (Learn cards + modal; quiz stays plain).
  // Some standard algs end with a net U-layer offset; append the AUF that moves the
  // fewest pieces so the diagram shows the canonical case (e.g. Z perm: edges only).
  svgArrows(it,thin){
    if(it.viz!=='pll') return this.svgFor(it);
    const da=this.diagAlg(it), key=it.uid+'§'+(thin?'t§':'')+da;
    if(this._svgsA[key]) return this._svgsA[key];
    const C=window.CUBE;
    return this._svgsA[key]=this.el(C.svgTop(C.caseState(da),'pll',C.arrowsFor(da),thin));
  }
  allItems(){ return this.cat.f2l.concat(this.cat.oll,this.cat.pll); }
  find(uid){ return this.allItems().concat(this.cat.oll2).find(i=>i.uid===uid); }
  stMeta(v){ return [
    {label:'NEW',co:'var(--tx2)'},{label:'WANT',co:'var(--info)'},
    {label:'LEARNING',co:'var(--warn)'},{label:'KNOWN',co:'var(--good)'}][v||0]; }
  setStatus(uid,v){ const status=Object.assign({},this.state.status); status[uid]=v; this.setState({status},()=>this.persist()); }
  lbl(it){ return it.name?it.id+' · '+this.tr(it.name):it.id; }
  tr(s){
    if(s==null||typeof s!=='string') return s;
    const L=this.state.lang;
    if(L==='en'||!window.L10N||!window.L10N[L]) return s;
    const m=s.match(/^(\s*)([\s\S]*?)(\s*)$/), hit=window.L10N[L][m[2]];
    return hit!==undefined? m[1]+hit+m[3] : s;
  }
  trf(key,vars){ let s=this.tr(key); for(const k in vars) s=s.replace('{'+k+'}',vars[k]); return s; }
  chip(active){ return active?{bg:'var(--accsf)',bd:'var(--acc)',co:'var(--tx)'}:{bg:'var(--sf)',bd:'var(--ln)',co:'var(--tx2)'}; }
  trigCo(t){ return {sexy:'var(--info)',invsexy:'var(--good)',sledge:'var(--warn)',hedge:'var(--acc)'}[t]; }
  // ---------- timer ----------
  // empty filter group = no restriction: nothing selected means everything
  drillPool(){
    const s=this.state, tf=s.tfilter, out=[];
    const anySet=['f2l','oll','pll'].some(k=>tf.sets[k]);
    const anySt=[0,1,2,3].some(k=>tf.st[k]);
    ['f2l','oll','pll'].forEach(k=>{ if(!anySet||tf.sets[k]) out.push.apply(out,this.cat[k]); });
    return out.filter(it=>!anySt||tf.st[s.status[it.uid]||0]);
  }
  newScr(){
    const C=window.CUBE; if(!C) return;
    const s=this.state; let scr;
    if(s.tmode==='case'){
      const pin=s.tpin?this.find(s.tpin):null;
      const pool=pin?[pin]:this.drillPool();
      if(!pool.length){ this.setState({scr:'',tcase:null}); return; }
      let it=pool[(Math.random()*pool.length)|0];
      if(pool.length>1&&it.uid===s.tcase) it=pool[(Math.random()*pool.length)|0];
      // scramble = exact inverse of the diagram alg: starts from a solved cube,
      // sets up exactly the shown diagram, and solving with the displayed alg
      // returns to solved — cases chain seamlessly (identical to modal setup)
      scr=C.drillScramble(this.diagAlg(it));
      this.setState({scr,tcase:it.uid});
    } else if(s.tmode==='ll'){
      const o=this.cat.oll[(Math.random()*this.cat.oll.length)|0];
      const p=this.cat.pll[(Math.random()*this.cat.pll.length)|0];
      const A=['','U','U2',"U'"];
      scr=C.llScramble(this.prefAlg(o),this.prefAlg(p),A[(Math.random()*4)|0],A[(Math.random()*4)|0]);
      this.setState({scr,tcase:null});
    } else { scr=C.scramble(this.props.scrambleLength??20); this.setState({scr}); }
  }
  phaseCo(n){ return {Cross:'var(--info)',F2L:'var(--acc)',OLL:'var(--warn)',PLL:'var(--good)'}[n]||'var(--tx2)'; }
  // phase labels for split timing in the current mode, or null when off
  phaseLabels(){
    const s=this.state;
    if(!s.tsplit) return null;
    if(s.tmode==='ll') return ['OLL','PLL'];
    if(s.tmode==='random') return ['Cross','F2L','OLL','PLL'];
    return null;
  }
  scrSvgEl(){
    const C=window.CUBE; if(!C||!this.state.scr) return null;
    return this.el(C.svgNet(C.apply(C.solved(),this.state.scr)));
  }
  session(){ return this.state.sessions[this.state.cur]; }
  beginHold(){
    clearTimeout(this._hold);
    this._hold=setTimeout(()=>this.setState({armed:true}),300);
  }
  padDown(e){
    if(e&&e.button>0) return;
    const s=this.state;
    if(s.tstate==='run'){
      const phases=this.phaseLabels();
      if(phases&&s.laps.length<phases.length-1){ this.setState({laps:s.laps.concat([Date.now()-s.t0])}); return; }
      this.finish(); this._justStopped=true; return;
    }
    if(s.tmode==='case'&&!s.scr) return;
    if(s.tstate==='idle'&&s.inspection){ this.startInspect(); return; }
    this.beginHold();
  }
  padUp(){
    const s=this.state;
    if(this._justStopped){ this._justStopped=false; return; }
    clearTimeout(this._hold);
    if(s.armed){ this.startRun(); }
    this.setState({armed:false});
  }
  padCancel(){ clearTimeout(this._hold); this.setState({armed:false}); }
  noCtx(e){ e.preventDefault(); }
  startInspect(){
    this.setState({tstate:'inspect',inspStart:Date.now(),now:Date.now()});
    this._insp=setInterval(()=>this.setState({now:Date.now()}),150);
  }
  startRun(){
    clearInterval(this._insp);
    const inspSec=this.state.tstate==='inspect'?(Date.now()-this.state.inspStart)/1000:0;
    this._inspOver=Math.max(0,inspSec-15);
    this.setState({tstate:'run',t0:Date.now(),now:Date.now(),armed:false,laps:[]});
    this._run=setInterval(()=>this.setState({now:Date.now()}),33);
  }
  finish(){
    clearInterval(this._run);
    const ms=Date.now()-this.state.t0;
    const pen=this._inspOver>2?'dnf':(this._inspOver>0?2:0);
    const sv={ms,pen,scr:this.state.scr,ts:Date.now()};
    // tag case-drill and last-layer times so they never mix into real solve stats
    if(this.state.tmode==='case'&&this.state.tcase) sv.drill=this.state.tcase;
    if(this.state.tmode==='ll') sv.ll=1;
    const laps=this.state.laps;
    if(laps&&laps.length){ const ph=[]; let prev=0; laps.forEach(l=>{ ph.push(l-prev); prev=l; }); ph.push(ms-prev); sv.ph=ph; }
    const sessions=this.state.sessions.map((x,i)=>i===this.state.cur?{name:x.name,solves:x.solves.concat([sv])}:x);
    this.setState({tstate:'idle',sessions,laps:[]},()=>{ this.persist(); this.newScr(); });
  }
  onKey(e,down){
    if(this.state.tab!=='timer'||this.state.modal) return;
    const tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='select'||tag==='textarea') return;
    if(e.code!=='Space') return;
    e.preventDefault();
    if(down){ if(!e.repeat&&!this._spaceHeld){ this._spaceHeld=true; this.padDown(); } }
    else { this._spaceHeld=false; this.padUp(); }
  }
  fmt(ms){
    if(ms==null) return '—';
    const cs=Math.round(ms/10), m=Math.floor(cs/6000);
    const s=((cs%6000)/100).toFixed(2);
    return m>0? m+':'+(s.length<5?'0':'')+s : s;
  }
  solveMs(sv){ return sv.pen==='dnf'?Infinity:sv.ms+(sv.pen===2?2000:0); }
  aoN(solves,n){
    if(solves.length<n) return null;
    const last=solves.slice(-n).map(s=>this.solveMs(s)).sort((a,b)=>a-b);
    const mid=last.slice(1,-1);
    if(mid.some(v=>!isFinite(v))) return 'DNF';
    return this.fmt(mid.reduce((a,b)=>a+b,0)/mid.length);
  }
  best(solves){ const v=solves.map(s=>this.solveMs(s)).filter(isFinite); return v.length?this.fmt(Math.min.apply(null,v)):null; }
  bestDrill(uid){ const all=[]; this.state.sessions.forEach(x=>x.solves.forEach(sv=>{ if(sv.drill===uid) all.push(sv); })); return this.best(all); }
  mutSolve(idx,fn){
    const sessions=this.state.sessions.map((x,i)=>{
      if(i!==this.state.cur) return x;
      const solves=x.solves.slice(); const r=fn(solves[idx],solves); return {name:x.name,solves:r||solves};
    });
    this.setState({sessions},()=>this.persist());
  }
  // ---------- quiz ----------
  quizPool(){
    const s=this.state, pools=[];
    ['f2l','oll','pll'].forEach(k=>{ if(s.qcfg.sets[k]) pools.push.apply(pools,this.cat[k]); });
    if(s.qcfg.scope==='learn') return pools.filter(i=>{const v=s.status[i.uid]||0; return v===1||v===2;});
    if(s.qcfg.scope==='known') return pools.filter(i=>(s.status[i.uid]||0)===3);
    return pools;
  }
  shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0, t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  startQuiz(){
    const pool=this.quizPool(); if(pool.length<2) return;
    clearInterval(this._qt);
    const quiz={qnum:0,score:0,streak:0,missed:[],done:false};
    this.setState({quiz},()=>this.nextQ());
  }
  nextQ(){
    const s=this.state, pool=this.quizPool();
    if(s.quiz.qnum>=10){ const quiz=Object.assign({},s.quiz,{done:true}); clearInterval(this._qt); this.setState({quiz}); return; }
    let t=pool[(Math.random()*pool.length)|0];
    if(pool.length>1&&this._lastQ===t.uid) t=pool[(Math.random()*pool.length)|0];
    this._lastQ=t.uid;
    const all=this.cat[t.set].filter(i=>i.uid!==t.uid);
    const same=this.shuffle(all.filter(i=>i.group===t.group));
    const rest=this.shuffle(all.filter(i=>i.group!==t.group));
    const n=Math.min(this.props.quizChoices??4,all.length+1);
    const opts=this.shuffle([t].concat(same.concat(rest).slice(0,n-1)));
    const secs=this.props.quizSeconds??10;
    const quiz=Object.assign({},s.quiz,{qnum:s.quiz.qnum+1,target:t,opts,picked:null,deadline:Date.now()+secs*1000,left:secs*1000});
    this.setState({quiz});
    clearInterval(this._qt);
    if(s.qcfg.timed) this._qt=setInterval(()=>{
      const q=this.state.quiz; if(!q||q.picked!==null) return;
      const left=q.deadline-Date.now();
      if(left<=0){ this.pickOpt(-1); } else this.setState({quiz:Object.assign({},q,{left})});
    },100);
  }
  pickOpt(i){
    const q=this.state.quiz; if(!q||q.picked!==null) return;
    clearInterval(this._qt);
    const ok=i>=0&&q.opts[i].uid===q.target.uid;
    const qstats=Object.assign({},this.state.qstats);
    const rec=Object.assign({a:0,c:0},qstats[q.target.uid]);
    rec.a++; if(ok) rec.c++; qstats[q.target.uid]=rec;
    const quiz=Object.assign({},q,{picked:i,ok,score:q.score+(ok?1:0),streak:ok?q.streak+1:0,
      missed:ok?q.missed:q.missed.concat([q.target.uid])});
    this.setState({quiz,qstats},()=>this.persist());
    if(ok) this._auto=setTimeout(()=>{ if(this.state.quiz&&this.state.quiz.picked!==null&&!this.state.quiz.done) this.nextQ(); },900);
  }
  openCase(uid){
    const it=this.find(uid); if(!it) return;
    this.setState({modal:uid,play:null,tab:this.state.tab});
  }
  // ---------- render ----------
  renderVals(){
    const s=this.state, C=window.CUBE, A=window.ALGS;
    const v={ theme:s.theme, wide:s.wide, narrow:!s.wide, loading:!s.ready,
      themeGlyph:s.theme==='dark'?'◐':'◑',
      toggleTheme:()=>this.setState({theme:s.theme==='dark'?'light':'dark'},()=>this.persist()),
      __tr:(x)=>this.tr(x),
      langLabel:s.lang==='de'?'DE':'EN',
      toggleLang:()=>{ const lang=s.lang==='de'?'en':'de';
        this.setState({lang},()=>{ this.persist(); document.documentElement.lang=lang; }); },
      isLearn:s.ready&&s.tab==='learn', isDrill:s.ready&&s.tab==='drill', isTimer:s.ready&&s.tab==='timer',
      isGuide:s.ready&&s.tab==='guide', isStats:s.ready&&s.tab==='stats',
      modalOn:false, playOn:false, playOff:true, m:{}, quizTimed:false };
    v.nav=[['learn','Learn'],['drill','Drill'],['timer','Timer'],['guide','Guide'],['stats','Progress']].map(n=>({
      label:n[1], icon:this.navIcon(n[0]), go:()=>this.setState({tab:n[0]}),
      bg:s.tab===n[0]?'var(--accsf)':'transparent', co:s.tab===n[0]?'var(--tx)':'var(--tx2)',
      co2:s.tab===n[0]?'var(--acc)':'var(--tx2)'}));
    if(!s.ready) return v;
    // ----- learn -----
    const setDefs=[['f2l','F2L'],['oll','OLL'],['pll','PLL'],['oll2','2-Look OLL'],['pll2','2-Look PLL'],['cross','Cross']];
    v.setChips=setDefs.map(d=>Object.assign({label:d[1],pick:()=>this.setState({set:d[0],stFilter:-1})},this.chip(s.set===d[0])));
    v.isCross=s.set==='cross'; v.notCross=!v.isCross;
    v.setIntro=s.set==='oll2'?this.tr(A.oll2.intro):(s.set==='pll2'?this.tr(A.pll2.intro)+' '+this.tr(A.pll2.cornersHint):(s.set==='cross'?this.tr(A.cross.intro):null));
    v.crossTips=A.cross.tips.map((t,i)=>({num:'0'+(i+1),title:t[0],body:t[1]}));
    if(v.notCross){
      const items=this.cat[s.set]||[];
      const counts=[0,0,0,0]; items.forEach(it=>counts[s.status[it.uid]||0]++);
      const stDefs=[[-1,'All'],[0,'New'],[1,'Want'],[2,'Learning'],[3,'Known']];
      v.statusChips=stDefs.map(d=>Object.assign({
        label:d[1], count:d[0]<0?items.length:counts[d[0]],
        dot:d[0]<0?'var(--acc)':this.stMeta(d[0]).co,
        pick:()=>this.setState({stFilter:d[0]})},this.chip(s.stFilter===d[0])));
      const tot=items.length||1;
      v.pctKnown=(counts[3]/tot*100).toFixed(1); v.pctLearn=(counts[2]/tot*100).toFixed(1); v.pctWant=(counts[1]/tot*100).toFixed(1);
      v.viewCards=s.view!=='list'; v.viewList=s.view==='list';
      v.viewGlyph=s.view==='list'?'▦':'☰';
      v.toggleView=()=>this.setState({view:s.view==='list'?'cards':'list'},()=>this.persist());
      const gOrder=[], gMap={};
      items.filter(it=>s.stFilter<0||(s.status[it.uid]||0)===s.stFilter).forEach(it=>{
        const st=s.status[it.uid]||0, meta=this.stMeta(st);
        const row={ id:it.id, name:it.name, svg:this.svgArrows(it), svgSm:this.svgArrows(it,true), alg:this.prefAlg(it), dot:st===0?'transparent':meta.co,
          stLabel:meta.label, stCo:meta.co,
          open:()=>this.openCase(it.uid),
          cycle:(e)=>{ e.stopPropagation(); this.setStatus(it.uid,(st+1)%4); } };
        const t=(this.tr(it.group)||'').toUpperCase();
        if(!gMap[t]){ gMap[t]=[]; gOrder.push(t); }
        gMap[t].push(row);
      });
      v.learnGroups=gOrder.map(t=>({title:t,items:gMap[t]}));
    }
    // ----- modal -----
    if(s.modal){
      const it=this.find(s.modal);
      if(it){
        v.modalOn=true;
        const st=s.status[it.uid]||0, pref=s.pref[it.uid]||0;
        const setup=C.drillScramble(this.diagAlg(it));
        const trigsFound={}; let anyAdjust=false;
        const adjustLabel='alignment turn to match the shown position';
        const algs=it.algs.map((raw,i)=>{
          const fit=this.algFit(it,i);
          if(fit.pre||fit.post) anyAdjust=true;
          const adjSeg=t=>({txt:t,title:adjustLabel,co:'var(--tx2)',bb:'2px dotted var(--tx2)',ws:'nowrap'});
          const segs=(fit.pre?[adjSeg(fit.pre)]:[])
            .concat(C.segments(raw).map(g=>{ if(g.trig) trigsFound[g.trig]=g.label;
              return { txt:g.txt, title:g.label||'', co:g.trig?this.trigCo(g.trig):'var(--tx)', bb:g.trig?('2px solid '+this.trigCo(g.trig)):'none',
                ws:g.trig?'nowrap':'normal' }; }))
            .concat(fit.post?[adjSeg(fit.post)]:[]);
          return { segs, starCo:i===Math.min(pref,it.algs.length-1)?'var(--warn)':'var(--ln)',
            makePref:()=>{ const p=Object.assign({},s.pref); p[it.uid]=i; this.setState({pref:p},()=>this.persist()); },
            play:()=>this.setState({play:{alg:fit.full,step:0}}) };
        });
        const qs=s.qstats[it.uid], accParts=[];
        if(qs) accParts.push(this.trf('drill record: {c}/{a} correct',{c:qs.c,a:qs.a}));
        const dbest=this.bestDrill(it.uid);
        if(dbest) accParts.push(this.trf('case best: {t}',{t:dbest}));
        v.m={ id:it.id, nameSuffix:it.name?'\u00b7 '+this.tr(it.name):'', groupUp:(this.tr(it.group)||'').toUpperCase(), svg:this.svgArrows(it),
          hint:it.hint||null, ft:it.ft||null, algs, setup,
          legendOn:Object.keys(trigsFound).length>0||anyAdjust,
          legend:Object.keys(trigsFound).map(k=>({co:this.trigCo(k),label:trigsFound[k]}))
            .concat(anyAdjust?[{co:'var(--tx2)',label:adjustLabel}]:[]),
          statusOpts:[0,1,2,3].map(x=>{ const mm=this.stMeta(x); const on=st===x;
            return { label:mm.label, pick:()=>this.setStatus(it.uid,x),
              bd:on?mm.co:'var(--ln)', bg:on?'var(--sf2)':'var(--sf)', co:on?mm.co:'var(--tx2)' }; }),
          toTimer:()=>{ if(it.set==='f2l'||it.set==='oll'||it.set==='pll'){
              this.setState({modal:null,tab:'timer',tmode:'case',tpin:it.uid,tcase:it.uid},()=>{ this.persist(); this.newScr(); });
            } else this.setState({modal:null,tab:'timer'}); },
          acc:accParts.length?accParts.join(' · '):null };
        if(s.play){
          v.playOn=true; v.playOff=false;
          const tokens=C.parseAlg(s.play.alg);
          let cs=C.caseState(s.play.alg);
          for(let i=0;i<s.play.step;i++) cs=C.applyToken(cs,tokens[i]);
          v.playSvg=this.cube3d(cs,s.play.anim,it.viz==='iso');
          v.playTokens=tokens.map((t,i)=>({ txt:t,
            bg:i===s.play.step?'var(--acc)':(i<s.play.step?'var(--sf2)':'var(--sf)'),
            co:i===s.play.step?'#fff':(i<s.play.step?'var(--tx2)':'var(--tx)') }));
          v.playNext=()=>this.playGo(1);
          v.playPrev=()=>this.playGo(-1);
          v.playReset=()=>{ clearTimeout(this._pt); this.setState({play:{alg:s.play.alg,step:0,anim:null}}); };
          v.playStop=()=>this.setState({play:null});
        }
      }
    }
    v.closeModal=()=>this.setState({modal:null,play:null});
    v.eatClick=(e)=>e.stopPropagation();
    v.sheetAlign=s.wide?'center':'flex-end';
    v.sheetPad=s.wide?'24px':'0';
    v.sheetRadius=s.wide?'22px':'22px 22px 0 0';
    // ----- drill -----
    const q=s.quiz;
    v.qConfig=!q; v.qActive=!!q&&!q.done; v.qDone=!!q&&q.done;
    v.qSetChips=[['f2l','F2L'],['oll','OLL'],['pll','PLL']].map(d=>Object.assign({
      label:d[1], pick:()=>{ const sets=Object.assign({},s.qcfg.sets); sets[d[0]]=!sets[d[0]];
        this.setState({qcfg:Object.assign({},s.qcfg,{sets})},()=>this.persist()); }},this.chip(s.qcfg.sets[d[0]])));
    v.qScopeChips=[['all','All cases'],['learn','Want + learning'],['known','Known only']].map(d=>Object.assign({
      label:d[1], pick:()=>this.setState({qcfg:Object.assign({},s.qcfg,{scope:d[0]})},()=>this.persist())},this.chip(s.qcfg.scope===d[0])));
    v.qModeChips=[['name','Case name'],['alg','Algorithm'],['timed','Name · timed']].map(d=>Object.assign({
      label:d[1], pick:()=>this.setState({qcfg:Object.assign({},s.qcfg,{mode:d[0]==='timed'?'name':d[0],timed:d[0]==='timed'})},()=>this.persist())},
      this.chip(d[0]==='timed'?s.qcfg.timed:(s.qcfg.mode===d[0]&&!s.qcfg.timed))));
    const pool=this.quizPool();
    v.qPoolLabel=this.trf('{n} cases in pool',{n:pool.length});
    v.qStartDisabled=pool.length<2;
    v.qStartBg=pool.length<2?'var(--sf2)':'var(--acc)';
    v.startQuiz=()=>this.startQuiz();
    v.quitQuiz=()=>{ clearInterval(this._qt); this.setState({quiz:null}); };
    if(q&&!q.done&&q.target){
      v.quizNum=q.qnum; v.quizScore=q.score; v.quizStreak=q.streak;
      v.quizTimed=s.qcfg.timed;
      const secs=(this.props.quizSeconds??10)*1000;
      v.quizBarPct=Math.max(0,(q.left/secs*100)).toFixed(1);
      v.quizBarCo=q.left<secs*0.3?'var(--bad)':'var(--acc)';
      v.quizSvg=this.svgFor(q.target);
      v.quizPrompt=s.qcfg.mode==='alg'?'WHICH ALGORITHM SOLVES THIS?':'NAME THIS CASE';
      v.quizCols=s.qcfg.mode==='alg'?'1fr':(s.wide?'1fr 1fr':'1fr');
      v.quizOpts=q.opts.map((o,i)=>{
        const isPick=q.picked===i, isRight=q.picked!==null&&o.uid===q.target.uid;
        return { label:s.qcfg.mode==='alg'?this.prefAlg(o):this.lbl(o),
          ff:s.qcfg.mode==='alg'?"'IBM Plex Mono',monospace":'inherit',
          fs:s.qcfg.mode==='alg'?'13px':'14.5px',
          bd:isRight?'var(--good)':(isPick?'var(--bad)':'var(--ln)'),
          bg:isRight?'color-mix(in srgb, var(--good) 14%, var(--sf))':(isPick?'color-mix(in srgb, var(--bad) 12%, var(--sf))':'var(--sf)'),
          co:'var(--tx)', pick:()=>this.pickOpt(i) };
      });
      v.quizFb=q.picked===null?'':(q.ok?['Nice.','Clean.','That’s it.','Instant.'][q.qnum%4]:(q.picked===-1?this.trf('Time! It was {c}.',{c:q.target.id}):this.trf('It was {c}',{c:this.lbl(q.target)})));
      v.quizFbCo=q.ok?'var(--good)':'var(--bad)';
      v.quizNextOn=q.picked!==null;
      v.quizNext=()=>{ clearTimeout(this._auto); this.nextQ(); };
    }
    if(q&&q.done){
      v.quizScore=q.score;
      v.quizVerdict=q.score>=9?'Recognition is automatic. Add harder cases.':(q.score>=7?'Solid — drill the misses below.':(q.score>=4?'Getting there. Repetition builds recognition.':'Slow down in Learn mode first, then come back.'));
      const uniq=Array.from(new Set(q.missed));
      v.quizMissedOn=uniq.length>0;
      v.quizMissed=uniq.map(uid=>{ const it=this.find(uid);
        return { label:this.lbl(it), svg:this.svgArrows(it,true), open:()=>this.openCase(uid) }; });
    }
    // ----- timer -----
    v.tmodeChips=[['random','Random scramble'],['ll','Last layer'],['case','Case drill']].map(d=>Object.assign({
      label:d[1], pick:()=>this.setState({tmode:d[0]},()=>{ this.persist(); this.newScr(); })},this.chip(s.tmode===d[0])));
    v.tCaseMode=s.tmode==='case'; v.tLLMode=s.tmode==='ll'; v.tSplitOn=s.tmode!=='case';
    const spc=this.chip(s.tsplit);
    v.splitBd=spc.bd; v.splitBg=spc.bg; v.splitCo=spc.co; v.splitState=s.tsplit?'on':'off';
    v.toggleSplit=()=>this.setState({tsplit:!s.tsplit},()=>this.persist());
    const tf=s.tfilter;
    v.tfSetChips=[['f2l','F2L'],['oll','OLL'],['pll','PLL']].map(d=>Object.assign({
      label:d[1], pick:()=>{ const sets=Object.assign({},tf.sets); sets[d[0]]=!sets[d[0]];
        this.setState({tfilter:{sets,st:tf.st},tpin:null},()=>{ this.persist(); this.newScr(); }); }},this.chip(tf.sets[d[0]])));
    v.tfStChips=[[0,'New'],[1,'Want'],[2,'Learning'],[3,'Known']].map(d=>Object.assign({
      label:d[1], dot:this.stMeta(d[0]).co,
      pick:()=>{ const stf=Object.assign({},tf.st); stf[d[0]]=!stf[d[0]];
        this.setState({tfilter:{sets:tf.sets,st:stf},tpin:null},()=>{ this.persist(); this.newScr(); }); }},this.chip(tf.st[d[0]])));
    const tfEmpty=!['f2l','oll','pll'].some(k=>tf.sets[k])&&![0,1,2,3].some(k=>tf.st[k]);
    const tfAllChip=this.chip(tfEmpty);
    v.tfAllBd=tfAllChip.bd; v.tfAllBg=tfAllChip.bg; v.tfAllCo=tfAllChip.co;
    v.tfAll=()=>this.setState({tfilter:{sets:{},st:{}},tpin:null},()=>{ this.persist(); this.newScr(); });
    const tpool=s.tpin?[this.find(s.tpin)].filter(Boolean):this.drillPool();
    v.tPoolLabel=this.trf('{n} cases in pool',{n:tpool.length});
    const tcur=s.tcase?this.find(s.tcase):null;
    v.tCurOn=!!tcur&&!s.tpin; v.tPinOn=!!s.tpin;
    v.tCurLabel=tcur?this.lbl(tcur):'';
    v.tCurOpen=()=>{ if(tcur) this.openCase(tcur.uid); };
    v.tUnpin=()=>this.setState({tpin:null},()=>{ this.persist(); this.newScr(); });
    const ins=this.chip(s.inspection);
    v.inspBd=ins.bd; v.inspBg=ins.bg; v.inspCo=ins.co; v.inspState=s.inspection?'on':'off';
    v.toggleInspection=()=>this.setState({inspection:!s.inspection},()=>this.persist());
    v.scr=s.scr; v.newScr=()=>this.newScr();
    v.showPreview=s.showPreview; v.prevBg=s.showPreview?'var(--accsf)':'var(--sf2)';
    v.togglePreview=()=>this.setState({showPreview:!s.showPreview});
    v.scrSvg=s.showPreview?this.scrSvgEl():null;
    v.padDown=(e)=>this.padDown(e); v.padUp=()=>this.padUp(); v.padCancel=()=>this.padCancel(); v.noCtx=(e)=>e.preventDefault();
    // While inspecting or solving, the pad goes fullscreen: no distractions and
    // the whole screen is the touch zone. Same element in both layouts, so an
    // in-flight touch (hold-to-arm, tap-to-stop) survives the style switch.
    const zen=s.tstate==='run'||s.tstate==='inspect';
    v.padPos=zen?'fixed':'relative'; v.padInset=zen?'0':'auto'; v.padZ=zen?'200':'auto';
    v.padRad=zen?'0':'18px'; v.padH=zen?'auto':'220px'; v.padMt=zen?'0':'12px';
    v.padTimeFs=zen?'min(20vw,120px)':'64px';
    // case mode shows only the drilled case's times; random mode only real solves
    const indexed=this.session().solves.map((sv,i)=>({sv,i})).filter(x=>{
      if(v.tCaseMode) return s.tpin?x.sv.drill===s.tpin:!!x.sv.drill;
      if(v.tLLMode) return !!x.sv.ll;
      return !x.sv.drill&&!x.sv.ll;
    });
    const solves=indexed.map(x=>x.sv);
    const lastSv=solves[solves.length-1];
    const phl=this.phaseLabels();
    if(s.tstate==='run'){ v.timeDisp=this.fmt(s.now-s.t0); v.timeCo='var(--tx)';
      v.padHint=phl?this.tr(phl[s.laps.length])+' · '+this.tr(s.laps.length<phl.length-1?'tap to split':'tap to stop'):this.tr('tap to stop');
      v.padSplitSegs=s.laps.map((l,i)=>({txt:(((i?l-s.laps[i-1]:l))/1000).toFixed(1),co:this.phaseCo(phl?phl[i]:'')}));
      v.padBg='var(--sf)'; v.padBd='var(--acc)'; }
    else if(s.tstate==='inspect'){
      const left=15-Math.floor((s.now-s.inspStart)/1000);
      v.timeDisp=String(Math.max(-2,left)); v.timeCo=s.armed?'var(--good)':(left<=3?'var(--bad)':'var(--warn)');
      v.padHint=s.armed?'release to start':'inspecting — hold, then release to start'; v.padBg='var(--sf)'; v.padBd=left<=3?'var(--bad)':'var(--warn)';
    }
    else { v.timeDisp=s.armed?'0.00':(lastSv?this.fmt(this.solveMs(lastSv))+(lastSv.pen==='dnf'?'':(lastSv.pen===2?'+':'')):'0.00');
      if(lastSv&&lastSv.pen==='dnf'&&!s.armed) v.timeDisp='DNF';
      v.timeCo=s.armed?'var(--good)':'var(--tx)';
      v.padHint=s.armed?'release to start':(s.inspection?'tap to inspect':'hold, release to start · space on desktop');
      v.padBg=s.armed?'color-mix(in srgb, var(--good) 10%, var(--sf))':'var(--sf)'; v.padBd=s.armed?'var(--good)':'var(--ln)'; }
    v.padSplitSegs=v.padSplitSegs||[];
    if(phl){
      const withPh=solves.filter(x=>x.ph&&x.ph.length===phl.length&&x.pen!=='dnf');
      v.phaseOn=withPh.length>0;
      v.phaseStats=phl.map((lb,i)=>({label:'ø '+this.tr(lb),co:this.phaseCo(lb),
        val:withPh.length?this.fmt(withPh.reduce((a,x)=>a+x.ph[i],0)/withPh.length):'—'}));
    } else v.phaseOn=false;
    v.tstats=[['BEST',this.best(solves)||'—'],['AO5',this.aoN(solves,5)||'—'],['AO12',this.aoN(solves,12)||'—'],
      ['MEAN',solves.length?this.fmt(solves.filter(x=>x.pen!=='dnf').reduce((a,b)=>a+this.solveMs(b),0)/Math.max(1,solves.filter(x=>x.pen!=='dnf').length)):'—'],
      ['SOLVES',String(solves.length)]].map(x=>({label:x[0],val:x[1]}));
    v.cur=s.cur;
    v.sessionOpts=s.sessions.map((x,i)=>({i,label:x.name+' ('+x.solves.filter(y=>!y.drill&&!y.ll).length+')'}));
    v.sessionPick=(e)=>this.setState({cur:+e.target.value},()=>this.persist());
    v.newSession=()=>{ const sessions=s.sessions.concat([{name:'Session '+(s.sessions.length+1),solves:[]}]);
      this.setState({sessions,cur:sessions.length-1},()=>this.persist()); };
    v.clearSession=()=>{ const sessions=s.sessions.map((x,i)=>i===s.cur?{name:x.name,solves:[]}:x);
      this.setState({sessions},()=>this.persist()); };
    v.solveRows=indexed.map(({sv,i},k)=>({
      num:'#'+(k+1),
      caseLbl:sv.drill?(this.find(sv.drill)||{id:''}).id:'',
      phSegs:(!sv.drill&&sv.ph)?sv.ph.map((p,i)=>({txt:(p/1000).toFixed(1),
        co:this.phaseCo((sv.ph.length===2?['OLL','PLL']:['Cross','F2L','OLL','PLL'])[i]||'')})):[],
      disp:sv.pen==='dnf'?'DNF':this.fmt(this.solveMs(sv))+(sv.pen===2?'+':''),
      co:sv.pen==='dnf'?'var(--bad)':(sv.pen===2?'var(--warn)':'var(--tx)'),
      p2bg:sv.pen===2?'var(--accsf)':'var(--sf2)', dnfbg:sv.pen==='dnf'?'var(--accsf)':'var(--sf2)',
      plus2:()=>this.mutSolve(i,(x)=>{ x.pen=x.pen===2?0:2; }),
      dnf:()=>this.mutSolve(i,(x)=>{ x.pen=x.pen==='dnf'?0:'dnf'; }),
      del:()=>this.mutSolve(i,(x,arr)=>{ arr.splice(i,1); return arr; })
    })).reverse();
    // ----- guide -----
    v.gsteps=A.guide.steps.map((g,i)=>({num:'0'+(i+1),title:g[0],body:g[1],
      go:()=>this.setState({tab:'learn',set:g[2],stFilter:-1})}));
    v.grips=A.guide.grips.map(g=>({title:g[0],body:g[1]}));
    v.trigRows=A.guide.triggers.map(t=>({co:this.trigCo(t[0]),name:t[1],alg:t[2],body:t[3]}));
    v.habits=A.guide.habits.map(h=>({title:h[0],body:h[1]}));
    // ----- stats -----
    v.progRows=[['f2l','F2L'],['oll','OLL'],['pll','PLL']].map(d=>{
      const items=this.cat[d[0]], c=[0,0,0,0];
      items.forEach(it=>c[s.status[it.uid]||0]++);
      const tot=items.length;
      return { label:d[1], counts:this.trf('{k} / {n} known',{k:c[3],n:tot}),
        k:(c[3]/tot*100).toFixed(1), l:(c[2]/tot*100).toFixed(1), w:(c[1]/tot*100).toFixed(1),
        go:()=>this.setState({tab:'learn',set:d[0],stFilter:-1}) };
    });
    let qa=0,qc=0; Object.keys(s.qstats).forEach(k=>{ qa+=s.qstats[k].a; qc+=s.qstats[k].c; });
    v.qTotal=String(qa); v.qAcc=qa?Math.round(qc/qa*100)+'%':'—';
    const weak=Object.keys(s.qstats).map(uid=>({uid,rec:s.qstats[uid]}))
      .filter(x=>x.rec.a>=2&&x.rec.c<x.rec.a)
      .sort((a,b)=>(a.rec.c/a.rec.a)-(b.rec.c/b.rec.a)).slice(0,8)
      .map(x=>{ const it=this.find(x.uid); if(!it) return null;
        return { label:this.lbl(it), svg:this.svgArrows(it,true),
          acc:Math.round(x.rec.c/x.rec.a*100)+'%', open:()=>this.openCase(x.uid) }; }).filter(Boolean);
    v.weakOn=weak.length>0; v.weakRows=weak;
    // drill-time stats per case, across all sessions (case execution, not full solves)
    const dstats={};
    s.sessions.forEach(x=>x.solves.forEach(sv=>{
      if(!sv.drill) return;
      const r=dstats[sv.drill]||(dstats[sv.drill]={n:0,best:Infinity});
      r.n++; const dms=this.solveMs(sv);
      if(dms<r.best) r.best=dms;
    }));
    const drilled=Object.keys(dstats);
    const totalDrills=drilled.reduce((a,u)=>a+dstats[u].n,0);
    v.drillOn=totalDrills>0;
    v.drillTiles=[['TOTAL DRILLS',String(totalDrills)],['CASES DRILLED',drilled.length+' / '+this.allItems().length]].map(x=>({label:x[0],val:x[1]}));
    // rank by turns-per-second at the case best — comparable across F2L/OLL/PLL,
    // unlike raw times, which would always blame the longest algs
    const slow=drilled.map(uid=>{
        const it=this.find(uid), st=dstats[uid];
        if(!it||st.n<2||!isFinite(st.best)||st.best<=0) return null;
        const tps=C.parseAlg(this.prefAlg(it)).length/(st.best/1000);
        return { it, st, tps };
      }).filter(Boolean)
      .sort((a,b)=>a.tps-b.tps).slice(0,8)
      .map(x=>({ label:this.lbl(x.it), svg:this.svgArrows(x.it,true), best:this.fmt(x.st.best),
        tps:x.tps.toFixed(1)+' TPS', count:x.st.n+'×',
        open:()=>this.openCase(x.it.uid) }));
    v.drillSlowOn=slow.length>0; v.drillSlowRows=slow;
    // phase splits across all sessions: 4-phase = real solves, 2-phase = LL mode
    const ph4=[],ph2=[];
    s.sessions.forEach(x=>x.solves.forEach(sv=>{
      if(!sv.ph||sv.pen==='dnf') return;
      if(sv.ph.length===4&&!sv.ll&&!sv.drill) ph4.push(sv.ph);
      if(sv.ph.length===2&&sv.ll) ph2.push(sv.ph);
    }));
    v.phSecOn=ph4.length>0||ph2.length>0;
    const PHCO=['var(--info)','var(--acc)','var(--warn)','var(--good)'];
    const PHN=['CROSS','F2L','OLL','PLL'];
    if(ph4.length){
      const sums=[0,0,0,0]; ph4.forEach(p=>p.forEach((x,i)=>sums[i]+=x));
      const tot=sums.reduce((a,b)=>a+b,0)||1;
      v.ph4On=true;
      v.ph4Count=this.trf('{n} split solves',{n:ph4.length});
      v.ph4Bar=sums.map((x,i)=>({w:(x/tot*100).toFixed(1),co:PHCO[i]}));
      v.ph4Legend=PHN.map((n,i)=>({label:this.tr(n)+' '+Math.round(sums[i]/tot*100)+'%',co:PHCO[i]}));
      v.ph4Rows=PHN.map((n,i)=>({label:n,co:PHCO[i],
        best:this.fmt(Math.min.apply(null,ph4.map(p=>p[i]))),
        mean:'ø '+this.fmt(sums[i]/ph4.length)}));
    } else v.ph4On=false;
    if(ph2.length){
      const s2=[0,0]; ph2.forEach(p=>{ s2[0]+=p[0]; s2[1]+=p[1]; });
      v.ph2On=true;
      v.ph2Count=this.trf('{n} last-layer solves',{n:ph2.length});
      v.ph2Rows=[['OLL',0],['PLL',1]].map(d=>({label:d[0],co:PHCO[d[1]+2],
        best:this.fmt(Math.min.apply(null,ph2.map(p=>p[d[1]]))),
        mean:'ø '+this.fmt(s2[d[1]]/ph2.length)}));
    } else v.ph2On=false;
    const allSolves=[]; s.sessions.forEach(x=>allSolves.push.apply(allSolves,x.solves.filter(sv=>!sv.drill&&!sv.ll)));
    v.globalTstats=[['ALL-TIME BEST',this.best(allSolves)||'—'],['TOTAL SOLVES',String(allSolves.length)],
      ['SESSIONS',String(s.sessions.length)]].map(x=>({label:x[0],val:x[1]}));
    v.exportData=()=>this.exportData(); v.importData=()=>this.importData();
    return v;
  }
  navIcon(k){
    const p={
      learn:'<rect x="3" y="3" width="8" height="8" rx="2.2"/><rect x="13" y="3" width="8" height="8" rx="2.2"/><rect x="3" y="13" width="8" height="8" rx="2.2"/><rect x="13" y="13" width="8" height="8" rx="2.2"/>',
      drill:'<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M9.6 9.8a2.5 2.5 0 1 1 3.2 2.7c-.7.25-.8.8-.8 1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.2"/>',
      timer:'<circle cx="12" cy="13.4" r="7.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 13.4V9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M9.4 2.8h5.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
      guide:'<path d="M4.5 5.4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v13.2a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2.1"/><path d="M8.4 8.2h7.2M8.4 12h7.2M8.4 15.8h4.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      stats:'<rect x="4" y="12.5" width="4.4" height="8" rx="1.4"/><rect x="9.8" y="8" width="4.4" height="12.5" rx="1.4"/><rect x="15.6" y="3.5" width="4.4" height="17" rx="1.4"/>'};
    return React.createElement('span',{style:{display:'inline-flex'},
      dangerouslySetInnerHTML:{__html:'<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">'+p[k]+'</svg>'}});
  }
}
