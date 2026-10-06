// Classifier sandbox: drag a decision line to separate two classes; see how a skewed sample fools you.
import { useEffect, useRef, useState } from "react";

type Pt = { x: number; y: number; cls: 0 | 1 };
type Line = { a: number; b: number; c: number };
const rnd = (seed: number) => { let x = seed; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };
function make(kind: "fair" | "skew" | "test"): Pt[] {
  const R = rnd(kind === "fair" ? 7 : kind === "skew" ? 11 : 23); const pts: Pt[] = [];
  for (let i = 0; i < 60; i++) { const cls = (i % 2) as 0 | 1; let x: number, y: number;
    if (kind === "skew") { if (cls === 0) { x = -0.75 + R() * 0.35; y = -0.9 + R() * 1.8; } else { x = 0.1 + R() * 0.8; y = -0.9 + R() * 1.8; } }
    else { const cx = cls === 0 ? -0.4 : 0.4, cy = cls === 0 ? 0.3 : -0.3; x = cx + (R() - 0.5); y = cy + (R() - 0.5); }
    pts.push({ x, y, cls }); }
  return pts;
}
const DATA = { fair: make("fair"), skew: make("skew"), test: make("test") };
const side = (l: Line, p: Pt) => (l.a * p.x + l.b * p.y + l.c > 0 ? 1 : 0);
const acc = (l: Line, pts: Pt[]) => pts.filter(p => side(l, p) === p.cls).length / pts.length;

export default function Sandbox({ onRecord }: { onRecord: (r: { train: number; test: number }) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [line, setLine] = useState<Line>({ a: 0.6, b: -0.2, c: 0 });
  const [mode, setMode] = useState<"fair" | "skew" | "test">("fair");
  const [train, setTrain] = useState<"fair" | "skew">("fair");
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pts = mode === "test" ? DATA.test : DATA[mode];
  const trainAcc = acc(line, DATA[train]); const testAcc = acc(line, DATA.test);

  useEffect(() => {
    const c = cv.current!; const cx = c.getContext("2d")!; const W = c.width, H = c.height; cx.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement); const ink = css.getPropertyValue("--ink").trim(); const grid = css.getPropertyValue("--line").trim();
    cx.strokeStyle = grid; cx.lineWidth = 1; for (let i = 1; i < 8; i++) { cx.beginPath(); cx.moveTo(W * i / 8, 0); cx.lineTo(W * i / 8, H); cx.stroke(); } for (let i = 1; i < 7; i++) { cx.beginPath(); cx.moveTo(0, H * i / 7); cx.lineTo(W, H * i / 7); cx.stroke(); }
    const px = (p: { x: number; y: number }) => [(p.x + 1) / 2 * W, (1 - (p.y + 1) / 2) * H] as const;
    pts.forEach(p => { const [x, y] = px(p); cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.fillStyle = p.cls ? "#e07b2a" : "#2f6fd6"; cx.fill(); if (side(line, p) !== p.cls) { cx.strokeStyle = "#c0392b"; cx.lineWidth = 2.5; cx.stroke(); } });
    cx.strokeStyle = ink; cx.lineWidth = 2.5; cx.beginPath();
    if (Math.abs(line.b) > 1e-3) { const ys = (x: number) => -(line.a * x + line.c) / line.b; cx.moveTo(...px({ x: -1, y: ys(-1) })); cx.lineTo(...px({ x: 1, y: ys(1) })); }
    else { const x = -line.c / line.a; cx.moveTo(...px({ x, y: -1 })); cx.lineTo(...px({ x, y: 1 })); }
    cx.stroke();
  }, [line, pts]);

  const pos = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: (1 - (e.clientY - r.top) / r.height) * 2 - 1 }; };
  const onMove = (e: React.PointerEvent) => { if (!drag.current) return; const p = pos(e); const dx = p.x - drag.current.x, dy = p.y - drag.current.y;
    setLine(l => { const n = Math.hypot(l.a, l.b); const ang = Math.atan2(l.b, l.a) + (dx * dy > 0 ? 1 : -1) * Math.hypot(dx, dy) * 0.6; return { a: Math.cos(ang) * n, b: Math.sin(ang) * n, c: l.c - (l.a * dx + l.b * dy) * 0.9 }; }); drag.current = p; };
  const fit = () => { const tp = DATA[train]; let best = line, bs = -1; for (let t = 0; t < 2500; t++) { const ang = Math.random() * Math.PI, c = (Math.random() - 0.5) * 1.4; const cand = { a: Math.cos(ang), b: Math.sin(ang), c }; const s = acc(cand, tp); if (s > bs) { bs = s; best = cand; } } setLine(best); };
  const pick = (m: "fair" | "skew" | "test") => { setMode(m); if (m !== "test") setTrain(m); };
  const hint = mode === "skew" ? "Notice how many lines separate this data perfectly. The sample never showed the hard cases, so there's no way to tell which line is right."
    : mode === "test" ? `This is data the model never saw. A line fit on the ${train === "skew" ? "skewed" : "fair"} sample scores what you see on the right. Skewed training looks perfect and fails here.`
    : "Drag anywhere on the canvas to move and rotate the line. Blue is one class, orange the other. Red rings mark mistakes.";
  return (
    <div className="stack">
      <p className="muted reading">Two kinds of dots. Drag the line until it separates them, then switch to the skewed sample and test on new data. This is the whole idea of a classifier, with no math.</p>
      <div className="sb">
        <canvas ref={cv} width={640} height={420} onPointerDown={e => { drag.current = pos(e); (e.target as Element).setPointerCapture(e.pointerId); }} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)} aria-label="Classifier canvas" />
        <div className="stack">
          <span className="eyebrow">Dataset</span>
          <div className="chips">{(["fair", "skew", "test"] as const).map(m => <button key={m} className={mode === m ? "on" : ""} onClick={() => pick(m)}>{m === "fair" ? "Fair sample" : m === "skew" ? "Skewed sample" : "New data (test)"}</button>)}</div>
          <div className="stat"><span>Training accuracy</span><b className="mono">{Math.round(trainAcc * 100)}%</b></div>
          <div className="stat"><span>Test accuracy</span><b className="mono">{mode === "test" ? Math.round(testAcc * 100) + "%" : "—"}</b></div>
          <div className="stat"><span>Misclassified here</span><b className="mono">{pts.filter(p => side(line, p) !== p.cls).length}</b></div>
          <button className="btn ghost sm" onClick={fit}>Let the computer fit the line</button>
          <button className="btn ghost sm" onClick={() => setLine({ a: 0.6, b: -0.2, c: 0 })}>Reset line</button>
          <div className="callout small">{hint}</div>
          <button className="btn sm" onClick={() => onRecord({ train: Math.round(trainAcc * 100), test: Math.round(testAcc * 100) })}>Record my result</button>
        </div>
      </div>
    </div>
  );
}
