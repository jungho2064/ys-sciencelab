"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  EXPERIMENT_CONFIGS,
  getExperimentConfigById,
} from "@/modules/experiments/configs";
import type {
  DbClassRow,
  DbControlledVarJson,
  DbExperimentLogRow,
  DbIndependentVarJson,
  DbSurveyLogRow,
  ExperimentConfig,
  GradeLevel,
  GroupLabRecord,
  StudentSession,
} from "@/modules/experiments/types";
import {
  SCIENCE_LAB_SCHEMA,
  getScienceLabDb,
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

const STUDENT_SESSION_KEY = "ys_sciencelab_student_session_v1";
const TEACHER_AUTH_KEY = "ys_sciencelab_teacher_auth_v1";
const LOCAL_RECORDS_KEY = "ys_sciencelab_local_records_v1";
export const LAB_BROADCAST_CHANNEL = "ys_sciencelab_realtime_channel";

const classCache = new Map<string, DbClassRow>();
let lastSupabaseSchemaWarning: string | null = null;

export function getSupabaseSchemaWarning(): string | null {
  return lastSupabaseSchemaWarning;
}

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
    simulationLog: [],
    aiFeedbackCount: 0,
    revisionCount: 0,
    conclusion: "",
    updatedAt: "",
  };
}

export function dbRowToGroupRecord(
  row: DbExperimentLogRow,
  grade: GradeLevel,
  classNum: number
): GroupLabRecord {
  const cfg = getExperimentConfigById(row.experiment_slug);
  const indep = cfg?.independentVariables[0];
  const checkedIds = Array.isArray(row.controlled_vars)
    ? row.controlled_vars.filter((c) => c.checked).map((c) => c.id)
    : [];

  const defaultPoints = indep
    ? indep.presetValues.map((val) => ({
        stepLabel: `${val}${indep.unit}`,
        xValue: val,
        yValue: null,
      }))
    : [];

  return {
    id: row.id,
    classId: row.class_id,
    recordKey: buildRecordKey(
      row.experiment_slug,
      grade,
      classNum,
      row.group_num
    ),
    experimentId: row.experiment_slug,
    grade,
    classNum,
    groupNum: row.group_num,
    status: row.status ?? "ready",
    controlledCheckedIds: checkedIds,
    dataPoints:
      Array.isArray(row.measured_data) && row.measured_data.length > 0
        ? row.measured_data
        : defaultPoints,
    simulationLog: Array.isArray(row.simulation_data)
      ? row.simulation_data
      : [],
    aiFeedbackCount: row.ai_feedback_count ?? 0,
    revisionCount: row.revision_count ?? 0,
    conclusion: row.conclusion ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function buildDbPayloadFromRecord(
  record: GroupLabRecord,
  classId: string
): Omit<DbExperimentLogRow, "id" | "updated_at"> {
  const cfg = getExperimentConfigById(record.experimentId);
  const indep = cfg?.independentVariables[0];

  const independentVarJson: DbIndependentVarJson = indep
    ? {
        id: indep.id,
        name: indep.name,
        unit: indep.unit,
        presetValues: indep.presetValues,
      }
    : {
        id: "unknown",
        name: "조작변인",
        unit: "",
        presetValues: record.dataPoints.map((d) => d.xValue),
      };

  const controlledVarsJson: DbControlledVarJson[] = (
    cfg?.controlledVariables ?? []
  ).map((cv) => ({
    id: cv.id,
    name: cv.name,
    fixedValue: cv.fixedValue,
    checked: record.controlledCheckedIds.includes(cv.id),
  }));

  return {
    class_id: classId,
    experiment_slug: record.experimentId,
    group_num: record.groupNum,
    status: record.status,
    independent_var: independentVarJson,
    controlled_vars: controlledVarsJson,
    measured_data: record.dataPoints,
    simulation_data: record.simulationLog ?? [],
    ai_feedback_count: record.aiFeedbackCount ?? 0,
    revision_count: record.revisionCount ?? 0,
    conclusion: record.conclusion ?? "",
  };
}

function checkPostgrestSchemaError(err: { code?: string; message?: string }) {
  if (err.code === "PGRST106") {
    lastSupabaseSchemaWarning =
      "Supabase 대시보드 → Project Settings → Data API → Exposed schemas에 'science_lab'을 추가해 주세요.";
  }
}

/**
 * 학년·반에 해당하는 `science_lab.classes` 행을 조회하거나 없으면 자동 생성합니다.
 */
export async function ensureClassRow(
  grade: GradeLevel,
  classNum: number
): Promise<DbClassRow | null> {
  const cacheKey = `${grade}-${classNum}`;
  const cached = classCache.get(cacheKey);
  if (cached) return cached;

  const db = getScienceLabDb();
  if (!db) return null;

  const { data: existing, error: selectErr } = await db
    .from("classes")
    .select("*")
    .eq("grade", grade)
    .eq("class_num", classNum)
    .maybeSingle<DbClassRow>();

  if (selectErr) {
    checkPostgrestSchemaError(selectErr);
    return null;
  }

  lastSupabaseSchemaWarning = null;

  if (existing) {
    classCache.set(cacheKey, existing);
    return existing;
  }

  const defaultPin = process.env.NEXT_PUBLIC_TEACHER_PIN || "1234";
  const { data: created, error: insertErr } = await db
    .from("classes")
    .upsert(
      {
        grade,
        class_num: classNum,
        teacher_pin: defaultPin,
      },
      { onConflict: "grade,class_num" }
    )
    .select("*")
    .single<DbClassRow>();

  if (insertErr || !created) {
    if (insertErr) checkPostgrestSchemaError(insertErr);
    return null;
  }

  classCache.set(cacheKey, created);
  return created;
}

/**
 * 교사 PIN 검증 (`science_lab.classes.teacher_pin` 또는 환경변수 마스터 PIN)
 */
export async function verifyTeacherPinWithDb(
  grade: GradeLevel,
  classNum: number,
  candidatePin: string
): Promise<boolean> {
  const masterPin = process.env.NEXT_PUBLIC_TEACHER_PIN || "1234";
  if (candidatePin === masterPin) return true;

  const cls = await ensureClassRow(grade, classNum);
  if (cls && cls.teacher_pin === candidatePin) {
    return true;
  }
  return false;
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
    // 미지원 브라우저 무시
  }
}

/**
 * 학급 실험 기록 목록 조회 (1순위: Supabase `science_lab.experiment_logs`, 2순위: 로컬 API/캐시)
 */
export async function fetchClassLabRecords(
  experimentId: string,
  grade: GradeLevel,
  classNum: number
): Promise<GroupLabRecord[]> {
  if (isSupabaseConfigured) {
    const cls = await ensureClassRow(grade, classNum);
    const db = getScienceLabDb();
    if (cls && db) {
      const { data, error } = await db
        .from("experiment_logs")
        .select("*")
        .eq("class_id", cls.id)
        .eq("experiment_slug", experimentId)
        .order("group_num", { ascending: true });

      if (!error && data) {
        const mapped = (data as DbExperimentLogRow[]).map((row) =>
          dbRowToGroupRecord(row, grade, classNum)
        );
        const localMap = readLocalCache();
        for (const r of mapped) {
          localMap[r.recordKey] = r;
        }
        writeLocalCache(localMap);
        return mapped;
      }
      if (error) checkPostgrestSchemaError(error);
    }
  }

  // 로컬 API 폴백
  try {
    const params = new URLSearchParams({
      experimentId,
      grade: String(grade),
      classNum: String(classNum),
    });
    const res = await fetch(`/api/lab-sessions?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed local fetch");
    const json = (await res.json()) as { records: GroupLabRecord[] };
    return json.records;
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

/**
 * 모둠 실험 데이터 저장 (Supabase `science_lab.experiment_logs` Upsert -> Realtime 자동 브로드캐스트)
 */
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

  if (isSupabaseConfigured) {
    const cls = await ensureClassRow(record.grade, record.classNum);
    const db = getScienceLabDb();
    if (cls && db) {
      const payload = buildDbPayloadFromRecord(stamped, cls.id);
      const { data, error } = await db
        .from("experiment_logs")
        .upsert(payload, {
          onConflict: "class_id,experiment_slug,group_num",
        })
        .select("*")
        .single<DbExperimentLogRow>();

      if (!error && data) {
        const synced = dbRowToGroupRecord(data, record.grade, record.classNum);
        localMap[synced.recordKey] = synced;
        writeLocalCache(localMap);
        return synced;
      }
      if (error) checkPostgrestSchemaError(error);
    }
  }

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
    // 오프라인 로컬 캐시 유지
  }
  return stamped;
}

/**
 * Supabase Realtime 구독 (`science_lab.experiment_logs` INSERT / UPDATE / DELETE 실시간 감지)
 */
export async function subscribeToClassRealtimeLogs(params: {
  experimentId: string;
  grade: GradeLevel;
  classNum: number;
  onRecordUpsert: (record: GroupLabRecord) => void;
  onRecordDelete: () => void;
  onConnectionChange?: (connected: boolean) => void;
}): Promise<() => void> {
  const client = getSupabaseClient();
  if (!client) {
    params.onConnectionChange?.(false);
    return () => {};
  }

  const cls = await ensureClassRow(params.grade, params.classNum);
  if (!cls) {
    params.onConnectionChange?.(false);
    return () => {};
  }

  const channelName = `sciencelab-logs-${cls.id}-${params.experimentId}`;
  const channel: RealtimeChannel = client
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: SCIENCE_LAB_SCHEMA,
        table: "experiment_logs",
        filter: `class_id=eq.${cls.id}`,
      },
      (payload) => {
        if (
          payload.eventType === "INSERT" ||
          payload.eventType === "UPDATE"
        ) {
          const row = payload.new as DbExperimentLogRow;
          if (row.experiment_slug === params.experimentId) {
            const mapped = dbRowToGroupRecord(
              row,
              params.grade,
              params.classNum
            );
            params.onRecordUpsert(mapped);
          }
        } else if (payload.eventType === "DELETE") {
          params.onRecordDelete();
        }
      }
    )
    .subscribe((status) => {
      params.onConnectionChange?.(status === "SUBSCRIBED");
    });

  return () => {
    void client.removeChannel(channel);
  };
}

const DEMO_CONCLUSIONS: Record<string, string[]> = {
  "g3-spring-weight": [
    "추의 개수가 늘어날수록 용수철이 늘어난 길이도 일정하게 길어집니다.",
    "추를 1개 더 걸 때마다 용수철이 약 2cm씩 규칙적으로 늘어났어요!",
    "물체의 무게가 무거울수록 용수철이 더 많이 늘어납니다.",
    "추의 무게가 2배, 3배가 되면 늘어난 길이도 약 2배, 3배가 됩니다.",
    "용수철이 늘어난 길이는 매단 추의 개수에 비례하여 커집니다.",
  ],
  "g4-shadow-size": [
    "손전등과 물체 사이의 거리가 가까울수록 그림자의 크기가 커집니다!",
    "손전등을 멀리 이동하면 스크린에 생기는 그림자가 점점 작아졌어요.",
    "거리가 멀어질수록 그림자 가로 길이가 줄어드는 규칙을 찾았습니다.",
    "손전등이 10cm일 때 가장 크고 30cm일 때 그림자가 가장 작았어요.",
    "빛이 직진하기 때문에 손전등을 물체에 가까이 대면 그림자가 커집니다.",
  ],
  "g5-dissolution-temp": [
    "물의 온도가 높을수록 물에 녹는 백반의 양이 많아집니다.",
    "20°C보다 80°C의 뜨거운 물에서 백반이 훨씬 많이 녹았어요!",
    "온도가 올라갈수록 녹는 백반 숟가락 수가 빠르게 늘어났습니다.",
    "물의 온도와 백반이 용해되는 양은 온도가 높을수록 커지는 관계예요.",
    "차가운 물에서는 조금만 녹고 따뜻한 물에서는 많이 녹았습니다.",
  ],
  "sample-dissolution": [
    "물 50mL에서 설탕은 20°C일 때 2숟가락, 80°C일 때 8숟가락이 녹아 온도가 높을수록 많이 녹았습니다.",
    "설탕은 20°C(2숟가락)에서 80°C(8숟가락)로 온도가 오를수록 녹는 양이 크게 늘었지만, 소금은 거의 비슷했어요!",
    "물의 양을 50mL로 똑같이 맞추었을 때 40°C에서는 4숟가락, 60°C에서는 6숟가락이 완전히 녹았습니다.",
    "20°C보다 80°C에서 설탕이 4배(2숟가락→8숟가락) 더 많이 용해되는 규칙을 찾았습니다.",
    "가상 실험과 실제 실험 모두 온도가 20°C씩 오를 때마다 설탕이 약 2숟가락씩 더 많이 녹았습니다.",
  ],
  "g6-electromagnet": [
    "직렬로 연결한 전지의 수가 많을수록 전자석에 붙는 클립 수가 많아집니다.",
    "전지를 1개에서 4개로 늘릴수록 전자석의 세기가 점점 강해졌어요!",
    "전지 개수가 늘어날수록 클립이 약 6개씩 더 많이 붙었습니다.",
    "전류가 세게 흐를수록 전자석의 자기력이 세진다는 것을 알게 되었어요.",
    "전지 4개를 연결했을 때 클립이 가장 많이 붙어 전자석이 가장 셌습니다.",
  ],
};

/**
 * 교사용 시연 데이터(1~6모둠) 생성 — Supabase `science_lab.experiment_logs`에 일괄 Upsert
 */
export async function seedDemoClassRecords(
  experimentId: string,
  grade: GradeLevel,
  classNum: number
): Promise<GroupLabRecord[]> {
  const cfg = getExperimentConfigById(experimentId);
  if (!cfg) return [];

  const indep = cfg.independentVariables[0];
  const conclusions = DEMO_CONCLUSIONS[cfg.id] ?? [
    "조작변인이 변함에 따라 실험 결과도 규칙적으로 변했습니다.",
  ];
  const offsets = [-0.2, 0.3, 0.0, -0.4, 0.2, 0.5];
  const nowIso = new Date().toISOString();

  const generated: GroupLabRecord[] = [];
  for (let groupNum = 1; groupNum <= 6; groupNum++) {
    const isCompleted = groupNum <= 4 || groupNum === 6;
    const measuredCount = isCompleted
      ? indep.presetValues.length
      : Math.max(2, indep.presetValues.length - (groupNum === 5 ? 2 : 1));

    const dataPoints = indep.presetValues.map((xVal, idx) => {
      if (idx >= measuredCount) {
        return {
          stepLabel: `${xVal}${indep.unit}`,
          xValue: xVal,
          yValue: null,
        };
      }
      const ideal = cfg.simulateValue(xVal);
      const jitter = offsets[(groupNum + idx) % offsets.length];
      const isIntegerUnit =
        cfg.dependentVariable.unit === "개" ||
        cfg.dependentVariable.unit === "숟가락";
      const realisticY = isIntegerUnit
        ? Math.max(0, Math.round(ideal + jitter * 2.2))
        : Math.max(0, Number((ideal + jitter).toFixed(1)));

      return {
        stepLabel: `${xVal}${indep.unit}`,
        xValue: xVal,
        yValue: realisticY,
      };
    });

    const checkedIds = isCompleted
      ? cfg.controlledVariables.map((c) => c.id)
      : cfg.controlledVariables.slice(0, 2).map((c) => c.id);

    generated.push({
      recordKey: buildRecordKey(cfg.id, grade, classNum, groupNum),
      experimentId: cfg.id,
      grade,
      classNum,
      groupNum,
      status: isCompleted ? "completed" : "measuring",
      controlledCheckedIds: checkedIds,
      dataPoints,
      simulationLog: indep.presetValues.slice(0, 2).map((xVal) => ({
        xValue: xVal,
        simulatedY: cfg.simulateValue(xVal),
        recordedAt: nowIso,
      })),
      aiFeedbackCount: (groupNum % 3) + 1,
      revisionCount: groupNum + 2,
      conclusion: isCompleted
        ? conclusions[(groupNum - 1) % conclusions.length]
        : "",
      updatedAt: nowIso,
    });
  }

  if (isSupabaseConfigured) {
    const cls = await ensureClassRow(grade, classNum);
    const db = getScienceLabDb();
    if (cls && db) {
      const payloads = generated.map((r) => buildDbPayloadFromRecord(r, cls.id));
      const { data, error } = await db
        .from("experiment_logs")
        .upsert(payloads, {
          onConflict: "class_id,experiment_slug,group_num",
        })
        .select("*");

      if (!error && data) {
        const synced = (data as DbExperimentLogRow[]).map((row) =>
          dbRowToGroupRecord(row, grade, classNum)
        );
        broadcastLabUpdate();
        return synced;
      }
      if (error) checkPostgrestSchemaError(error);
    }
  }

  // 폴백: 로컬 API 시드
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
  broadcastLabUpdate();
  return json.records ?? generated;
}

/**
 * 학급 실험 기록 초기화 (Supabase `science_lab.experiment_logs` DELETE + 로컬 초기화)
 */
export async function resetClassLabRecords(
  experimentId: string,
  grade: GradeLevel,
  classNum: number
): Promise<void> {
  if (isSupabaseConfigured) {
    const cls = await ensureClassRow(grade, classNum);
    const db = getScienceLabDb();
    if (cls && db) {
      await db
        .from("experiment_logs")
        .delete()
        .eq("class_id", cls.id)
        .eq("experiment_slug", experimentId);
    }
  }

  try {
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
  } catch {
    // 무시
  }

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

/**
 * 연구대회 익명 설문·소감 저장 (`science_lab.survey_logs`)
 */
export async function submitStudentSurveyLog(input: {
  grade: GradeLevel;
  classNum: number;
  anonStudentCode: string;
  surveyPhase: "pre" | "post" | "reflection";
  experimentSlug: string;
  interestScore: number;
  inquiryConfidenceScore: number;
  collaborationScore: number;
  reflectionText: string;
}): Promise<{ ok: boolean; errorMessage?: string }> {
  const db = getScienceLabDb();
  if (!db) {
    return {
      ok: false,
      errorMessage: "Supabase 연결 설정을 확인해 주세요.",
    };
  }

  const cls = await ensureClassRow(input.grade, input.classNum);
  const { error } = await db.from("survey_logs").insert({
    class_id: cls?.id ?? null,
    anon_student_code: input.anonStudentCode.trim(),
    survey_phase: input.surveyPhase,
    experiment_slug: input.experimentSlug,
    interest_score: input.interestScore,
    inquiry_confidence_score: input.inquiryConfidenceScore,
    collaboration_score: input.collaborationScore,
    responses: {
      grade: input.grade,
      class_num: input.classNum,
    },
    reflection_text: input.reflectionText.trim(),
  });

  if (error) {
    checkPostgrestSchemaError(error);
    return { ok: false, errorMessage: error.message };
  }

  return { ok: true };
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(filename: string, csvRows: string[][]): void {
  const csvBody = csvRows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\r\n");
  // UTF-8 BOM을 포함하여 엑셀·한셀·SPSS에서 한글이 깨지지 않도록 처리
  const blob = new Blob(["\uFEFF" + csvBody], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * 연구대회 통계 분석용 [전체 실험 로그 CSV 다운로드]
 */
export async function downloadAllExperimentLogsCsv(): Promise<{
  count: number;
}> {
  const headers = [
    "로그ID",
    "최종수정일시(updated_at)",
    "학년(grade)",
    "반(class_num)",
    "모둠(group_num)",
    "실험모듈ID(experiment_slug)",
    "단원명",
    "실험제목",
    "진행상태(status)",
    "변인수정횟수(revision_count)",
    "AI코칭횟수(ai_feedback_count)",
    "통제변인점검수",
    "통제변인전체수",
    "가상실험조작횟수",
    "실측입력단계수",
    "모둠결론(conclusion)",
    "조작변인_JSON(independent_var)",
    "통제변인_JSON(controlled_vars)",
    "실제측정값_JSON(measured_data)",
    "가상실험기록_JSON(simulation_data)",
  ];

  const rows: string[][] = [headers];
  const db = getScienceLabDb();

  if (db) {
    const [{ data: classesData }, { data: logsData, error }] =
      await Promise.all([
        db.from("classes").select("*"),
        db
          .from("experiment_logs")
          .select("*")
          .order("updated_at", { ascending: false }),
      ]);

    if (!error && logsData) {
      const classMap = new Map<string, DbClassRow>();
      for (const c of (classesData ?? []) as DbClassRow[]) {
        classMap.set(c.id, c);
      }

      for (const log of logsData as DbExperimentLogRow[]) {
        const cls = classMap.get(log.class_id);
        const cfg =
          EXPERIMENT_CONFIGS.find((item) => item.id === log.experiment_slug) ??
          null;
        const checkedCount = Array.isArray(log.controlled_vars)
          ? log.controlled_vars.filter((v) => v.checked).length
          : 0;
        const totalCtrlCount = Array.isArray(log.controlled_vars)
          ? log.controlled_vars.length
          : cfg?.controlledVariables.length ?? 0;
        const simCount = Array.isArray(log.simulation_data)
          ? log.simulation_data.length
          : 0;
        const measuredFilledCount = Array.isArray(log.measured_data)
          ? log.measured_data.filter((m) => m.yValue !== null).length
          : 0;

        rows.push([
          log.id,
          log.updated_at,
          String(cls?.grade ?? cfg?.grade ?? ""),
          String(cls?.class_num ?? ""),
          String(log.group_num),
          log.experiment_slug,
          cfg?.unitName ?? "",
          cfg?.title ?? "",
          log.status,
          String(log.revision_count ?? 0),
          String(log.ai_feedback_count ?? 0),
          String(checkedCount),
          String(totalCtrlCount),
          String(simCount),
          String(measuredFilledCount),
          log.conclusion ?? "",
          JSON.stringify(log.independent_var ?? {}),
          JSON.stringify(log.controlled_vars ?? []),
          JSON.stringify(log.measured_data ?? []),
          JSON.stringify(log.simulation_data ?? []),
        ]);
      }

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      triggerCsvDownload(`science_lab_experiment_logs_${stamp}.csv`, rows);
      return { count: logsData.length };
    }
  }

  // 오프라인 폴백: 로컬 캐시 데이터 CSV 출력
  const localRecords = Object.values(readLocalCache());
  for (const r of localRecords) {
    const cfg = getExperimentConfigById(r.experimentId);
    rows.push([
      r.id ?? r.recordKey,
      r.updatedAt,
      String(r.grade),
      String(r.classNum),
      String(r.groupNum),
      r.experimentId,
      cfg?.unitName ?? "",
      cfg?.title ?? "",
      r.status,
      String(r.revisionCount ?? 0),
      String(r.aiFeedbackCount ?? 0),
      String(r.controlledCheckedIds.length),
      String(cfg?.controlledVariables.length ?? 0),
      String(r.simulationLog?.length ?? 0),
      String(r.dataPoints.filter((d) => d.yValue !== null).length),
      r.conclusion,
      JSON.stringify(cfg?.independentVariables[0] ?? {}),
      JSON.stringify(r.controlledCheckedIds),
      JSON.stringify(r.dataPoints),
      JSON.stringify(r.simulationLog ?? []),
    ]);
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  triggerCsvDownload(`science_lab_experiment_logs_${stamp}.csv`, rows);
  return { count: localRecords.length };
}

/**
 * 연구대회 사전·사후 설문 및 소감 CSV 다운로드 (`science_lab.survey_logs`)
 */
export async function downloadAllSurveyLogsCsv(): Promise<{ count: number }> {
  const headers = [
    "설문ID",
    "제출일시(created_at)",
    "학년",
    "반",
    "익명학생코드(anon_student_code)",
    "설문단계(survey_phase)",
    "실험모듈ID(experiment_slug)",
    "과학흥미도(1~5)",
    "탐구자신감(1~5)",
    "모둠협력만족도(1~5)",
    "학생소감(reflection_text)",
    "기타응답_JSON",
  ];
  const rows: string[][] = [headers];
  const db = getScienceLabDb();

  if (db) {
    const [{ data: classesData }, { data: surveys }] = await Promise.all([
      db.from("classes").select("*"),
      db
        .from("survey_logs")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const classMap = new Map<string, DbClassRow>();
    for (const c of (classesData ?? []) as DbClassRow[]) {
      classMap.set(c.id, c);
    }

    const list = (surveys ?? []) as DbSurveyLogRow[];
    for (const s of list) {
      const cls = s.class_id ? classMap.get(s.class_id) : undefined;
      rows.push([
        s.id,
        s.created_at,
        String(cls?.grade ?? ""),
        String(cls?.class_num ?? ""),
        s.anon_student_code,
        s.survey_phase,
        s.experiment_slug ?? "",
        String(s.interest_score ?? ""),
        String(s.inquiry_confidence_score ?? ""),
        String(s.collaboration_score ?? ""),
        s.reflection_text ?? "",
        JSON.stringify(s.responses ?? {}),
      ]);
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    triggerCsvDownload(`science_lab_survey_logs_${stamp}.csv`, rows);
    return { count: list.length };
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  triggerCsvDownload(`science_lab_survey_logs_${stamp}.csv`, rows);
  return { count: 0 };
}
