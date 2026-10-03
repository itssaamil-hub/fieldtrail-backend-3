import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/lead/LeadFeatures.jsx', import.meta.url), 'utf8');

test('trusted lead entry forces Add Deal GPS off without changing attendance GPS hook', () => {
  assert.match(source, /allowLeadWithoutStartDay !== true/);
  assert.match(source, /gpsLocation: false/);
  assert.match(source, /locationMandatoryForNewLead: false/);
  assert.match(source, /continuousGpsTracking: false/);
  assert.match(source, /createCoreLeadFeatures\(\{ \.\.\.deps, api: leadCaptureApi/);
  assert.match(source, /Attendance and[\s\S]*useSalesmanSettings/);
});
