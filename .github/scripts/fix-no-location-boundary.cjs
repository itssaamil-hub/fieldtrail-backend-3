const fs = require('fs');

const leadPath = 'src/lead/LeadFeatures.jsx';
let lead = fs.readFileSync(leadPath, 'utf8');
const leadOld = 'leadInitials, VerificationStamp, SyncBadge, Overlay';
const leadNew = 'leadInitials, VerificationStamp, SyncBadge, NoLocationBadge, Overlay';
if (!lead.includes(leadNew)) {
  if (!lead.includes(leadOld)) throw new Error('LeadFeatures NoLocationBadge dependency anchor not found');
  lead = lead.replace(leadOld, leadNew);
  fs.writeFileSync(leadPath, lead);
}

const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');
const appOld = 'leadInitials, VerificationStamp, SyncBadge, Overlay, Select';
const appNew = 'leadInitials, VerificationStamp, SyncBadge, NoLocationBadge, Overlay, Select';
if (!app.includes(appNew)) {
  if (!app.includes(appOld)) throw new Error('App lead factory NoLocationBadge anchor not found');
  app = app.replace(appOld, appNew);
  fs.writeFileSync(appPath, app);
}

const occurrences = (lead.match(/NoLocationBadge/g) || []).length;
if (occurrences < 2) throw new Error(`Expected NoLocationBadge dependency plus consumer(s), found ${occurrences}`);
console.log(`NoLocationBadge boundary patched; LeadFeatures occurrences=${occurrences}`);
