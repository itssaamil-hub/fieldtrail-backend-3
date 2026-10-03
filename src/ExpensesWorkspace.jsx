import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { Download, FileSpreadsheet, FileText, Pencil, Plus, ReceiptText, RefreshCw, Trash2, X } from "lucide-react";

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
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const xmlEscape = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const asciiPdf = value => String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const truncate = (value, max) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
};

function buildExpensePdf(expenses, filters, total) {
  const header = [
    "Engage Expense Report",
    `Generated: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date())} IST`,
    `Filters: ${filters}`,
    `Entries: ${expenses.length}   Total: INR ${Math.round(total).toLocaleString("en-IN")}`,
    "",
    "Date         Category           Employee                    Amount",
    "--------------------------------------------------------------------------",
  ];
  const lines = [...header];
  expenses.forEach(e => {
    const date = isoDay(e.spentOn) || "-";
    const category = truncate(e.category || "-", 17).padEnd(17, " ");
    const employee = truncate(e.salesmanName || "Company", 26).padEnd(26, " ");
    const amount = `INR ${Math.round(Number(e.amount || 0)).toLocaleString("en-IN")}`.padStart(14, " ");
    lines.push(`${date}   ${category} ${employee} ${amount}`);
    if (e.note) lines.push(`  Note: ${truncate(e.note, 78)}`);
  });

  const PAGE_LINES = 49;
  const pages = [];
  for (let i = 0; i < lines.length; i += PAGE_LINES) pages.push(lines.slice(i, i + PAGE_LINES));
  if (!pages.length) pages.push(header);

  const objects = [null, null, null];
  const fontObj = 3;
  pages.forEach((pageLines, index) => {
    const pageObj = 4 + index * 2;
    const contentObj = pageObj + 1;
    const stream = `BT\n/F1 9 Tf\n12 TL\n40 806 Td\n${pageLines.map(line => `(${asciiPdf(line)}) Tj\nT*`).join("")}ET`;
    objects[pageObj - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objects[contentObj - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  const kids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function buildExpenseExcel(expenses, filters, total) {
  const rows = expenses.map(e => `<Row><Cell><Data ss:Type="String">${xmlEscape(isoDay(e.spentOn))}</Data></Cell><Cell><Data ss:Type="String">${xmlEscape(e.category)}</Data></Cell><Cell><Data ss:Type="String">${xmlEscape(e.salesmanName || "Company")}</Data></Cell><Cell><Data ss:Type="Number">${Number(e.amount || 0)}</Data></Cell><Cell><Data ss:Type="String">${xmlEscape(e.note || "")}</Data></Cell></Row>`).join("");
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E5F1EF" ss:Pattern="Solid"/></Style><Style ss:ID="Money"><NumberFormat ss:Format="₹#,##0.00"/></Style></Styles><Worksheet ss:Name="Expenses"><Table><Column ss:Width="85"/><Column ss:Width="105"/><Column ss:Width="150"/><Column ss:Width="90"/><Column ss:Width="240"/><Row><Cell ss:MergeAcross="4"><Data ss:Type="String">Engage Expense Report</Data></Cell></Row><Row><Cell ss:MergeAcross="4"><Data ss:Type="String">${xmlEscape(filters)}</Data></Cell></Row><Row><Cell><Data ss:Type="String">Entries</Data></Cell><Cell><Data ss:Type="Number">${expenses.length}</Data></Cell><Cell><Data ss:Type="String">Total</Data></Cell><Cell ss:StyleID="Money"><Data ss:Type="Number">${Number(total || 0)}</Data></Cell></Row><Row ss:StyleID="Header"><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Category</Data></Cell><Cell><Data ss:Type="String">Employee</Data></Cell><Cell><Data ss:Type="String">Amount</Data></Cell><Cell><Data ss:Type="String">Note</Data></Cell></Row>${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane></WorksheetOptions></Worksheet></Workbook>`;
  return new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
}

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
  const filterLabel = useMemo(() => {
    const employee = salesmanId === "all" ? "All employees" : salesmen.find(s => s.id === salesmanId)?.name || salesmen.find(s => s.id === salesmanId)?.fullName || "Selected employee";
    const categoryText = category === "all" ? "All categories" : category;
    const period = from || to ? `${from || "Beginning"} to ${to || "Today"}` : "All time";
    return `${period} · ${categoryText} · ${employee}`;
  }, [category, salesmanId, from, to, salesmen]);

  const setQuick = offset => { const r = monthRange(offset); setFrom(r.from); setTo(r.to); };
  const isCurrent = from === monthRange(0).from && to === monthRange(0).to;
  const isPrevious = from === monthRange(-1).from && to === monthRange(-1).to;
  const exportExcel = () => downloadBlob(buildExpenseExcel(expenses || [], filterLabel, total), `engage-expenses-${istDay()}.xls`);
  const exportPdf = () => downloadBlob(buildExpensePdf(expenses || [], filterLabel, total), `engage-expenses-${istDay()}.pdf`);

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError("");
    try { await api.adminDeleteExpense(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (err) { setError(err.message || "Could not delete the expense."); }
    finally { setDeleting(false); }
  };

  return <div className="engage-expenses-workspace">
    <style>{`
      .engage-expenses-workspace{color:#1A1D23}.engage-expense-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:18px}.engage-expense-kicker{font-size:10px;font-weight:800;letter-spacing:.8px;color:#64748B;text-transform:uppercase}.engage-expense-hero h2{margin:4px 0 3px;font-size:23px;letter-spacing:-.4px}.engage-expense-hero p{margin:0;color:#64748B;font-size:12.5px}.engage-expense-hero-actions{display:flex;align-items:center;gap:8px}.engage-expense-add,.engage-expense-export summary{height:40px;border-radius:10px;padding:0 14px;font-weight:750;display:flex;align-items:center;gap:7px;cursor:pointer;box-sizing:border-box}.engage-expense-add{border:0;background:#145C5D;color:white}.engage-expense-export{position:relative}.engage-expense-export summary{list-style:none;border:1px solid #DDE2E6;background:white;color:#334155}.engage-expense-export summary::-webkit-details-marker{display:none}.engage-expense-export-menu{position:absolute;right:0;top:46px;z-index:20;width:190px;background:white;border:1px solid #E1E5E9;border-radius:12px;padding:6px;box-shadow:0 12px 32px rgba(15,23,42,.12)}.engage-expense-export-menu button{width:100%;height:38px;border:0;border-radius:8px;background:white;color:#334155;display:flex;align-items:center;gap:9px;padding:0 10px;font-size:12px;font-weight:700;cursor:pointer;text-align:left}.engage-expense-export-menu button:hover{background:#F4F7F6;color:#145C5D}.engage-expense-export-menu button:disabled{opacity:.45;cursor:not-allowed}.engage-expense-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:white;border:1px solid #E7E9EE;border-radius:14px;padding:10px;margin-bottom:14px}.engage-expense-toolbar select,.engage-expense-toolbar input{height:36px;border:1px solid #E1E5E9;border-radius:9px;background:#fff;padding:0 10px;font-size:12px;color:#334155}.engage-expense-toolbar .quick{display:flex;gap:4px;background:#F4F6F7;border-radius:9px;padding:3px}.engage-expense-toolbar .quick button{height:30px;border:0;border-radius:7px;padding:0 10px;background:transparent;font-size:11.5px;color:#64748B;cursor:pointer}.engage-expense-toolbar .quick button.active{background:#fff;color:#145C5D;font-weight:750;box-shadow:0 1px 3px rgba(15,23,42,.08)}.engage-expense-refresh{margin-left:auto;width:36px;height:36px;border:1px solid #E1E5E9;border-radius:9px;background:#fff;color:#64748B;display:grid;place-items:center;cursor:pointer}.engage-expense-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.engage-expense-stat{background:#fff;border:1px solid #E7E9EE;border-radius:14px;padding:13px 14px}.engage-expense-stat span{display:block;font-size:10.5px;color:#64748B;font-weight:700}.engage-expense-stat strong{display:block;font-size:20px;margin-top:5px;letter-spacing:-.35px}.engage-expense-main{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:14px}.engage-expense-list,.engage-expense-breakdown{background:#fff;border:1px solid #E7E9EE;border-radius:15px;padding:12px}.engage-expense-section-title{font-size:11px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:.55px;margin-bottom:8px}.engage-expense-row{display:grid;grid-template-columns:40px minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:10px 8px;border-top:1px solid #EEF0F2}.engage-expense-row:first-of-type{border-top:0}.engage-expense-icon{width:36px;height:36px;border-radius:10px;background:#F3F7F5;color:#145C5D;display:grid;place-items:center}.engage-expense-row-title{font-size:13px;font-weight:750}.engage-expense-row-meta{font-size:11px;color:#7A8491;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.engage-expense-amount{font-size:13.5px;font-weight:800}.engage-expense-actions{display:flex;gap:2px}.engage-expense-actions button{width:30px;height:30px;border:0;background:transparent;color:#7A8491;border-radius:8px;cursor:pointer}.engage-expense-actions button:hover{background:#F4F5F7;color:#1A1D23}.engage-expense-cat{margin-bottom:12px}.engage-expense-cat-head{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px}.engage-expense-cat-head span:first-child{font-weight:700}.engage-expense-bar{height:7px;background:#EFF1F3;border-radius:999px;overflow:hidden}.engage-expense-bar i{display:block;height:100%;background:#145C5D;border-radius:999px}.engage-expense-empty{padding:44px 20px;text-align:center;color:#64748B;font-size:12.5px}.engage-expense-load{margin-top:10px;width:100%;height:36px;border:1px solid #E1E5E9;border-radius:9px;background:#fff;color:#145C5D;font-weight:700;cursor:pointer}.engage-expense-error{font-size:12px;color:#B42318;background:#FFF1F0;border-radius:9px;padding:8px 10px;margin:8px 0}.engage-expense-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.38);display:grid;place-items:center;padding:18px}.engage-expense-modal{width:min(620px,100%);background:white;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.2);padding:18px}.engage-expense-modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}.engage-expense-modal-head strong{display:block;font-size:17px}.engage-expense-modal-head span{display:block;font-size:11.5px;color:#64748B;margin-top:3px}.engage-expense-modal-head button{border:0;background:#F4F5F7;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;cursor:pointer}.engage-expense-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.engage-expense-form-grid label,.engage-expense-note{font-size:11.5px;color:#64748B;font-weight:700}.engage-expense-form-grid input,.engage-expense-form-grid select,.engage-expense-note textarea{width:100%;box-sizing:border-box;border:1px solid #DDE2E6;border-radius:10px;background:white;color:#1A1D23;margin-top:5px;font:inherit;font-weight:500}.engage-expense-form-grid input,.engage-expense-form-grid select{height:40px;padding:0 10px}.engage-expense-note{display:block;margin-top:12px}.engage-expense-note textarea{min-height:82px;padding:10px;resize:vertical}.engage-expense-money-input{position:relative}.engage-expense-money-input span{position:absolute;left:10px;top:16px;color:#64748B}.engage-expense-money-input input{padding-left:27px}.engage-expense-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.engage-expense-modal-actions button{height:38px;border:1px solid #DDE2E6;border-radius:9px;background:white;padding:0 13px;font-weight:700;cursor:pointer}.engage-expense-modal-actions .primary{background:#145C5D;color:white;border-color:#145C5D}.engage-expense-confirm{width:min(420px,100%);background:white;border-radius:17px;padding:18px;box-shadow:0 24px 70px rgba(15,23,42,.2)}.engage-expense-confirm h3{margin:0 0 6px;font-size:17px}.engage-expense-confirm p{font-size:12.5px;color:#64748B;line-height:1.5;margin:0}.engage-expense-confirm .danger{background:#B42318;color:white;border-color:#B42318}@media(max-width:820px){.engage-expense-summary{grid-template-columns:1fr 1fr}.engage-expense-main{grid-template-columns:1fr}.engage-expense-breakdown{order:-1}.engage-expense-hero{align-items:flex-start}.engage-expense-form-grid{grid-template-columns:1fr}}@media(max-width:520px){.engage-expense-summary{grid-template-columns:1fr 1fr}.engage-expense-row{grid-template-columns:36px minmax(0,1fr) auto}.engage-expense-actions{grid-column:2/4}.engage-expense-toolbar .quick{width:100%}.engage-expense-refresh{margin-left:0}.engage-expense-hero{display:block}.engage-expense-hero-actions{margin-top:12px}.engage-expense-hero h2{font-size:20px}}
    `}</style>

    <div className="engage-expense-hero">
      <div><div className="engage-expense-kicker">Finance · Expenses</div><h2>Expense control</h2><p>Record, review and audit company spending from one place.</p></div>
      <div className="engage-expense-hero-actions">
        <details className="engage-expense-export"><summary><Download size={15}/> Export</summary><div className="engage-expense-export-menu"><button onClick={exportExcel} disabled={expenses === null}><FileSpreadsheet size={16}/> Export to Excel</button><button onClick={exportPdf} disabled={expenses === null}><FileText size={16}/> Export to PDF</button></div></details>
        <button className="engage-expense-add" onClick={()=>setModal({})}><Plus size={16}/> Add expense</button>
      </div>
    </div>

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
