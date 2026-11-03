import React, { useEffect, useRef, useState } from "react";
import { BotMessageSquare, Send, X, ShieldCheck, AlertCircle } from "lucide-react";
import { api, getSession } from "./api.js";
import "./ask-engage.css";

const EXAMPLES = [
  "How many deals did Anand add this month, and what payments are currently overdue?",
  "What are the pending payments?",
  "Show overdue payments",
  "Show payment summary"
];
const money = (amount, currency) => {
  try {
    return new Intl.NumberFormat("en-IN", { style:"currency", currency:currency||"INR",
      maximumFractionDigits:2 }).format(Number(amount)||0);
  } catch {
    return (currency||"") + " " + Number(amount||0).toLocaleString("en-IN");
  }
};

export default function AskEngage({onClose}) {
  const [draft,setDraft] = useState("");
  const [messages,setMessages] = useState([]);
  const [busy,setBusy] = useState(false);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const panelRef = useRef(null);
  useEffect(()=>{inputRef.current?.focus()},[]);
  useEffect(()=>{endRef.current?.scrollIntoView({block:"end",behavior:"smooth"})},[messages,busy]);
  useEffect(()=>{
    const key = e=>{
      if(e.key==="Escape"){e.preventDefault();onClose();return}
      if(e.key!=="Tab")return;
      const controls=[...panelRef.current.querySelectorAll("button:not(:disabled),textarea:not(:disabled)")];
      if(!controls.length)return;
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    };
    document.addEventListener("keydown",key,true);
    return ()=>document.removeEventListener("keydown",key,true);
  },[onClose]);
  if(getSession()?.role!=="admin")return null;

  const ask=async text=>{
    const question=(text||"").trim();
    if(!question||busy)return;
    if(question.length>2000){setMessages(v=>[...v,{role:"error",text:"Use up to 2,000 characters per question."}]);return}
    const previousQuestion=[...messages].reverse().find(x=>x.role==="user")?.text||"";
    setMessages(v=>[...v,{role:"user",text:question}]);
    setDraft("");setBusy(true);
    try {
      const data=await api.askEngage({question,previousQuestion});
      setMessages(v=>[...v,{role:"assistant",text:data.answer||"No answer returned.",data}]);
    }catch(e){
      setMessages(v=>[...v,{role:"error",text:e.message||"Ask Engage could not get the CRM answer. No figures were generated."}]);
    }finally{setBusy(false);inputRef.current?.focus()}
  };

  return <section className="ae-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Ask Engage chatbot">
    <div className="ae-head">
      <div className="ae-head-icon"><BotMessageSquare size={20} strokeWidth={1.9}/></div>
      <div><strong>Ask Engage</strong><small>AI-powered CRM answers</small></div>
      <button type="button" className="ae-close" onClick={onClose} aria-label="Close Ask Engage"><X size={19}/></button>
    </div>
    <div className="ae-subtitle"><ShieldCheck size={14}/> Read-only · Uses live Engage CRM records</div>
    <div className="ae-conversation" role="log" aria-live="polite">
      {!messages.length&&<div className="ae-start">
        <div className="ae-welcome"><BotMessageSquare size={25}/></div>
        <h3>What would you like to know?</h3>
        <p>Ask detailed questions about deals and payments. You can combine up to four related CRM topics in one message. Answers use real CRM records, not sample data.</p>
        <div className="ae-suggestions">
          {EXAMPLES.map(question=><button key={question} type="button" disabled={busy} onClick={()=>ask(question)}>{question}</button>)}
        </div>
      </div>}
      {messages.map((m,i)=><div className={"ae-message ae-"+m.role} key={i}>
        <p>{m.text}</p>
        {m.data?.totals?.length>0&&<div className="ae-totals">
          {m.data.totals.map(t=><div key={t.currency} className="ae-total">
            <strong>{t.currency}</strong>
            <span>{t.accounts} account{t.accounts===1?"":"s"}</span>
            <span>Remaining: <b>{money(t.balance,t.currency)}</b></span>
            {m.data.metric==="payment_summary"&&<span>Paid: {money(t.paid,t.currency)}</span>}
          </div>)}
        </div>}
        {m.data?.items?.length>0&&<div className="ae-accounts">
          {m.data.items.map((a,i)=><div className="ae-account" key={a.key||i}>
            <div><b>{a.name}</b><span>{a.status}</span></div>
            <div><strong>{money(a.balance,a.currency)}</strong><small>{a.dueDate?"Due "+String(a.dueDate).slice(0,10):"No due date"}</small></div>
          </div>)}
        </div>}
        {m.data?.parts?.map((part,j)=><div className="ae-part" key={j}>
          <div className="ae-part-title">{j+1}. {part.answer}</div>
          {part.totals?.length>0&&<div className="ae-totals">
            {part.totals.map(t=><div key={t.currency} className="ae-total">
              <strong>{t.currency}</strong>
              <span>{t.accounts} account{t.accounts===1?"":"s"}</span>
              <span>Remaining: <b>{money(t.balance,t.currency)}</b></span>
              {part.metric==="payment_summary"&&<span>Paid: {money(t.paid,t.currency)}</span>}
            </div>)}
          </div>}
          {part.items?.length>0&&<div className="ae-accounts">
            {part.items.map((a,k)=><div className="ae-account" key={a.key||k}>
              <div><b>{a.name}</b><span>{a.status}</span></div>
              <div><strong>{money(a.balance,a.currency)}</strong><small>{a.dueDate?"Due "+String(a.dueDate).slice(0,10):"No due date"}</small></div>
            </div>)}
          </div>}
          {part.note&&<small className="ae-note">{part.note}</small>}
        </div>)}
        {m.data?.note&&<small className="ae-note">{m.data.note}</small>
        {m.data?.asOf&&<small className="ae-asof">Checked {new Date(m.data.asOf).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})} IST</small>}
      </div>)}
      {busy&&<div className="ae-thinking" role="status">Checking live CRM data…</div>}
      <div ref={endRef}/>
    </div>
    <form className="ae-composer" onSubmit={e=>{e.preventDefault();ask(draft)}}>
      <textarea ref={inputRef} aria-label="Ask Engage question" value={draft} onChange={e=>setDraft(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask(draft)}}}
        placeholder="Ask a detailed question about deals, payments, employees…" maxLength={2000} rows={3} disabled={busy}/>
      <button type="submit" title="Ask Engage" aria-label="Send question" disabled={busy||!draft.trim()}><Send size={18}/></button>
    </form>
    <div className="ae-footer"><AlertCircle size={12}/> Ask Engage cannot edit CRM records. Gemini receives your question, not payment or deal rows.</div>
  </section>;
}
