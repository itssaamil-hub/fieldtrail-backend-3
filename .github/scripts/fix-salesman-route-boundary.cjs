const fs = require('fs');

const adminPath = 'src/admin/AdminAppView.jsx';
let admin = fs.readFileSync(adminPath, 'utf8');
const adminOld = 'MessageComposeModal, LeadDetailDrawer, SalesmanFormModal, MyLeadsModal, VerificationStamp';
const adminNew = 'MessageComposeModal, LeadDetailDrawer, SalesmanFormModal, MyLeadsModal, SalesmanRouteModal, VerificationStamp';
if (!admin.includes(adminNew)) {
  if (!admin.includes(adminOld)) throw new Error('AdminAppView SalesmanRouteModal dependency anchor not found');
  admin = admin.replace(adminOld, adminNew);
  fs.writeFileSync(adminPath, admin);
}

const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');
const appOld = 'MessageComposeModal, LeadDetailDrawer, SalesmanFormModal, MyLeadsModal, VerificationStamp';
const appNew = 'MessageComposeModal, LeadDetailDrawer, SalesmanFormModal, MyLeadsModal, SalesmanRouteModal, VerificationStamp';
if (!app.includes(appNew)) {
  if (!app.includes(appOld)) throw new Error('App admin factory SalesmanRouteModal anchor not found');
  app = app.replace(appOld, appNew);
  fs.writeFileSync(appPath, app);
}

if (!(admin.match(/SalesmanRouteModal/g) || []).length) throw new Error('SalesmanRouteModal still missing from AdminAppView');
console.log('SalesmanRouteModal boundary patched');
