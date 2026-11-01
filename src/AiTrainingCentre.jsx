import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { OnboardingDialog } from "./Onboarding.jsx";
import "./ai-training.css";

const choices = {
  type: [["first","First message"],["after","After a talk"],["followup","Follow-up"],["custom","Write My Own"]],
  language: [["english","English"],["hinglish","Hinglish"],["hindi","Hindi"]],
  tone: [["respectful","Respectful"],["friendly","Friendly"],["casual","Casual"]],
  goal: [["demo","Book a demo"],["trial","Discuss a trial"],["pricing","Share pricing"],["decision","Get a decision"],["stay","Stay in touch"]]
};
const defaults = { type:"after", language:"english", tone:"respectful", goal:"demo", message:"" };
const choice = (name, value, change) => (
  <label key={name}>{name === "type" ? "Message type" : name.charAt(0).toUpperCase()+name.slice(1)}
    <select value={value} onChange={e=>change(name,e.target.value)}>
      {choices[name].map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
  </label>
);

export default function AiTrainingCentre({ onClose }) {
  const [tab,setTab] = useState("knowledge");
  const [settings,setSettings] = useState({ company_knowledge:"", writing_instructions:"" });
  const [example,setExample] = useState(defaults);
  const [test,setTest] = useState({...defaults, message:""});
  const [preview,setPreview] = useState(null);
  const [filter,setFilter] = useState("pending");
  const [examples,setExamples] = useState([]);
  const [offset,setOffset] = useState(0);
  const [hasMore,setHasMore] = useState(false);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");

  const loadExamples = async (status=filter,page=offset) => {
    const data=await api.aiTrainingExamples(status,page);
    setExamples(data.examples||[]);
    setHasMore(!!data.hasMore);
  };
  useEffect(()=>{
    let active=true;
    Promise.all([api.aiTrainingConfig(),api.aiTrainingExamples("pending",0)])
      .then(([c,e])=>{if(!active)return;setSettings(c.settings);setExamples(e.examples||[]);setHasMore(!!e.hasMore);})
      .catch(e=>{if(active)setError(e.message||"Unable to load AI training.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  const run=async(job)=>{
    if(busy)return;
    setBusy(true);setError("");setSuccess("");
    try { await job(); }
    catch(e){setError(e.message||"Request failed. Try again.");}
    finally{setBusy(false);}
  };
  const switchFilter=(value)=>{
    setFilter(value);setOffset(0);
    run(()=>loadExamples(value,0));
  };
  const pageTo=(page)=>run(async()=>{await loadExamples(filter,page);setOffset(page);});
  const update=(set)=>(key,value)=>set(s=>({...s,[key]:value}));
  const save=()=>run(async()=>{
    const data=await api.aiTrainingSaveConfig(settings);
    setSettings(data.settings);
    setSuccess("Training instructions saved. They will apply to the next Gemini generation.");
  });
  const submit=()=>run(async()=>{
    const r=await api.aiTrainingSubmitExample({...example,goal:example.type==="custom"?"stay":example.goal});
    setSuccess(r.example.status==="approved"?"Approved example saved.":"Example submitted for admin review.");
    setExample(defaults);setFilter("approved");setOffset(0);
    await loadExamples("approved",0);
  });
  const review=(id,status)=>run(async()=>{
    await api.aiTrainingReviewExample(id,status);
    await loadExamples();
    setSuccess(status==="approved"?"Example approved for Gemini.":"Example rejected.");
  });
  const remove=(id)=>run(async()=>{
    if(!window.confirm("Permanently delete this training example?"))return;
    await api.aiTrainingDeleteExample(id);
    await loadExamples();setSuccess("Example deleted.");
  });
  const previewTest=()=>run(async()=>{
    setPreview(null);
    const res=await api.aiTrainingTest({
      ...test,
      goal:test.type==="custom"?"stay":test.goal,
      notes:test.type==="custom"?"":test.message,
      instruction:test.type==="custom"?test.message:"",
      useGemini:true
    });
    if(res.source!=="gemini"||!res.message?.trim())throw new Error("Gemini did not generate a test message.");
    setPreview(res);
    setSuccess("Test generated using Gemini.");
  });

  return <OnboardingDialog title="AI Training Centre" fullPage onClose={onClose} busy={busy}>
    <div className="ai-training">
      <header className="ai-training-header">
        <div className="ai-training-kicker">ADMIN · AI WRITER</div>
        <h2>Train your sales message writer</h2>
        <p>Add verified company knowledge, set a consistent writing style, and approve good examples. Only approved content is used for Gemini-generated messages.</p>
      </header>
      <nav className="ai-training-tabs" aria-label="AI Training Centre">
        {[["knowledge","Knowledge & rules"],["examples","Sales examples"],["test","Test AI"]].map(([key,label])=>
          <button type="button" key={key} aria-current={tab===key?"page":undefined}
            className={tab===key?"active":""} onClick={()=>{setTab(key);setError("");setSuccess("");}}>{label}</button>
        )}
      </nav>
      {error&&<p role="alert" className="ai-training-error">{error}</p>}
      {success&&<p role="status" className="ai-training-success">{success}</p>}
      {loading?<p>Loading training settings…</p>:tab==="knowledge"?<>
        <section className="ai-training-panel">
          <h3>Company Knowledge</h3>
          <p>Only add verified Swirl.cx capabilities, integrations, pricing, and availability. The bot should not invent claims.</p>
          <textarea aria-label="Company Knowledge" rows={9} maxLength={5000}
            placeholder="Enter verified product facts and important limitations. Do not include customer details."
            value={settings.company_knowledge||""} onChange={e=>setSettings(s=>({...s,company_knowledge:e.target.value}))}/>
          <small>{(settings.company_knowledge||"").length}/5000 characters</small>
        </section>
        <section className="ai-training-panel">
          <h3>AI Writing Instructions</h3>
          <p>Set message length, tone, objection handling, and CTA preferences. Core privacy and no-invention rules still take priority.</p>
          <textarea aria-label="AI Writing Instructions" rows={7} maxLength={3000}
            placeholder="Example: Keep WhatsApp messages short, respectful, and natural. Ask for a 10-minute demo when appropriate."
            value={settings.writing_instructions||""} onChange={e=>setSettings(s=>({...s,writing_instructions:e.target.value}))}/>
          <small>{(settings.writing_instructions||"").length}/3000 characters</small>
        </section>
        <div className="ai-training-actions"><button className="ai-training-primary" onClick={save} disabled={busy}>Save training instructions</button></div>
        <p className="ai-training-note">Do not enter private customer information. These settings are provided to Google for Gemini generation.</p>
      </>:tab==="examples"?<>
        <section className="ai-training-panel">
          <h3>Add an approved sales example</h3>
          <p>Use placeholders [[OWNER]], [[BUSINESS]] and [[SENDER]] instead of real names. Do not include personal data. Admin-added examples are immediately approved.</p>
          <div className="ai-training-fields">{["type","language","goal","tone"].filter(name=>example.type!=="custom"||name!=="goal").map(name=>choice(name,example[name],update(setExample)))}</div>
          <label>Example WhatsApp message
            <textarea value={example.message} maxLength={1200} rows={6}
              placeholder="Hi [[OWNER]], it was great speaking with you about [[BUSINESS]]…"
              onChange={e=>setExample(s=>({...s,message:e.target.value}))}/>
          </label>
          <div className="ai-training-actions">
            <button className="ai-training-primary" disabled={busy||example.message.trim().length<25} onClick={submit}>Add approved example</button>
          </div>
        </section>
        <section className="ai-training-panel">
          <div className="ai-training-between"><h3>Review examples</h3>
            <select aria-label="Example status" value={filter} onChange={e=>switchFilter(e.target.value)}>
              {[["pending","Pending review"],["approved","Approved"],["rejected","Rejected"],["all","All examples"]].map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {!examples.length?<p>No examples for this filter.</p>:examples.map(row=><article className="ai-training-example" key={row.id}>
            <div><strong>{row.submitted_by_name||"Sales team"}</strong><span>{row.status} · {row.language} · {row.message_type==="custom"?"Write My Own":row.message_type}{row.message_type==="custom"?"":" · "+row.goal}</span></div>
            <p>{row.message}</p>
            <div className="ai-training-actions">
              {row.status!=="approved"&&<button disabled={busy} onClick={()=>review(row.id,"approved")}>Approve</button>}
              {row.status!=="rejected"&&<button disabled={busy} onClick={()=>review(row.id,"rejected")}>Reject</button>}
              <button disabled={busy} onClick={()=>remove(row.id)}>Delete</button>
            </div>
          </article>)}
          <div className="ai-training-actions">
            <button disabled={busy||!offset} onClick={()=>pageTo(offset-50)}>Previous</button>
            <span>Page {Math.floor(offset/50)+1}</span>
            <button disabled={busy||!hasMore} onClick={()=>pageTo(offset+50)}>Next</button>
          </div>
        </section>
      </>:<>
        <section className="ai-training-panel">
          <h3>Test Gemini with your training</h3>
          <p>This test uses a hypothetical scenario, not any CRM customer's record. It will not save or send a message. Gemini API limits may apply.</p>
          <div className="ai-training-fields">{["type","language","goal","tone"].filter(name=>test.type!=="custom"||name!=="goal").map(name=>choice(name,test[name],(key,value)=>{update(setTest)(key,value);setPreview(null);}))}</div>
          <label>{test.type==="custom"?"Write My Own request":"Test conversation scenario"}
            <textarea rows={5} maxLength={600} value={test.message}
              placeholder={test.type==="custom"?"Write a polite reply to a restaurant owner concerned about pricing, without pushing for a demo.":"The owner is interested in inventory and recipe costing, and asked for a demo next week."}
              onChange={e=>{setTest(s=>({...s,message:e.target.value}));setPreview(null);}}/>
          </label>
          <div className="ai-training-actions"><button className="ai-training-primary" disabled={busy||!test.message.trim()} onClick={previewTest}>{busy?"Generating…":"Generate test message"}</button></div>
          {preview&&<section className="ai-training-preview">
            <strong>Generated with Gemini</strong>
            <p style={{whiteSpace:"pre-wrap"}}>{preview.message}</p>
          </section>}
        </section>
      </>}
    </div>
  </OnboardingDialog>;
}
