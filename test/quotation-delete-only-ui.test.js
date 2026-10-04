import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('payments UI exposes no manual void actions', () => {
  const collections = read('src/Collections.jsx');

  assert.doesNotMatch(collections, /Void payment account/);
  assert.doesNotMatch(collections, />Void account<\/button>/);
  assert.doesNotMatch(collections, />Void quotation<\/button>/);
  assert.doesNotMatch(collections, /VoidAccountAction/);
  assert.doesNotMatch(collections, /voidPaymentAccount/);
  assert.doesNotMatch(collections, /voidAcceptedQuotation/);
});

test('quotation delete action remains available under existing lifecycle safeguards', () => {
  const quotations = read('src/Quotations.jsx');

  assert.match(quotations, />Delete quotation<\/button>/);
  assert.match(quotations, /const canDelete=/);
  assert.match(quotations, /api\.deleteQuote\(selected,body\)/);
});
