import React from "react";
import { ChevronRight, Phone } from "lucide-react";
import "./mobile-contacts.css";

const STATUS_LABELS = {
  cold: "Cold", conversation: "Conversation", hot: "Hot", demo: "Demo",
  negotiation: "Negotiation", won: "Won", lost: "Lost", nurture: "Nurture",
  warm: "Warm", new: "New", contacted: "Contacted", follow_up: "Follow-up",
  demo_scheduled: "Demo Scheduled", proposal_sent: "Proposal Sent",
};
const AVATAR_PALETTES = [
  ["#E8F5EF", "#147A5A"], ["#EEF3FF", "#4967B2"], ["#F4EEFF", "#7651A8"],
  ["#FFF2E7", "#A45E24"], ["#FDECEF", "#A84E63"], ["#EAF6F8", "#287C88"],
];

function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0][0] : `${words[0][0]}${words[1][0]}`).toUpperCase();
}
function avatarStyle(name) {
  const value = String(name || "?");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  const [background, color] = AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
  return { background, color };
}

export default function MobileContacts({ leads, onSelectLead, renderVerification, enableCall = false, showVerification = true }) {
  if (!leads.length) {
    return <div className="engage-mobile-contacts-empty">No contacts match these filters.</div>;
  }

  return <div className="engage-mobile-contacts-list">
    {leads.map((lead) => {
      const contact = lead.owner?.trim() || "Contact not added";
      const company = lead.business?.trim() || "Company not added";
      const status = STATUS_LABELS[lead.status] || lead.status || "Not added";
      const openLead = () => onSelectLead(lead);
      const handleKeyDown = (event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLead();
        }
      };
      return <div key={lead.id} role="button" tabIndex={0} className="engage-mobile-contact-card" onClick={openLead} onKeyDown={handleKeyDown}>
        <div className={`engage-mobile-contact-top${showVerification ? "" : " compact-status"}`}>
          <span className="engage-mobile-contact-avatar" aria-hidden="true" style={avatarStyle(lead.owner || lead.business)}>{initials(lead.owner || lead.business)}</span>
          <span className="engage-mobile-contact-identity">
            <strong className={!lead.owner?.trim() ? "is-missing" : undefined}>{contact}</strong>
            <span>{company}</span>
          </span>
          {showVerification ? (
            <ChevronRight size={18} aria-hidden="true" />
          ) : (
            <span className="engage-mobile-contact-top-actions">
              <span className={`engage-mobile-contact-status ${lead.status || ""}`}>{status}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </span>
          )}
        </div>
        {enableCall && lead.phone ? (
          <a className="engage-mobile-contact-phone engage-mobile-contact-phone--callable" href={`tel:${String(lead.phone).replace(/[^+\d]/g, "")}`} onClick={(event) => event.stopPropagation()} aria-label={`Call ${contact} at ${lead.phone}`}>
            <Phone size={13} aria-hidden="true" />
            <span>{lead.phone}</span>
          </a>
        ) : (
          <div className="engage-mobile-contact-phone">
            <Phone size={13} aria-hidden="true" />
            <span>{lead.phone || "Phone not added"}</span>
          </div>
        )}
        <div className="engage-mobile-contact-meta">
          <span>{lead.salesmanName || "Unassigned"}</span>
          {lead.subLocation && <span>{lead.subLocation}</span>}
        </div>
        {showVerification && (
          <div className="engage-mobile-contact-bottom">
            <span className={`engage-mobile-contact-status ${lead.status || ""}`}>{status}</span>
            <span className="engage-mobile-contact-verification">{renderVerification?.(lead)}</span>
          </div>
        )}
      </div>;
    })}
  </div>;
}
