import React from 'react';
import './desktop-contacts.css';

const statuses = {cold:'Cold',conversation:'Conversation',hot:'Hot',demo:'Demo',negotiation:'Negotiation',won:'Won',lost:'Lost',nurture:'Nurture'};
export default function DesktopContacts({leads,onSelectLead,renderVerification}) {
 return <div className="engage-contacts-table-wrap"><table className="engage-contacts-table">
  <caption className="engage-contacts-sr">Contacts from your existing lead records</caption>
  <thead><tr>{['Contact name','Company / Restaurant','Phone','Employee','Status'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
  <tbody>{leads.map(lead=><tr key={lead.id} onClick={()=>onSelectLead(lead)}>
   <td><button type="button" className="engage-contact-open" onClick={e=>{e.stopPropagation();onSelectLead(lead)}} aria-label={`Open ${lead.owner?.trim()||'contact'} at ${lead.business||'company'}`}><span className="engage-contact-avatar" aria-hidden="true">{lead.owner?.trim()?lead.owner.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase():'—'}</span><span className={!lead.owner?.trim()?'engage-contact-missing':undefined}>{lead.owner?.trim()||'Not added'}</span></button></td>
   <td><strong>{lead.business||'Not added'}</strong>{lead.subLocation&&<small>{lead.subLocation}</small>}</td>
   <td className="engage-contact-phone">{lead.phone||'Not added'}</td>
   <td>{lead.salesmanName||'Unassigned'}</td>
   <td><div className="engage-contact-badges"><span className={`engage-contact-status ${statuses[lead.status]?lead.status:''}`}>{statuses[lead.status]||lead.status||'Not added'}</span>{renderVerification?.(lead)}</div></td>
  </tr>)}{!leads.length&&<tr><td colSpan={5} className="engage-contacts-empty">No contacts match these filters.</td></tr>}</tbody>
 </table></div>;
}
