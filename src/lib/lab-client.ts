"use client";

import type {
  ExperimentConfig,
  GradeLevel,
  GroupLabRecord,
  StudentSession,
} from "@/modules/experiments/types";

const STUDENT_SESSION_KEY = "ys_sciencelab_student_session_v1";
const TEACHER_AUTH_KEY = "ys_sciencelab_teacher_auth_v1";
const LOCAL_RECORDS_KEY = "ys_sciencelab_local_records_v1";
export const LAB_BROADCAST_CHANNEL = "ys_sciencelab_realtime_channel";

export function buildRecordKey(
  experimentId: string,
  grade: GradeLevel,
  classNum: number,
  groupNum: number
): string {
  return `${experimentId}__g${grade}-c${classNum}-m${groupNum}`;
}

export function createInitialGroupRecord(
  config: ExperimentConfig,
  session: StudentSession
): GroupLabRecord {
  const indep = config.independentVariables[0];
  return {
    recordKey: buildRecordKey(
      config.id,
      session.grade,
      session.classNum,
      session.groupNum
    ),
    experimentId: config.id,
    grade: session.grade,
    classNum: session.classNum,
    groupNum: session.groupNum,
    status: "ready",
    controlledCheckedIds: [],
    dataPoints: indep.presetValues.map((val) => ({
      stepLabel: `${val}${indep.unit}`,
      xValue: val,
      yValue: null,
    })),
    conclusion: "",
    updatedAt: "",
  };
}

export function loadStudentSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STUDENT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudentSession;
  } catch {
    return null;
  }
}

export function saveStudentSession(session: StudentSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session));
}

export function clearStudentSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STUDENT_SESSION_KEY);
}

export function isTeacherAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(TEACHER_AUTH_KEY) === "verified";
}

export function setTeacherAuthenticated(authenticated: boolean): void {
  if (typeof window === "undefined") return;
  if (authenticated) {
    window.sessionStorage.setItem(TEACHER_AUTH_KEY, "verified");
  } else {
    window.sessionStorage.removeItem(TEACHER_AUTH_KEY);
  }
}

function readLocalCache(): Record<string, GroupLabRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_RECORDS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, GroupLabRecord>) : {};
  } catch {
    return {};
  }
}

function writeLocalCache(map: Record<string, GroupLabRecord>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(map));
  } catch {
    // quota 초과 무시
  }
}

export function broadcastLabUpdate(): void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  try {
    const ch = new BroadcastChannel(LAB_BROADCAST_CHANNEL);
    ch.postMessage({ type: "LAB_UPDATED", ts: Date.now() });
    ch.close();
  } catch {
    // 지원하지 않는 브라우저 환경 무시
  }
}

export async function fetchClassLabRecords(
  experimentId: string,
  grade: GradeLevel,
  classNum: number
): Promise<GroupLabRecord[]> {
  try {
    const params = new URLSearchParams({
      experimentId,
      grade: String(grade),
      classNum: String(classNum),
    });
    const res = await fetch(`/api/lab-sessions?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch");
    const data = (await res.json()) as { records: GroupLabRecord[] };

    // 로컬 캐시와 병합하여 최신 데이터 보장
    const localMap = readLocalCache();
    for (const r of data.records) {
      localMap[r.recordKey] = r;
    }
    writeLocalCache(localMap);
    return data.records;
  } catch {
    const localMap = readLocalCache();
    return Object.values(localMap).filter(
      (r) =>
        r.experimentId === experimentId &&
        r.grade === grade &&
        r.classNum === classNum
    );
  }
}

export async function upsertGroupLabRecord(
  record: GroupLabRecord
): Promise<GroupLabRecord> {
  const stamped: GroupLabRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  const localMap = readLocalCache();
  localMap[stamped.recordKey] = stamped;
  writeLocalCache(localMap);
  broadcastLabUpdate();

  try {
    const res = await fetch("/api/lab-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", record: stamped }),
    });
    if (res.ok) {
      const json = (await res.json()) as { record: GroupLabRecord };
      return json.record;
    }
  } catch {
    // 오프라인일 경우 로컬 캐시 유지
  }
  return stamped;
}

export async function seedDemoClassRecords(
  experimentId: string,
  grade: GradeLevel,
  classNum: number
): Promise<GroupLabRecord[]> {
  const res = await fetch("/api/lab-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "seed_demo",
      experimentId,
      grade,
      classNum,
    }),
  });
  const json = (await res.json()) as { records?: GroupLabRecord[] };
  const records = json.records ?? [];
  const localMap = readLocalCache();
  for (const r of records) {
    localMap[r.recordKey] = r;
  }
  writeLocalCache(localMap);
  broadcastLabUpdate();
  return records;
}

export async function resetClassLabRecords(
  experimentId: string,
  grade: GradeLevel,
  classNum: number
): Promise<void> {
  await fetch("/api/lab-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "reset_class",
      experimentId,
      grade,
      classNum,
    }),
  });
  const localMap = readLocalCache();
  const prefix = `${experimentId}__g${grade}-c${classNum}-`;
  for (const k of Object.keys(localMap)) {
    if (k.startsWith(prefix)) {
      delete localMap[k];
    }
  }
  writeLocalCache(localMap);
  broadcastLabUpdate();
}
