let observer=null;
let queued=false;

function text(node){return (node?.textContent||'').replace(/\s+/g,' ').trim();}
function visible(node){
  if(!node||!node.isConnected||node.closest('[hidden]')) return false;
  const s=getComputedStyle(node);
  return s.display!=='none'&&s.visibility!=='hidden'&&node.getClientRects().length>0;
}
function exactTextNode(label,root=document){
  return [...root.querySelectorAll('div,span,label,p,h1,h2,h3,h4')].find(n=>visible(n)&&text(n)===label)||null;
}

// Employee Location & Tracking is now rendered natively by React.
// This tiny compatibility shim only hides the three obsolete global CRM
// location controls that still live in the legacy settings markup.
function removeGlobalLocationSettings(){
  const heading=exactTextNode('Location Settings');
  if(!heading||heading.dataset.engageGlobalLocationHeading==='true') return;
  const expected=['GPS Location','Location Mandatory for New Lead','Continuous GPS Tracking'];
  const rows=[];
  let node=heading.nextElementSibling;
  for(const label of expected){
    if(!node||!text(node).startsWith(label)) return;
    rows.push(node);node=node.nextElementSibling;
  }
  heading.dataset.engageGlobalLocationHeading='true';
  heading.style.display='none';
  rows.forEach(row=>{row.dataset.engageGlobalLocationSettings='true';row.style.display='none';});
}

function apply(){queued=false;removeGlobalLocationSettings();}
function queue(){if(queued)return;queued=true;requestAnimationFrame(apply);}
function install(){if(observer)return;observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});window.addEventListener('focus',queue);setTimeout(queue,0);}
install();
