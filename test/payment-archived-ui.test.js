import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const jsx=fs.readFileSync(new URL('../src/Collections.jsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/collections.css',import.meta.url),'utf8');

test('Payments exposes only active statuses plus Archived',()=>{
  assert.match(jsx,/\["pending","Pending"\]/);
  assert.match(jsx,/\["partial","Partially paid"\]/);
  assert.match(jsx,/\["overdue","Overdue"\]/);
  assert.match(jsx,/\["paid","Paid"\]/);
  assert.match(jsx,/\["archived","Archived"\]/);
  assert.doesNotMatch(jsx,/\["voided","Voided"\]/);
  assert.doesNotMatch(jsx,/Void payment account|Void account|Payment account voided/);
  assert.match(jsx,/status==='archived'&&!!c\.archived_at/);
  assert.match(jsx,/status==='all'&&!c\.archived_at/);
});

test('archived accounts are read-only in Payments',()=>{
  assert.match(jsx,/a\.archived_at\?'Archived'/);
  assert.match(jsx,/Payment account archived/);
  assert.match(jsx,/reactivated automatically/);
  assert.match(jsx,/!a\.archived_at&&\(admin\?<DueDate/);
  assert.match(jsx,/admin&&!a\.archived_at&&a\.pending>0/);
  assert.match(jsx,/admin=\{admin&&!a\.archived_at\}/);
});

test('payment status buttons use responsive grid sizing',()=>{
  assert.match(css,/\.ft-col-tabs\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(108px,1fr\)\)/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*\.ft-col-tabs\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css,/\.ft-col-state\.archived\{/);
});
