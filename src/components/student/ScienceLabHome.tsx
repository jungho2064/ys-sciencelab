"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  CheckCircle2,
  Flame,
  FlaskConical,
  Magnet,
  MonitorPlay,
  Rocket,
  Scale,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import { AppHeader } from "@/components/common/AppHeader";
import {
  EXPERIMENT_CONFIGS,
  getExperimentConfigById,
  getExperimentsByGrade,
} from "@/modules/experiments/configs";
import {
  DynamicExperimentHost,
  hasDynamicExperimentModule,
} from "@/modules/experiments/registry";
import type {
  ExperimentConfig,
  GradeLevel,
  GroupLabRecord,
  GroupLabRecordPatch,
  StudentSession,
} from "@/modules/experiments/types";
import {
  LAB_BROADCAST_CHANNEL,
  buildRecordKey,
  createInitialGroupRecord,
  fetchClassLabRecords,
  saveStudentSession,
  subscribeToClassRealtimeLogs,
  upsertGroupLabRecord,
} from "@/lib/lab-client";

const SESSION_STORAGE_EVENT = "ys-student-session-change";
const STUDENT_SESSION_STORAGE_KEY = "ys_sciencelab_student_session_v1";

function subscribeStudentSession(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SESSION_STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SESSION_STORAGE_EVENT, onStoreChange);
  };
}

function getStudentSessionRawSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STUDENT_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerNullSnapshot(): null {
  return null;
}

const GRADES: GradeLevel[] = [3, 4, 5, 6];
const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8];
const GROUPS = [1, 2, 3, 4, 5, 6];

const GRADE_STYLE: Record<
  GradeLevel,
  {
    label: string;
    desc: string;
    activeTab: string;
    cardBorder: string;
    badge: string;
  }
> = {
  3: {
    label: "3학년",
    desc: "기초 탐구와 호기심 출발!",
    activeTab: "bg-amber-500 text-white shadow-md shadow-amber-200",
    cardBorder: "hover:border-amber-400",
    badge: "bg-amber-100 text-amber-800",
  },
  4: {
    label: "4학년",
    desc: "관찰과 측정으로 규칙 찾기!",
    activeTab: "bg-sky-500 text-white shadow-md shadow-sky-200",
    cardBorder: "hover:border-sky-400",
    badge: "bg-sky-100 text-sky-800",
  },
  5: {
    label: "5학년",
    desc: "변인 통제와 공정한 실험!",
    activeTab: "bg-emerald-600 text-white shadow-md shadow-emerald-200",
    cardBorder: "hover:border-emerald-400",
    badge: "bg-emerald-100 text-emerald-800",
  },
  6: {
    label: "6학년",
    desc: "자료 해석과 과학적 결론 도출!",
    activeTab: "bg-violet-600 text-white shadow-md shadow-violet-200",
    cardBorder: "hover:border-violet-400",
    badge: "bg-violet-100 text-violet-800",
  },
};

function UnitIcon({ name }: { name: ExperimentConfig["iconName"] }) {
  switch (name) {
    case "Scale":
      return <Scale className="h-6 w-6" />;
    case "Sun":
      return <Sun className="h-6 w-6" />;
    case "Flame":
      return <Flame className="h-6 w-6" />;
    case "Magnet":
      return <Magnet className="h-6 w-6" />;
    case "FlaskConical":
      return <FlaskConical className="h-6 w-6" />;
    default:
      return <Sparkles className="h-6 w-6" />;
  }
}

export function ScienceLabHome() {
  const rawSession = useSyncExternalStore(
    subscribeStudentSession,
    getStudentSessionRawSnapshot,
    getServerNullSnapshot
  );

  const studentSession = useMemo<StudentSession | null>(() => {
    if (!rawSession) return null;
    try {
      return JSON.parse(rawSession) as StudentSession;
    } catch {
      return null;
    }
  }, [rawSession]);

  const [showEntryModal, setShowEntryModal] = useState<boolean>(false);

  // 빠른 모둠 입장 선택 상태
  const [draftGrade, setDraftGrade] = useState<GradeLevel>(4);
  const [draftClass, setDraftClass] = useState<number>(1);
  const [draftGroup, setDraftGroup] = useState<number>(1);

  // 메인 화면 학년 탭 (수동 선택 시 우선, 미선택 시 입장 학년 기준)
  const [manualGradeTab, setManualGradeTab] = useState<GradeLevel | null>(null);
  const selectedGradeTab: GradeLevel =
    manualGradeTab ?? studentSession?.grade ?? 4;

  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(
    null
  );
  const [pendingExperimentId, setPendingExperimentId] = useState<string | null>(
    null
  );
  const [groupRecord, setGroupRecord] = useState<GroupLabRecord | null>(null);

  // 선택된 실험과 학생 세션에 맞는 기록 비동기 로드 및 BroadcastChannel 구독
  useEffect(() => {
    if (!activeExperimentId || !studentSession) return;
    const cfg = getExperimentConfigById(activeExperimentId);
    if (!cfg) return;

    let cancelled = false;
    const targetKey = buildRecordKey(
      activeExperimentId,
      studentSession.grade,
      studentSession.classNum,
      studentSession.groupNum
    );

    const loadLatest = () => {
      void fetchClassLabRecords(
        activeExperimentId,
        studentSession.grade,
        studentSession.classNum
      ).then((records) => {
        if (cancelled) return;
        const found = records.find((r) => r.recordKey === targetKey);
        setGroupRecord(found ?? createInitialGroupRecord(cfg, studentSession));
      });
    };

    loadLatest();

    let unsubscribeRealtime: (() => void) | null = null;
    void subscribeToClassRealtimeLogs({
      experimentId: activeExperimentId,
      grade: studentSession.grade,
      classNum: studentSession.classNum,
      onRecordUpsert: (incoming) => {
        if (!cancelled && incoming.groupNum === studentSession.groupNum) {
          setGroupRecord(incoming);
        }
      },
      onRecordDelete: () => {
        if (!cancelled) {
          setGroupRecord(createInitialGroupRecord(cfg, studentSession));
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
        loadLatest();
      };
    }

    return () => {
      cancelled = true;
      unsubscribeRealtime?.();
      ch?.close();
    };
  }, [activeExperimentId, studentSession]);

  const handleConfirmEntry = () => {
    const nextSession: StudentSession = {
      grade: draftGrade,
      classNum: draftClass,
      groupNum: draftGroup,
    };
    saveStudentSession(nextSession);
    window.dispatchEvent(new Event(SESSION_STORAGE_EVENT));
    setManualGradeTab(draftGrade);
    setShowEntryModal(false);

    if (pendingExperimentId) {
      setActiveExperimentId(pendingExperimentId);
      setPendingExperimentId(null);
    }
  };

  const handleSelectExperiment = (cfg: ExperimentConfig) => {
    if (!studentSession) {
      setDraftGrade(cfg.grade);
      setPendingExperimentId(cfg.id);
      setShowEntryModal(true);
      return;
    }
    const initial = createInitialGroupRecord(cfg, studentSession);
    setGroupRecord(initial);
    setActiveExperimentId(cfg.id);
  };

  const handleUpdateRecord = useCallback((patch: GroupLabRecordPatch) => {
    setGroupRecord((prev) => {
      if (!prev) return prev;
      const updated: GroupLabRecord = {
        ...prev,
        ...patch,
      };
      void upsertGroupLabRecord(updated);
      return updated;
    });
  }, []);

  const activeConfig = activeExperimentId
    ? getExperimentConfigById(activeExperimentId)
    : undefined;
  const canRenderModule =
    Boolean(activeExperimentId) &&
    hasDynamicExperimentModule(activeExperimentId ?? "");

  const gradeExperiments = getExperimentsByGrade(selectedGradeTab);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        mode="student"
        studentSession={studentSession}
        onEditStudentSession={() => {
          if (studentSession) {
            setDraftGrade(studentSession.grade);
            setDraftClass(studentSession.classNum);
            setDraftGroup(studentSession.groupNum);
          }
          setShowEntryModal(true);
        }}
        onGoHomeUnitList={() => setActiveExperimentId(null)}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* 활성 실험 단원이 선택된 경우: 동적 플러그인 모듈 렌더링 */}
        {activeConfig &&
        activeExperimentId &&
        canRenderModule &&
        studentSession &&
        groupRecord ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveExperimentId(null)}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                학년·단원 선택 화면으로 돌아가기
              </button>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-xs font-bold text-indigo-700">
                <Blocks className="h-3.5 w-3.5" />
                동적 플러그인 로드됨: <code>{activeConfig.id}</code>
              </span>
            </div>

            <DynamicExperimentHost
              experimentId={activeExperimentId}
              config={activeConfig}
              studentSession={studentSession}
              groupRecord={groupRecord}
              onUpdateRecord={handleUpdateRecord}
            />
          </div>
        ) : (
          /* 메인 허브 화면: 1) 학생 빠른 모둠 입장 + 교사 모드 안내, 2) 학년별(3~6학년) 단원 선택 */
          <div className="space-y-8">
            {/* 상단 히어로 & 빠른 입장 배너 */}
            <section className="grid gap-5 lg:grid-cols-12">
              {/* 학생 빠른 입장 카드 */}
              <div className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-600 via-indigo-600 to-sky-500 p-6 text-white shadow-lg sm:p-8 lg:col-span-8">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-xs font-extrabold backdrop-blur-xs">
                  <Rocket className="h-3.5 w-3.5" />
                  회원가입·비밀번호 없이 3초 만에 수업 시작!
                </div>

                <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl">
                  안녕! 오늘 우리 모둠의 과학 실험을 시작해 볼까요?
                </h1>
                <p className="mt-2 text-sm font-medium text-indigo-100 sm:text-base">
                  학년, 반, 모둠만 선택하면 측정한 실험 기록과 그래프가 선생님 전자칠판으로 실시간 연결됩니다.
                </p>

                {studentSession ? (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/15 p-4 backdrop-blur-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-xs">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-100">
                          현재 입장한 우리 모둠
                        </div>
                        <div className="text-xl font-black">
                          {studentSession.grade}학년 {studentSession.classNum}반{" "}
                          {studentSession.groupNum}모둠
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftGrade(studentSession.grade);
                        setDraftClass(studentSession.classNum);
                        setDraftGroup(studentSession.groupNum);
                        setShowEntryModal(true);
                      }}
                      className="rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-indigo-700 shadow-xs transition hover:bg-indigo-50"
                    >
                      학년·반·모둠 다시 고르기
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl bg-white p-4 text-slate-900 shadow-md sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                      {/* 학년 */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-500">
                          1. 학년 선택
                        </label>
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                          {GRADES.map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                setDraftGrade(g);
                                setManualGradeTab(g);
                              }}
                              className={`rounded-xl py-2 text-sm font-extrabold transition ${
                                draftGrade === g
                                  ? "bg-indigo-600 text-white shadow-2xs"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              {g}학년
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 반 */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-500">
                          2. 반 선택
                        </label>
                        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                          {CLASSES.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setDraftClass(c)}
                              className={`rounded-xl py-2 text-xs font-extrabold transition ${
                                draftClass === c
                                  ? "bg-indigo-600 text-white shadow-2xs"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              {c}반
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 모둠 */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-500">
                          3. 모둠 선택 (1~6모둠)
                        </label>
                        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                          {GROUPS.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setDraftGroup(m)}
                              className={`rounded-xl py-2 text-xs font-extrabold transition ${
                                draftGroup === m
                                  ? "bg-emerald-600 text-white shadow-2xs"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              {m}모둠
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmEntry}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-base font-black text-white shadow-md transition hover:bg-indigo-700 active:scale-[0.99]"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      {draftGrade}학년 {draftClass}반 {draftGroup}모둠으로 즉시 입장하기!
                    </button>
                  </div>
                )}
              </div>

              {/* 교사(전자칠판) 모드 안내 카드 */}
              <div className="flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-slate-900 p-6 text-white shadow-lg sm:p-7 lg:col-span-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-extrabold text-amber-300">
                    <MonitorPlay className="h-3.5 w-3.5" />
                    선생님 전용 · 전자칠판 대시보드
                  </span>
                  <h2 className="mt-3 text-xl font-black sm:text-2xl">
                    우리 반 1~6모둠 실험 결과를 한 화면에 비교해요
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    관리자 PIN 번호로 입장하면 모둠별 변인 통제 점검 여부, 실시간 측정 그래프, 실험 결론을 전자칠판에서 즉시 비교할 수 있습니다.
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl bg-slate-800/90 p-3.5 text-xs text-slate-300">
                    <div className="font-bold text-amber-300">
                      플러그인 확장형 구조 안내
                    </div>
                    <p className="mt-1">
                      현재 등록된 실험 모듈:{" "}
                      <strong className="text-white">
                        3~6학년 총 {EXPERIMENT_CONFIGS.length}개 단원
                      </strong>{" "}
                      (<code>src/modules/experiments/</code>에 폴더만 추가하면 자동 확장)
                    </p>
                  </div>

                  <Link
                    href="/teacher"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-sm font-black text-slate-950 shadow-sm transition hover:bg-amber-300"
                  >
                    <MonitorPlay className="h-4 w-4" />
                    교사(전자칠판) 대시보드 열기
                  </Link>
                </div>
              </div>
            </section>

            {/* 학년 선택 탭 & 단원 플러그인 카드 목록 */}
            <section className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                    🔬 학년별 과학 실험 단원 선택
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    학년과 단원을 선택하면 해당 실험 모듈이 동적으로 불러와집니다.
                  </p>
                </div>
              </div>

              {/* 3~6학년 탭 버튼 */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {GRADES.map((g) => {
                  const style = GRADE_STYLE[g];
                  const count = getExperimentsByGrade(g).length;
                  const isSelected = selectedGradeTab === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setManualGradeTab(g)}
                      className={`flex flex-col items-start rounded-2xl border-2 p-4 text-left transition ${
                        isSelected
                          ? `${style.activeTab} border-transparent`
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-lg font-black">{style.label}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                            isSelected
                              ? "bg-white/25 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {count}개 단원
                        </span>
                      </div>
                      <span
                        className={`mt-1 text-xs font-medium ${
                          isSelected ? "text-white/90" : "text-slate-500"
                        }`}
                      >
                        {style.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 선택된 학년의 실험 단원 카드 그리드 */}
              <div className="grid gap-5 md:grid-cols-2">
                {gradeExperiments.map((cfg) => {
                  const gStyle = GRADE_STYLE[cfg.grade];
                  return (
                    <div
                      key={cfg.id}
                      className={`group flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-xs transition ${gStyle.cardBorder} hover:shadow-md`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-xl px-3 py-1 text-xs font-extrabold ${gStyle.badge}`}
                            >
                              {cfg.grade}학년 {cfg.semester}학기 ·{" "}
                              {cfg.unitNumber}단원 {cfg.unitName}
                            </span>
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                              {cfg.achievementStandard.code}
                            </span>
                          </div>
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${gStyle.badge}`}
                          >
                            <UnitIcon name={cfg.iconName} />
                          </div>
                        </div>

                        <h3 className="mt-4 text-xl font-black text-slate-900">
                          {cfg.title}
                        </h3>
                        <p className="mt-1.5 text-sm font-medium text-slate-600">
                          {cfg.subtitle}
                        </p>

                        {/* 조작변인 / 통제변인 요약 배지 */}
                        <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3.5 text-xs">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-extrabold text-indigo-800">
                              조작변인
                            </span>
                            <span className="font-bold text-slate-800">
                              {cfg.independentVariables
                                .map((v) => `${v.name}(${v.unit})`)
                                .join(", ")}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-extrabold text-emerald-800">
                              통제변인
                            </span>
                            <span className="font-medium text-slate-600">
                              {cfg.controlledVariables
                                .map((v) => v.name)
                                .join(" · ")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectExperiment(cfg)}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-extrabold text-white transition group-hover:bg-indigo-600"
                      >
                        이 단원 실험실 입장하기
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* 모둠 선택/변경 모달 */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
            <h3 className="text-xl font-black text-slate-900">
              🎒 우리 학년 · 반 · 모둠 선택
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              비밀번호 없이 내 모둠만 고르면 바로 실험을 시작할 수 있어요!
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-600">
                  학년 선택
                </label>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setDraftGrade(g)}
                      className={`rounded-xl py-2.5 text-sm font-extrabold ${
                        draftGrade === g
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {g}학년
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600">
                  반 선택
                </label>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {CLASSES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraftClass(c)}
                      className={`rounded-xl py-2 text-sm font-extrabold ${
                        draftClass === c
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {c}반
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600">
                  모둠 선택 (1~6모둠)
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {GROUPS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDraftGroup(m)}
                      className={`rounded-xl py-2.5 text-sm font-extrabold ${
                        draftGroup === m
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {m}모둠
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowEntryModal(false);
                  setPendingExperimentId(null);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmEntry}
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700"
              >
                {draftGrade}학년 {draftClass}반 {draftGroup}모둠으로 입장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
