const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MANAGER='1058895628836556920';
let shifts=[]; let manager=false;
const label=h=>`${h%12||12}:00 ${h<12?'AM':'PM'}`;
async function api(url,opts={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});if(!r.ok){let e={};try{e=await r.json()}catch{}throw new Error(e.error||'Request failed')}return r.json()}
function htmlSafe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function covers(s,d,h){if(s.start===s.end)return s.day===d; if(s.end>s.start)return s.day===d&&h>=s.start&&h<s.end; return (s.day===d&&h>=s.start)||(d===(s.day+1)%7&&h<s.end)}
function render(){const grid=document.getElementById('grid');grid.innerHTML='';
  const timeHead=document.createElement('div');timeHead.className='cell header';timeHead.textContent='Time';grid.append(timeHead);
  DAYS.forEach(d=>{const x=document.createElement('div');x.className='cell header';x.textContent=d.slice(0,3);grid.append(x)});
  for(let h=0;h<24;h++){
    const t=document.createElement('div');t.className='cell time';t.textContent=label(h);grid.append(t);
    for(let d=0;d<7;d++){
      const cell=document.createElement('button');cell.type='button';cell.className='cell slot';
      const s=shifts.find(x=>covers(x,d,h));
      if(!s){cell.textContent='+ Add';cell.onclick=()=>addShift(d,h)}
      else{cell.classList.add('filled');cell.innerHTML=`<div class="name">${htmlSafe(s.person)}</div><div class="small">${label(s.start)}–${label(s.end)}</div>`;cell.onclick=()=>editShift(s)}
      grid.append(cell);
    }
  }
}
async function addShift(day,start){const person=prompt(`Name or role for ${DAYS[day]} at ${label(start)}:`);if(!person?.trim())return;const raw=prompt('End hour (0-23):',String((start+1)%24));if(raw===null)return;const end=Number(raw);if(!Number.isInteger(end)||end<0||end>23)return alert('End hour must be 0-23.');await api('/api/shifts',{method:'POST',body:JSON.stringify({person,day,start,end})});shifts=await api('/api/shifts');render()}
async function editShift(s){const person=prompt('Name or role:',s.person);if(person===null)return;const start=Number(prompt('Start hour (0-23):',s.start));const end=Number(prompt('End hour (0-23):',s.end));if(!Number.isInteger(start)||start<0||start>23||!Number.isInteger(end)||end<0||end>23)return alert('Invalid time.');await api('/api/shifts/'+s.id,{method:'PUT',body:JSON.stringify({person,day:s.day,start,end})});if(manager&&confirm('Remove this shift instead?'))await api('/api/shifts/'+s.id,{method:'DELETE'});shifts=await api('/api/shifts');render()}
async function init(){const me=await api('/api/me');if(!me.user){document.getElementById('loginPanel').hidden=false;return}manager=me.manager;document.getElementById('loginPanel').hidden=true;document.getElementById('app').hidden=false;document.getElementById('account').textContent=`${me.user.username}${manager?' • Manager':''}`;document.getElementById('permissions').textContent=manager?'You can remove shifts.':'You can add and edit shifts.';shifts=await api('/api/shifts');render()}
document.getElementById('logout').onclick=async()=>{await api('/auth/logout',{method:'POST'});location.reload()};init().catch(e=>alert(e.message));
