import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('accepted quotation exposes the manual payment-account action only in accepted state', () => {
  const quotations = read('src/Quotations.jsx');
  const collections = read('src/Collections.jsx');

  assert.match(quotations, /effectiveStatus==='accepted'&&<QuoteCollection/);
  assert.doesNotMatch(quotations, /action\('accepted'\)[\s\S]{0,300}collectionFromQuote/);
  assert.match(collections, /Creating an account does not record a payment/);
  assert.match(collections, />Create \/ open payment account<\/button>/);
});

test('manual payment-account click uses the explicit conversion endpoint and opens returned account', () => {
  const collections = read('src/Collections.jsx');
  const api = read('src/api.js');

  assert.match(api, /collectionFromQuote:\(id,body\)=>request\('\/collections\/from-quotation\/'\+id,\{method:'POST',body\}\)/);
  assert.match(collections, /await api\.collectionFromQuote\(record\.quote\.id,\{revision:record\.current\.revision,version:record\.current\.version,dueDate:due\}\)/);
  assert.match(collections, /fieldtrail:open-collections/);
  assert.match(collections, /detail:\{key:r\.key\}/);
});
