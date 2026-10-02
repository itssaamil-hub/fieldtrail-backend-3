import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getQueuedLeads,pushQueuedLead,removeQueuedLead,flushOfflineLeads,legacyQueueCount} from '../src/offlineLeadQueue.js';
function storage(){const map=new Map();global.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};return map;}
test('offline deals are isolated by owner, deduplicated and preserved on every failed sync',async()=>{
 const map=storage(),a={clientUuid:'a',businessName:'Cafe A'},b={clientUuid:'b',businessName:'Cafe B'};
 map.set('fieldtrail:queuedLeads',JSON.stringify([{clientUuid:'legacy'}]));
 pushQueuedLead(a,'A');pushQueuedLead(a,'A');pushQueuedLead(b,'B');
 assert.deepEqual(getQueuedLeads('A'),[a]);assert.deepEqual(getQueuedLeads('B'),[b]);assert.equal(legacyQueueCount(),1);
 for(const status of [0,400,401,403,409,422,429,500,503]){
  const errors=[];await flushOfflineLeads({userId:'A',isCurrent:()=>true,createLead:async()=>{throw Object.assign(Error('failed'),{status});},onSynced:()=>assert.fail('must not report saved'),onError:e=>errors.push(e)});
  assert.deepEqual(getQueuedLeads('A'),[a]);assert.equal(errors.length,1);
 }
 removeQueuedLead('a','B');assert.deepEqual(getQueuedLeads('A'),[a]);assert.equal(legacyQueueCount(),1);
});
test('switching account mid-flight never submits the next deal under the new login',async()=>{
 storage();pushQueuedLead({clientUuid:'first'},'A');pushQueuedLead({clientUuid:'second'},'A');pushQueuedLead({clientUuid:'other'},'B');
 let current='A';const sent=[];
 await flushOfflineLeads({userId:'A',isCurrent:()=>current==='A',createLead:async(p,user)=>{sent.push([p.clientUuid,user]);current='B';return{lead:{id:'saved',salesman_id:'A'}};},onSynced:()=>assert.fail('must not update B UI'),onError:()=>assert.fail('no error')});
 assert.deepEqual(sent,[['first','A']]);assert.deepEqual(getQueuedLeads('A'),[{clientUuid:'second'}]);assert.deepEqual(getQueuedLeads('B'),[{clientUuid:'other'}]);
});
test('unconfirmed responses stay saved and validation failures do not block other deals',async()=>{
 storage();pushQueuedLead({clientUuid:'invalid'},'A');pushQueuedLead({clientUuid:'valid'},'A');const synced=[];
 await flushOfflineLeads({userId:'A',isCurrent:()=>true,createLead:async p=>{if(p.clientUuid==='invalid')throw Object.assign(Error('invalid'),{status:400});return{lead:{id:'saved',salesman_id:'A'},deduped:true};},onSynced:r=>synced.push(r),onError:()=>{}});
 assert.deepEqual(getQueuedLeads('A'),[{clientUuid:'invalid'}]);assert.equal(synced.length,1);
 await flushOfflineLeads({userId:'A',isCurrent:()=>true,createLead:async()=>({}),onSynced:()=>assert.fail(),onError:()=>{}});assert.equal(getQueuedLeads('A').length,1);
});
test('corrupt stored queues are preserved and cannot be overwritten by a new deal',()=>{
 const map=storage();map.set('fieldtrail:queuedLeads:A','broken JSON');assert.deepEqual(getQueuedLeads('A'),[]);
 assert.throws(()=>pushQueuedLead({clientUuid:'new'},'A'));assert.equal(map.get('fieldtrail:queuedLeads:A'),'broken JSON');
});
