import React from "react";
import { ChevronRight, Phone } from "lucide-react";
import "./mobile-contacts.css";

const STATUS_LABELS = {
  cold: "Cold", conversation: "Conversation", hot: "Hot", demo: "Demo",
  negotiation: "Negotiation", won: "Won", lost: "Lost", nurture: "Nurture",
  warm: "Warm", new: "New", contacted: "Contacted", follow_up: "Follow-up",
  demo_scheduled: "Demo Scheduled", proposal_sent: "Proposal Sent",
};

function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0][0] : `${words[0][0]}${words[1][0]}`).toUpperCase();
}

export default function MobileContacts({ leads, onSelectLead, renderVerification }) {
  if (!leads.length) {
    return <div className="engage-mobile-contacts-empty">No contacts match these filters.</div>;
  }

  return <div className="engage-mobile-contacts-list">
    {leads.map((lead) => {
      const contact = lead.owner?.trim() || "Contact not added";
      const company = lead.business?.trim() || "Company not added";
      const status = STATUS_LABELS[lead.status] || lead.status || "Not added";
      return <button key={lead.id} type="button" className="engage-mobile-contact-card" onClick={() => onSelectLead(lead)}>
        <div className="engage-mobile-contact-top">
          <span className="engage-mobile-contact-avatar" aria-hidden="true">{initials(lead.owner || lead.business)}</span>
          <span className="engage-mobile-contact-identity">
            <strong className={!lead.owner?.trim() ? "is-missing" : undefined}>{contact}</strong>
            <span>{company}</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </div>
        <div className="engage-mobile-contact-phone">
          <Phone size={13} aria-hidden="true" />
          <span>{lead.phone || "Phone not added"}</span>
        </div>
        <div className="engage-mobile-contact-meta">
          <span>{lead.salesmanName || "Unassigned"}</span>
          {lead.subLocation && <span>{lead.subLocation}</span>}
        </div>
        <div className="engage-mobile-contact-bottom">
          <span className={`engage-mobile-contact-status ${lead.status || ""}`}>{status}</span>
          <span className="engage-mobile-contact-verification">{renderVerification?.(lead)}</span>
        </div>
      </button>;
    })}
  </div>;
}
