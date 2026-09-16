# Lead Brief update

My Leads and employee lead lists now show a Brief pill on each card. Clicking the pill opens the summary directly; clicking the rest of the card opens lead details. Verification remains in lead details.

The existing JavaScript rules generate the summary from CRM fields and status history. Words appear gradually, followed by the recommended next action. Reduced-motion preferences show the result immediately. If history cannot load, the popup uses the loaded lead fields and explains this.

Deploy this complete frontend using your existing build and environment settings. No backend or cron change is required. Changed source files: src/App.jsx, src/LeadBriefPopup.jsx, src/lead-brief.css.

Validation: production build and jsdom interaction checks. Live deployment and mobile browser rendering have not been tested here.
