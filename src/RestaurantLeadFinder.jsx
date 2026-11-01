import React, { useEffect, useState } from "react";
import { MapPin, Search, ExternalLink, Globe, Phone, ShieldCheck, AlertCircle } from "lucide-react";
import { api, getSession } from "./api.js";
import { OnboardingDialog } from "./Onboarding.jsx";

// Results exist in this component only for the current session. Google Places
// content is never persisted into Engage's contacts/deals or browser storage.
const categories = [
  ["restaurant", "Restaurants"],
  ["cafe", "Cafés"],
  ["bakery", "Bakeries"],
  ["qsr", "QSRs"]
];
const inputStyle = {width:"100%",height:39,border:"1px solid #D8E2E6",background:"#fff",borderRadius:10,padding:"8px 11px",boxSizing:"border-box",fontSize:13,color:"#25343A"};
const buttonStyle = {height:38,border:"1px solid #D9E2E6",borderRadius:10,padding:"0 12px",cursor:"pointer",background:"#fff",color:"#25414A",fontSize:12,fontWeight:750};
const textStyle = {fontSize:12,color:"#687681",lineHeight:1.6};
const GOOGLE_LOGO = "https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png";

function Attribution({items=[]}) {
  if (!items.length) return null;
  return <div style={{marginTop:5,...textStyle}}>
    {items.map((item,i)=><span key={i}>{i>0?" · ":""}{item.providerUri?<a href={item.providerUri} target="_blank" rel="noopener noreferrer">{item.provider||"Attribution"}</a>:item.provider}</span>)}
  </div>;
}

export default function RestaurantLeadFinder({onClose}) {
  const [city,setCity]=useState("");
  const [area,setArea]=useState("");
  const [category,setCategory]=useState("restaurant");
  const [results,setResults]=useState([]);
  const [nextToken,setNextToken]=useState(null);
  const [searched,setSearched]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [status,setStatus]=useState(null);
  const [contacts,setContacts]=useState({});
  const [contactBusy,setContactBusy]=useState("");
  const [contactError,setContactError]=useState({});
  const [lastQuery,setLastQuery]=useState(null);

  useEffect(()=>{
    let alive=true;
    api.restaurantFinderStatus().then(v=>{if(alive)setStatus(v)}).catch(e=>{if(alive)setError(e.message||"Could not check Google Places configuration.")});
    return()=>{alive=false};
  },[]);

  if(getSession()?.role!=="admin") return null;

  const search=async (more=false)=>{
    if(busy)return;
    setBusy(true);setError("");
    try{
      const q=more?lastQuery:{city:city.trim(),area:area.trim(),category};
      if(!q?.city || q.city.length<2){setError("Enter a city in India.");return}
      const response=await api.restaurantFinderSearch({...q,pageToken:more?nextToken:undefined});
      setResults(previous=>{
        const combined=more?[...previous,...(response.places||[])]:response.places||[];
        const seen=new Set();
        return combined.filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true});
      });
      if(!more){setContacts({});setContactError({});setLastQuery(q)}
      setNextToken(response.nextPageToken||null);
      setSearched(true);
      setStatus(current=>current?{...current,search:response.usage}:current);
    }catch(e){setError(e.message||"Restaurant search failed. No results were saved.")}
    finally{setBusy(false)}
  };

  const lookup=async placeId=>{
    if(contactBusy)return;
    setContactBusy(placeId);setContactError(v=>({...v,[placeId]:""}));
    try{
      const result=await api.restaurantFinderContact(placeId);
      setContacts(v=>({...v,[placeId]:result}));
      setStatus(v=>v?{...v,contact:result.usage}:v);
    }catch(e){setContactError(v=>({...v,[placeId]:e.message||"Contact lookup unavailable"}))}
    finally{setContactBusy("")}
  };

  return <OnboardingDialog title="Restaurant Lead Finder" onClose={onClose} wide fullPage desktopFull busy={busy||Boolean(contactBusy)}>
    <div style={{padding:"15px 18px 22px",overflowY:"auto",maxHeight:"calc(100vh - 110px)"}}>
      <p style={{...textStyle,margin:"0 0 13px"}}>Find restaurant prospects across India. Admin-only · Google Places results are displayed temporarily and are not added to CRM.</p>
      <form onSubmit={e=>{e.preventDefault();search(false)}} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))",gap:11,alignItems:"end"}}>
        <label style={{fontSize:12,fontWeight:750,color:"#354750"}}>City
          <input aria-label="Restaurant city" value={city} onChange={e=>setCity(e.target.value)} required maxLength={80} placeholder="e.g. Lucknow" style={{...inputStyle,marginTop:5}}/>
        </label>
        <label style={{fontSize:12,fontWeight:750,color:"#354750"}}>Locality (optional)
          <input aria-label="Restaurant locality" value={area} onChange={e=>setArea(e.target.value)} maxLength={90} placeholder="e.g. Gomti Nagar" style={{...inputStyle,marginTop:5}}/>
        </label>
        <label style={{fontSize:12,fontWeight:750,color:"#354750"}}>Type
          <select aria-label="Restaurant category" value={category} onChange={e=>setCategory(e.target.value)} style={{...inputStyle,marginTop:5}}>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        </label>
        <button type="submit" disabled={busy||!status?.configured} style={{...buttonStyle,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,background:"#135F60",color:"#fff",border:0,opacity:busy||!status?.configured?.5:1}}><Search size={15}/>{busy?"Searching…":"Search restaurants"}</button>
      </form>

      {status&&!status.configured&&<div role="alert" style={{marginTop:12,padding:11,borderRadius:10,background:"#FFF7E8",color:"#7E4E00",fontSize:12}}>Google Places is not connected yet. Add <strong>GOOGLE_PLACES_API_KEY</strong> to the existing Render backend environment. Never enter the key in this page or frontend code.</div>}
      {status&&<div style={{marginTop:11,...textStyle,display:"flex",gap:14,flexWrap:"wrap"}}>
        <span><ShieldCheck size={13} style={{verticalAlign:"-2px"}}/> Search usage: {status.search?.today??0}/{status.search?.limit?.daily??"–"} today · {status.search?.month??0}/{status.search?.limit?.monthly??"–"} this month</span>
        <span>Contact lookup: {status.contactEnabled?"Enabled — higher Google API tier":"Off (higher Google API tier)"}</span>
      </div>}
      {error&&<p role="alert" style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:"#B42318",marginTop:12}}><AlertCircle size={15}/>{error}</p>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,margin:"19px 0 11px"}}>
        <strong style={{fontSize:14,color:"#233D42"}}>Restaurant results{searched?` · ${results.length}`:""}</strong>
        <img src={GOOGLE_LOGO} alt="Powered by Google" style={{height:16,width:"auto"}}/>
      </div>
      {!searched&&!busy&&<p style={{...textStyle,padding:"24px 0",textAlign:"center"}}>Search a city or locality to discover restaurants. No sample or fabricated results are shown.</p>}
      {searched&&!busy&&!results.length&&<p style={{...textStyle,padding:"24px 0",textAlign:"center"}}>No restaurants found for this search. Try another area or category.</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 270px), 1fr))",gap:10}}>
        {results.map(p=><article key={p.id} style={{padding:13,border:"1px solid #DEE5E9",borderRadius:12,background:"#fff",minWidth:0}}>
          <strong style={{fontSize:13.5,color:"#233D42"}}>{p.name}</strong>
          <div style={{display:"flex",alignItems:"flex-start",gap:5,marginTop:7,...textStyle}}><MapPin size={13} style={{flexShrink:0,marginTop:2}}/>{p.address||"Address unavailable"}</div>
          <Attribution items={p.attributions}/>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:11}}>
            <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" style={{...buttonStyle,display:"inline-flex",alignItems:"center",gap:5,height:33,textDecoration:"none"}}><ExternalLink size={13}/> Open in Maps</a>
            {status?.contactEnabled&&<button type="button" disabled={!!contactBusy||busy} onClick={()=>lookup(p.id)} style={{...buttonStyle,height:33}}><Phone size={13} style={{verticalAlign:"-2px",marginRight:4}}/>{contactBusy===p.id?"Checking…":"Look up contact"}</button>}
          </div>
          {contacts[p.id]&&<div style={{...textStyle,marginTop:9}}>
            {contacts[p.id].phone?<div><Phone size={12} style={{verticalAlign:"-2px"}}/> {contacts[p.id].phone}</div>:<div>Phone not listed</div>}
            {contacts[p.id].website&&<div><Globe size={12} style={{verticalAlign:"-2px"}}/> <a href={contacts[p.id].website} target="_blank" rel="noopener noreferrer">Restaurant website</a></div>}
            <Attribution items={contacts[p.id].attributions}/>
          </div>}
          {contactError[p.id]&&<div role="alert" style={{...textStyle,color:"#B42318"}}>{contactError[p.id]}</div>}
        </article>)}
      </div>
      {searched&&nextToken&&<div style={{textAlign:"center",padding:13}}><button type="button" disabled={busy} onClick={()=>search(true)} style={buttonStyle}>{busy?"Loading…":"Load more restaurants"}</button></div>}
      <p style={{...textStyle,marginTop:15}}>Google Places content is provided for live discovery only. Listings are not stored, exported or automatically added as CRM leads. API limits are separate from Google Cloud quotas and billing alerts; verify your Google Cloud billing settings.</p>
    </div>
  </OnboardingDialog>;
}
