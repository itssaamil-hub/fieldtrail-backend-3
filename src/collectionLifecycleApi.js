import {ApiError,getApiBase,getSession} from './api.js';

async function post(path,body){
 const token=getSession()?.token||'';
 let res;
 try{res=await fetch(`${getApiBase()}${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body||{})});}
 catch{throw new ApiError('Could not reach the server — check your connection.',0)}
 let data=null;try{data=await res.json()}catch{}
 if(!res.ok)throw new ApiError(data?.error||`Request failed (${res.status})`,res.status);
 return data;
}

export const voidAcceptedQuotation=(quoteId,body)=>post(`/quotations/${quoteId}/void`,body);
export const voidPaymentAccount=(key,body)=>post(`/collections/${encodeURIComponent(key)}/void`,body);
