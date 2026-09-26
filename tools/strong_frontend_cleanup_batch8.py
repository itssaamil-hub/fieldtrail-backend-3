from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
app_path=ROOT/'src'/'App.jsx'; api_path=ROOT/'src'/'api.js'; main_path=ROOT/'src'/'main.jsx'
app=app_path.read_text(); api=api_path.read_text(); main=main_path.read_text()

anchor='  adminDeleteExpense: (id) => request(`/admin/expenses/${id}`, { method: "DELETE" }),\n'
if anchor not in api: raise SystemExit('adminDeleteExpense anchor missing')
if 'adminUpdateExpense:' not in api:
    api=api.replace(anchor,anchor+'  adminUpdateExpense: (id, payload) => request(`/admin/expenses/${id}`, { method: "PATCH", body: payload }),\n',1)
api_path.write_text(api)

start=app.index('function ExpensesReport(')
next_match=re.search(r'\nfunction [A-Za-z0-9_]+\(',app[start+20:])
if not next_match: raise SystemExit('Could not locate function after ExpensesReport')
end=start+20+next_match.start()+1
new=r'''function ExpensesReport({ salesmen }) {
  const PAGE_SIZE = 12;
  const [category,setCategory]=useState("all"), [salesmanId,setSalesmanId]=useState("all"), [from,setFrom]=useState(""), [to,setTo]=useState("");
  const [expenses,setExpenses]=useState(null), [monthTotal,setMonthTotal]=useState(0), [error,setError]=useState(""), [visibleCount,setVisibleCount]=useState(PAGE_SIZE), [editing,setEditing]=useState(null);
  const isoDay=(value)=>String(value||"").match(/^(\d{4}-\d{2}-\d{2})/)?.[1]||"";
  const formatDate=(value)=>{const day=isoDay(value);if(!day)return String(value||"");const d=new Date(`${day}T12:00:00+05:30`);return new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(d)};
  const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const monthRange=(offset=0)=>{const now=new Date();const base=new Date(now.getFullYear(),now.getMonth()+offset,1,12);const y=base.getFullYear(),m=base.getMonth();const first=`${y}-${String(m+1).padStart(2,"0")}-01`;const last=offset===0?today():`${y}-${String(m+1).padStart(2,"0")}-${String(new Date(y,m+1,0).getDate()).padStart(2,"0")}`;return {from:first,to:last}};
  const load=useCallback(()=>{setExpenses(null);setError("");setVisibleCount(PAGE_SIZE);const current={category,salesmanId,from,to};Promise.all([api.adminExpenses(current),api.adminExpenses(monthRange(0))]).then(([res,month])=>{setExpenses(res.expenses||[]);setMonthTotal((month.expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0))}).catch(err=>setError(err.message||"Couldn't load expenses."));},[category,salesmanId,from,to]);
  useEffect(()=>{load()},[load]);
  const del=async id=>{try{await api.adminDeleteExpense(id);load()}catch(err){setError(err.message||"Couldn't delete that expense.")}};
  const setRange=offset=>{const r=monthRange(offset);setFrom(r.from);setTo(r.to)};
  const total=(expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
  const byCategory=(expenses||[]).reduce((a,e)=>{a[e.category]=(a[e.category]||0)+Number(e.amount||0);return a},{});
  const categoryRows=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]); const maxCategory=Math.max(1,...categoryRows.map(([,v])=>v)); const top=categoryRows[0];
  const groups=[];(expenses||[]).slice(0,visibleCount).forEach(e=>{const d=isoDay(e.spentOn);const yesterday=new Date(Date.now()-86400000);const y=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(yesterday);const label=d===today()?"Today":d===y?"Yesterday":formatDate(d);let g=groups.find(x=>x.label===label);if(!g){g={label,rows:[]};groups.push(g)}g.rows.push(e)});
  return <div className="engage-expense-report">
    <div className="engage-expense-quick-filters"><span>Quick date</span><button type="button" onClick={()=>setRange(0)} className={from===monthRange(0).from&&to===monthRange(0).to?"is-active":""}>This month</button><button type="button" onClick={()=>setRange(-1)} className={from===monthRange(-1).from&&to===monthRange(-1).to?"is-active":""}>Last month</button><button type="button" onClick={()=>{setFrom("");setTo("")}}>All time</button></div>
    <div className="engage-expense-filters" style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
      <Select value={category} onChange={setCategory} options={[["all","All categories"],...EXPENSE_CATEGORIES.map(c=>[c,c])]} />
      <Select value={salesmanId} onChange={setSalesmanId} options={[["all","All employees"],...salesmen.map(s=>[s.id,s.name])]} />
      <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{...inputStyle,marginBottom:0,width:135}}/><span style={{fontSize:12,color:T.inkSoft}}>to</span><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{...inputStyle,marginBottom:0,width:135}}/>
    </div>
    {error&&<div style={{fontSize:12.5,color:T.danger,marginBottom:10}}>{error}</div>}
    {expenses===null&&!error&&<div style={{fontSize:13,color:T.inkSoft,display:"flex",alignItems:"center",gap:6}}><Loader2 size={14} className="spin"/> Loading…</div>}
    {expenses&&expenses.length===0&&<EmptyReportState text="No expenses recorded for these filters."/>}
    {expenses&&expenses.length>0&&<>
      <div className="engage-expense-summary"><div className="engage-expense-summary-card"><span>Total spend</span><strong>{fmtMoney(total)}</strong></div><div className="engage-expense-summary-card"><span>This month</span><strong>{fmtMoney(monthTotal)}</strong></div><div className="engage-expense-summary-card"><span>Top category</span><strong>{top?.[0]||"—"}</strong>{top&&<small>{fmtMoney(top[1])}</small>}</div><div className="engage-expense-summary-card"><span>Entries</span><strong>{expenses.length}</strong></div></div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>{categoryRows.map(([cat,amt])=><div key={cat}><div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span style={{fontWeight:600}}>{cat}</span><span style={{color:T.inkSoft}}>{fmtMoney(amt)}</span></div><div style={{height:8,background:T.paperDeep,borderRadius:11,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(amt/maxCategory*100)}%`,background:T.danger,borderRadius:11}}/></div></div>)}</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>{groups.map(group=><React.Fragment key={group.label}><div className="engage-expense-date-group">{group.label}</div>{group.rows.map(e=><div key={e.id} style={{background:T.card,border:`1px solid ${T.line}`,borderRadius:10,padding:"9px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div><div className="engage-expense-row-title" style={{fontSize:12.5,fontWeight:600}}>{e.category} · {fmtMoney(e.amount)}</div><div className="engage-expense-row-meta" style={{fontSize:11,color:T.inkSoft,marginTop:1}}>{formatDate(e.spentOn)}{e.salesmanName?` · ${e.salesmanName}`:""}{e.note?` · ${e.note}`:""}</div></div><div style={{display:"flex",gap:4}}><button onClick={()=>setEditing(e)} aria-label="Edit expense" style={{background:"none",border:"none",cursor:"pointer",color:T.inkSoft,padding:4}}><Pencil size={14}/></button><button onClick={()=>del(e.id)} aria-label="Delete expense" style={{background:"none",border:"none",cursor:"pointer",color:T.inkSoft,padding:4}}><Trash2 size={14}/></button></div></div>)}</React.Fragment>)}</div>
      {expenses.length>visibleCount&&<button type="button" className="engage-expense-load-more" onClick={()=>setVisibleCount(v=>v+PAGE_SIZE)}>Load more ({expenses.length-visibleCount} remaining)</button>}
    </>}
    {editing&&<ExpenseEditModal expense={editing} salesmen={salesmen} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}}/>}
  </div>;
}

function ExpenseEditModal({ expense, salesmen, onClose, onSaved }) {
  const [form,setForm]=useState({category:expense.category||EXPENSE_CATEGORIES[0],amount:String(expense.amount||""),salesmanId:expense.salesmanId||"",spentOn:String(expense.spentOn||"").slice(0,10),note:expense.note||""});const [saving,setSaving]=useState(false),[error,setError]=useState("");
  const submit=async e=>{e.preventDefault();setSaving(true);setError("");try{await api.adminUpdateExpense(expense.id,{category:form.category,amount:Number(form.amount),salesmanId:form.salesmanId||null,spentOn:form.spentOn,note:form.note.trim()||null});onSaved()}catch(err){setError(err.message||"Could not update expense.");setSaving(false)}};
  return <Overlay title="Edit expense" onClose={onClose}><form onSubmit={submit}><Field label="Category"><Select value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} options={EXPENSE_CATEGORIES.map(c=>[c,c])}/></Field><Field label="Amount"><input style={inputStyle} type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></Field><Field label="Employee"><Select value={form.salesmanId} onChange={v=>setForm(f=>({...f,salesmanId:v}))} options={[["","Not linked"],...salesmen.map(s=>[s.id,s.name])]}/></Field><Field label="Date"><input style={inputStyle} type="date" value={form.spentOn} onChange={e=>setForm(f=>({...f,spentOn:e.target.value}))}/></Field><Field label="Note"><textarea style={{...inputStyle,minHeight:70}} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></Field>{error&&<div style={{fontSize:12,color:T.danger,marginBottom:10}}>{error}</div>}<button disabled={saving} type="submit" style={{width:"100%",padding:11,borderRadius:10,border:0,background:T.route,color:"#fff",fontWeight:700}}>{saving?"Saving…":"Save changes"}</button></form></Overlay>;
}

'''
app=app[:start]+new+app[end:]
app_path.write_text(app)
main=main.replace('import "./expenseReportEnhance.js";\n','')
main_path.write_text(main)
print('Batch 8 applied')
