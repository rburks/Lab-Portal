import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { store } from "./lib/store";
import SignIn from "./pages/SignIn";
import CourseMap from "./pages/CourseMap";
import SessionPage from "./pages/SessionPage";
import Instructor from "./pages/Instructor";
import CalendarPage from "./pages/CalendarPage";
import MessagesPage from "./pages/MessagesPage";
import MyWork from "./pages/MyWork";
import Showcase from "./pages/Showcase";
import { PublicPortfolio } from "./pages/Portfolio";
import StudyGuide from "./pages/StudyGuide";
import { useEffect, useState } from "react";

function Shell() {
  const { user, loading, mode, setMode } = useAuth();
  if (loading) return <div className="page"><div className="empty">Loading…</div></div>;
  if (!user) return <SignIn />;
  const isInstr = user.role === "instructor";
  const instrMode = isInstr && mode === "instructor";
  return (
    <>
      {store.demo && <div className="demo-banner">Demo mode: no backend connected. Data resets on reload. Switch users from the top right.</div>}
      <header className="topbar"><div className="in">
        <Link to="/" className="brand"><span className="logo">S/AI</span><b>Software/AI Lab Portal</b></Link>
        <nav className="nav">
          {instrMode ? <>
            <NavLink to="/instructor" end>Dashboard</NavLink>
            <NavLink to="/instructor/sessions">Sessions</NavLink>
            <NavLink to="/instructor/class">Class</NavLink>
            <NavLink to="/calendar">Calendar<PendingOH /></NavLink>
            <NavLink to="/messages">Messages<Unread /></NavLink>
          </> : <>
            <NavLink to="/" end>Course</NavLink>
            <NavLink to="/progress">My work</NavLink>
            <NavLink to="/study">Exam guide</NavLink>
            <NavLink to="/showcase">Showcase</NavLink>
            <NavLink to="/calendar">Calendar</NavLink>
            <NavLink to="/messages">Messages<Unread /></NavLink>
          </>}
        </nav>
        <div className="row">
          {isInstr && <div className="mode" role="group" aria-label="View mode"><button className={mode === "instructor" ? "on" : ""} onClick={() => setMode("instructor")}>Instructor</button><button className={mode === "student" ? "on" : ""} onClick={() => setMode("student")}>Student view</button></div>}
          {store.demo && <DemoSwitcher />}
          <span className="small muted">{user.full_name}</span>
          <button className="btn ghost sm" onClick={() => store.signOut()}>Sign out</button>
        </div>
      </div></header>
      {isInstr && mode === "student" && <div className="mode-banner">Previewing as a student. Sessions appear as the whole class sees them. Switch back to Instructor at the top right.</div>}
      <main className="page">
        <Routes>
          <Route path="/" element={instrMode ? <Navigate to="/instructor" replace /> : <CourseMap />} />
          <Route path="/session/:id" element={<SessionPage />} />
          <Route path="/progress" element={<MyWork />} />
          <Route path="/showcase" element={<Showcase />} />
          <Route path="/study" element={<StudyGuide />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/instructor/*" element={isInstr ? <Instructor /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}

function Unread() {
  const { user } = useAuth();
  const [n, setN] = useState(0);
  useEffect(() => { if (!user) return; const f = async () => { const m = await store.messages(user.role === "instructor" ? undefined : user.id); setN(m.filter(x => x.sender_id !== user.id && !x.read_at).length); }; f(); const t = setInterval(f, 30000); return () => clearInterval(t); }, [user]);
  return n ? <span className="pill acc" style={{ marginLeft: 6, padding: "0 7px" }}>{n}</span> : null;
}

function PendingOH() {
  const { user } = useAuth();
  const [n, setN] = useState(0);
  useEffect(() => { if (!user) return; const f = async () => { const r = await store.ohRequests(); setN(r.filter(x => x.status === "pending").length); }; f(); const t = setInterval(f, 30000); return () => clearInterval(t); }, [user]);
  return n ? <span className="pill warn" style={{ marginLeft: 6, padding: "0 7px" }}>{n}</span> : null;
}

function DemoSwitcher() {
  const { user } = useAuth();
  return (
    <select style={{ width: "auto", padding: "5px 8px" }} value={user?.id} onChange={e => store.demoSwitchUser?.(e.target.value)} aria-label="Switch demo user">
      <option value="u-instr">Instructor</option>
      <option value="u1">Dana (strong)</option>
      <option value="u2">Marcus (struggling)</option>
      <option value="u4">Tom (middling)</option>
    </select>
  );
}

export default function App() {
  // Public portfolio pages render without the portal chrome and without signing in.
  const loc = useLocation();
  if (loc.pathname.startsWith("/p/")) return <AuthProvider><Routes><Route path="/p/:slug" element={<PublicPortfolio />} /></Routes></AuthProvider>;
  return <AuthProvider><Shell /></AuthProvider>;
}
