import React, { useEffect, useState } from "react";
import { X, UserRound, ShieldCheck, KeyRound, Eye, EyeOff } from "lucide-react";
import { getApiBase, getSession, setSession, clearSession } from "./api.js";

async function accountRequest(path, options = {}) {
  const session = getSession();
  const res = await fetch(`${getApiBase()}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.token || ""}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", border: "1px solid #E4E7EC", borderRadius: 10,
  padding: "11px 12px", fontSize: 14, outline: "none", background: "#fff", color: "#1A1D23"
};
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "#4B5563", marginBottom: 6 };
const cardStyle = { border: "1px solid #E7E9EE", borderRadius: 14, padding: 18, background: "#fff" };

export default function AccountSettingsLauncher() {
  const [isAdmin, setIsAdmin] = useState(() => getSession()?.role === "admin");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setIsAdmin(getSession()?.role === "admin");
    const handler = () => {
      sync();
      if (getSession()?.role === "admin") setOpen(true);
    };
    const timer = window.setInterval(sync, 700);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("engage:open-account-settings", handler);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("engage:open-account-settings", handler);
    };
  }, []);

  if (!isAdmin) return null;
  return <>
    <button
      type="button"
      aria-label="My account"
      title="My account"
      onClick={() => setOpen(true)}
      style={{ position:"fixed", right:14, top:12, zIndex:900, width:38, height:38, borderRadius:12, border:"1px solid #E7E9EE", background:"#fff", display:"none", placeItems:"center", boxShadow:"0 4px 16px rgba(20,30,40,.08)" }}
      className="engage-account-mobile-trigger"
    ><UserRound size={18}/></button>
    {open && <AccountSettingsModal onClose={() => setOpen(false)} />}
    <style>{`@media (max-width: 600px){.engage-account-mobile-trigger{display:grid!important}}`}</style>
  </>;
}

function AccountSettingsModal({ onClose }) {
  const initialSession = getSession();
  const [profile, setProfile] = useState({ fullName: initialSession?.fullName || "", phone: initialSession?.phone || "" });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError] = useState("");
  const [pw, setPw] = useState({ currentPassword:"", newPassword:"", confirmPassword:"" });
  const [show, setShow] = useState({ current:false, next:false, confirm:false });

  useEffect(() => {
    let alive = true;
    accountRequest("/auth/me").then((data) => {
      if (!alive) return;
      setProfile({ fullName: data.user?.full_name || "", phone: data.user?.phone || "" });
    }).catch((err) => alive && setError(err.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setError(""); setProfileMessage(""); setSavingProfile(true);
    try {
      const data = await accountRequest("/auth/me", { method:"PATCH", body: profile });
      const session = getSession();
      setSession({ ...session, fullName: data.user.full_name, phone: data.user.phone });
      setProfile({ fullName:data.user.full_name, phone:data.user.phone });
      setProfileMessage("Profile updated successfully.");
    } catch (err) { setError(err.message); }
    finally { setSavingProfile(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setError(""); setPasswordMessage("");
    if (pw.newPassword !== pw.confirmPassword) { setError("New passwords do not match."); return; }
    if (pw.newPassword.length < 8) { setError("New password must be at least 8 characters."); return; }
    setChangingPassword(true);
    try {
      const data = await accountRequest("/auth/change-password", { method:"POST", body:{ currentPassword:pw.currentPassword, newPassword:pw.newPassword } });
      setPw({ currentPassword:"", newPassword:"", confirmPassword:"" });
      if (data?.reauthenticate) {
        clearSession();
        window.location.reload();
        return;
      }
      setPasswordMessage("Password changed successfully.");
    } catch (err) { setError(err.message); }
    finally { setChangingPassword(false); }
  }

  const passwordField = (key, label, showKey) => <div>
    <label style={labelStyle}>{label}</label>
    <div style={{ position:"relative" }}>
      <input
        style={{ ...inputStyle, paddingRight:42 }}
        type={show[showKey] ? "text" : "password"}
        value={pw[key]}
        autoComplete={key === "currentPassword" ? "current-password" : "new-password"}
        onChange={(e)=>setPw(v=>({ ...v, [key]:e.target.value }))}
      />
      <button type="button" onClick={()=>setShow(v=>({ ...v, [showKey]:!v[showKey] }))} aria-label={show[showKey] ? "Hide password" : "Show password"}
        style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", border:0, background:"transparent", padding:6, color:"#6B7280", cursor:"pointer" }}>
        {show[showKey] ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
    </div>
  </div>;

  return <div role="dialog" aria-modal="true" aria-label="My Account" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}
    style={{ position:"fixed", inset:0, zIndex:5000, background:"rgba(17,24,39,.42)", display:"grid", placeItems:"center", padding:16 }}>
    <div style={{ width:"min(760px, 100%)", maxHeight:"92vh", overflowY:"auto", background:"#F7F8FA", borderRadius:18, boxShadow:"0 24px 80px rgba(15,23,42,.28)" }}>
      <div style={{ position:"sticky", top:0, zIndex:2, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"17px 20px", background:"rgba(255,255,255,.96)", borderBottom:"1px solid #E7E9EE", borderRadius:"18px 18px 0 0" }}>
        <div><div style={{ fontSize:18, fontWeight:800, color:"#1A1D23" }}>My Account</div><div style={{ fontSize:12, color:"#6B7280", marginTop:2 }}>Manage your admin profile and security</div></div>
        <button onClick={onClose} aria-label="Close" style={{ border:0, background:"#F3F4F6", borderRadius:10, width:34, height:34, display:"grid", placeItems:"center", cursor:"pointer" }}><X size={18}/></button>
      </div>

      <div style={{ padding:20, display:"grid", gap:16 }}>
        {error && <div style={{ padding:"10px 12px", borderRadius:10, background:"#FDECEC", color:"#A32929", fontSize:13, fontWeight:600 }}>{error}</div>}
        {loading ? <div style={{ ...cardStyle, textAlign:"center", color:"#6B7280" }}>Loading account…</div> : <>
          <form onSubmit={saveProfile} style={cardStyle}>
            <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16 }}><span style={{ width:34,height:34,borderRadius:10,display:"grid",placeItems:"center",background:"#E8F5EF",color:"#147A5A" }}><UserRound size={18}/></span><div><div style={{ fontWeight:800, fontSize:15 }}>Profile</div><div style={{ fontSize:12, color:"#6B7280" }}>Your admin account details</div></div></div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14 }}>
              <div><label style={labelStyle}>Full name</label><input style={inputStyle} value={profile.fullName} onChange={(e)=>setProfile(v=>({ ...v, fullName:e.target.value }))}/></div>
              <div><label style={labelStyle}>Phone number</label><input style={inputStyle} inputMode="tel" value={profile.phone} onChange={(e)=>setProfile(v=>({ ...v, phone:e.target.value }))}/></div>
              <div><label style={labelStyle}>Role</label><div style={{ ...inputStyle, background:"#F8FAFC", display:"flex", alignItems:"center", gap:7, color:"#475569" }}><ShieldCheck size={16}/> Admin</div></div>
            </div>
            <div style={{ marginTop:16, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:12, color:"#16805C", fontWeight:700 }}>{profileMessage}</span>
              <button disabled={savingProfile} style={{ border:0, borderRadius:10, background:"#145C5D", color:"white", padding:"10px 16px", fontWeight:800, cursor:"pointer", opacity:savingProfile?.7:1 }}>{savingProfile?"Saving…":"Save profile"}</button>
            </div>
          </form>

          <form onSubmit={changePassword} style={cardStyle}>
            <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16 }}><span style={{ width:34,height:34,borderRadius:10,display:"grid",placeItems:"center",background:"#FFF2E7",color:"#A45E24" }}><KeyRound size={18}/></span><div><div style={{ fontWeight:800, fontSize:15 }}>Security</div><div style={{ fontSize:12, color:"#6B7280" }}>Change your login password</div></div></div>
            <div style={{ display:"grid", gap:14 }}>
              {passwordField("currentPassword", "Current password", "current")}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14 }}>
                {passwordField("newPassword", "New password", "next")}
                {passwordField("confirmPassword", "Confirm new password", "confirm")}
              </div>
              <div style={{ fontSize:11, color:"#6B7280" }}>Use at least 8 characters. Changing your password securely signs out existing sessions, so you will log in again.</div>
            </div>
            <div style={{ marginTop:16, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:12, color:"#16805C", fontWeight:700 }}>{passwordMessage}</span>
              <button disabled={changingPassword} style={{ border:0, borderRadius:10, background:"#1A1D23", color:"white", padding:"10px 16px", fontWeight:800, cursor:"pointer", opacity:changingPassword?.7:1 }}>{changingPassword?"Changing…":"Change password"}</button>
            </div>
          </form>
        </>}
      </div>
    </div>
  </div>;
}
