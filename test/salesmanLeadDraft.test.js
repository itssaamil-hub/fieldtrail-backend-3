import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_SALESMAN_LEAD_FORM, salesmanLeadDraftKey,
  loadSalesmanLeadDraft, saveSalesmanLeadDraft, clearSalesmanLeadDraft,
} from '../src/lead/salesmanLeadDraft.js';

const EMPLOYEE_A='3f7ff2a6-5b2c-4d6f-a741-92b6a841dd99';
const EMPLOYEE_B='00ebb823-87e5-4af1-9bf3-e12fd4c99498';
const CLIENT_ID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function memoryStorage(){
 const map=new Map();
 return {
  getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>map.set(key,String(value)),
  removeItem:key=>map.delete(key),
 };
}
test('unfinished Add Deal restores for only its employee; no GPS persisted',()=>{
 const storage=memoryStorage();
 const form={...EMPTY_SALESMAN_LEAD_FORM,business:'Cafe Draft',subLocation:'Gomti Nagar',phone:'9876543210',notes:'Call at 4'};
 assert.equal(saveSalesmanLeadDraft(EMPLOYEE_A,{form,clientUuid:CLIENT_ID,photo:null,gps:{lat:100,lng:100}},storage),true);
 const stored=storage.getItem(salesmanLeadDraftKey(EMPLOYEE_A));
 assert.ok(stored);
 assert.equal(stored.includes('gps'),false);
 const restored=loadSalesmanLeadDraft(EMPLOYEE_A,storage);
 assert.equal(restored.form.business,'Cafe Draft');
 assert.equal(restored.form.notes,'Call at 4');
 assert.equal(restored.clientUuid,CLIENT_ID);
 assert.equal(loadSalesmanLeadDraft(EMPLOYEE_B,storage),null);
});
test('compressed image draft restores, and reset clears everything for the employee only',()=>{
 const storage=memoryStorage();
 const photo={base64:'UklGRgAAAABXRUJQ',bytes:12,width:300,height:200};
 const form={...EMPTY_SALESMAN_LEAD_FORM,business:'A'};
 saveSalesmanLeadDraft(EMPLOYEE_A,{form,photo,clientUuid:CLIENT_ID},storage);
 saveSalesmanLeadDraft(EMPLOYEE_B,{form:{...form,business:'B'},clientUuid:CLIENT_ID,photo:null},storage);
 assert.deepEqual(loadSalesmanLeadDraft(EMPLOYEE_A,storage).photo,photo);
 assert.equal(clearSalesmanLeadDraft(EMPLOYEE_A,storage),true);
 assert.equal(loadSalesmanLeadDraft(EMPLOYEE_A,storage),null);
 assert.equal(loadSalesmanLeadDraft(EMPLOYEE_B,storage).form.business,'B');
});
test('empty or reset form removes old draft instead of restoring it',()=>{
 const storage=memoryStorage();
 saveSalesmanLeadDraft(EMPLOYEE_A,{form:{...EMPTY_SALESMAN_LEAD_FORM,business:'Before'},clientUuid:CLIENT_ID},storage);
 assert.ok(loadSalesmanLeadDraft(EMPLOYEE_A,storage));
 saveSalesmanLeadDraft(EMPLOYEE_A,{form:{...EMPTY_SALESMAN_LEAD_FORM},photo:null,clientUuid:CLIENT_ID},storage);
 assert.equal(loadSalesmanLeadDraft(EMPLOYEE_A,storage),null);
});
test('corrupt drafts and storage exceptions do not block lead entry',()=>{
 const storage=memoryStorage();
 storage.setItem(salesmanLeadDraftKey(EMPLOYEE_A),'{broken');
 assert.equal(loadSalesmanLeadDraft(EMPLOYEE_A,storage),null);
 const broken={
  getItem(){throw Error('blocked');},
  setItem(){throw Error('quota');},
  removeItem(){throw Error('blocked');},
 };
 assert.equal(loadSalesmanLeadDraft(EMPLOYEE_A,broken),null);
 assert.equal(saveSalesmanLeadDraft(EMPLOYEE_A,{form:EMPTY_SALESMAN_LEAD_FORM,clientUuid:CLIENT_ID},broken),false);
 assert.equal(clearSalesmanLeadDraft(EMPLOYEE_A,broken),false);
});
