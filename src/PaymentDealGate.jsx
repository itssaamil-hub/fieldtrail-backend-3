import React,{useEffect,useState} from 'react';
import {api,getSession} from './api.js';

const BLOCK_EVENT='engage:payment-deal-blocked';
let gateInstalled=false;

function installGate(){
 if(gateInstalled||typeof window==='undefined')return;
 gateInstalled=true;
 window.addEventListener('fieldtrail:open-collections',event=>{
  if(event.detail?.dealStatusVerified===true)return;
  const key=String(event.detail?.key||'');
  const match=key.match(/^lead:([0-9a-f-]+)$/i);
  if(!match||getSession()?.role!=='admin')return;
  event.stopImmediatePropagation();
  const leadId=match[1];
  api.adminActivityLead(leadId).then(result=>{
   const lead=result?.lead;
   if(lead&&String(lead.status||'').toLowerCase()!=='won'){
    window.dispatchEvent(new CustomEvent(BLOCK_EVENT,{detail:{leadId,businessName:lead.business_name||lead.businessName||'this Deal'}}));
    return;
   }
   window.dispatchEvent(new CustomEvent('fieldtrail:open-collections',{detail:{...event.detail,dealStatusVerified:true}}));
  }).catch(()=>{
   // If Deal verification itself fails, preserve the existing Payments behavior
   // rather than inventing a status or hiding a genuine backend error.
   window.dispatchEvent(new CustomEvent('fieldtrail:open-collections',{detail:{...event.detail,dealStatusVerified:true}}));
  });
 },true);
}

installGate();

export default function PaymentDealGate(){
 const [blocked,setBlocked]=useState(null);
 useEffect(()=>{
  const onBlocked=event=>setBlocked(event.detail||null);
  window.addEventListener(BLOCK_EVENT,onBlocked);
  return()=>window.removeEventListener(BLOCK_EVENT,onBlocked);
 },[]);
 if(!blocked)return null;
 const openDeal=()=>{
  const hash=`#lead=${blocked.leadId}`;
  setBlocked(null);
  if(window.location.hash===hash)window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash=hash;
  // Quotations/other modal state is in-memory. Reloading this one navigation
  // clears that overlay and lets Engage's existing #lead route open the Deal.
  window.location.reload();
 };
 return <div role="dialog" aria-modal="true" aria-label="Payments require a Won Deal" style={{position:'fixed',inset:0,zIndex:100000,background:'rgba(17,24,39,.46)',display:'grid',placeItems:'center',padding:18}}>
  <div style={{width:'min(430px,100%)',background:'#fff',borderRadius:16,padding:20,boxShadow:'0 20px 55px rgba(0,0,0,.22)',border:'1px solid #E7E9EE'}}>
   <div style={{fontSize:17,fontWeight:800,color:'#1A1D23',marginBottom:7}}>Move Deal to Won to open Payments</div>
   <div style={{fontSize:13,color:'#6B7280',lineHeight:1.55,marginBottom:18}}><strong style={{color:'#1A1D23'}}>{blocked.businessName}</strong> is not currently Won. Open the Deal, change its status to <strong>Won</strong>, then Payments will become available.</div>
   <div style={{display:'flex',gap:9,justifyContent:'flex-end'}}>
    <button type="button" onClick={()=>setBlocked(null)} style={{padding:'10px 14px',borderRadius:9,border:'1px solid #E7E9EE',background:'#fff',color:'#1A1D23',fontWeight:700,cursor:'pointer'}}>Cancel</button>
    <button type="button" onClick={openDeal} style={{padding:'10px 16px',borderRadius:9,border:'none',background:'#145C5D',color:'#fff',fontWeight:800,cursor:'pointer'}}>Open Deal</button>
   </div>
  </div>
 </div>;
}
