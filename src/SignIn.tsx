import { useState } from "react";
import Logo from "../components/Logo";
import { store } from "../lib/store";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setState("sending");
    const r = await store.signInWithEmail(email.trim());
    if (r.error) { setErr(r.error); setState("error"); } else setState(store.demo ? "idle" : "sent");
  };
  return (
    <div className="page">
      <div className="card pad-lg signin stack">
        <div className="brand"><Logo /><b>Software/AI Portal</b></div>
        <h1>Sign in</h1>
        <p className="muted">Enter the email your instructor added to the roster. We'll send you a sign-in link; no password needed.</p>
        {state === "sent" ? (
          <div className="callout"><b>Check your email.</b> Open the link on this device to finish signing in. It expires in an hour.</div>
        ) : (
          <form className="stack" onSubmit={go}>
            <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Email</span><input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
            {err && <div className="small" style={{ color: "var(--bad)" }}>{err}</div>}
            <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send sign-in link"}</button>
          </form>
        )}
        {store.demo && (
          <div className="callout small">
            <b>Demo mode.</b> No backend is connected. Try a demo account:
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn ghost sm" onClick={() => store.demoSwitchUser?.("u1")}>Student (strong)</button>
              <button className="btn ghost sm" onClick={() => store.demoSwitchUser?.("u2")}>Student (struggling)</button>
              <button className="btn ghost sm" onClick={() => store.demoSwitchUser?.("u-instr")}>Instructor</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
