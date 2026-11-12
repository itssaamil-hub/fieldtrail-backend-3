import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/lead/LeadFeatures.jsx', import.meta.url), 'utf8');

test('trusted lead entry stays GPS-free unless mandatory lead GPS is explicitly ON', () => {
  assert.match(source, /allowLeadWithoutStartDay !== true \|\| mandatoryLeadGps/);
  assert.match(source, /locationSettings\?\.gpsLocation === true/);
  assert.match(source, /locationSettings\?\.locationMandatoryForNewLead === true/);
  assert.match(source, /gpsLocation: false/);
  assert.match(source, /locationMandatoryForNewLead: false/);
  assert.match(source, /continuousGpsTracking: false/);
  assert.match(source, /createCoreLeadFeatures\(\{ \.\.\.deps, api: leadCaptureApi/);
});
