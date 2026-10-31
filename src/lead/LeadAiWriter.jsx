import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Loader2, MessageCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { api } from "../api.js";

// A lead-scoped, optional composer. Nothing is sent to WhatsApp until the
// employee reviews the text and presses Send in WhatsApp itself.
const field = {
  width:"100%", boxSizing:"border-box", border:"1px solid #DCE4E1", borderRadius:10,
  padding:"10px 11px", background:"#fff", color:"#1E2932",
  fontSize:13, fontFamily:"Inter, system-ui, sans-serif", outlineColor:"#7548CF"
};
const labels = {
  type: [["first","First message"],["after","After a talk"],["followup","Follow-up"]],
  goal: [["demo","Book a demo"],["trial","Discuss a trial"],["pricing","Share pricing"],["decision","Get a decision"],["stay","Stay in touch"]],
  language: [["english","English"],["hinglish","Hinglish"],["hindi","हिंदी"]],
  tone: [["respectful","Respectful"],["friendly","Friendly"],["casual","Casual"]],
  variant: [["short","Short"],["natural","Natural"],["professional","Professional"]]
};
const label = { fontSize:12, fontWeight:750, color:"#2E3B41", display:"block", marginBottom:5 };
const h = { border:0, background:"transparent", fontSize:13, color:"#344054", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 };
const purple = "#7548CF";

function SelectField({ name, title, value, onChange }) {
  return <label style={{ display:"block", minWidth:0 }}>
    <span style={label}>{title}</span>
    <select aria-label={title} value={value} onChange={e=>onChange(e.target.value)} style={field}>
      {labels[name].map(([v,t])=><option value={v} key={v}>{t}</option>)}
    </select>
  </label>;
}
function whatsappUrl(phone,text) {
  const d=String(phone||"").replace(/\D/g,"");
  if (d.length < 10 || d.length > 15) return null;
  const n=d.length===10?"91"+d:d;
  return "https://wa.me/"+n+"?text="+encodeURIComponent(text);
}

export default function LeadAiWriter({ lead, onClose }) {
  const [type,setType]=useState("after");
  const [goal,setGoal]=useState("demo");
  const [language,setLanguage]=useState("english");
  const [tone,setTone]=useState("respectful");
  const [notes,setNotes]=useState("");
  const [useGemini,setUseGemini]=useState(false);
  const [drafts,setDrafts]=useState(null);
  const [variant,setVariant]=useState("natural");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [copied,setCopied]=useState(false);
  const [source,setSource]=useState("");
  const [savingExample,setSavingExample]=useState(false);
  const [exampleNotice,setExampleNotice]=useState("");
  const [preview,setPreview]=useState(false);

  useEffect(()=>{
    const onKey=e=>{if(e.key==="Escape")onClose();};
    document.addEventListener("keydown",onKey);
    return ()=>document.removeEventListener("keydown",onKey);
  },[onClose]);
  const change=(setter)=>(v)=>{setter(v);setDrafts(null);setError("");setExampleNotice("");setPreview(false);};
  const generate=async()=>{
    if(busy)return;
    setBusy(true);setError("");setNotice("");setExampleNotice("");setPreview(false);
    try{
      const result=await api.generateLeadAiMessage(lead.id,{type,goal,language,tone,notes,useGemini});
      if(!result?.drafts?.natural)throw new Error("No draft was generated.");
      setDrafts(result.drafts);setSource(result.source||"template");setVariant("natural");
      setNotice(result.notice||"");
    }catch(e){setError(e.message||"Could not generate a draft. Please retry.");}
    finally{setBusy(false);}
  };
  const current=drafts?.[variant]||"";
  const updateDraft=v=>{setDrafts(d=>d?{...d,[variant]:v}:d);setExampleNotice("");};
  const url=current.trim()?whatsappUrl(lead.phone,current):null;
  const share=()=>{if(url)window.open(url,"_blank","noopener,noreferrer");};
  const saveGoodExample=async()=>{
    if(!current.trim()||savingExample)return;
    setSavingExample(true);setError("");setExampleNotice("");
    try{
      const r=await api.aiTrainingSubmitExample({leadId:lead.id,message:current,language,type,goal,tone});
      setExampleNotice(r.example?.status==="approved"?"Training example approved.":"Submitted for admin approval. Not used for training yet.");
    }catch(e){setError(e.message||"Could not submit training example.");}
    finally{setSavingExample(false);}
  };
  const copy=async()=>{
    if(!current.trim())return;
    try{await navigator.clipboard.writeText(current);setCopied(true);}
    catch{setError("Copy unavailable in this browser. Select the message text and copy manually.");}
  };

  return <div role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}
    style={{position:"fixed",inset:0,zIndex:2400,background:"rgba(25,32,41,.38)",display:"flex",justifyContent:"flex-end"}}>
    <section role="dialog" aria-modal="true" aria-label="AI WhatsApp Writer"
      style={{width:"min(510px,100vw)",height:"100%",minWidth:0,overflow:"auto",background:"#F8FAF9",boxShadow:"-10px 0 36px rgba(0,0,0,.11)",padding:"18px clamp(14px,3vw,23px)",boxSizing:"border-box",fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:16}}>
        <button type="button" style={h} onClick={onClose}><ArrowLeft size={16}/> Back to lead</button>
        <button type="button" aria-label="Close AI Writer" onClick={onClose} style={{...h,padding:7}}><X size={18}/></button>
      </div>
      <header style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
        <span style={{width:37,height:37,borderRadius:10,background:purple,color:"#fff",display:"grid",placeItems:"center",fontWeight:850,fontSize:13}}>AI</span>
        <div>
          <div style={{fontSize:18,fontWeight:850,color:"#202B35"}}>WhatsApp AI Writer</div>
          <div style={{fontSize:11.5,color:"#63717B",marginTop:3}}>Personalized restaurant sales outreach</div>
        </div>
      </header>
      <div style={{padding:12,borderRadius:11,background:"#F0EBFB",marginBottom:15}}>
        <div style={{fontWeight:800,fontSize:13,color:"#55319D",overflowWrap:"anywhere"}}>{lead.business}</div>
        <div style={{fontSize:11.5,color:"#6B607D",marginTop:3}}>Contact: {lead.owner||"Not recorded"} · Stage: {lead.status||"Not set"}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <SelectField name="type" title="Message type" value={type} onChange={change(setType)}/>
        <label style={{display:"block"}}>
          <span style={label}>What was discussed? (optional)</span>
          <textarea value={notes} onChange={e=>change(setNotes)(e.target.value)} maxLength={600} rows={3}
            placeholder="What interested the owner? Any concerns or promised next steps?"
            style={{...field,resize:"vertical",minHeight:75,lineHeight:1.5}}/>
        </label>
        <SelectField name="goal" title="Next step" value={goal} onChange={change(setGoal)}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <SelectField name="language" title="Language" value={language} onChange={change(setLanguage)}/>
          <SelectField name="tone" title="Tone" value={tone} onChange={change(setTone)}/>
        </div>
        <label style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:12,color:"#4B5563",padding:"10px",border:"1px solid #E5E7EB",borderRadius:10,background:"#fff"}}>
          <input type="checkbox" checked={useGemini} onChange={e=>change(setUseGemini)(e.target.checked)} style={{marginTop:2,accentColor:purple}}/>
          <span><strong>Use Gemini AI when available</strong><span style={{display:"block",fontSize:11.5,marginTop:3,lineHeight:1.5}}>Optional. When enabled, your discussion note (with known names, phone numbers, emails and links redacted) and the lead stage/follow-up date are provided to Google. Remove other sensitive details yourself. Free-tier data may be used by Google to improve products. Leave off for private templates.</span></span>
        </label>
        <button type="button" onClick={generate} disabled={busy}
          style={{border:0,borderRadius:11,background:purple,color:"#fff",minHeight:43,fontSize:13,fontWeight:800,cursor:busy?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:busy ? 0.7 : 1}}>
          {busy?<Loader2 size={16}/>:<Sparkles size={16}/>} {busy?"Generating…":"Generate message"}
        </button>
        {error && <div role="alert" style={{fontSize:12,color:"#B42318",padding:10,background:"#FFF0F0",borderRadius:9}}>{error}</div>}
        {notice && <div role="status" style={{fontSize:12,color:"#7C5B22",padding:10,background:"#FFF8E7",borderRadius:9}}>{notice}</div>}
        {drafts && <>
          <div style={{borderTop:"1px solid #E1E6E3",paddingTop:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <div style={{fontWeight:800,fontSize:13,color:"#24303A"}}>Your message</div>
            <span style={{fontSize:11,color:"#67747D"}}>{source==="gemini"?"Generated with Gemini":"Private template draft"}</span>
          </div>
          <div role="group" aria-label="Message style" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:5}}>
            {labels.variant.map(([key,name])=><button key={key} type="button" onClick={()=>{setVariant(key);setCopied(false);setPreview(false);}}
              aria-pressed={variant===key}
              style={{border:variant===key?"1px solid #7548CF":"1px solid #DCE4E1",borderRadius:9,padding:"9px 4px",background:variant===key?"#F0EBFB":"#fff",color:variant===key?"#6035AC":"#596570",fontSize:11.5,fontWeight:750,cursor:"pointer"}}>{name}</button>)}
          </div>
          <label><span style={label}>Edit before sending</span>
            <textarea value={current} onChange={e=>updateDraft(e.target.value)} rows={9} aria-label="Editable WhatsApp message" style={{...field,resize:"vertical",lineHeight:1.55,minHeight:165}}/>
          </label>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:-8}}>
            <span style={{fontSize:11,color:"#68737E"}}>{current.trim()?current.trim().split(/\s+/).length:0} words</span>
            <button type="button" style={{...h,color:purple,fontWeight:800,fontSize:11.5}} onClick={generate}><RefreshCw size={13}/> Regenerate</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <button type="button" onClick={copy} disabled={!current.trim()} style={{border:"1px solid #D6DDE2",borderRadius:10,padding:"11px 6px",background:"#fff",cursor:"pointer",fontSize:12.5,fontWeight:800,color:"#334155"}}>
              {copied?<Check size={15} style={{verticalAlign:"middle"}}/>:<Copy size={15} style={{verticalAlign:"middle"}}/>} {copied?"Copied":"Copy"}
            </button>
            <button type="button" disabled={!url} onClick={share} style={{border:0,borderRadius:10,padding:"11px 6px",background:"#1D8B62",color:"#fff",cursor:url?"pointer":"not-allowed",opacity:url?1:.45,fontSize:12.5,fontWeight:800}}>
              <MessageCircle size={15} style={{verticalAlign:"middle"}}/> Open WhatsApp
            </button>
          </div>
          <div style={{borderTop:"1px solid #E1E6E3",paddingTop:12}}>
            <button type="button" disabled={busy||savingExample||!current.trim()||!!exampleNotice} onClick={saveGoodExample}
              style={{...h,fontWeight:750,color:purple,fontSize:12,opacity:savingExample?.6:1}}>
              {savingExample?"Saving…":"☆ Save as Good Example"}
            </button>
            <div style={{fontSize:11,color:"#7B8590",marginTop:4}}>Submit this draft as a team writing example. Known customer names and contact details are removed; admin approval is required before Gemini uses it. Review the text for other private details first.</div>
            {exampleNotice&&<div role="status" style={{fontSize:12,color:"#256B48",marginTop:7}}>{exampleNotice}</div>}
          </div>
          {!url && <div style={{fontSize:11.5,color:"#7C5963"}}>Add a valid contact number to this lead to open WhatsApp directly.</div>}
          <div style={{fontSize:11.5,color:"#7B8590",lineHeight:1.5}}>Opening WhatsApp only prepares the message. It will not send automatically or mark the message as sent in CRM.</div>
        </>}
      </div>
    </section>
  </div>;
}
