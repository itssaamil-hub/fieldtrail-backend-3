import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('accepted quotation exposes the Deal-based Payments action only in accepted state', () => {
  const quotations = read('src/Quotations.jsx');
  const collections = read('src/Collections.jsx');

  assert.match(quotations, /effectiveStatus==='accepted'&&<QuoteCollection/);
  assert.doesNotMatch(quotations, /action\('accepted'\)[\s\S]{0,300}collectionFromQuote/);
  assert.doesNotMatch(collections, /api\.collectionFromQuote/);
  assert.doesNotMatch(collections, /Create \/ open payment account/);
  assert.doesNotMatch(collections, /Balance due date \(optional\)/);
  assert.match(collections, />Open Payments<\/button>/);
  assert.match(collections, /disabled=\{busy\|\|!record\.quote\.lead_id\}/);
  assert.match(collections, /Recording a payment is allowed only while the Deal is Won/);
});

test('quotation Payments action opens the linked Deal account without creating or converting an account', () => {
  const collections = read('src/Collections.jsx');
  const api = read('src/api.js');

  assert.match(api, /collectionFromQuote:\(id,body\)=>request\('\/collections\/from-quotation\/'\+id,\{method:'POST',body\}\)/);
  assert.match(collections, /fieldtrail:open-collections/);
  assert.match(collections, /detail:\{key:`lead:\$\{record\.quote\.lead_id\}`\}/);
  assert.match(collections, /Link this quotation to a Deal before opening Payments/);
});
