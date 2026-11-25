"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AlertCircle,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Delete,
  Download,
  Expand,
  FileSpreadsheet,
  KeyRound,
  LineChart as LineChartIcon,
  Lock,
  Radio,
  RotateCcw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeader } from "@/components/common/AppHeader";
import {
  EXPERIMENT_CONFIGS,
  getExperimentConfigById,
  getExperimentsByGrade,
} from "@/modules/experiments/configs";
import type { GradeLevel, GroupLabRecord } from "@/modules/experiments/types";
import {
  LAB_BROADCAST_CHANNEL,
  downloadAllExperimentLogsCsv,
  downloadAllSurveyLogsCsv,
  fetchClassLabRecords,
  getSupabaseSchemaWarning,
  isTeacherAuthenticated,
  resetClassLabRecords,
  seedDemoClassRecords,
  setTeacherAuthenticated,
  subscribeToClassRealtimeLogs,
  verifyTeacherPinWithDb,
} from "@/lib/lab-client";

const TEACHER_PIN_FALLBACK = process.env.NEXT_PUBLIC_TEACHER_PIN || "1234";
const GRADES: GradeLevel[] = [3, 4, 5, 6];
const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8];
const GROUPS = [1, 2, 3, 4, 5, 6];

const GROUP_COLORS = [
  "#ef4444", // 1모둠: 빨강
  "#f59e0b", // 2모둠: 주황/호박
  "#10b981", // 3모둠: 초록
  "#0ea5e9", // 4모둠: 하늘
  "#6366f1", // 5모둠: 남색
  "#a855f7", // 6모둠: 보라
];

const TEACHER_AUTH_EVENT = "ys-teacher-auth-change";

function subscribeTeacherAuth(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(TEACHER_AUTH_EVENT, onStoreChange);
  return () => window.removeEventListener(TEACHER_AUTH_EVENT, onStoreChange);
}

function getTeacherAuthSnapshot(): boolean {
  return isTeacherAuthenticated();
}

function getServerFalseSnapshot(): boolean {
  return false;
}

export function TeacherDashboard() {
  const authenticated = useSyncExternalStore(
    subscribeTeacherAuth,
    getTeacherAuthSnapshot,
    getServerFalseSnapshot
  );
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);

  // 전담 교사용 학년 / 반 / 단원 필터 상태
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(4);
  const [selectedClass, setSelectedClass] = useState<number>(1);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>(
    () => getExperimentsByGrade(4)[0]?.id ?? EXPERIMENT_CONFIGS[0].id
  );

  const [records, setRecords] = useState<GroupLabRecord[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [lastRealtimeTime, setLastRealtimeTime] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);

  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [spotlightGroup, setSpotlightGroup] = useState<number | null>(null);

  const gradeExperiments = useMemo(
    () => getExperimentsByGrade(selectedGrade),
    [selectedGrade]
  );

  const activeConfig = useMemo(
    () =>
      getExperimentConfigById(selectedExperimentId) ??
      gradeExperiments[0] ??
      EXPERIMENT_CONFIGS[0],
    [selectedExperimentId, gradeExperiments]
  );

  const handleSelectGrade = (grade: GradeLevel) => {
    setSelectedGrade(grade);
    const units = getExperimentsByGrade(grade);
    if (units.length > 0) {
      setSelectedExperimentId(units[0].id);
      setChartType(units[0].dependentVariable.chartType);
    }
    setConfirmReset(false);
  };

  // 초기 조회 + Supabase Realtime(WebSocket) 즉시 반영 + 보조 BroadcastChannel 구독
  useEffect(() => {
    if (!authenticated || !activeConfig) return;
    let cancelled = false;

    const refresh = () => {
      void fetchClassLabRecords(
        activeConfig.id,
        selectedGrade,
        selectedClass
      ).then((list) => {
        if (!cancelled) {
          setRecords(list);
          setSchemaWarning(getSupabaseSchemaWarning());
        }
      });
    };

    refresh();

    let unsubscribeRealtime: (() => void) | null = null;
    void subscribeToClassRealtimeLogs({
      experimentId: activeConfig.id,
      grade: selectedGrade,
      classNum: selectedClass,
      onRecordUpsert: (incoming) => {
        if (cancelled) return;
        setRecords((prev) => {
          const filtered = prev.filter(
            (item) => item.groupNum !== incoming.groupNum
          );
          return [...filtered, incoming].sort(
            (a, b) => a.groupNum - b.groupNum
          );
        });
        setLastRealtimeTime(
          new Date().toLocaleTimeString("ko-KR", { hour12: false })
        );
      },
      onRecordDelete: () => {
        if (!cancelled) {
          refresh();
          setLastRealtimeTime(
            new Date().toLocaleTimeString("ko-KR", { hour12: false })
          );
        }
      },
      onConnectionChange: (connected) => {
        if (!cancelled) {
          setRealtimeConnected(connected);
        }
      },
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
      } else {
        unsubscribeRealtime = cleanup;
      }
    });

    let ch: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      ch = new BroadcastChannel(LAB_BROADCAST_CHANNEL);
      ch.onmessage = () => {
        refresh();
      };
    }

    return () => {
      cancelled = true;
      unsubscribeRealtime?.();
      ch?.close();
    };
  }, [authenticated, activeConfig, selectedGrade, selectedClass]);

  const verifyPin = async (candidate: string) => {
    if (!candidate) return;
    setVerifyingPin(true);
    const ok = await verifyTeacherPinWithDb(
      selectedGrade,
      selectedClass,
      candidate
    );
    setVerifyingPin(false);

    if (ok) {
      setTeacherAuthenticated(true);
      window.dispatchEvent(new Event(TEACHER_AUTH_EVENT));
      setPinError("");
      setPinInput("");
    } else {
      setPinError("관리자 PIN 번호가 일치하지 않습니다. 다시 확인해 주세요.");
      setPinInput("");
    }
  };

  const handleDigitPress = (digit: string) => {
    setPinError("");
    const next = (pinInput + digit).slice(0, 6);
    setPinInput(next);
    if (
      next.length === TEACHER_PIN_FALLBACK.length &&
      next === TEACHER_PIN_FALLBACK
    ) {
      void verifyPin(next);
    }
  };

  const handleSeedDemo = async () => {
    const seeded = await seedDemoClassRecords(
      activeConfig.id,
      selectedGrade,
      selectedClass
    );
    setRecords(seeded);
    setSchemaWarning(getSupabaseSchemaWarning());
    setConfirmReset(false);
  };

  const handleResetClass = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await resetClassLabRecords(activeConfig.id, selectedGrade, selectedClass);
    setRecords([]);
    setConfirmReset(false);
  };

  const handleExportExperimentCsv = async () => {
    const { count } = await downloadAllExperimentLogsCsv();
    setExportNotice(
      `📥 전체 실험 로그 ${count}건을 CSV 파일로 다운로드했습니다.`
    );
    window.setTimeout(() => setExportNotice(null), 4000);
  };

  const handleExportSurveyCsv = async () => {
    const { count } = await downloadAllSurveyLogsCsv();
    setExportNotice(
      `📋 익명 설문·소감 로그 ${count}건을 CSV 파일로 다운로드했습니다.`
    );
    window.setTimeout(() => setExportNotice(null), 4000);
  };

  // 모둠 번호 -> 기록 매핑
  const recordByGroup = useMemo(() => {
    const map = new Map<number, GroupLabRecord>();
    for (const r of records) {
      map.set(r.groupNum, r);
    }
    return map;
  }, [records]);

  // 전체 모둠 통합 Recharts 데이터 구성 (각 x단계별 1~6모둠 값 + 학급 평균)
  const combinedChartData = useMemo(() => {
    const indep = activeConfig.independentVariables[0];
    return indep.presetValues.map((xVal) => {
      const row: Record<string, string | number | null> = {
        stepLabel: `${xVal}${indep.unit}`,
      };
      let sum = 0;
      let count = 0;
      for (const g of GROUPS) {
        const rec = recordByGroup.get(g);
        const pt = rec?.dataPoints.find((d) => d.xValue === xVal);
        const val = pt?.yValue ?? null;
        row[`${g}모둠`] = val;
        if (val !== null && !Number.isNaN(val)) {
          sum += val;
          count += 1;
        }
      }
      row["학급평균"] = count > 0 ? Number((sum / count).toFixed(1)) : null;
      return row;
    });
  }, [activeConfig, recordByGroup]);

  const activeGroupCount = records.filter(
    (r) =>
      r.status !== "ready" ||
      r.dataPoints.some((p) => p.yValue !== null) ||
      r.controlledCheckedIds.length > 0
  ).length;

  const completedGroupCount = records.filter(
    (r) => r.status === "completed"
  ).length;

  const controlledDoneGroupCount = records.filter(
    (r) =>
      activeConfig.controlledVariables.length > 0 &&
      activeConfig.controlledVariables.every((cv) =>
        r.controlledCheckedIds.includes(cv.id)
      )
  ).length;

  const spotlightRecord =
    spotlightGroup !== null ? recordByGroup.get(spotlightGroup) : undefined;

  // 1. 미인증 시 전자칠판 터치 친화형 PIN 잠금 화면 렌더링
  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-950 text-white">
        <AppHeader mode="teacher" />
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300">
              <KeyRound className="h-7 w-7" />
            </div>

            <h1 className="mt-4 text-center text-2xl font-black">
              교사(전자칠판) 모드 입장
            </h1>
            <p className="mt-1.5 text-center text-sm text-slate-400">
              관리자 PIN 번호를 입력하면 우리 반 전체 모둠 실험 대시보드가 열립니다.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verifyPin(pinInput);
              }}
              className="mt-6"
            >
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => {
                  setPinError("");
                  setPinInput(e.target.value);
                }}
                placeholder="PIN 번호 입력"
                className="w-full rounded-2xl border-2 border-slate-700 bg-slate-950 py-3.5 text-center text-2xl font-black tracking-[0.4em] text-amber-300 outline-none focus:border-amber-400"
              />

              {pinError && (
                <p className="mt-2.5 text-center text-xs font-bold text-rose-400">
                  {pinError}
                </p>
              )}

              {/* 전자칠판 터치용 숫자 키패드 */}
              <div className="mt-5 grid grid-cols-3 gap-2.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleDigitPress(num)}
                    className="rounded-2xl bg-slate-800 py-3.5 text-xl font-black text-white transition hover:bg-slate-700 active:scale-95"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPinInput("")}
                  className="rounded-2xl bg-slate-800/70 py-3.5 text-sm font-bold text-slate-300 hover:bg-slate-700"
                >
                  초기화
                </button>
                <button
                  type="button"
                  onClick={() => handleDigitPress("0")}
                  className="rounded-2xl bg-slate-800 py-3.5 text-xl font-black text-white transition hover:bg-slate-700 active:scale-95"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPinInput((prev) => prev.slice(0, -1))}
                  className="flex items-center justify-center rounded-2xl bg-slate-800/70 py-3.5 text-slate-300 hover:bg-slate-700"
                  aria-label="한 글자 지우기"
                >
                  <Delete className="h-5 w-5" />
                </button>
              </div>

              <button
                type="submit"
                disabled={verifyingPin}
                className="mt-5 w-full rounded-2xl bg-amber-400 py-3.5 text-base font-black text-slate-950 shadow-md transition hover:bg-amber-300 disabled:opacity-60"
              >
                {verifyingPin ? "PIN 확인 중..." : "전자칠판 대시보드 열기"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              초기 설정 PIN: <code className="text-slate-300">1234</code> (
              <code>science_lab.classes.teacher_pin</code> 연동)
            </p>
          </div>
        </main>
      </div>
    );
  }

  const indep = activeConfig.independentVariables[0];

  // 2. 인증 완료 시 전자칠판 실시간 통합 대시보드
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <AppHeader mode="teacher" />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {schemaWarning && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{schemaWarning}</span>
          </div>
        )}

        {exportNotice && (
          <div className="rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-extrabold text-white shadow-sm">
            {exportNotice}
          </div>
        )}

        {/* 상단 컨트롤 바: 전담 수업용 학년 / 반 / 단원 전환 + 연구대회 CSV 다운로드 + 시연 도구 */}
        <section className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white shadow-lg sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${
                  realtimeConnected
                    ? "bg-emerald-500/20 text-emerald-300 ring-emerald-400/40"
                    : "bg-sky-500/20 text-sky-300 ring-sky-400/40"
                }`}
              >
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                {realtimeConnected
                  ? "Supabase Realtime 실시간 구독 중 (science_lab)"
                  : "실시간 채널 연결 중"}
              </span>
              {lastRealtimeTime && (
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                  최근 수신: {lastRealtimeTime}
                </span>
              )}
              <span className="text-xs font-bold text-slate-300 sm:text-sm">
                성취기준 {activeConfig.achievementStandard.code} ·{" "}
                {activeConfig.unitName}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExportExperimentCsv()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-black text-white shadow-xs transition hover:bg-emerald-400"
              >
                <Download className="h-3.5 w-3.5" />
                전체 실험 로그 CSV 다운로드
              </button>
              <button
                type="button"
                onClick={() => void handleExportSurveyCsv()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-extrabold text-emerald-200 transition hover:bg-emerald-500/25"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                설문 로그 CSV
              </button>
              <button
                type="button"
                onClick={() => void handleSeedDemo()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-300"
              >
                <Sparkles className="h-3.5 w-3.5" />
                시연용 1~6모둠 예시 채우기
              </button>
              <button
                type="button"
                onClick={() => void handleResetClass()}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                  confirmReset
                    ? "bg-rose-600 text-white"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {confirmReset
                  ? "한 번 더 누르면 초기화됩니다"
                  : "우리 반 기록 초기화"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeacherAuthenticated(false);
                  window.dispatchEvent(new Event(TEACHER_AUTH_EVENT));
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                <Lock className="h-3.5 w-3.5" />
                잠금
              </button>
            </div>
          </div>

          {/* 학년 · 반 · 단원 즉시 전환 필터 */}
          <div className="mt-5 grid gap-4 lg:grid-cols-12">
            {/* 학년 */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-400">
                수업 학년
              </label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handleSelectGrade(g)}
                    className={`rounded-xl py-2 text-sm font-black transition ${
                      selectedGrade === g
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {g}학년
                  </button>
                ))}
              </div>
            </div>

            {/* 반 */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-bold text-slate-400">
                수업 학급 (반 선택)
              </label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                {CLASSES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setSelectedClass(c);
                      setConfirmReset(false);
                    }}
                    className={`rounded-xl py-2 text-xs font-black transition ${
                      selectedClass === c
                        ? "bg-sky-500 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {c}반
                  </button>
                ))}
              </div>
            </div>

            {/* 단원 모듈 선택 */}
            <div className="lg:col-span-5">
              <label className="block text-xs font-bold text-slate-400">
                실험 단원 모듈 ({selectedGrade}학년)
              </label>
              <select
                value={activeConfig.id}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedExperimentId(id);
                  const cfg = getExperimentConfigById(id);
                  if (cfg) setChartType(cfg.dependentVariable.chartType);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-extrabold text-white outline-none focus:border-indigo-400"
              >
                {gradeExperiments.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>
                    [{cfg.semester}학기 {cfg.unitNumber}단원] {cfg.title} (
                    {cfg.achievementStandard.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 학급 실시간 진행 요약 카드 3종 */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500">
                {selectedGrade}학년 {selectedClass}반 참여 모둠
              </div>
              <div className="text-2xl font-black text-slate-900">
                {activeGroupCount}{" "}
                <span className="text-sm font-bold text-slate-400">/ 6모둠</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500">
                통제변인 점검 완료 모둠
              </div>
              <div className="text-2xl font-black text-slate-900">
                {controlledDoneGroupCount}{" "}
                <span className="text-sm font-bold text-slate-400">/ 6모둠</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500">
                실험 결론 제출 완료
              </div>
              <div className="text-2xl font-black text-slate-900">
                {completedGroupCount}{" "}
                <span className="text-sm font-bold text-slate-400">/ 6모둠</span>
              </div>
            </div>
          </div>
        </section>

        {/* 전자칠판 메인: 우리 반 1~6모둠 통합 비교 그래프 */}
        <section className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                📈 {selectedGrade}학년 {selectedClass}반 전체 모둠 실시간 통합 그래프
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                실험 주제: <strong>{activeConfig.title}</strong> · 가로축:{" "}
                {indep.name}({indep.unit}) / 세로축:{" "}
                {activeConfig.dependentVariable.name}(
                {activeConfig.dependentVariable.unit})
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setChartType("line")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                  chartType === "line"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                <LineChartIcon className="h-4 w-4" />
                모둠별 꺾은선 비교
              </button>
              <button
                type="button"
                onClick={() => setChartType("bar")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                  chartType === "bar"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                모둠별 막대 비교
              </button>
            </div>
          </div>

          <div className="mt-5 h-80 w-full min-w-0 sm:h-96">
            {activeGroupCount === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <LineChartIcon className="h-12 w-12 text-slate-300" />
                <p className="mt-3 text-lg font-extrabold text-slate-700">
                  아직 {selectedGrade}학년 {selectedClass}반 모둠에서 입력된 측정값이 없습니다.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  모둠 태블릿에서 값을 저장하거나 상단의{" "}
                  <strong>[시연용 1~6모둠 예시 채우기]</strong> 버튼을 누르면 새로고침 없이 즉시 그래프가 그려집니다!
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <LineChart
                    data={combinedChartData}
                    margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="stepLabel"
                      tick={{ fontSize: 14, fontWeight: 800, fill: "#1e293b" }}
                    />
                    <YAxis
                      unit={activeConfig.dependentVariable.unit}
                      tick={{ fontSize: 13, fontWeight: 700, fill: "#475569" }}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontWeight: 700, paddingTop: 8 }} />
                    {GROUPS.map((g, i) => (
                      <Line
                        key={g}
                        type="monotone"
                        dataKey={`${g}모둠`}
                        stroke={GROUP_COLORS[i]}
                        strokeWidth={3}
                        dot={{ r: 5 }}
                        connectNulls
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="학급평균"
                      stroke="#0f172a"
                      strokeWidth={4}
                      strokeDasharray="6 4"
                      dot={{ r: 6, fill: "#0f172a" }}
                      connectNulls
                    />
                  </LineChart>
                ) : (
                  <BarChart
                    data={combinedChartData}
                    margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="stepLabel"
                      tick={{ fontSize: 14, fontWeight: 800, fill: "#1e293b" }}
                    />
                    <YAxis
                      unit={activeConfig.dependentVariable.unit}
                      tick={{ fontSize: 13, fontWeight: 700, fill: "#475569" }}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontWeight: 700, paddingTop: 8 }} />
                    {GROUPS.map((g, i) => (
                      <Bar
                        key={g}
                        dataKey={`${g}모둠`}
                        fill={GROUP_COLORS[i]}
                        radius={[6, 6, 0, 0]}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 1~6모둠 개별 실시간 현황 카드 그리드 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">
              👥 1~6모둠별 실시간 탐구 현황 및 연구 분석 지표
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              모둠 카드를 누르면 전자칠판 발표용 크게 보기 창이 열립니다.
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {GROUPS.map((groupNum, idx) => {
              const rec = recordByGroup.get(groupNum);
              const status = rec?.status ?? "ready";
              const filled =
                rec?.dataPoints.filter((d) => d.yValue !== null).length ?? 0;
              const totalSteps = indep.presetValues.length;
              const checkedVars = rec?.controlledCheckedIds.length ?? 0;
              const totalVars = activeConfig.controlledVariables.length;

              return (
                <div
                  key={groupNum}
                  onClick={() => setSpotlightGroup(groupNum)}
                  className="group cursor-pointer rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-2xs transition hover:border-indigo-400 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        style={{ backgroundColor: GROUP_COLORS[idx] }}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white shadow-2xs"
                      >
                        {groupNum}
                      </span>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          {groupNum}모둠
                        </h3>
                        <span className="text-[11px] font-bold text-slate-500">
                          통제변인 {checkedVars}/{totalVars} · 수정{" "}
                          {rec?.revisionCount ?? 0}회
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {status === "completed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          실험 완료
                        </span>
                      ) : status === "measuring" || filled > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold text-sky-800">
                          <Clock className="h-3.5 w-3.5" />
                          측정 중 ({filled}/{totalSteps})
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                          입장 대기
                        </span>
                      )}
                      <Expand className="h-4 w-4 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </div>

                  {/* 연구대회 로그 요약 태그 */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700">
                      <Bot className="h-3 w-3" />
                      AI 코칭 {rec?.aiFeedbackCount ?? 0}회
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                      가상실험 {rec?.simulationLog?.length ?? 0}회
                    </span>
                  </div>

                  {/* 측정값 요약 칩 */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                    {indep.presetValues.map((xVal) => {
                      const pt = rec?.dataPoints.find((d) => d.xValue === xVal);
                      const hasVal =
                        pt?.yValue !== undefined && pt?.yValue !== null;
                      return (
                        <div
                          key={xVal}
                          className={`rounded-xl border p-2 text-center ${
                            hasVal
                              ? "border-slate-200 bg-slate-50"
                              : "border-dashed border-slate-200 bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold text-slate-400">
                            {xVal}
                            {indep.unit}
                          </div>
                          <div
                            className={`mt-0.5 text-xs font-black ${
                              hasVal ? "text-slate-900" : "text-slate-300"
                            }`}
                          >
                            {hasVal
                              ? `${pt?.yValue}${activeConfig.dependentVariable.unit}`
                              : "-"}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 모둠 결론 요약 */}
                  <div className="mt-3.5 rounded-2xl bg-slate-50 p-3 text-xs">
                    {rec?.conclusion ? (
                      <p className="line-clamp-2 font-semibold text-slate-800">
                        💬 &ldquo;{rec.conclusion}&rdquo;
                      </p>
                    ) : (
                      <p className="text-slate-400">
                        아직 작성된 실험 결론이 없습니다.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* 전자칠판 모둠 발표 확대 모달 */}
      {spotlightGroup !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  style={{
                    backgroundColor: GROUP_COLORS[spotlightGroup - 1],
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black text-white"
                >
                  {spotlightGroup}
                </span>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {selectedGrade}학년 {selectedClass}반 {spotlightGroup}모둠 탐구 발표
                  </h3>
                  <p className="text-sm font-medium text-slate-500">
                    {activeConfig.title} · 변인 수정{" "}
                    {spotlightRecord?.revisionCount ?? 0}회 · AI 코칭{" "}
                    {spotlightRecord?.aiFeedbackCount ?? 0}회
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSpotlightGroup(null)}
                className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-center text-sm">
                <thead className="bg-slate-100 font-extrabold text-slate-700">
                  <tr>
                    <th className="px-3 py-2.5">조작변인 단계</th>
                    {indep.presetValues.map((v) => (
                      <th key={v} className="px-3 py-2.5">
                        {v}
                        {indep.unit}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200 font-black text-slate-900">
                    <td className="bg-slate-50 px-3 py-3 text-xs font-bold text-slate-600">
                      {activeConfig.dependentVariable.name}
                    </td>
                    {indep.presetValues.map((v) => {
                      const pt = spotlightRecord?.dataPoints.find(
                        (d) => d.xValue === v
                      );
                      return (
                        <td key={v} className="px-3 py-3 text-base">
                          {pt?.yValue !== null && pt?.yValue !== undefined
                            ? `${pt.yValue}${activeConfig.dependentVariable.unit}`
                            : "-"}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-5 rounded-2xl border-2 border-indigo-100 bg-indigo-50/70 p-5">
              <div className="text-xs font-extrabold text-indigo-600">
                우리 모둠이 찾은 규칙성 (결론)
              </div>
              <p className="mt-2 text-lg font-extrabold text-slate-900">
                {spotlightRecord?.conclusion
                  ? `“${spotlightRecord.conclusion}”`
                  : "아직 결론을 작성하고 있어요."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
