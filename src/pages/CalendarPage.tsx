// Calendar page: course schedule by month. Students see dates and book office hours.
// Instructor adds holidays and buffer days (which push later sessions back) and manages slots.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { store, type CalendarDay, type CourseSettings, type OHRequest, type Profile, type Slot } from "../lib/store";
import { buildSchedule, fmtLong, fmtTime, iso, nextDates, parse, WEEKDAYS, type ScheduledDay } from "../lib/schedule";

export default function CalendarPage() {
  const { user, toast } = useAuth();
  const isInstr = user?.role === "instructor";
  const [settings, setSettings] = useState<CourseSettings | null>(null);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reqs, setReqs] = useState<OHRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tab, setTab] = useState<"schedule" | "office">("schedule");
  const reload = useCallback(async () => {
    const [s, d, sl, r] = await Promise.all([store.settings(), store.calendarDays(), store.slots(), store.ohRequests()]);
    setSettings(s); setDays(d); setSlots(sl); setReqs(r);
    if (isInstr) setProfiles(await store.allProfiles());
  }, [isInstr]);
  useEffect(() => { reload(); }, [reload]);
  const schedule = useMemo(() => settings ? buildSchedule(settings, days) : [], [settings, days]);
  if (!settings) return <div className="empty">Loading calendar…</div>;
  const last = schedule[schedule.length - 1];
  return (
    <>
      <div className="hero">
        <div><span className="eyebrow">{WEEKDAYS.filter((_, i) => settings.class_days.includes(i)).join(", ")} · 6:00 to 9:00 PM</span><h1>Calendar</h1>
          <p className="muted">Starts {fmtLong(settings.start_date)}, ends {last ? fmtLong(last.date) : "—"}. {days.filter(d => d.kind === "holiday").length} holidays, {days.filter(d => d.kind === "buffer").length} buffer days.</p></div>
        <div className="tabs" style={{ borderBottom: 0 }}><button className={tab === "schedule" ? "on" : ""} onClick={() => setTab("schedule")}>Schedule</button><button className={tab === "office" ? "on" : ""} onClick={() => setTab("office")}>Office hours{reqs.filter(r => r.status === "pending").length ? ` (${reqs.filter(r => r.status === "pending").length})` : ""}</button></div>
      </div>
      {tab === "schedule" ? <Schedule schedule={schedule} days={days} isInstr={!!isInstr} onChange={async (d) => { await store.setCalendarDay(d); await reload(); toast("Calendar updated"); }} />
        : <OfficeHours slots={slots} reqs={reqs} profiles={profiles} isInstr={!!isInstr} userId={user!.id} reload={reload} toast={toast} />}
    </>
  );
}

function Schedule({ schedule, days, isInstr, onChange }: { schedule: ScheduledDay[]; days: CalendarDay[]; isInstr: boolean; onChange: (d: CalendarDay | { day: string; remove: true }) => Promise<void> }) {
  const [adding, setAdding] = useState<{ day: string; kind: "holiday" | "buffer"; label: string } | null>(null);
  const months = useMemo(() => { const m = new Map<string, ScheduledDay[]>(); schedule.forEach(d => { const k = d.date.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k)!.push(d); }); return [...m.entries()]; }, [schedule]);
  const today = iso(new Date());
  return (
    <div className="stack" style={{ gap: 14 }}>
      {isInstr && (
        <div className="card"><div className="row between">
          <div><h3>Buffer and holiday days</h3><p className="small muted">Marking a class date pushes every later session back one class day. Remove it to pull them forward again.</p></div>
          <button className="btn sm" onClick={() => setAdding({ day: today, kind: "buffer", label: "" })}>Add a day</button>
        </div>
          {adding && <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <label className="stack" style={{ gap: 4, width: "auto" }}><span className="eyebrow">Date</span><input id="cal-day" type="date" value={adding.day} onChange={e => setAdding({ ...adding, day: e.target.value })} style={{ width: "auto" }} /></label>
            <label className="stack" style={{ gap: 4, width: "auto" }}><span className="eyebrow">Type</span><select value={adding.kind} onChange={e => setAdding({ ...adding, kind: e.target.value as "holiday" | "buffer" })} style={{ width: "auto" }}><option value="buffer">Buffer (catch-up, no new session)</option><option value="holiday">Holiday (no class)</option></select></label>
            <label className="stack" style={{ gap: 4, flex: 1, minWidth: 160 }}><span className="eyebrow">Label</span><input id="cal-label" placeholder={adding.kind === "buffer" ? "Catch-up day" : "Thanksgiving"} value={adding.label} onChange={e => setAdding({ ...adding, label: e.target.value })} /></label>
            <button className="btn" onClick={async () => { await onChange({ day: adding.day, kind: adding.kind, label: adding.label || null }); setAdding(null); }}>Save</button>
            <button className="btn ghost" onClick={() => setAdding(null)}>Cancel</button>
          </div>}
          {days.length > 0 && <div className="row" style={{ marginTop: 12 }}>{days.map(d => <span key={d.day} className={`pill ${d.kind === "holiday" ? "" : "acc"}`}>{fmtLong(d.day)} · {d.label || d.kind}<button className="btn ghost xs" style={{ marginLeft: 6, padding: "0 6px" }} onClick={() => onChange({ day: d.day, remove: true })} aria-label="Remove">×</button></span>)}</div>}
        </div>)}
      <div className="weeks">
        {months.map(([k, list]) => (
          <div className="card" key={k}><h3 style={{ marginBottom: 10 }}>{parse(k + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
            <div className="stack" style={{ gap: 6 }}>{list.map(d => (
              <div key={d.date} className="row between" style={{ padding: "6px 8px", borderRadius: 6, background: d.date === today ? "var(--accent-soft)" : d.kind !== "session" ? "var(--panel-2)" : "transparent", gap: 8 }}>
                <span className="mono small" style={{ width: 96, flexShrink: 0, whiteSpace: "nowrap" }}>{fmtLong(d.date)}</span>
                {d.kind === "session" ? <Link to={`/session/${d.session!.id}`} className="small" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)", textDecoration: "none" }} title={d.session!.title}><b>W{d.session!.week} D{d.session!.day}</b> · {d.session!.title}</Link>
                  : <span className="small" style={{ flex: 1 }}><span className={`pill ${d.kind === "holiday" ? "" : "acc"}`}>{d.label}</span></span>}
              </div>))}</div>
          </div>))}
      </div>
    </div>
  );
}

function OfficeHours({ slots, reqs, profiles, isInstr, userId, reload, toast }: { slots: Slot[]; reqs: OHRequest[]; profiles: Profile[]; isInstr: boolean; userId: string; reload: () => Promise<void>; toast: (m: string) => void }) {
  const [topic, setTopic] = useState("");
  const [pick, setPick] = useState<{ slot: Slot; date: string } | null>(null);
  const [custom, setCustom] = useState<{ date: string; time: string } | null>(null);
  const [newSlot, setNewSlot] = useState<Omit<Slot, "id"> | null>(null);
  const name = (id: string) => profiles.find(p => p.id === id)?.full_name || "Student";
  const taken = (slot: Slot, date: string) => reqs.filter(r => r.slot_id === slot.id && r.requested_at.startsWith(date) && (r.status === "pending" || r.status === "accepted")).length >= slot.capacity;
  const submit = async () => {
    if (!topic.trim()) return toast("Add a sentence about what you want to cover");
    if (pick) await store.requestOH({ slot_id: pick.slot.id, requested_at: `${pick.date}T${pick.slot.start_time}:00`, topic: topic.trim() });
    else if (custom) await store.requestOH({ slot_id: null, requested_at: `${custom.date}T${custom.time}:00`, topic: topic.trim() });
    else return toast("Pick a slot or propose a time");
    setTopic(""); setPick(null); setCustom(null); await reload(); toast("Request sent");
  };
  const mine = reqs.filter(r => isInstr || r.student_id === userId).sort((a, b) => a.requested_at.localeCompare(b.requested_at));
  return (
    <div className="stack" style={{ gap: 14 }}>
      {isInstr ? (
        <div className="card"><div className="row between"><div><h3>Your slots</h3><p className="small muted">Recurring weekly times students can book. Each booking is one student unless you raise capacity.</p></div><button className="btn sm" onClick={() => setNewSlot({ weekday: 2, start_time: "17:00", minutes: 15, capacity: 1, location: "", active: true })}>Add slot</button></div>
          {newSlot && <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <label className="stack" style={{ gap: 4, width: "auto" }}><span className="eyebrow">Day</span><select style={{ width: "auto" }} value={newSlot.weekday} onChange={e => setNewSlot({ ...newSlot, weekday: +e.target.value })}>{WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}</select></label>
            <label className="stack" style={{ gap: 4, width: "auto" }}><span className="eyebrow">Start</span><input type="time" style={{ width: "auto" }} value={newSlot.start_time} onChange={e => setNewSlot({ ...newSlot, start_time: e.target.value })} /></label>
            <label className="stack" style={{ gap: 4, width: 90 }}><span className="eyebrow">Minutes</span><input type="number" min={5} value={newSlot.minutes} onChange={e => setNewSlot({ ...newSlot, minutes: +e.target.value })} /></label>
            <label className="stack" style={{ gap: 4, width: 90 }}><span className="eyebrow">Capacity</span><input type="number" min={1} value={newSlot.capacity} onChange={e => setNewSlot({ ...newSlot, capacity: +e.target.value })} /></label>
            <label className="stack" style={{ gap: 4, flex: 1, minWidth: 160 }}><span className="eyebrow">Where</span><input placeholder="Zoom link or room" value={newSlot.location || ""} onChange={e => setNewSlot({ ...newSlot, location: e.target.value })} /></label>
            <button className="btn" onClick={async () => { await store.saveSlot(newSlot); setNewSlot(null); await reload(); toast("Slot added"); }}>Save</button><button className="btn ghost" onClick={() => setNewSlot(null)}>Cancel</button></div>}
          <div className="stack" style={{ gap: 6, marginTop: 12 }}>{slots.map(s => <div key={s.id} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}><span><b>{WEEKDAYS[s.weekday]} {fmtTime(s.start_time)}</b> · {s.minutes} min · {s.location || "location not set"}</span><button className="btn ghost xs" onClick={async () => { await store.deleteSlot(s.id); await reload(); }}>Remove</button></div>)}{!slots.length && <div className="small muted">No slots yet.</div>}</div>
        </div>
      ) : (
        <div className="card stack">
          <h3>Book office hours</h3>
          <p className="small muted">Pick an open slot, or propose another time. Tell Roland what you want to cover so the time is useful.</p>
          <div className="stack" style={{ gap: 8 }}>{slots.filter(s => s.active).map(s => (
            <div key={s.id}><div className="small" style={{ fontWeight: 600 }}>{WEEKDAYS[s.weekday]} {fmtTime(s.start_time)} · {s.minutes} min · {s.location}</div>
              <div className="chips" style={{ marginTop: 4 }}>{nextDates(s.weekday, 3).map(d => { const full = taken(s, d); const on = pick?.slot.id === s.id && pick.date === d; return <button key={d} disabled={full} className={on ? "on" : ""} onClick={() => { setPick({ slot: s, date: d }); setCustom(null); }} style={full ? { opacity: .5, textDecoration: "line-through" } : {}}>{fmtLong(d)}</button>; })}</div></div>))}</div>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <span className="small muted">Or propose a time:</span>
            <input type="date" style={{ width: "auto" }} value={custom?.date || ""} onChange={e => { setCustom({ date: e.target.value, time: custom?.time || "17:00" }); setPick(null); }} />
            <input type="time" style={{ width: "auto" }} value={custom?.time || "17:00"} onChange={e => setCustom({ date: custom?.date || iso(new Date()), time: e.target.value })} />
          </div>
          <textarea id="oh-topic" placeholder="What do you want to go over? One or two sentences." value={topic} onChange={e => setTopic(e.target.value)} />
          <div><button className="btn" onClick={submit}>{pick ? `Book ${fmtLong(pick.date)} ${fmtTime(pick.slot.start_time)}` : custom?.date ? `Request ${fmtLong(custom.date)} ${fmtTime(custom.time)}` : "Send request"}</button></div>
        </div>
      )}
      <div className="card"><h3>{isInstr ? "Requests" : "Your requests"}</h3>
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>{mine.map(r => (
          <div key={r.id} className="sub" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div style={{ minWidth: 0 }}><div className="row" style={{ gap: 8 }}>{isInstr && <b>{name(r.student_id)}</b>}<span className="mono small">{fmtLong(r.requested_at.slice(0, 10))} {fmtTime(r.requested_at.slice(11, 16))}</span><span className={`pill ${r.status === "accepted" ? "good" : r.status === "declined" || r.status === "cancelled" ? "bad" : r.status === "done" ? "" : "warn"}`}>{r.status}</span>{!r.slot_id && <span className="pill">custom time</span>}</div>
              <div className="small" style={{ marginTop: 4 }}>{r.topic}</div>{r.instructor_note && <div className="small muted">Note: {r.instructor_note}</div>}</div>
            <div className="row" style={{ gap: 6 }}>
              {isInstr && r.status === "pending" && <><button className="btn sm" onClick={async () => { await store.updateOH(r.id, { status: "accepted" }); await reload(); toast("Accepted"); }}>Accept</button><DeclineBtn onDecline={async (note) => { await store.updateOH(r.id, { status: "declined", instructor_note: note || null }); await reload(); }} /></>}
              {isInstr && r.status === "accepted" && <button className="btn ghost sm" onClick={async () => { await store.updateOH(r.id, { status: "done" }); await reload(); }}>Mark done</button>}
              {!isInstr && (r.status === "pending" || r.status === "accepted") && <button className="btn ghost xs" onClick={async () => { await store.updateOH(r.id, { status: "cancelled" }); await reload(); }}>Cancel</button>}
            </div>
          </div>))}{!mine.length && <div className="small muted">No requests yet.</div>}</div>
      </div>
    </div>
  );
}

function DeclineBtn({ onDecline }: { onDecline: (note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [note, setNote] = useState("");
  if (!open) return <button className="btn ghost sm" onClick={() => setOpen(true)}>Decline</button>;
  return <div className="row" style={{ gap: 6 }}><input placeholder="Optional note, e.g. another time" value={note} onChange={e => setNote(e.target.value)} style={{ width: 200, padding: "5px 8px" }} /><button className="btn sm danger" onClick={() => onDecline(note)}>Confirm</button><button className="btn ghost sm" onClick={() => setOpen(false)}>Back</button></div>;
}
