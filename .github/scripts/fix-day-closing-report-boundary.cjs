const fs = require('fs');

const reportPath = 'src/reports/ReportFeatures.jsx';
let report = fs.readFileSync(reportPath, 'utf8');
const reportOld = 'CheckCircle2, RefreshCw, Route, Pencil, Trash2, Search, X } = deps;';
const reportNew = 'CheckCircle2, RefreshCw, Route, Pencil, Trash2, Search, X, DayClosingReportsEntry } = deps;';
if (!report.includes(reportNew)) {
  if (!report.includes(reportOld)) throw new Error('ReportFeatures dependency anchor not found');
  report = report.replace(reportOld, reportNew);
  fs.writeFileSync(reportPath, report);
}

const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');
const appOld = 'CheckCircle2, RefreshCw, Route, Pencil, Trash2, Search, X });';
const appNew = 'CheckCircle2, RefreshCw, Route, Pencil, Trash2, Search, X, DayClosingReportsEntry });';
if (!app.includes(appNew)) {
  if (!app.includes(appOld)) throw new Error('App createReportFeatures anchor not found');
  app = app.replace(appOld, appNew);
  fs.writeFileSync(appPath, app);
}

const refs = (report.match(/DayClosingReportsEntry/g) || []).length;
if (refs < 2) throw new Error(`Expected DayClosingReportsEntry dependency + usage, found ${refs}`);
console.log(`DayClosingReportsEntry boundary patched; refs=${refs}`);
