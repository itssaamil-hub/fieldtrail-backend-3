const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const id='11111111-1111-4111-8111-111111111111';
function mount(hash,session={id:'user'}){
 const source=fs.readFileSync(require.resolve('../src/App.jsx'),'utf8');const start=source.indexOf('    const openFromLocation =');const end=source.indexOf('  }, [session]);',start);assert(start>0&&end>start);
 const state={},listeners={},messages={};const window={location:{hash,origin:'https://app.example'},addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){}};const context={window,session,URL,Date,navigator:{serviceWorker:{addEventListener:(k,f)=>messages[k]=f,removeEventListener(){}}}};
 for(const name of source.slice(start,end).match(/set[A-Z]\w+/g)||[])context[name]=value=>state[name]=value;
 vm.runInNewContext('(function(){'+source.slice(start,end).replace('} catch { /* Ignore malformed messages. */ }','} catch (err) { throw err; }')+'})()',context);return{state,window,click:url=>messages.message({data:{type:'OPEN_NOTIFICATION',url}})};
}
test('quotation push opens exact quotation after login and hides notifications',()=>{const h=mount('#quotation='+id);assert.equal(h.state.setQuotationView.initialId,id);assert.equal(h.state.setShowNotifications,false);assert.equal(h.state.setNotificationLead,null);});
test('signed-out quote destination waits for login',()=>{assert.equal(mount('#quotation='+id,null).state.setQuotationView,undefined);assert.equal(mount('#quotation='+id,{id:'admin',role:'admin'}).state.setQuotationView.initialId,id);});
test('warm and repeated service-worker clicks open quotation; external and invalid links ignored',()=>{const h=mount('');h.click('/#quotation='+id);assert.equal(h.window.location.hash,'#quotation='+id,'push should update hash');assert.equal(h.state.setQuotationView.initialId,id);h.click('/#quotation='+id);assert.equal(h.state.setQuotationView.initialId,id);const fresh=mount('');fresh.click('https://other.example/#quotation='+id);fresh.click('/#quotation=bad');assert.equal(fresh.state.setQuotationView,undefined);});
test('lead and briefing destinations retain existing behavior',()=>{assert.equal(mount('#lead='+id).state.setNotificationLead.id,id);assert.equal(mount('#sales-briefing').state.setShowNotifications,true);});

test('generic Start Day push opens the existing Notifications panel, including legacy root links',()=>{const h=mount('');h.click('/');assert.equal(h.window.location.hash,'#notifications');assert.equal(h.state.setShowNotifications,true);});
test('lead deep link closes overlapping panels and selects dashboard before showing the deal drawer',()=>{const h=mount('#lead='+id);assert.equal(h.state.setDesktopSection,'dashboard');assert.equal(h.state.setQuotationView,null);assert.equal(h.state.setShowBroadcast,false);assert.equal(h.state.setNotificationLead.id,id);});
