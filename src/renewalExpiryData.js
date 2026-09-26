import { api } from './api.js';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function renewalMonthFromDate(value){
  if(!value) return '';
  const month = Number(String(value).slice(5,7));
  return month >= 1 && month <= 12 ? MONTH_NAMES[month - 1] : '';
}

export function normalizeRenewalPayload(payload = {}){
  if(!payload || typeof payload !== 'object') return payload;
  if(!payload.renewalDate) return payload;
  return {
    ...payload,
    renewalMonth: renewalMonthFromDate(payload.renewalDate) || payload.renewalMonth || null,
  };
}

function wrap(name){
  const original = api[name];
  if(typeof original !== 'function' || original.__engageRenewalNormalized) return;
  const wrapped = function(...args){
    const payloadIndex = name.includes('UpdateLead') ? 1 : 0;
    if(args[payloadIndex] && typeof args[payloadIndex] === 'object'){
      args[payloadIndex] = normalizeRenewalPayload(args[payloadIndex]);
    }
    return original.apply(api,args);
  };
  wrapped.__engageRenewalNormalized = true;
  api[name] = wrapped;
}

wrap('adminCreateLead');
wrap('salesmanCreateLead');
wrap('adminUpdateLead');
wrap('salesmanUpdateLead');
