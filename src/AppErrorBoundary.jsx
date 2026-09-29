import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, errorMessage: error?.message || "Unknown interface error" };
  }

  componentDidCatch(error, info) {
    console.error("Engage UI crashed", { message: error?.message, componentStack: info?.componentStack });
  }

  recover = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (error) {
      console.warn("Engage cache recovery could not fully complete", error);
    }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#F4F5F7", padding:24, fontFamily:"Inter, system-ui, sans-serif" }}>
        <section style={{ width:"min(460px,100%)", background:"#fff", border:"1px solid #E7E9EE", borderRadius:18, padding:24, boxShadow:"0 18px 50px rgba(15,23,42,.08)" }}>
          <div style={{ fontSize:20, fontWeight:800, color:"#1A1D23" }}>Engage needs to reload</div>
          <p style={{ margin:"8px 0 12px", color:"#6B7280", fontSize:14, lineHeight:1.55 }}>
            Something unexpected happened in the interface. Your saved server data is not affected.
          </p>
          <div style={{ marginBottom:18, padding:"9px 10px", borderRadius:9, background:"#F8FAFB", border:"1px solid #E7E9EE", color:"#8A3B2F", fontSize:12, lineHeight:1.45, overflowWrap:"anywhere" }}>
            Error: {this.state.errorMessage}
          </div>
          <button type="button" onClick={this.recover} style={{ border:0, borderRadius:10, padding:"11px 16px", background:"#145C5D", color:"#fff", fontWeight:800, cursor:"pointer" }}>
            Recover Engage
          </button>
        </section>
      </main>
    );
  }
}
