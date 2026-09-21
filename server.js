let pollTO=null,firstSnapAt=0,connNote=null;
function setConn(t,bad){
 if(connNote&&connNote.parentNode)connNote.remove();
 connNote=null;
 if(!t)return;
 connNote=document.createElement('div');
 connNote.className='note';
 connNote.style.color=bad?'#BF3B2B':'#4a7c3f';
 connNote.textContent=t;
 document.querySelector('#scr-wait .card').prepend(connNote);
}
function openRoom(s){
 clearTimeout(pollTO);
 CUR=s;VIEW=null;lastRN=0;evKey='';noteKey='';firstSnapAt=0;
 hideOv();hideOffer();
 $('lobCode').textContent=s.code;
 show('scr-wait');
 setConn('подключаемся к комнате…');
 poll();
}
async function poll(){
 if(!CUR)return;
 try{
  const q='/state?rtok='+encodeURIComponent(CUR.rtok)+'&v='+(VIEW?VIEW.v:-1);
  const r=await fetch(q);
  if(r.status===403){fatal('Комната не найдена — сервер мог перезапуститься. Создайте комнату заново.');return}
  const j=await r.json();
  if(j.room){
   if(!firstSnapAt){firstSnapAt=1;setConn('связь с комнатой установлена');setTimeout(()=>setConn(null),2500)}
   VIEW=j.room;apply();
  }
 }catch(e){
  if(!firstSnapAt)setConn('нет связи с сервером — повторяем…',true);
 }
 const ms=!VIEW?1600:(VIEW.phase==='between'?700:VIEW.phase==='round'?900:1600);
 pollTO=setTimeout(poll,ms);
}
function fatal(msg){
 clearTimeout(pollTO);
 CUR=null;VIEW=null;clearInterval(tint);hideOv();hideOffer();
 if(connNote&&connNote.parentNode)connNote.remove();connNote=null;
 $('btnExitRoom').hidden=true;
 show('scr-home');renderRecent();
 if(msg)toast('Отсоединено',msg);
}
