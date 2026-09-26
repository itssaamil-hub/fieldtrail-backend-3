import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Engage UI crashed", { message: error?.message, componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#F4F5F7", padding:24, fontFamily:"Inter, system-ui, sans-serif" }}>
        <section style={{ width:"min(460px,100%)", background:"#fff", border:"1px solid #E7E9EE", borderRadius:18, padding:24, boxShadow:"0 18px 50px rgba(15,23,42,.08)" }}>
          <div style={{ fontSize:20, fontWeight:800, color:"#1A1D23" }}>Engage needs to reload</div>
          <p style={{ margin:"8px 0 18px", color:"#6B7280", fontSize:14, lineHeight:1.55 }}>
            Something unexpected happened in the interface. Your saved server data is not affected.
          </p>
          <button type="button" onClick={() => window.location.reload()} style={{ border:0, borderRadius:10, padding:"11px 16px", background:"#145C5D", color:"#fff", fontWeight:800, cursor:"pointer" }}>
            Reload Engage
          </button>
        </section>
      </main>
    );
  }
}
