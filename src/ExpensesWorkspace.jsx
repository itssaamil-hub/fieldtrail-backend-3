import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { CalendarDays, ChevronDown, CircleDollarSign, Pencil, Plus, ReceiptText, RefreshCw, Trash2, UserRound, X } from "lucide-react";

const CATEGORIES = ["Salary", "Travel", "Fuel", "Food", "Other"];
const PAGE_SIZE = 12;
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const istDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const isoDay = value => String(value || "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || "";
const dateLabel = value => {
  const day = isoDay(value);
  if (!day) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${day}T12:00:00+05:30`));
};
const monthRange = offset => {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12);
  const y = base.getFullYear();
  const m = base.getMonth();
  const mm = String(m + 1).padStart(2, "0");
  const last = offset === 0 ? istDay() : `${y}-${mm}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, "0")}`;
  return { from: `${y}-${mm}-01`, to: last };
};

function ExpenseModal({ expense, salesmen, onClose, onSaved }) {
  const editing = Boolean(expense);
  const [category, setCategory] = useState(expense?.category || CATEGORIES[0]);
  const [salesmanId, setSalesmanId] = useState(expense?.salesmanId || "");
  const [amount, setAmount] = useState(expense?.amount ? String(expense.amount) : "");
  const [spentOn, setSpentOn] = useState(isoDay(expense?.spentOn) || istDay());
  const [note, setNote] = useState(expense?.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async e => {
    e.preventDefault();
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) return setError("Enter a valid amount.");
    if (!spentOn) return setError("Choose an expense date.");
    setSaving(true); setError("");
    const payload = { category, amount: num, salesmanId: salesmanId || undefined, note: note.trim() || undefined, spentOn };
    try {
      if (editing) await api.adminUpdateExpense(expense.id, payload);
      else await api.adminCreateExpense(payload);
      onSaved();
    } catch (err) {
      setError(err.message || "Could not save the expense.");
    } finally { setSaving(false); }
  };

  return <div className="engage-expense-overlay" role="dialog" aria-modal="true" aria-label={editing ? "Edit expense" : "Add expense"}>
    <form className="engage-expense-modal" onSubmit={save}>
      <div className="engage-expense-modal-head"><div><strong>{editing ? "Edit expense" : "Add expense"}</strong><span>{editing ? "Correct the entry while keeping the audit trail." : "Record a company expense."}</span></div><button type="button" onClick={onClose} aria-label="Close"><X size={17}/></button></div>
      <div className="engage-expense-form-grid">
        <label><span>Category</span><select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span>Amount</span><div className="engage-expense-money-input"><span>₹</span><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="0" /></div></label>
        <label><span>Employee</span><select value={salesmanId} onChange={e=>setSalesmanId(e.target.value)}><option value="">Company / unassigned</option>{salesmen.map(s=><option key={s.id} value={s.id}>{s.name || s.fullName || s.full_name}</option>)}</select></label>
        <label><span>Date</span><input type="date" value={spentOn} onChange={e=>setSpentOn(e.target.value)} /></label>
      </div>
      <label className="engage-expense-note"><span>Note</span><textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} placeholder="Optional note" /></label>
      {error && <div className="engage-expense-error">{error}</div>}
      <div className="engage-expense-modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add expense"}</button></div>
    </form>
  </div>;
}

export default function ExpensesWorkspace({ salesmen = [] }) {
  const [category, setCategory] = useState("all");
  const [salesmanId, setSalesmanId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expenses, setExpenses] = useState(null);
  const [monthTotal, setMonthTotal] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(""); setVisibleCount(PAGE_SIZE);
    try {
      const [current, month] = await Promise.all([
        api.adminExpenses({ category, salesmanId, from, to }),
        api.adminExpenses(monthRange(0)),
      ]);
      setExpenses(current.expenses || []);
      setMonthTotal((month.expenses || []).reduce((sum, x) => sum + Number(x.amount || 0), 0));
    } catch (err) { setError(err.message || "Could not load expenses."); setExpenses([]); }
  }, [category, salesmanId, from, to]);
  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => (expenses || []).reduce((sum, x) => sum + Number(x.amount || 0), 0), [expenses]);
  const categoryRows = useMemo(() => {
    const sums = {};
    for (const e of expenses || []) sums[e.category] = (sums[e.category] || 0) + Number(e.amount || 0);
    return Object.entries(sums).sort((a,b)=>b[1]-a[1]);
  }, [expenses]);
  const maxCategory = Math.max(1, ...categoryRows.map(([,v])=>v));
  const topCategory = categoryRows[0];
  const shown = (expenses || []).slice(0, visibleCount);

  const setQuick = offset => { const r = monthRange(offset); setFrom(r.from); setTo(r.to); };
  const isCurrent = from === monthRange(0).from && to === monthRange(0).to;
  const isPrevious = from === monthRange(-1).from && to === monthRange(-1).to;

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError("");
    try { await api.adminDeleteExpense(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (err) { setError(err.message || "Could not delete the expense."); }
    finally { setDeleting(false); }
  };

  return <div className="engage-expenses-workspace">
    <style>{`
      .engage-expenses-workspace{color:#1A1D23}.engage-expense-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:18px}.engage-expense-kicker{font-size:10px;font-weight:800;letter-spacing:.8px;color:#64748B;text-transform:uppercase}.engage-expense-hero h2{margin:4px 0 3px;font-size:23px;letter-spacing:-.4px}.engage-expense-hero p{margin:0;color:#64748B;font-size:12.5px}.engage-expense-add{height:40px;border:0;border-radius:10px;padding:0 14px;background:#145C5D;color:white;font-weight:750;display:flex;align-items:center;gap:7px;cursor:pointer}.engage-expense-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:white;border:1px solid #E7E9EE;border-radius:14px;padding:10px;margin-bottom:14px}.engage-expense-toolbar select,.engage-expense-toolbar input{height:36px;border:1px solid #E1E5E9;border-radius:9px;background:#fff;padding:0 10px;font-size:12px;color:#334155}.engage-expense-toolbar .quick{display:flex;gap:4px;background:#F4F6F7;border-radius:9px;padding:3px}.engage-expense-toolbar .quick button{height:30px;border:0;border-radius:7px;padding:0 10px;background:transparent;font-size:11.5px;color:#64748B;cursor:pointer}.engage-expense-toolbar .quick button.active{background:#fff;color:#145C5D;font-weight:750;box-shadow:0 1px 3px rgba(15,23,42,.08)}.engage-expense-refresh{margin-left:auto;width:36px;height:36px;border:1px solid #E1E5E9;border-radius:9px;background:#fff;color:#64748B;display:grid;place-items:center;cursor:pointer}.engage-expense-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.engage-expense-stat{background:#fff;border:1px solid #E7E9EE;border-radius:14px;padding:13px 14px}.engage-expense-stat span{display:block;font-size:10.5px;color:#64748B;font-weight:700}.engage-expense-stat strong{display:block;font-size:20px;margin-top:5px;letter-spacing:-.35px}.engage-expense-main{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:14px}.engage-expense-list,.engage-expense-breakdown{background:#fff;border:1px solid #E7E9EE;border-radius:15px;padding:12px}.engage-expense-section-title{font-size:11px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:.55px;margin-bottom:8px}.engage-expense-row{display:grid;grid-template-columns:40px minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:10px 8px;border-top:1px solid #EEF0F2}.engage-expense-row:first-of-type{border-top:0}.engage-expense-icon{width:36px;height:36px;border-radius:10px;background:#F3F7F5;color:#145C5D;display:grid;place-items:center}.engage-expense-row-title{font-size:13px;font-weight:750}.engage-expense-row-meta{font-size:11px;color:#7A8491;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.engage-expense-amount{font-size:13.5px;font-weight:800}.engage-expense-actions{display:flex;gap:2px}.engage-expense-actions button{width:30px;height:30px;border:0;background:transparent;color:#7A8491;border-radius:8px;cursor:pointer}.engage-expense-actions button:hover{background:#F4F5F7;color:#1A1D23}.engage-expense-cat{margin-bottom:12px}.engage-expense-cat-head{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px}.engage-expense-cat-head span:first-child{font-weight:700}.engage-expense-bar{height:7px;background:#EFF1F3;border-radius:999px;overflow:hidden}.engage-expense-bar i{display:block;height:100%;background:#145C5D;border-radius:999px}.engage-expense-empty{padding:44px 20px;text-align:center;color:#64748B;font-size:12.5px}.engage-expense-load{margin-top:10px;width:100%;height:36px;border:1px solid #E1E5E9;border-radius:9px;background:#fff;color:#145C5D;font-weight:700;cursor:pointer}.engage-expense-error{font-size:12px;color:#B42318;background:#FFF1F0;border-radius:9px;padding:8px 10px;margin:8px 0}.engage-expense-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.38);display:grid;place-items:center;padding:18px}.engage-expense-modal{width:min(620px,100%);background:white;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.2);padding:18px}.engage-expense-modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}.engage-expense-modal-head strong{display:block;font-size:17px}.engage-expense-modal-head span{display:block;font-size:11.5px;color:#64748B;margin-top:3px}.engage-expense-modal-head button{border:0;background:#F4F5F7;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;cursor:pointer}.engage-expense-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.engage-expense-form-grid label,.engage-expense-note{font-size:11.5px;color:#64748B;font-weight:700}.engage-expense-form-grid input,.engage-expense-form-grid select,.engage-expense-note textarea{width:100%;box-sizing:border-box;border:1px solid #DDE2E6;border-radius:10px;background:white;color:#1A1D23;margin-top:5px;font:inherit;font-weight:500}.engage-expense-form-grid input,.engage-expense-form-grid select{height:40px;padding:0 10px}.engage-expense-note{display:block;margin-top:12px}.engage-expense-note textarea{min-height:82px;padding:10px;resize:vertical}.engage-expense-money-input{position:relative}.engage-expense-money-input span{position:absolute;left:10px;top:16px;color:#64748B}.engage-expense-money-input input{padding-left:27px}.engage-expense-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.engage-expense-modal-actions button{height:38px;border:1px solid #DDE2E6;border-radius:9px;background:white;padding:0 13px;font-weight:700;cursor:pointer}.engage-expense-modal-actions .primary{background:#145C5D;color:white;border-color:#145C5D}.engage-expense-confirm{width:min(420px,100%);background:white;border-radius:17px;padding:18px;box-shadow:0 24px 70px rgba(15,23,42,.2)}.engage-expense-confirm h3{margin:0 0 6px;font-size:17px}.engage-expense-confirm p{font-size:12.5px;color:#64748B;line-height:1.5;margin:0}.engage-expense-confirm .danger{background:#B42318;color:white;border-color:#B42318}@media(max-width:820px){.engage-expense-summary{grid-template-columns:1fr 1fr}.engage-expense-main{grid-template-columns:1fr}.engage-expense-breakdown{order:-1}.engage-expense-hero{align-items:flex-start}.engage-expense-form-grid{grid-template-columns:1fr}}@media(max-width:520px){.engage-expense-summary{grid-template-columns:1fr 1fr}.engage-expense-row{grid-template-columns:36px minmax(0,1fr) auto}.engage-expense-actions{grid-column:2/4}.engage-expense-toolbar .quick{width:100%}.engage-expense-refresh{margin-left:0}.engage-expense-hero h2{font-size:20px}}
    `}</style>

    <div className="engage-expense-hero"><div><div className="engage-expense-kicker">Finance · Expenses</div><h2>Expense control</h2><p>Record, review and audit company spending from one place.</p></div><button className="engage-expense-add" onClick={()=>setModal({})}><Plus size={16}/> Add expense</button></div>

    <div className="engage-expense-toolbar">
      <div className="quick"><button className={isCurrent?"active":""} onClick={()=>setQuick(0)}>This month</button><button className={isPrevious?"active":""} onClick={()=>setQuick(-1)}>Last month</button><button className={!from&&!to?"active":""} onClick={()=>{setFrom("");setTo("")}}>All time</button></div>
      <select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select>
      <select value={salesmanId} onChange={e=>setSalesmanId(e.target.value)}><option value="all">All employees</option>{salesmen.map(s=><option key={s.id} value={s.id}>{s.name || s.fullName || s.full_name}</option>)}</select>
      <input type="date" value={from} onChange={e=>setFrom(e.target.value)} aria-label="From date"/><input type="date" value={to} onChange={e=>setTo(e.target.value)} aria-label="To date"/>
      <button className="engage-expense-refresh" onClick={load} aria-label="Refresh expenses"><RefreshCw size={15}/></button>
    </div>

    {error && <div className="engage-expense-error">{error}</div>}
    <div className="engage-expense-summary">
      <div className="engage-expense-stat"><span>Total spend</span><strong>{inr.format(total)}</strong></div>
      <div className="engage-expense-stat"><span>This month</span><strong>{inr.format(monthTotal)}</strong></div>
      <div className="engage-expense-stat"><span>Top category</span><strong>{topCategory?.[0] || "—"}</strong></div>
      <div className="engage-expense-stat"><span>Entries</span><strong>{expenses?.length ?? "—"}</strong></div>
    </div>

    <div className="engage-expense-main">
      <section className="engage-expense-list"><div className="engage-expense-section-title">Expense entries</div>
        {expenses === null && <div className="engage-expense-empty">Loading expenses…</div>}
        {expenses?.length === 0 && <div className="engage-expense-empty"><ReceiptText size={24}/><div style={{marginTop:7}}>No expenses match these filters.</div></div>}
        {shown.map(e=><div className="engage-expense-row" key={e.id}><div className="engage-expense-icon"><ReceiptText size={16}/></div><div><div className="engage-expense-row-title">{e.category}</div><div className="engage-expense-row-meta">{dateLabel(e.spentOn)}{e.salesmanName ? ` · ${e.salesmanName}` : " · Company"}{e.note ? ` · ${e.note}` : ""}</div></div><div className="engage-expense-amount">{inr.format(Number(e.amount||0))}</div><div className="engage-expense-actions"><button onClick={()=>setModal(e)} aria-label="Edit expense"><Pencil size={14}/></button><button onClick={()=>setDeleteTarget(e)} aria-label="Delete expense"><Trash2 size={14}/></button></div></div>)}
        {(expenses?.length || 0) > visibleCount && <button className="engage-expense-load" onClick={()=>setVisibleCount(v=>v+PAGE_SIZE)}>Load more · {(expenses.length-visibleCount)} remaining</button>}
      </section>
      <aside className="engage-expense-breakdown"><div className="engage-expense-section-title">Category breakdown</div>{categoryRows.length===0?<div className="engage-expense-empty" style={{padding:24}}>No spending to break down.</div>:categoryRows.map(([cat, amount])=><div className="engage-expense-cat" key={cat}><div className="engage-expense-cat-head"><span>{cat}</span><span>{inr.format(amount)}</span></div><div className="engage-expense-bar"><i style={{width:`${Math.round(amount/maxCategory*100)}%`}}/></div></div>)}</aside>
    </div>

    {modal && <ExpenseModal expense={modal.id ? modal : null} salesmen={salesmen} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);load()}}/>}
    {deleteTarget && <div className="engage-expense-overlay" role="dialog" aria-modal="true"><div className="engage-expense-confirm"><h3>Delete this expense?</h3><p>{deleteTarget.category} · {inr.format(Number(deleteTarget.amount||0))} · {dateLabel(deleteTarget.spentOn)}. This action is audited.</p><div className="engage-expense-modal-actions"><button onClick={()=>setDeleteTarget(null)} disabled={deleting}>Cancel</button><button className="danger" onClick={remove} disabled={deleting}>{deleting?"Deleting…":"Delete expense"}</button></div></div></div>}
  </div>;
}
