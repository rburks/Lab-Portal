// Student "My work": progress across sessions, the capstone tracker, and the portfolio editor, as three tabs.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MyProgress from "./MyProgress";
import { StudentCapstone } from "./Capstone";
import { PortfolioEditor } from "./Portfolio";
import { useAuth } from "../auth";

type T = "progress" | "capstone" | "portfolio";
export default function MyWork() {
  const { user } = useAuth();
  const loc = useLocation(); const nav = useNavigate();
  const q = new URLSearchParams(loc.search).get("tab") as T | null;
  const [tab, setTab] = useState<T>(q === "capstone" || q === "portfolio" ? q : "progress");
  useEffect(() => { if (q === "capstone" || q === "portfolio" || q === "progress") setTab(q); }, [q]);
  const go = (t: T) => { setTab(t); nav(`/progress${t === "progress" ? "" : `?tab=${t}`}`, { replace: true }); };
  return (
    <>
      <div className="hero"><div><span className="eyebrow">{user!.full_name}</span><h1>My work</h1></div>
        <div className="tabs" style={{ borderBottom: 0 }}><button className={tab === "progress" ? "on" : ""} onClick={() => go("progress")}>Progress</button><button className={tab === "capstone" ? "on" : ""} onClick={() => go("capstone")}>Capstone</button><button className={tab === "portfolio" ? "on" : ""} onClick={() => go("portfolio")}>Portfolio</button></div></div>
      {tab === "progress" ? <MyProgress embedded /> : tab === "capstone" ? <StudentCapstone /> : <PortfolioEditor />}
    </>
  );
}
