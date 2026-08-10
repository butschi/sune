// Facelet cube engine + SVG renderers. window.CUBE
(function(){
const FACES=['U','R','F','D','L','B'];
const FDEF={
 U:{n:[0,1,0],r:[1,0,0],d:[0,0,1]},
 R:{n:[1,0,0],r:[0,0,-1],d:[0,-1,0]},
 F:{n:[0,0,1],r:[1,0,0],d:[0,-1,0]},
 D:{n:[0,-1,0],r:[1,0,0],d:[0,0,-1]},
 L:{n:[-1,0,0],r:[0,0,1],d:[0,-1,0]},
 B:{n:[0,0,-1],r:[-1,0,0],d:[0,-1,0]}};
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const eq=(a,b)=>a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
const stickers=[];
FACES.forEach(f=>{const d=FDEF[f];for(let i=0;i<9;i++){const r=(i/3)|0,c=i%3;
 stickers.push({p:add(add(d.n,mul(d.r,c-1)),mul(d.d,r-1)),n:d.n});}});
// 90-degree rotations; letter = move whose direction it matches
const RU=p=>[-p[2],p[1],p[0]], RD=p=>[p[2],p[1],-p[0]];
const RR=p=>[p[0],p[2],-p[1]], RL=p=>[p[0],-p[2],p[1]];
const RF=p=>[p[1],-p[0],p[2]], RB=p=>[-p[1],p[0],p[2]];
const DEFS={
 U:[p=>p[1]===1,RU], D:[p=>p[1]===-1,RD], E:[p=>p[1]===0,RD], y:[()=>true,RU],
 u:[p=>p[1]>=0,RU], d:[p=>p[1]<=0,RD],
 R:[p=>p[0]===1,RR], L:[p=>p[0]===-1,RL], M:[p=>p[0]===0,RL], x:[()=>true,RR],
 r:[p=>p[0]>=0,RR], l:[p=>p[0]<=0,RL],
 F:[p=>p[2]===1,RF], B:[p=>p[2]===-1,RB], S:[p=>p[2]===0,RF], z:[()=>true,RF],
 f:[p=>p[2]>=0,RF], b:[p=>p[2]<=0,RB]};
const PERMS={};
for(const k in DEFS){const sel=DEFS[k][0],rot=DEFS[k][1],perm=new Array(54);
 stickers.forEach((s,i)=>{if(!sel(s.p)){perm[i]=i;return;}
  const np=rot(s.p),nn=rot(s.n);
  const j=stickers.findIndex(t=>eq(t.p,np)&&eq(t.n,nn));perm[j]=i;});
 PERMS[k]=perm;}
function solved(){const s=[];FACES.forEach(f=>{for(let i=0;i<9;i++)s.push(f);});return s;}
function parseAlg(a){return String(a).replace(/[()\[\]]/g,' ').trim().split(/\s+/).filter(Boolean);}
function applyToken(st,t){
 let m=t[0],rest=t.slice(1);
 if(rest[0]==='w'){m=m.toLowerCase();rest=rest.slice(1);}
 let n=rest.includes('2')?2:(rest.includes("'")?3:1);
 const perm=PERMS[m];if(!perm){console.warn('bad move',t);return st;}
 let s=st;
 for(let k=0;k<n;k++){const ns=new Array(54);for(let i=0;i<54;i++)ns[i]=s[perm[i]];s=ns;}
 return s;}
function apply(st,alg){let s=st;parseAlg(alg).forEach(t=>{s=applyToken(s,t);});return s;}
function invert(alg){return parseAlg(alg).reverse().map(t=>
 t.includes('2')?t.replace(/'/g,''):(t.includes("'")?t.replace("'",''):t+"'")).join(' ');}
function caseState(alg,pre){let s=apply(solved(),invert(alg));if(pre)s=apply(s,pre);return s;}
// ---- case-solved predicates, shared by the app and the alg tests
function f2lIntact(st){
 for(let i=27;i<36;i++)if(st[i]!=='D')return false;
 for(const off of [9,18,36,45]){const c=st[off+4];for(let k=3;k<9;k++)if(st[off+k]!==c)return false;}
 return true;}
// kind: 'pll' solved up to final AUF/rotation; 'oll' top oriented + F2L intact;
// 'oll2' top edges oriented + F2L intact; anything else ('f2l') F2L intact
function caseSolved(kind,st){
 if(kind==='pll'){for(let f=0;f<6;f++){const o=f*9;for(let i=1;i<9;i++)if(st[o+i]!==st[o])return false;}
  return st[0]==='U'&&st[27]==='D';}
 if(!f2lIntact(st))return false;
 if(kind==='oll'){for(let i=0;i<9;i++)if(st[i]!=='U')return false;return true;}
 if(kind==='oll2')return st[1]==='U'&&st[3]==='U'&&st[5]==='U'&&st[7]==='U';
 return true;}
// Standard scheme held yellow-up, red-front: green right, blue left, orange back.
// (Yellow-up with green front would put orange on the right — a green-front/red-right
// cube does not exist in reality; getting this wrong mirrors every diagram.)
const COL={U:'#ffd23f',D:'#f2f2f5',F:'#ee4646',B:'#ff9438',R:'#2fbd5d',L:'#3d86f5'};
const GRAY='var(--ck-gray,#5a5a66)';
const LINE='var(--ck-line,#15151a)';
// ---- piece-movement arrows for PLL diagrams
// applying alg maps sticker at old position X[i] to position i, so executing the
// alg on the case state moves the U-face piece at cell X[i] to cell i
function arrowsFor(alg){
 let id=[];for(let i=0;i<54;i++)id.push(i);
 const X=apply(id,alg),moves=[];
 for(let i=0;i<9;i++){ if(i===4)continue; const j=X[i]; if(j!==i&&j<9&&j!==4)moves.push([j,i]); }
 const out=[],done={};
 moves.forEach(m=>{const a=m[0],b=m[1];
  if(done[a+'>'+b])return;
  const rev=moves.some(n=>n[0]===b&&n[1]===a);
  if(rev){ out.push({a:Math.min(a,b),b:Math.max(a,b),double:true}); done[a+'>'+b]=done[b+'>'+a]=1; }
  else { out.push({a,b,double:false}); done[a+'>'+b]=1; }});
 return out;}
// ---- top view (OLL/PLL). mode: 'pll' full colors, 'oll' yellow/gray, 'eoll' edges only
function svgTop(state,mode,arrows){
 let out='';
 const cf=(i,kind)=>{if(mode==='pll')return COL[state[i]];
  if(mode==='eoll'&&kind==='c')return GRAY;
  return state[i]==='U'?COL.U:GRAY;};
 const rect=(x,y,w,h,f)=>{out+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="2.5" fill="'+f+'"/>';};
 const s=30,g=2.5,t=11,o=t+5,B=o+3*s+2*g; // U block ends at B
 for(let i=0;i<9;i++){const row=(i/3)|0,c=i%3;
  rect(o+c*(s+g),o+row*(s+g),s,s,cf(i,(i%2===0&&i!==4)?'c':'e'));}
 const strip=(ids,horiz,fixed)=>ids.forEach((id,k)=>{const kind=k===1?'e':'c',v=o+k*(s+g);
  if(horiz)rect(v,fixed,s,t,cf(id,kind));else rect(fixed,v,t,s,cf(id,kind));});
 strip([47,46,45],true,0); strip([18,19,20],true,B+5);
 strip([36,37,38],false,0); strip([11,10,9],false,B+5);
 if(arrows&&arrows.length){
  const ctr=i=>[o+(i%3)*(s+g)+s/2, o+((i/3)|0)*(s+g)+s/2];
  const head=(tx,ty,ux,uy)=>{const H=8.5,W=8,px=-uy,py=ux;
   out+='<polygon points="'+tx.toFixed(1)+','+ty.toFixed(1)+' '+(tx-ux*H+px*W/2).toFixed(1)+','+(ty-uy*H+py*W/2).toFixed(1)+' '+(tx-ux*H-px*W/2).toFixed(1)+','+(ty-uy*H-py*W/2).toFixed(1)+'" fill="'+LINE+'"/>';};
  arrows.forEach(ar=>{
   const p=ctr(ar.a),q=ctr(ar.b),dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
   const back=ar.double?11:4;
   out+='<line x1="'+(p[0]+ux*back).toFixed(1)+'" y1="'+(p[1]+uy*back).toFixed(1)+'" x2="'+(q[0]-ux*11).toFixed(1)+'" y2="'+(q[1]-uy*11).toFixed(1)+'" stroke="'+LINE+'" stroke-width="4.5" stroke-linecap="round" opacity="0.92"/>';
   head(q[0]-ux*3,q[1]-uy*3,ux,uy);
   if(ar.double)head(p[0]+ux*3,p[1]+uy*3,-ux,-uy);});}
 const tot=B+5+t;
 return '<svg viewBox="0 0 '+tot+' '+tot+'" xmlns="http://www.w3.org/2000/svg">'+out+'</svg>';}
// ---- isometric view (F2L): U, F, R faces.
// For recognition only the target pair matters, so last-layer pieces are grayed
// (any multi-sticker cubie carrying U-color that is not the pair), and the state
// is AUF-rotated to the angle that shows the most pair stickers on visible faces.
function cubieGroups(){
 const groups={};
 stickers.forEach((st,i)=>{const k=st.p.join(',');(groups[k]=groups[k]||[]).push(i);});
 return groups;}
function isoAuf(state){
 const groups=cubieGroups();
 const pairVis=st=>{let n=0;for(const k in groups){const idxs=groups[k];
  const set=idxs.map(i=>st[i]).sort().join('');
  if(set==='DFR'||set==='FR')n+=idxs.filter(i=>i<27).length;}return n;};
 let best=state,bn=pairVis(state),s=apply(state,'U');
 for(let k=1;k<4;k++){const n=pairVis(s);if(n>bn){bn=n;best=s;}s=apply(s,'U');}
 return best;}
// true for stickers of last-layer pieces that are not the target pair — F2L noise
function grayMask(state){
 const groups=cubieGroups();
 return state.map((l,i)=>{
  const idxs=groups[stickers[i].p.join(',')];
  return idxs.length>1&&idxs.some(j=>state[j]==='U');});
}
function isoColors(state){
 const best=isoAuf(state);
 const m=grayMask(best);
 return best.map((l,i)=>m[i]?GRAY:COL[l]);
}
function svgIso(state){
 const s=20;let out='';
 const co=isoColors(state);
 const P=(x,y,z)=>(((x-z)*0.866*s).toFixed(1))+','+((((x+z)*0.5-y)*s).toFixed(1));
 const quad=(c,f)=>{out+='<polygon points="'+c.map(p=>P(p[0],p[1],p[2])).join(' ')+'" fill="'+f+'" stroke="'+LINE+'" stroke-width="1.6" stroke-linejoin="round"/>';};
 for(let r=0;r<3;r++)for(let c=0;c<3;c++)
  quad([[c,3,r],[c+1,3,r],[c+1,3,r+1],[c,3,r+1]],co[r*3+c]);
 for(let r=0;r<3;r++)for(let c=0;c<3;c++)
  quad([[c,3-r,3],[c+1,3-r,3],[c+1,2-r,3],[c,2-r,3]],co[18+r*3+c]);
 for(let r=0;r<3;r++)for(let c=0;c<3;c++)
  quad([[3,3-r,3-c],[3,3-r,2-c],[3,2-r,2-c],[3,2-r,3-c]],co[9+r*3+c]);
 return '<svg viewBox="-56 -64 112 128" xmlns="http://www.w3.org/2000/svg">'+out+'</svg>';}
// ---- unfolded net
function svgNet(state){
 const c=10,g=1.2,fs=3*c+2*g;let out='';
 const face=(off,gx,gy)=>{for(let i=0;i<9;i++){const r=(i/3)|0,co=i%3;
  out+='<rect x="'+(gx+co*(c+g)).toFixed(1)+'" y="'+(gy+r*(c+g)).toFixed(1)+'" width="'+c+'" height="'+c+'" rx="1.5" fill="'+COL[state[off+i]]+'" stroke="'+LINE+'" stroke-width="0.8"/>';}};
 const gp=fs+4;
 face(0,gp,0);face(36,0,gp);face(18,gp,gp);face(9,2*gp,gp);face(45,3*gp,gp);face(27,gp,2*gp);
 return '<svg viewBox="-1 -1 '+(4*gp-2)+' '+(3*gp-2)+'" xmlns="http://www.w3.org/2000/svg">'+out+'</svg>';}
// ---- move plan for 3D layer animation: CSS axis + signed degrees + layer selector
const AXIS={U:['Y',-1],D:['Y',1],E:['Y',1],y:['Y',-1],u:['Y',-1],d:['Y',1],R:['X',1],L:['X',-1],M:['X',-1],x:['X',1],r:['X',1],l:['X',-1],F:['Z',1],B:['Z',-1],S:['Z',1],z:['Z',1],f:['Z',1],b:['Z',-1]};
function movePlan(t){
 let m=t[0],rest=t.slice(1);
 if(rest[0]==='w'){m=m.toLowerCase();rest=rest.slice(1);}
 const n=rest.includes('2')?2:(rest.includes("'")?3:1);
 const a=AXIS[m],d=DEFS[m];if(!a||!d)return null;
 return {sel:d[0],axis:a[0],deg:a[1]*(n===2?180:(n===3?-90:90))};}
// ---- merge/cancel adjacent same-face turns ("R' U' U'" -> "R' U2")
function simplify(alg){
 let t=parseAlg(alg),changed=true;
 const val=k=>k.includes('2')?2:(k.includes("'")?3:1);
 const fc=k=>k.replace(/['2]/g,'');
 while(changed){
  changed=false;
  const out=[];
  for(const m of t){
   const prev=out[out.length-1];
   if(prev&&fc(prev)===fc(m)){
    out.pop();
    const v=(val(prev)+val(m))%4;
    if(v!==0)out.push(fc(m)+(v===2?'2':v===3?"'":''));
    changed=true;
   } else out.push(m);
  }
  t=out;
 }
 return t.join(' ');}
// ---- case diagram alg + drill scramble (single source of truth for both the
// case modal's setup scramble and the timer's case-drill scrambles)
function diagramAlg(alg,kind){
 if(kind!=='pll')return alg;
 let best=alg,bn=Infinity;
 ['',' U',' U2'," U'"].forEach(a=>{
  const n=arrowsFor(alg+a).reduce((s,x)=>s+(x.double?2:1),0);
  if(n<bn){bn=n;best=alg+a;}});
 return best;}
function drillScramble(alg){return simplify(invert(alg));}
// ---- scramble (random-move, WCA-style constraints)
function scramble(len){len=len||20;
 const F=['U','D','R','L','F','B'],AX={U:0,D:0,R:1,L:1,F:2,B:2},S=['',"'",'2'];
 const out=[];let last=null,last2=null;
 while(out.length<len){const f=F[(Math.random()*6)|0];
  if(f===last)continue;
  if(last&&AX[f]===AX[last]&&f===last2)continue;
  out.push(f+S[(Math.random()*3)|0]);last2=last;last=f;}
 return out.join(' ');}
// ---- finger-trick trigger detection
const TRIGS=[
 {name:'sexy',label:'Sexy move',t:['R','U',"R'","U'"]},
 {name:'invsexy',label:'Inverse sexy',t:["U","R","U'","R'"]},
 {name:'sledge',label:'Sledgehammer',t:["R'",'F','R',"F'"]},
 {name:'hedge',label:'Hedgeslammer',t:['F',"R'","F'",'R']}];
function segments(alg){
 const T=parseAlg(alg),out=[];let i=0;
 while(i<T.length){let hit=null;
  for(const tr of TRIGS){if(tr.t.every((m,k)=>T[i+k]===m)){hit=tr;break;}}
  if(hit){out.push({txt:T.slice(i,i+4).join(' '),trig:hit.name,label:hit.label});i+=4;}
  else{if(out.length&&!out[out.length-1].trig){out[out.length-1].txt+=' '+T[i];}
   else out.push({txt:T[i],trig:null,label:null});i++;}}
 return out;}
window.CUBE={solved,parseAlg,applyToken,apply,invert,caseState,caseSolved,f2lIntact,isoAuf,grayMask,svgTop,svgIso,svgNet,scramble,simplify,diagramAlg,drillScramble,segments,movePlan,arrowsFor,COL,GRAY,TRIGS,stickers};
})();
