import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const settingsSource = fs.readFileSync(path.join(process.cwd(), 'src/useSalesmanSettings.js'), 'utf8');
const leadWrapperSource = fs.readFileSync(path.join(process.cwd(), 'src/lead/LeadFeatures.jsx'), 'utf8');

test('salesman GPS acquisition starts disabled until employee policy is loaded', () => {
  expect(settingsSource).toMatch(/useState\(false\).*gpsLocation/s);
  expect(settingsSource).toMatch(/useState\(false\).*continuousTracking/s);
  expect(settingsSource).toMatch(/useState\(\{ start: false, end: false \}\)/);
  expect(settingsSource).toContain('location.gpsLocation === true');
  expect(settingsSource).toContain('enabled && location.requireLocationToStartDay === true');
  expect(settingsSource).toContain('enabled && location.requireLocationToEndDay === true');
  expect(settingsSource).not.toContain('continuousGpsTracking ?? true');
  expect(settingsSource).not.toContain('requireLocationToStartDay !== false');
  expect(settingsSource).not.toContain('requireLocationToEndDay !== false');
});

test('Add Deal cannot boot the device GPS from legacy optimistic defaults', () => {
  expect(leadWrapperSource).toContain('locationSafeUseState');
  expect(leadWrapperSource).toContain('gpsLocation: false');
  expect(leadWrapperSource).toContain('locationMandatoryForNewLead: false');
  expect(leadWrapperSource).toContain('continuousGpsTracking: false');
  expect(leadWrapperSource).toContain('api: leadCaptureApi');
  expect(leadWrapperSource).toContain('useState: locationSafeUseState');
  expect(leadWrapperSource).toContain('allowLeadWithoutStartDay !== true');
});
