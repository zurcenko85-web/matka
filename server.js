/* ═══ ТЕОРЕМА — игровой сервер: аккаунты · комнаты · матч · банк ═══
   Связь с клиентом — опрос GET /state (проходит через любой прокси).
   Всё состояние — в памяти сервера. Node 18+. */

const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000;
const MINUS='−';
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const tok=n=>crypto.randomBytes(n).toString('hex');
const now=()=>Date.now();
const cleanName=s=>{s=String(s||'').replace(/\s+/g,' ').trim().slice(0,16);
 return s||pick(['Пифагор','Эйлер','Ковалевская','Гаусс','Гипатия','Коши'])};
const hashPw=(pw,salt)=>crypto.scryptSync(String(pw),salt,32).toString('hex');

/* ── аккаунты ── */
const users=new Map();     // loginLower -> {login,salt,hash}
const sessions=new Map();  // token -> loginLower
const LOGIN_RE=/^[A-Za-z0-9_\-]{3,20}$/;
function doRegister(login,pw){
 login=String(login||'').trim();
 if(!LOGIN_RE.test(login))return{error:'Логин: 3–20 символов — латиница, цифры, «_» или «-».'};
 if(String(pw||'').length<6)return{error:'Пароль — минимум 6 символов.'};
 const key=login.toLowerCase();
 if(users.has(key))return{error:'Такой логин уже занят.'};
 const salt=crypto.randomBytes(8).toString('hex');
 users.set(key,{login,salt,hash:hashPw(pw,salt)});
 const t=tok(16);sessions.set(t,key);
 console.log('+ регистрация:',login);
 return{token:t,login};
}
function doLogin(login,pw){
 const key=String(login||'').trim().toLowerCase();
 const u=users.get(key);
 if(!u)return{error:'Нет такого логина (сервер мог перезапуститься — зарегистрируйтесь заново).'};
 if(hashPw(String(pw||''),u.salt)!==u.hash)return{error:'Неверный пароль.'};
 const t=tok(16);sessions.set(t,key);
 return{token:t,login:u.login};
}

/* ── генераторы задач ── */
const SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻','−':'⁻','x':'ˣ'};
const SUB={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
const sup=s=>String(s).split('').map(c=>SUP[c]||'').join('');
const sub=s=>String(s).split('').map(c=>SUB[c]||'').join('');
const plural=(n,one,few,many)=>{const a=n%10,b=n%100;return (a===1&&b!==11)?one:(a>=2&&a<=4&&(b<10||b>=20))?few:many};
function lin(a,b){let s=(a===1?'':a)+'x';if(b)s+=b<0?` − ${Math.abs(b)}`:` + ${b}`;return s}
function poly3(A,B){let s='x³';if(A)s+=A<0?` − ${Math.abs(A)}x²`:` + ${A}x²`;if(B)s+=B<0?` − ${Math.abs(B)}x`:` + ${B}x`;return s+' + 7'}
function fmtAnswer(v,p){let s=p>0?(+v).toFixed(p).replace(/0+$/,'').replace(/[.,]$/,''):String(Math.round(v));
 return s.replace('-','−').replace('.',',')}
function parseAnswer(raw){
 const s=String(raw==null?'':raw).trim().replace(',','.').replace(/[−–—]/g,'-').replace(/\s+/g,'');
 const f=/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(s);
 if(f){const d=parseFloat(f[2]);return d?parseFloat(f[1])/d:null}
 return /^-?\d+(\.\d+)?$/.test(s)?parseFloat(s):null;
}
const TOPICS=[['eq','Уравнения'],['pow','Преобразования'],['der','Производная'],['pro','Вероятность'],
 ['pla','Планиметрия'],['ste','Стереометрия'],['txt','Текстовые']];
const TLBL=Object.fromEntries(TOPICS);
const g_linear=()=>{const x=rnd(-9,9),a=rnd(2,9),b=rnd(-20,20),c=a*x+b;
 return{text:`Найдите корень уравнения ${lin(a,b)} = ${c<0?MINUS+Math.abs(c):c}.`,ans:x,prec:0}};
const g_quadratic=()=>{let p=rnd(-9,9),q=rnd(-9,9);while(q===p)q=rnd(-9,9);
 const B=-(p+q),C=p*q;let s='x²';
 if(B)s+=B<0?` − ${Math.abs(B)}x`:` + ${B}x`;if(C)s+=C<0?` − ${Math.abs(C)}`:` + ${C}`;
 return{text:`Решите уравнение ${s} = 0. Если корней несколько, в ответе укажите больший.`,ans:Math.max(p,q),prec:0}};
const g_exponential=()=>{const a=pick([2,3,4,5]);
 if(Math.random()<.6){const k=rnd(2,5),n=rnd(1,9);
  return{text:`Найдите корень уравнения ${a}${sup('x-'+n)} = ${a**k}.`,ans:k+n,prec:0}}
 const k=rnd(2,5),n=rnd(k+1,k+9);
 return{text:`Найдите корень уравнения (1/${a})${sup('x-'+n)} = ${a**k}.`,ans:n-k,prec:0}};
const g_logarithm=()=>{const a=pick([2,3,5]),k=rnd(2,4);
 if(Math.random()<.5){const n=rnd(1,Math.min(30,a**k-1));
  return{text:`Найдите корень уравнения log${sub(a)}(x + ${n}) = ${k}.`,ans:a**k-n,prec:0}}
 const n=rnd(1,20);
 return{text:`Найдите корень уравнения log${sub(a)}(x − ${n}) = ${k}.`,ans:a**k+n,prec:0}};
function g_trig(){
 for(let t=0;t<200;t++){
  const f=Math.random()<.5?'sin':'cos',k=pick([2,3,4,6]);
  const bank=f==='sin'
   ?[['1/2',[30,150]],['√2/2',[45,135]],['√3/2',[60,120]],[MINUS+'1/2',[210,330]],['1',[90]],[MINUS+'1',[270]]]
   :[['1/2',[60,300]],['√2/2',[45,315]],['√3/2',[30,330]],[MINUS+'1/2',[120,240]],['1',[0]],[MINUS+'1',[180]]];
  const[sv,ts]=pick(bank);
  if((k*ts[0])%180!==0)continue;
  const cands=[];for(let n=-6;n<=6;n++)for(const tt of ts)cands.push(k*tt/180+2*k*n);
  const pos=cands.filter(x=>x>0),neg=cands.filter(x=>x<0);
  if(!pos.length||!neg.length)continue;
  const mp=Math.random()<.5;
  return{text:`Решите уравнение ${f}(πx/${k}) = ${sv}. В ответе укажите ${mp?'наименьший положительный':'наибольший отрицательный'} корень.`,
   ans:mp?Math.min(...pos):Math.max(...neg),prec:0};
 }
 return{text:'Решите уравнение sin(πx/3) = √3/2. В ответе укажите наименьший положительный корень.',ans:1,prec:0}}
const g_powers=()=>{const A=pick([2,3,5,10]),m=rnd(2,7),n=rnd(1,6),k=rnd(1,6),e=m+n-k;
 if(e>=1&&e<=5)return{text:`Найдите значение выражения a${sup(m)} · a${sup(n)} / a${sup(k)}, если a = ${A}.`,ans:A**e,prec:0};
 const m2=rnd(2,3),n2=rnd(2,3),k2=rnd(1,m2*n2-1);
 return{text:`Найдите значение выражения (a${sup(m2)})${sup(n2)} / a${sup(k2)}, если a = ${A}.`,ans:A**(m2*n2-k2),prec:0}};
const g_quadmin=()=>{const a=rnd(-9,9)||5,c=rnd(-15,15),b=-2*a;let s='x²';
 if(b)s+=b<0?` − ${Math.abs(b)}x`:` + ${b}x`;if(c)s+=c<0?` − ${Math.abs(c)}`:` + ${c}`;
 return{text:`Найдите точку минимума функции y = ${s}.`,ans:a,prec:0}};
const g_cubicmin=()=>{const u=rnd(-5,2),v=u+rnd(1,4),A=-(v+2*u),B=u*u+2*u*v;
 return{text:`Найдите точку минимума функции y = ${poly3(A,B)}.`,ans:v,prec:0}};
function g_derivgraph(){
 const ys=[];let y=rnd(-3,3);
 for(let i=0;i<13;i++){if(y===0)y=Math.random()<.5?1:-1;ys.push(y);y=Math.max(-4,Math.min(4,y+rnd(-2,2)))}
 const pos=ys.filter(v=>v>0).length,neg=ys.filter(v=>v<0).length;
 let zeros=0;for(let i=0;i<12;i++)if(ys[i]*ys[i+1]<0)zeros++;
 const opts=[[`укажите количество целых точек отрезка [−6; 6], в которых производная функции f(x) положительна.`,pos],
  [`укажите количество целых точек отрезка [−6; 6], в которых производная функции f(x) отрицательна.`,neg]];
 if(zeros)opts.push(['укажите количество точек, в которых производная функции f(x) равна нулю.',zeros]);
 const[q,answ]=pick(opts);
 const X=x=>40+(x+6)*40,Y=v=>160-28*v;let g='';
 for(let x=-6;x<=6;x++)g+=`<line x1="${X(x)}" y1="26" x2="${X(x)}" y2="294" stroke="rgba(33,29,23,.09)"/>`;
 for(let v=-4;v<=4;v++)g+=`<line x1="40" y1="${Y(v)}" x2="520" y2="${Y(v)}" stroke="rgba(33,29,23,.09)"/>`;
 g+='<line x1="34" y1="160" x2="528" y2="160" stroke="#211D17" stroke-width="1.6"/>';
 g+=`<line x1="${X(0)}" y1="26" x2="${X(0)}" y2="294" stroke="#211D17" stroke-width="1.6"/>`;
 for(let x=-6;x<=6;x++){
  g+=`<line x1="${X(x)}" y1="156" x2="${X(x)}" y2="164" stroke="#211D17" stroke-width="1.4"/>`;
  g+=`<text x="${X(x)}" y="182" font-size="10.5" text-anchor="middle" fill="rgba(33,29,23,.5)">${x===0?'':x}</text>`}
 const pts=ys.map((v,i)=>`${X(i-6)},${Y(v)}`).join(' ');
 const svg=`<svg viewBox="0 0 560 320" xmlns="http://www.w3.org/2000/svg">${g}<polyline points="${pts}" fill="none" stroke="#211D17" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
 return{text:`На рисунке изображён график y = f′(x) — производной функции f(x), определённой на интервале (−7; 7). ${q[0].toUpperCase()+q.slice(1)}`,
  ans:answ,prec:0,img:svg}}
const g_pies=()=>{const N=pick([4,5,8,10,16,20,25]),M=rnd(1,N-1);
 return{text:`На тарелке лежат ${N} ${plural(N,'пирожка','пирожков','пирожков')}: ${M} ${plural(M,'пирожок','пирожка','пирожков')} с капустой, остальные — с яблоками. Найдите вероятность того, что случайно выбранный пирожок окажется с яблоками. Ответ округлите до сотых.`,ans:(N-M)/N,prec:2}};
const g_dice=()=>{const s=rnd(2,12),c=[0,0,1,2,3,4,5,6,5,4,3,2,1][s];
 return{text:`Игральный кубик бросают дважды. Найдите вероятность того, что сумма выпавших очков равна ${s}. Ответ округлите до сотых.`,ans:c/36,prec:2}};
const g_tickets=()=>{const N=pick([10,20,25,40,50]),M=rnd(1,N-1);
 return{text:`На экзамене по механике ${N} ${plural(N,'билет','билета','билетов')}, из которых ${M} студент не выучил. Найдите вероятность того, что ему попадётся выученный билет. Ответ округлите до сотых.`,ans:(N-M)/N,prec:2}};
const g_trisides=()=>{const a=rnd(6,20),b=rnd(6,20),s=pick([0.4,0.5,0.6]);
 return{text:`Две стороны треугольника равны ${a} и ${b}, а синус угла между ними равен ${String(s).replace('.',',')}. Найдите площадь этого треугольника.`,ans:a*b*s/2,prec:2}};
const g_righttri=()=>{const a=rnd(3,16),b=rnd(3,16);
 return{text:`В прямоугольном треугольнике катеты равны ${a} и ${b}. Найдите площадь этого треугольника.`,ans:a*b/2,prec:1}};
const g_rhombus=()=>{const m=rnd(2,7);
 return{text:`Сторона ромба равна ${2*m}, а один из углов этого ромба равен 30°. Найдите площадь ромба.`,ans:2*m*m,prec:0}};
const g_box=()=>{const a=rnd(2,9),b=rnd(2,9),c=rnd(2,9);
 return{text:`Два ребра прямоугольного параллелепипеда, выходящие из одной вершины, равны ${a} и ${b}. Объём параллелепипеда равен ${a*b*c}. Найдите третье ребро, выходящее из той же вершины.`,ans:c,prec:0}};
const g_pyramid=()=>{const h=rnd(2,12),S=3*rnd(2,15);
 return{text:`Площадь основания пирамиды равна ${S}, а высота пирамиды равна ${h}. Найдите её объём.`,ans:S*h/3,prec:0}};
function g_percent(){
 for(let t=0;t<300;t++){const base=pick([800,1000,1200,1600,2000,2400,3000,4000]),p=rnd(5,50),q=rnd(5,50);
  const f=base*(1+p/100)*(1-q/100);
  if(Math.abs(f-Math.round(f))<1e-9)
   return{text:`Куртка стоила ${base} рублей. На распродаже её цену сначала повысили на ${p}%, а затем снизили на ${q}%. Сколько рублей стала стоить куртка после снижения цены?`,ans:Math.round(f),prec:0}}
 return{text:'Куртка стоила 1000 рублей. На распродаже её цену сначала повысили на 10%, а затем снизили на 10%. Сколько рублей стала стоить куртка после снижения цены?',ans:990,prec:0}}
function g_speed(){
 for(let t=0;t<300;t++){const t1=rnd(1,4),t2=rnd(1,4),v1=rnd(3,12)*10,v2=rnd(3,12)*10;
  const s=(t1*v1+t2*v2)/(t1+t2);
  if(Math.abs(s-Math.round(s))<1e-9)
   return{text:`Первые ${t1} ${plural(t1,'час','часа','часов')} велосипедист ехал со скоростью ${v1} км/ч, следующие ${t2} ${plural(t2,'час','часа','часов')} — со скоростью ${v2} км/ч. Найдите среднюю скорость велосипедиста на всём пути. Ответ дайте в км/ч.`,ans:Math.round(s),prec:0}}
 return{text:'Первый час велосипедист ехал со скоростью 50 км/ч, следующий час — со скоростью 70 км/ч. Найдите его среднюю скорость. Ответ дайте в км/ч.',ans:60,prec:0}}
const GENS=[['eq',g_linear],['eq',g_quadratic],['eq',g_exponential],['eq',g_logarithm],['eq',g_trig],
 ['pow',g_powers],['der',g_quadmin],['der',g_cubicmin],['der',g_derivgraph],
 ['pro',g_pies],['pro',g_dice],['pro',g_tickets],
 ['pla',g_trisides],['pla',g_righttri],['pla',g_rhombus],
 ['ste',g_box],['ste',g_pyramid],['txt',g_percent],['txt',g_speed]];

/* ── банк (парсер прототипов) ── */
const bank=[];
const ENT={'amp':'&','lt':'<','gt':'>','quot':'"','#39':"'",'nbsp':' ','mdash':'—','ndash':'–','minus':'−','deg':'°','pi':'π','radic':'√'};
function unesc(s){return s.replace(/&(amp|lt|gt|quot|#39|nbsp|mdash|ndash|minus|deg|pi|radic);/g,(m,e)=>ENT[e])
 .replace(/&#(\d+);/g,(m,d)=>String.fromCodePoint(+d))}
function stripTags(h){return unesc(h.replace(/<(script|style)[\s\S]*?<\/\1>/gi,' ')
 .replace(/<img[^>]*>/gi,' ⟨рисунок⟩ ').replace(/<[^>]+>/g,' ')).replace(/[ \t]+/g,' ')}
async function fetchProblem(pid){
 const r=await fetch('https://math-ege.sdamgia.ru/problem?id='+pid,
  {headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw new Error('HTTP '+r.status);
 const txt=stripTags(await r.text());
 const mh=/Задание\s*(\d+)\s*№\s*(\d+)/.exec(txt);
 if(!mh)throw new Error('задача не найдена (проверьте номер)');
 const body=txt.slice(mh.index+mh[0].length);
 const ma=/Ответ\s*[:\-—]?\s*([^\n\r]+)/.exec(body);
 if(!ma)throw new Error('ответ на странице не найден');
 const text=body.slice(0,ma.index).replace(/\s+/g,' ').trim().replace(/^[.·\s]+/,'');
 const raw=ma[1].split(/\s+Решение/)[0].trim().replace(/[.\s]+$/,'');
 const norm=raw.replace('−','-').replace(',','.');
 let ans=null,prec=0;
 if(/^-?\d+(\.\d+)?$/.test(norm)){ans=parseFloat(norm);prec=norm.includes('.')?norm.split('.')[1].length:0}
 if(!text)throw new Error('пустой текст задачи');
 return{text,ans,raw,prec,task:mh[1]};
}

/* ── комнаты ── */
const CODE_AB='abcdefghjkmnpqrstuvwxyz23456789';
const genCode=()=>Array.from({length:6},()=>pick(CODE_AB.split(''))).join('');
const rooms=new Map();
function newRoom(code,login,name){
 return{code,names:[name,null],rtok:[tok(12),null],
  settings:{target:5,time:120,source:'mix',topics:Object.fromEntries(TOPICS.map(([k])=>[k,true]))},
  phase:'lobby',scores:[0,0],hist:[],tries:[0,0],n:0,round:null,between:null,
  pendingSkip:null,skipEv:null,winner:null,note:null,deck:[],used:{},v:1,
  stats:[{solved:0,sum:0,best:null,wrong:0},{solved:0,sum:0,best:null,wrong:0}],
  seen:[now(),0]};
}
function view(r,seat){
 const t=now();
 return{code:r.code,seat,v:r.v,names:r.names,
  online:[t-(r.seen[0]||0)<8000,t-(r.seen[1]||0)<8000],
  phase:r.phase,scores:r.scores,hist:r.hist,tries:r.tries,
  target:r.settings.target,time:r.settings.time,topics:r.settings.topics,source:r.settings.source,
  note:r.note||null,
  round:r.round?{n:r.round.n,text:r.round.text,topic:r.round.topic,img:r.round.img,deadline:r.round.deadline}:null,
  between:r.between?{until:r.between.until,last:r.between.last,finalAfter:r.between.finalAfter}:null,
  pendingSkip:r.pendingSkip?{by:r.pendingSkip.by,n:r.pendingSkip.n,until:r.pendingSkip.until}:null,
  skipEv:r.skipEv,myStats:r.stats[seat],winner:r.winner,
  bankN:bank.length,servertime:t};
}
function finishRound(r,kind,ms){
 const round=r.round,answer=round.answer;
 if(kind===0||kind===1)r.scores[kind]++;
 r.hist.push(kind);
 const done=r.scores[0]>=r.settings.target||r.scores[1]>=r.settings.target;
 r.between={until:now()+5200,last:{n:round.n,kind,answer,ms},finalAfter:done};
 r.round=null;r.pendingSkip=null;r.v++;
}
function resetMatch(r){
 Object.assign(r,{scores:[0,0],hist:[],tries:[0,0],n:0,round:null,deck:[],used:{},winner:null,
  pendingSkip:null,skipEv:null,note:null,
  stats:[{solved:0,sum:0,best:null,wrong:0},{solved:0,sum:0,best:null,wrong:0}]});
 r.phase='between';r.between={until:now()+1500,last:null,finalAfter:false};r.v++;
}
function pickTask(r){
 const src=r.settings.source;
 if((src==='bank'||src==='mix')&&bank.length&&(src==='bank'||Math.random()<0.5)){
  const start=Math.floor(Math.random()*bank.length);
  for(let i=0;i<Math.min(bank.length,12);i++){
   const bp=bank[(start+i)%bank.length],sig='b|'+bp.text.slice(0,80);
   if(!r.used[sig]){r.used[sig]=1;
    return{text:bp.text,ans:bp.ans,rawans:bp.raw||null,prec:bp.prec||0,
     topic:'Задание '+(bp.task!=null?bp.task:'?')+' · банк ФИПИ',img:''}}
  }
  for(const bp of bank)delete r.used['b|'+bp.text.slice(0,80)];
  const bp=bank[start];r.used['b|'+bp.text.slice(0,80)]=1;
  return{text:bp.text,ans:bp.ans,rawans:bp.raw||null,prec:bp.prec||0,
   topic:'Задание '+(bp.task!=null?bp.task:'?')+' · банк ФИПИ',img:''};
 }
 const pool=GENS.filter(([c])=>r.settings.topics[c]);
 if(!pool.length)return null;
 if(!r.deck.length){r.deck=pool.slice();
  for(let i=r.deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r.deck[i],r.deck[j]]=[r.deck[j],r.deck[i]]}}
 const[cat,fn]=r.deck.pop();
 let t=fn(),sig=t.text+'|'+t.ans,guard=0;
 while(r.used[sig]&&guard<60){t=fn();sig=t.text+'|'+t.ans;guard++}
 if(Object.keys(r.used).length>500)r.used={};
 r.used[sig]=1;
 return{text:t.text,ans:t.ans,rawans:null,prec:t.prec,topic:(TLBL[cat]||'')+' · прототип банка',img:t.img||''};
}
function newRound(r){
 const task=pickTask(r);
 if(!task){r.phase='lobby';r.between=null;
  r.note='Нет задач: пополните банк или включите темы генераторов.';r.v++;return}
 r.n++;
 r.round={n:r.n,text:task.text,topic:task.topic,img:task.img||'',prec:task.prec,
  ans:task.ans,rawans:task.rawans,answer:task.rawans||fmtAnswer(task.ans,task.prec),
  started:now(),deadline:now()+r.settings.time*1000};
 r.tries=[0,0];r.pendingSkip=null;r.skipEv=null;r.note=null;r.v++;
 console.log('· комната',r.code,'— раунд',r.n,':',r.round.text.slice(0,55)+'…  ответ:',r.round.answer);
}
/* тик каждую секунду: таймауты раундов, пауз, пропусков */
setInterval(()=>{
 const t=now();
 for(const r of rooms.values()){
  if(r.phase==='round'&&r.round&&t>=r.round.deadline){finishRound(r,'draw',null);continue}
  if(r.phase==='between'&&r.between&&t>=r.between.until){
   if(r.between.finalAfter){r.phase='final';r.winner=r.scores[0]>=r.settings.target?0:1;
    r.between=null;r.v++;console.log('■ комната',r.code,'— матч',r.scores.join(':'))}
   else newRound(r);
   continue;
  }
  if(r.pendingSkip&&t>=r.pendingSkip.until){
   r.skipEv={res:'timeout',to:r.pendingSkip.by,n:r.pendingSkip.n};
   r.pendingSkip=null;r.v++;
  }
 }
},1000);
/* уборка брошенных комнат */
setInterval(()=>{
 const t=now();
 for(const[code,r]of rooms){
  const last=Math.max(r.seen[0]||0,r.seen[1]||0);
  if(t-last>2*3600*1000){rooms.delete(code);console.log('− комната',code,'удалена (простой)')}
 }
},10*60*1000).unref();

function findRoom(rtok){
 for(const r of rooms.values()){const i=r.rtok.indexOf(rtok);if(i>=0)return{r,seat:i}}
 return{};
}
function act(d){
 const{r,seat}=findRoom(d.rtok||'');
 if(!r)return{error:'Комната не найдена или устарела'};
 r.seen[seat]=now();
 const a=d.action;
 switch(a){
  case 'settings':{
   if(seat!==0||r.phase!=='lobby')return{error:'настройки меняет создатель до старта'};
   const s=d.settings||{};
   if([3,5,7].includes(+s.target))r.settings.target=+s.target;
   if([60,90,120,180,240].includes(+s.time))r.settings.time=+s.time;
   if(['gen','bank','mix'].includes(s.source))r.settings.source=s.source;
   if(s.topics)for(const[k]of TOPICS)if(k in s.topics)r.settings.topics[k]=!!s.topics[k];
   r.v++;return{ok:true};
  }
  case 'start':{
   if(seat!==0)return{error:'стартует создатель комнаты'};
   if(!r.rtok[1])return{error:'ждём второго игрока'};
   if(r.settings.source==='gen'&&!Object.values(r.settings.topics).some(Boolean))
    return{error:'выберите хотя бы одну тему'};
   resetMatch(r);return{ok:true};
  }
  case 'answer':{
   const rd=r.round;
   if(r.phase!=='round'||!rd||+d.n!==rd.n)return{ok:false,msg:'раунд уже завершён'};
   const val=parseAnswer(d.value);
   if(val===null)return{ok:false,msg:'Введите число или дробь вида 7/3.'};
   let good;
   if(rd.ans!=null){const tol=Math.pow(10,-(rd.prec||0))/2+1e-9;good=Math.abs(val-rd.ans)<=tol}
   else good=String(d.value).trim().replace(',','.').replace(/\s/g,'')===String(rd.rawans||'').trim().replace('−','-');
   r.tries[seat]++;
   if(!good){r.stats[seat].wrong++;r.v++;return{ok:false,msg:'неверно'}}
   const ms=Math.max(1,now()-rd.started),st=r.stats[seat];
   st.solved++;st.sum+=ms;st.best=st.best==null?ms:Math.min(st.best,ms);
   console.log('★ комната',r.code,'—',r.names[seat],'решает раунд',rd.n,'за',(ms/1000).toFixed(1)+'с');
   finishRound(r,seat,ms);return{ok:true};
  }
  case 'skip':{
   const rd=r.round;
   if(r.phase!=='round'||!rd||+d.n!==rd.n)return{error:'раунд не активен'};
   if(r.pendingSkip)return{error:'запрос уже отправлен'};
   r.pendingSkip={by:seat,n:rd.n,until:now()+15000};r.v++;return{ok:true};
  }
  case 'skipReply':{
   const p=r.pendingSkip;
   if(!p||p.by===seat)return{error:'нет запроса к вам'};
   if(d.ok){r.skipEv={res:'ok',to:p.by,n:p.n};finishRound(r,'skip',null)}
   else{r.skipEv={res:'no',to:p.by,n:p.n};r.pendingSkip=null;r.v++}
   return{ok:true};
  }
  case 'rematch':{
   if(seat!==0||r.phase!=='final')return{error:'реванш недоступен'};
   resetMatch(r);return{ok:true};
  }
 }
 return{error:'неизвестное действие'};
}

/* ── HTTP ── */
let HTML='';
try{
 HTML=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 console.log('index.html загружен:',Buffer.byteLength(HTML),'байт');
}catch(e){
 console.log('⚠ index.html не найден в корне репозитория — положите файл и сделайте redeploy');
 HTML='<!DOCTYPE html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:560px;margin:80px auto">'+
      '<h2>index.html не найден</h2><p>Файл интерфейса должен лежать в корне репозитория рядом с server.js.</p></body>';
}
async function handle(d){
 switch(d.action){
  case 'register':return doRegister(d.login,d.password);
  case 'login':    return doLogin(d.login,d.password);
  case 'me':{
   const key=sessions.get(d.token||'');
   if(!key)return{error:'сессия истекла'};
   return{login:users.get(key).login};
  }
  case 'create':{
   const key=sessions.get(d.token||'');
   if(!key)return{error:'войдите в аккаунт'};
   let code=null;
   for(let i=0;i<10;i++){const c=genCode();if(!rooms.has(c)){code=c;break}}
   if(!code)return{error:'не удалось выделить код, попробуйте ещё'};
   const room=newRoom(code,key,cleanName(d.name));
   rooms.set(code,room);
   console.log('+ комната',code,'· хост',key);
   return{code,rtok:room.rtok[0],seat:0};
  }
  case 'join':{
   const key=sessions.get(d.token||'');
   if(!key)return{error:'войдите в аккаунт'};
   const code=String(d.code||'').toLowerCase().trim();
   const room=rooms.get(code);
   if(!room)return{error:'Комната не найдена. Проверьте код.'};
   if(room.rtok[1])return{error:'В этой комнате уже играют вдвоём.'};
   room.rtok[1]=tok(12);room.names[1]=cleanName(d.name);room.seen[1]=now();room.v++;
   console.log('+ комната',code,'· гость',key);
   return{code,rtok:room.rtok[1],seat:1};
  }
  case 'bank':{
   const key=sessions.get(d.token||'');
   if(!key)return{error:'нужен вход в аккаунт'};
   const ids=[...new Set(String(d.ids||'').split(/[^0-9]+/).filter(Boolean).map(Number))].slice(0,6);
   if(!ids.length)return{error:'укажите номера задач'};
   const added=[],errs=[];
   for(const id of ids){
    try{const p=await fetchProblem(id);bank.push(p);added.push({id,task:p.task,raw:p.raw})}
    catch(e){errs.push({id,err:String(e.message||e)})}
   }
   return{added,errs,bankN:bank.length};
  }
  case 'act':return act(d);
 }
 return{error:'неизвестное действие'};
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://x');
 if(req.method==='GET'){
  if(u.pathname==='/'||u.pathname==='/index.html'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   return res.end(HTML);
  }
  if(u.pathname==='/state'){
   const{r,seat}=findRoom(u.searchParams.get('rtok')||'');
   if(!r){res.writeHead(403,{'Content-Type':'application/json'});
    return res.end('{"error":"нет комнаты"}')}
   r.seen[seat]=now();
   const cv=u.searchParams.get('v');
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
   if(String(r.v)===cv)return res.end('{"same":true}');
   return res.end(JSON.stringify({room:view(r,seat)}));
  }
  res.writeHead(404);return res.end();
 }
 if(req.method==='POST'&&u.pathname==='/api'){
  let b='';
  req.on('data',c=>{b+=c;if(b.length>1e5)req.destroy()});
  await new Promise(r=>req.on('end',r));
  let d={};try{d=JSON.parse(b||'{}')}catch(e){}
  let out;
  try{out=await handle(d)}catch(e){out={error:'внутренняя ошибка: '+(e.message||e)}}
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
  return res.end(JSON.stringify(out));
 }
 res.writeHead(404);res.end();
});
server.listen(PORT,'0.0.0.0',()=>{
 console.log('ТЕОРЕМА: слушаю порт '+PORT+' · связь с клиентами — опрос /state');
});
