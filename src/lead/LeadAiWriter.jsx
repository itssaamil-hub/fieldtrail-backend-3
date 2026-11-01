import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Loader2, MessageCircle, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { api } from "../api.js";

// Lead-scoped writing assistant: nothing is sent to WhatsApp automatically.
// Conversation history lives only in this open composer; we do not store it.
const field = {
  width:"100%", boxSizing:"border-box", border:"1px solid #DCE4E1", borderRadius:10,
  padding:"10px 11px", background:"#fff", color:"#1E2932",
  fontSize:13, fontFamily:"Inter, system-ui, sans-serif", outlineColor:"#7548CF"
};
const labels = {
  type: [["after","After a talk"],["first","First message"],["followup","Follow-up"],["custom","Write My Own"]],
  goal: [["demo","Book a demo"],["trial","Discuss a trial"],["pricing","Share pricing"],["decision","Get a decision"],["stay","Stay in touch"]],
  language: [["english","English"],["hinglish","Hinglish"],["hindi","हिंदी"]],
  tone: [["respectful","Respectful"],["friendly","Friendly"],["casual","Casual"]]
};
const label = { fontSize:12, fontWeight:750, color:"#2E3B41", display:"block", marginBottom:5 };
const linkButton = { border:0, background:"transparent", fontSize:13, color:"#344054", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 };
const purple = "#7548CF";
const quickActions = [
  ["Make shorter", "Rewrite this message more concisely without losing its main point."],
  ["More natural", "Rewrite this like a thoughtful real salesperson texting naturally. No corporate or scripted phrasing."],
  ["Less salesy", "Make this softer and less sales-focused, without pressuring the customer."],
  ["Handle objection", "Address the concern mentioned in the discussion notes tactfully. Do not invent an objection or promise."],
  ["Try again", "Write a fresh alternative that feels authentic, while keeping only the supported facts."]
];

function SelectField({ name, title, value, onChange }) {
  return <label style={{display:"block",minWidth:0}}>
    <span style={label}>{title}</span>
    <select aria-label={title} value={value} onChange={e=>onChange(e.target.value)} style={field}>
      {labels[name].map(([v,t])=><option key={v} value={v}>{t}</option>)}
    </select>
  </label>;
}
function whatsappUrl(phone,text) {
  const digits=String(phone||"").replace(/\D/g,"");
  if(digits.length<10||digits.length>15)return null;
  const n=digits.length===10?"91"+digits:digits;
  return "https://wa.me/"+n+"?text="+encodeURIComponent(text);
}
export default function LeadAiWriter({ lead, onClose }) {
  const [type,setType]=useState("custom");
  const [goal,setGoal]=useState("demo");
  const [language,setLanguage]=useState("english");
  const [tone,setTone]=useState("respectful");
  const [notes,setNotes]=useState("");
  const [input,setInput]=useState("");
  const [messages,setMessages]=useState([]);
  const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);
  const [savingExample,setSavingExample]=useState(false);
  const [exampleNotice,setExampleNotice]=useState("");

  useEffect(()=>{
    const onKey=e=>{if(e.key==="Escape")onClose();};
    document.addEventListener("keydown",onKey);
    return ()=>document.removeEventListener("keydown",onKey);
  },[onClose]);
  const resetConversation=()=>{
    setMessages([]);setDraft("");setError("");
    setExampleNotice("");setCopied(false);
  };
  const change=(setter)=>(value)=>{setter(value);resetConversation();};
  const sendPrompt=async (quickText)=>{
    if(busy)return;
    const instruction=typeof quickText==="string"?quickText.trim():input.trim();
    const refining=Boolean(draft);
    if(type==="custom"&&!instruction){setError("Describe what you want AI to write.");return;}
    if(refining&&!instruction){setError("Tell AI what to change.");return;}
    setBusy(true);setError("");setExampleNotice("");setCopied(false);
    try{
      const result=await api.converseLeadAiMessage(lead.id,{
        type,goal,language,tone,notes,useGemini:true,
        instruction,previousMessage:refining?draft:""
      });
      if(!result?.message?.trim()||result.source!=="gemini"){
        throw new Error("AI could not generate a message. Please try again.");
      }
      const nextDraft=result.message;
      const requestLabel=instruction||(
        type==="first"?"Write a first WhatsApp message":
        type==="followup"?"Write a gentle follow-up":
        "Write a message based on our discussion"
      );
      setMessages(list=>[...list,{role:"user",text:requestLabel},{role:"assistant",text:nextDraft}]);
      setDraft(nextDraft);setInput("");
    }catch(e){setError(e?.message||"Could not generate your message. Please try again.");}
    finally{setBusy(false);}
  };
  const shareUrl=draft.trim()?whatsappUrl(lead.phone,draft):null;
  const copy=async()=>{
    if(!draft.trim())return;
    try{await navigator.clipboard.writeText(draft);setCopied(true);}
    catch{setError("Copy unavailable. Select the message and copy it manually.");}
  };
  const saveGoodExample=async()=>{
    if(!draft.trim()||savingExample)return;
    setSavingExample(true);setError("");setExampleNotice("");
    try{
      const result=await api.aiTrainingSubmitExample({
        leadId:lead.id,message:draft,language,
        type,goal:type==="custom"?"stay":goal,tone
      });
      setExampleNotice(result.example?.status==="approved"?
        "Training example approved.":"Submitted for admin approval. Not used for training yet.");
    }catch(e){setError(e?.message||"Could not submit training example.");}
    finally{setSavingExample(false);}
  };

  return <div role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}
    style={{position:"fixed",inset:0,zIndex:2400,background:"rgba(25,32,41,.38)",display:"flex",justifyContent:"flex-end"}}>
    <section role="dialog" aria-modal="true" aria-label="AI WhatsApp Writer"
      style={{width:"min(510px,100vw)",height:"100%",minWidth:0,overflow:"auto",background:"#F8FAF9",boxShadow:"-10px 0 36px rgba(0,0,0,.11)",padding:"18px clamp(14px,3vw,23px)",boxSizing:"border-box",fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:16}}>
        <button type="button" style={linkButton} onClick={onClose}><ArrowLeft size={16}/> Back to lead</button>
        <button type="button" aria-label="Close AI Writer" onClick={onClose} style={{...linkButton,padding:7}}><X size={18}/></button>
      </div>
      <header style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
        <span style={{width:37,height:37,borderRadius:10,background:purple,color:"#fff",display:"grid",placeItems:"center",fontWeight:850,fontSize:13}}>AI</span>
        <div>
          <div style={{fontSize:18,fontWeight:850,color:"#202B35"}}>Engage AI Sales Assistant</div>
          <div style={{fontSize:11.5,color:"#63717B",marginTop:3}}>Write, refine and review one WhatsApp message</div>
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
          <textarea value={notes} onChange={e=>change(setNotes)(e.target.value)} maxLength={600} rows={2}
            placeholder="Relevant interests, concerns or agreed next steps"
            style={{...field,resize:"vertical",minHeight:62,lineHeight:1.5}}/>
        </label>
        {type!=="custom"&&<SelectField name="goal" title="Next step" value={goal} onChange={change(setGoal)}/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <SelectField name="language" title="Language" value={language} onChange={change(setLanguage)}/>
          <SelectField name="tone" title="Tone" value={tone} onChange={change(setTone)}/>
        </div>
        <div style={{fontSize:11,color:"#7B8590",lineHeight:1.5}}>AI drafting processes your request and redacted notes with Google. Avoid sensitive details and review each message before sending.</div>
        <div style={{borderTop:"1px solid #E1E6E3",paddingTop:14,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontWeight:800,fontSize:13,color:"#24303A"}}>Conversation</div>
          {messages.map((item,i)=><div key={i} style={{alignSelf:item.role==="user"?"flex-end":"flex-start",maxWidth:"95%",padding:"11px 13px",borderRadius:13,background:item.role==="user"?"#F0EBFB":"#fff",border:"1px solid "+(item.role==="user"?"#DFD1FA":"#E1E6E3"),fontSize:12.5,lineHeight:1.6,color:"#26323A",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>
            <div style={{fontSize:10.5,fontWeight:800,color:item.role==="user"?"#6035AC":"#475569",marginBottom:4}}>{item.role==="user"?"You":"Engage AI"}</div>{item.text}
          </div>)}
        </div>
        {draft&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <span style={{fontWeight:800,fontSize:13,color:"#24303A"}}>Edit message before sending</span>
            <span style={{fontSize:11,color:"#67747D"}}>AI-generated message</span>
          </div>
          <textarea value={draft} onChange={e=>{setDraft(e.target.value);setCopied(false);setExampleNotice("");}} rows={5}
            aria-label="Editable WhatsApp message" style={{...field,resize:"vertical",lineHeight:1.55,minHeight:120}}/>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {quickActions.map(([name,request])=><button key={name} type="button" onClick={()=>sendPrompt(request)} disabled={busy}
              style={{border:"1px solid #D9D3E6",borderRadius:18,background:"#fff",padding:"7px 10px",fontSize:11.5,color:"#6035AC",cursor:busy?"wait":"pointer",opacity:busy?.55:1}}>{name}</button>)}
          </div>
        </>}
        <label>
          <span style={label}>{draft?"Ask AI to refine this message":type==="custom"?"Write your own request":"Ask AI to write your message (optional)"}</span>
          <textarea value={input} onChange={e=>setInput(e.target.value)} maxLength={700} rows={3}
            placeholder={draft?"For example: Make it warmer and remove the demo request.":type==="custom"?"Tell AI exactly what you want to say…":"Add a personal instruction, or generate using the selected message type…"}
            style={{...field,resize:"vertical",minHeight:76,lineHeight:1.5}}/>
        </label>
        <button type="button" onClick={()=>sendPrompt()} disabled={busy}
          style={{border:0,borderRadius:11,background:purple,color:"#fff",minHeight:43,fontSize:13,fontWeight:800,cursor:busy?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:busy?.7:1}}>
          {busy?<Loader2 size={16}/>:draft?<Send size={16}/>:<Sparkles size={16}/>}
          {busy?"Generating…":draft?"Refine message":"Generate message"}
        </button>
        {error&&<div role="alert" style={{fontSize:12,color:"#B42318",padding:10,background:"#FFF0F0",borderRadius:9}}>{error}</div>}
        {draft&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:"#68737E"}}>{draft.trim()?draft.trim().split(/\s+/).length:0} words</span>
            <button type="button" style={{...linkButton,color:purple,fontWeight:800,fontSize:11.5}} onClick={resetConversation}><RefreshCw size={13}/> Start over</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <button type="button" onClick={copy} disabled={!draft.trim()} style={{border:"1px solid #D6DDE2",borderRadius:10,padding:"11px 6px",background:"#fff",cursor:"pointer",fontSize:12.5,fontWeight:800,color:"#334155"}}>
              {copied?<Check size={15} style={{verticalAlign:"middle"}}/>:<Copy size={15} style={{verticalAlign:"middle"}}/>} {copied?"Copied":"Copy"}
            </button>
            <button type="button" disabled={!shareUrl} onClick={()=>{if(shareUrl)window.open(shareUrl,"_blank","noopener,noreferrer");}} style={{border:0,borderRadius:10,padding:"11px 6px",background:"#1D8B62",color:"#fff",cursor:shareUrl?"pointer":"not-allowed",opacity:shareUrl?1:.45,fontSize:12.5,fontWeight:800}}>
              <MessageCircle size={15} style={{verticalAlign:"middle"}}/> Open WhatsApp
            </button>
          </div>
          <div style={{borderTop:"1px solid #E1E6E3",paddingTop:12}}>
            <button type="button" disabled={busy||savingExample||!draft.trim()||!!exampleNotice} onClick={saveGoodExample}
              style={{...linkButton,fontWeight:750,color:purple,fontSize:12,opacity:savingExample?.6:1}}>
              {savingExample?"Saving…":"☆ Save as Good Example"}
            </button>
            <div style={{fontSize:11,color:"#7B8590",marginTop:4}}>Submit your edited message for admin approval. Known customer details are redacted; review for other private details. Write My Own examples are reviewed in their own training category.</div>
            {exampleNotice&&<div role="status" style={{fontSize:12,color:"#256B48",marginTop:7}}>{exampleNotice}</div>}
          </div>
          {!shareUrl&&<div style={{fontSize:11.5,color:"#7C5963"}}>Add a valid contact number to the lead to open WhatsApp directly.</div>}
          <div style={{fontSize:11.5,color:"#7B8590",lineHeight:1.5}}>Opening WhatsApp only prepares your message. Nothing is sent automatically or marked sent in CRM.</div>
        </>}
      </div>
    </section>
  </div>;
}
