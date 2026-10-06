// Loads everything a student view needs, once, and exposes it to pages.
import { useCallback, useEffect, useState } from "react";
import { store, type Grade, type Progress, type Release, type Submission } from "../lib/store";

export function useStudentData() {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const [p, s, g, r] = await Promise.all([store.myProgress(), store.mySubmissions(), store.myGrades(), store.releases()]);
    setProgress(p); setSubs(s); setGrades(g); setReleases(r); setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { progress, subs, grades, releases, loading, reload };
}
