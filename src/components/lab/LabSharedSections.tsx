"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  CloudUpload,
  Lightbulb,
  MessageSquareHeart,
  Send,
  Sliders,
  Sparkles,
  Star,
} from "lucide-react";
import type {
  ExperimentConfig,
  GroupLabRecord,
  GroupLabRecordPatch,
  LabProgressStatus,
  StudentSession,
  ThemeColor,
} from "@/modules/experiments/types";
import { submitStudentSurveyLog } from "@/lib/lab-client";

export const MAX_COACH_CALLS = 5;

export const LAB_THEME_STYLES: Record<
  ThemeColor,
  {
    badgeBg: string;
    badgeText: string;
    headerGradient: string;
    accentText: string;
    buttonBg: string;
    chartHex: string;
    softBorder: string;
  }
> = {
  amber: {
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    headerGradient: "from-amber-500 to-orange-500",
    accentText: "text-amber-700",
    buttonBg: "bg-amber-500 hover:bg-amber-600",
    chartHex: "#f59e0b",
    softBorder: "border-amber-200",
  },
  sky: {
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-800",
    headerGradient: "from-sky-500 to-blue-600",
    accentText: "text-sky-700",
    buttonBg: "bg-sky-500 hover:bg-sky-600",
    chartHex: "#0284c7",
    softBorder: "border-sky-200",
  },
  emerald: {
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    headerGradient: "from-emerald-500 to-teal-600",
    accentText: "text-emerald-700",
    buttonBg: "bg-emerald-500 hover:bg-emerald-600",
    chartHex: "#059669",
    softBorder: "border-emerald-200",
  },
  violet: {
    badgeBg: "bg-violet-100",
    badgeText: "text-violet-800",
    headerGradient: "from-violet-500 to-purple-600",
    accentText: "text-violet-700",
    buttonBg: "bg-violet-500 hover:bg-violet-600",
    chartHex: "#7c3aed",
    softBorder: "border-violet-200",
  },
};

export function ExperimentHeaderAndSafety({
  config,
  studentSession,
  groupRecord,
}: {
  config: ExperimentConfig;
  studentSession: StudentSession;
  groupRecord: GroupLabRecord;
}) {
  const theme = LAB_THEME_STYLES[config.themeColor];

  return (
    <>
      <section
        className={`rounded-3xl bg-gradient-to-r ${theme.headerGradient} p-6 text-white shadow-lg sm:p-8`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/25 px-3.5 py-1 text-sm font-bold backdrop-blur-xs">
              {config.grade}학년 {config.semester}학기 · {config.unitNumber}단원{" "}
              {config.unitName}
            </span>
            <span className="rounded-full bg-slate-900/30 px-3 py-1 text-xs font-semibold">
              성취기준 {config.achievementStandard.code}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur-xs">
              <CloudUpload className="h-3.5 w-3.5" />
              실시간 자동 저장 (수정 {groupRecord.revisionCount ?? 0}회 · 코칭{" "}
              {groupRecord.aiFeedbackCount ?? 0}/{MAX_COACH_CALLS}회)
            </span>
            <div className="rounded-2xl bg-white/20 px-4 py-1.5 text-sm font-bold backdrop-blur-xs">
              {studentSession.grade}학년 {studentSession.classNum}반{" "}
              {studentSession.groupNum}모둠
            </div>
          </div>
        </div>

        <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {config.title}
        </h2>
        <p className="mt-1.5 text-base font-medium text-white/95 sm:text-lg">
          {config.subtitle}
        </p>
        <p className="mt-3 rounded-xl bg-black/15 px-3.5 py-2 text-xs text-white/90 sm:text-sm">
          🎯 학습 목표: {config.achievementStandard.description}
        </p>
      </section>

      {config.safetyNotes.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/90 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-amber-200/80 p-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-amber-900">
                실험 전 꼭 지키는 안전 약속!
              </h3>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-amber-800">
                {config.safetyNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export function VariableControlSection({
  config,
  groupRecord,
  onUpdateRecord,
}: {
  config: ExperimentConfig;
  groupRecord: GroupLabRecord;
  onUpdateRecord: (patch: GroupLabRecordPatch) => void;
}) {
  const theme = LAB_THEME_STYLES[config.themeColor];
  const filledCount = groupRecord.dataPoints.filter(
    (d) => d.yValue !== null && !Number.isNaN(d.yValue)
  ).length;

  const allControlledChecked =
    config.controlledVariables.length > 0 &&
    config.controlledVariables.every((c) =>
      groupRecord.controlledCheckedIds.includes(c.id)
    );

  const toggleControlled = (id: string) => {
    const exists = groupRecord.controlledCheckedIds.includes(id);
    const nextIds = exists
      ? groupRecord.controlledCheckedIds.filter((item) => item !== id)
      : [...groupRecord.controlledCheckedIds, id];

    const nextStatus: LabProgressStatus =
      groupRecord.status === "completed"
        ? "completed"
        : filledCount > 0 || nextIds.length > 0
          ? "measuring"
          : "ready";

    onUpdateRecord({
      controlledCheckedIds: nextIds,
      revisionCount: (groupRecord.revisionCount ?? 0) + 1,
      status: nextStatus,
    });
  };

  return (
    <section className="grid gap-5 lg:grid-cols-12">
      <div
        className={`rounded-3xl border-2 ${theme.softBorder} bg-white p-5 shadow-xs lg:col-span-5`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-xl ${theme.badgeBg} ${theme.badgeText} px-3 py-1 text-sm font-extrabold`}
          >
            <Sliders className="h-4 w-4" />
            다르게 해야 할 조건 (조작변인)
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {config.independentVariables.map((iv) => (
            <div
              key={iv.id}
              className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-extrabold text-slate-900">
                  {iv.name}
                </span>
                <span className="rounded-lg bg-white px-2.5 py-0.5 text-xs font-bold text-slate-600 shadow-2xs">
                  단위: {iv.unit}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-600">{iv.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {iv.presetValues.map((v) => (
                  <span
                    key={v}
                    className={`rounded-lg ${theme.badgeBg} ${theme.badgeText} px-2.5 py-1 text-xs font-bold`}
                  >
                    {v}
                    {iv.unit}
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="text-xs font-bold text-indigo-600">
              측정할 실험 결과 (종속변인)
            </div>
            <div className="mt-1 text-base font-extrabold text-indigo-950">
              📏 {config.dependentVariable.name} (
              {config.dependentVariable.unit})
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-emerald-200 bg-white p-5 shadow-xs lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-1 text-sm font-extrabold text-emerald-800">
            <ClipboardCheck className="h-4 w-4" />
            같게 해야 할 조건 (통제변인 체크!)
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${
              allControlledChecked
                ? "bg-emerald-500 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {allControlledChecked
              ? "✨ 공정한 실험 준비 완료!"
              : `${groupRecord.controlledCheckedIds.length} / ${config.controlledVariables.length} 확인됨`}
          </span>
        </div>

        <p className="mt-2 text-xs text-slate-500 sm:text-sm">
          모둠 친구들과 함께 아래 조건을 똑같게 맞추었는지 하나씩 눌러 확인해 보세요.
        </p>

        <div className="mt-3.5 space-y-2.5">
          {config.controlledVariables.map((cv) => {
            const checked = groupRecord.controlledCheckedIds.includes(cv.id);
            return (
              <button
                key={cv.id}
                type="button"
                onClick={() => toggleControlled(cv.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-all ${
                  checked
                    ? "border-emerald-400 bg-emerald-50/70 shadow-2xs"
                    : "border-slate-200 bg-slate-50/60 hover:border-emerald-200 hover:bg-white"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                    checked
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{cv.name}</span>
                    <span className="rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      기준: {cv.fixedValue}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{cv.checkLabel}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function AiCoachAndConclusionSection({
  config,
  studentSession,
  groupRecord,
  onUpdateRecord,
  controlViolations = [],
  activeSimulationSettings,
}: {
  config: ExperimentConfig;
  studentSession: StudentSession;
  groupRecord: GroupLabRecord;
  onUpdateRecord: (patch: GroupLabRecordPatch) => void;
  controlViolations?: string[];
  activeSimulationSettings?: Record<string, unknown>;
}) {
  const theme = LAB_THEME_STYLES[config.themeColor];
  const [coachingLoading, setCoachingLoading] = useState<boolean>(false);
  const [aiCoachingMessage, setAiCoachingMessage] = useState<string | null>(
    null
  );
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const [submitBanner, setSubmitBanner] = useState<boolean>(false);

  const usedCount = groupRecord.aiFeedbackCount ?? 0;
  const remainingCount = Math.max(0, MAX_COACH_CALLS - usedCount);
  const limitReached = usedCount >= MAX_COACH_CALLS;
  const filledCount = groupRecord.dataPoints.filter(
    (d) => d.yValue !== null && !Number.isNaN(d.yValue)
  ).length;

  const handleRequestAiCoaching = async () => {
    if (limitReached || coachingLoading) return;
    setCoachingLoading(true);
    setCoachingError(null);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId: config.id,
          grade: studentSession.grade,
          classNum: studentSession.classNum,
          groupNum: studentSession.groupNum,
          clientFeedbackCount: usedCount,
          controlledCheckedIds: groupRecord.controlledCheckedIds,
          controlViolations,
          activeSimulationSettings,
          simulationLog: groupRecord.simulationLog ?? [],
          measuredData: groupRecord.dataPoints,
          conclusion: groupRecord.conclusion,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        limitReached?: boolean;
        feedback?: string;
        aiFeedbackCount?: number;
        message?: string;
      };

      if (typeof data.aiFeedbackCount === "number") {
        onUpdateRecord({ aiFeedbackCount: data.aiFeedbackCount });
      }

      if (!res.ok || !data.ok) {
        setCoachingError(
          data.message ?? "AI 탐구 코칭을 불러오는 중 문제가 발생했어요."
        );
        return;
      }

      setAiCoachingMessage(data.feedback ?? null);
    } catch {
      setCoachingError(
        "네트워크 상태를 확인한 뒤 다시 AI 탐구 코칭을 눌러 주세요."
      );
    } finally {
      setCoachingLoading(false);
    }
  };

  const handleCompleteSubmit = () => {
    onUpdateRecord({ status: "completed" });
    setSubmitBanner(true);
    window.setTimeout(() => setSubmitBanner(false), 3500);
  };

  return (
    <section className="rounded-3xl border-2 border-indigo-200 bg-white p-5 shadow-xs sm:p-6">
      {/* AI 탐구 코치 안내 및 호출 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-indigo-50/80 p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              💡 탐구 힌트: {config.inquiryTip}
            </p>
            <p className="mt-0.5 text-xs font-medium text-indigo-700/80">
              AI 탐구 코치(Gemini Flash)는 정답을 바로 알려주지 않고 질문으로 생각을 도와줘요! (1차시 최대 {MAX_COACH_CALLS}회)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-xl px-2.5 py-1.5 text-xs font-extrabold ${
              limitReached
                ? "bg-rose-100 text-rose-700"
                : "bg-white text-indigo-700 border border-indigo-200"
            }`}
          >
            남은 코칭: {remainingCount}/{MAX_COACH_CALLS}회
          </span>
          <button
            type="button"
            disabled={limitReached || coachingLoading}
            onClick={() => void handleRequestAiCoaching()}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white shadow-2xs transition ${
              limitReached
                ? "cursor-not-allowed bg-slate-400"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            <Bot className="h-4 w-4" />
            {coachingLoading
              ? "생각 힌트 만드는 중..."
              : limitReached
                ? "코칭 5회 모두 사용"
                : "AI 탐구 코칭 받기"}
          </button>
        </div>
      </div>

      {aiCoachingMessage && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 p-4 text-sm font-bold text-indigo-950">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-indigo-600">
              AI 탐구 코치의 생각 질문 ({usedCount}/{MAX_COACH_CALLS}회)
            </div>
            <p className="mt-1 text-base leading-relaxed">{aiCoachingMessage}</p>
          </div>
        </div>
      )}

      {coachingError && (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          ⚠️ {coachingError}
        </div>
      )}

      <div className="mt-4">
        <label
          htmlFor="group-conclusion"
          className="block text-base font-extrabold text-slate-900"
        >
          🔎 실험 결과에서 찾은 규칙성 (우리 모둠의 결론)
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          측정한 숫자(온도, 숟가락 수, 길이 등)를 꼭 넣어서 우리 모둠의 결론을 적어 보세요!
        </p>
        <textarea
          id="group-conclusion"
          rows={2}
          placeholder="예) 물의 온도가 20°C일 때는 2숟가락, 80°C일 때는 8숟가락이 녹아 온도가 높을수록 설탕이 더 많이 용해됩니다."
          value={groupRecord.conclusion}
          onChange={(e) =>
            onUpdateRecord({
              conclusion: e.target.value,
              status:
                groupRecord.status === "completed" ? "completed" : "measuring",
            })
          }
          className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-3.5 text-base font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-500 sm:text-sm">
          {groupRecord.status === "completed" ? (
            <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              선생님 전자칠판(Supabase Realtime)에 실험 완료 상태로 전송되었습니다!
            </span>
          ) : (
            <span>
              측정값 입력: {filledCount}/{groupRecord.dataPoints.length}단계 완료
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCompleteSubmit}
          className={`inline-flex items-center gap-2 rounded-2xl ${theme.buttonBg} px-6 py-3 text-base font-extrabold text-white shadow-md transition active:scale-[0.98]`}
        >
          <Send className="h-4 w-4" />
          {groupRecord.status === "completed"
            ? "실험 결과 다시 저장하기"
            : "실험 완료! 선생님 칠판으로 보내기"}
        </button>
      </div>

      {submitBanner && (
        <div className="mt-3 rounded-2xl bg-emerald-500 px-4 py-2.5 text-center text-sm font-extrabold text-white shadow-xs">
          🎉 짝짝짝! {studentSession.groupNum}모둠의 실험 그래프와 결론이 전자칠판에 실시간 반영되었어요!
        </div>
      )}
    </section>
  );
}

export function AnonymousSurveySection({
  config,
  studentSession,
}: {
  config: ExperimentConfig;
  studentSession: StudentSession;
}) {
  const [anonCode, setAnonCode] = useState<string>(
    `G${studentSession.grade}C${studentSession.classNum}-M${studentSession.groupNum}-`
  );
  const [surveyPhase, setSurveyPhase] = useState<"pre" | "post" | "reflection">(
    "reflection"
  );
  const [interestScore, setInterestScore] = useState<number>(5);
  const [confidenceScore, setConfidenceScore] = useState<number>(5);
  const [collabScore, setCollabScore] = useState<number>(5);
  const [reflectionText, setReflectionText] = useState<string>("");
  const [surveySubmittedMsg, setSurveySubmittedMsg] = useState<string | null>(
    null
  );

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (anonCode.trim().length < 2) {
      setSurveySubmittedMsg("익명 번호(예: 출석번호 2자리)를 입력해 주세요.");
      return;
    }
    const result = await submitStudentSurveyLog({
      grade: studentSession.grade,
      classNum: studentSession.classNum,
      anonStudentCode: anonCode.trim(),
      surveyPhase,
      experimentSlug: config.id,
      interestScore,
      inquiryConfidenceScore: confidenceScore,
      collaborationScore: collabScore,
      reflectionText,
    });

    if (result.ok) {
      setSurveySubmittedMsg(
        "✅ 소중한 탐구 설문과 소감이 익명 코드로 안전하게 저장되었어요!"
      );
      setReflectionText("");
    } else {
      setSurveySubmittedMsg(
        `⚠️ 저장 중 안내: ${result.errorMessage ?? "다시 시도해 주세요."}`
      );
    }
  };

  return (
    <section className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-3 py-1 text-sm font-extrabold text-rose-800">
          <MessageSquareHeart className="h-4 w-4" />
          익명 과학 탐구 설문 & 오늘 실험 소감 남기기
        </span>
        <span className="text-xs font-semibold text-slate-400">
          이름 대신 익명 코드로 안전하게 저장됩니다
        </span>
      </div>

      <form onSubmit={(e) => void handleSurveySubmit(e)} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-extrabold text-slate-600">
              나의 익명 코드 (예: G5C1-M1-07)
            </label>
            <input
              type="text"
              value={anonCode}
              onChange={(e) => setAnonCode(e.target.value)}
              placeholder="익명 번호 또는 별명 코드"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-600">
              설문 구분
            </label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(
                [
                  { key: "pre", label: "사전 설문" },
                  { key: "reflection", label: "수업 소감" },
                  { key: "post", label: "사후 설문" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSurveyPhase(item.key)}
                  className={`rounded-xl py-2 text-xs font-extrabold transition ${
                    surveyPhase === item.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "과학 실험 흥미도",
              value: interestScore,
              setter: setInterestScore,
            },
            {
              label: "변인 통제 자신감",
              value: confidenceScore,
              setter: setConfidenceScore,
            },
            {
              label: "모둠 친구와 협력",
              value: collabScore,
              setter: setCollabScore,
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <div className="text-xs font-extrabold text-slate-700">
                {metric.label}
              </div>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => metric.setter(score)}
                    className="p-0.5"
                    aria-label={`${metric.label} ${score}점`}
                  >
                    <Star
                      className={`h-6 w-6 transition ${
                        score <= metric.value
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-auto text-xs font-black text-slate-700">
                  {metric.value}점
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
            placeholder="오늘 실험을 하며 새롭게 알게 된 점이나 느낀 점을 적어 보세요!"
            className="flex-1 rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-xs transition hover:bg-rose-600"
          >
            익명 소감 제출하기
          </button>
        </div>

        {surveySubmittedMsg && (
          <p className="text-xs font-extrabold text-emerald-700">
            {surveySubmittedMsg}
          </p>
        )}
      </form>
    </section>
  );
}
