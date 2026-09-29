import fs from 'fs';

const leadPath = 'src/lead/LeadFeatures.jsx';
let lead = fs.readFileSync(leadPath, 'utf8');
const leadOld = 'StatCard, SalesmanReportsPage, getDeviceId';
const leadNew = 'StatCard, SalesmanReportsPage, TasksEntry, getDeviceId';
if (!lead.includes(leadNew)) {
  if (!lead.includes(leadOld)) throw new Error('LeadFeatures dependency anchor not found');
  lead = lead.replace(leadOld, leadNew);
  fs.writeFileSync(leadPath, lead);
}

const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');
const appOld = 'StatCard, SalesmanReportsPage, getDeviceId, getDayStarted';
const appNew = 'StatCard, SalesmanReportsPage, TasksEntry, getDeviceId, getDayStarted';
if (!app.includes(appNew)) {
  if (!app.includes(appOld)) throw new Error('App lead factory anchor not found');
  app = app.replace(appOld, appNew);
  fs.writeFileSync(appPath, app);
}
