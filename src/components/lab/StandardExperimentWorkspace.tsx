"use client";

import { useState, type ReactNode } from "react";
import {
  BarChart3,
  LineChart as LineChartIcon,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AiCoachAndConclusionSection,
  AnonymousSurveySection,
  ExperimentHeaderAndSafety,
  LAB_THEME_STYLES,
  VariableControlSection,
} from "@/components/lab/LabSharedSections";
import type {
  ExperimentModuleProps,
  LabProgressStatus,
} from "@/modules/experiments/types";

interface StandardExperimentWorkspaceProps extends ExperimentModuleProps {
  /** 각 단원 플러그인 고유 가상 실험 시뮬레이터 영역 */
  simulatorSlot?: ReactNode;
}

export function StandardExperimentWorkspace({
  config,
  studentSession,
  groupRecord,
  onUpdateRecord,
  simulatorSlot,
}: StandardExperimentWorkspaceProps) {
  const theme = LAB_THEME_STYLES[config.themeColor];
  const indep = config.independentVariables[0];
  const [chartMode, setChartMode] = useState<"line" | "bar">(
    config.dependentVariable.chartType
  );

  const filledCount = groupRecord.dataPoints.filter(
    (d) => d.yValue !== null && !Number.isNaN(d.yValue)
  ).length;

  const handleValueChange = (index: number, raw: string) => {
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && Number.isNaN(parsed)) return;

    const nextPoints = groupRecord.dataPoints.map((pt, idx) =>
      idx === index ? { ...pt, yValue: parsed } : pt
    );
    const anyFilled = nextPoints.some((p) => p.yValue !== null);
    const nextStatus: LabProgressStatus =
      groupRecord.status === "completed"
        ? "completed"
        : anyFilled
          ? "measuring"
          : "ready";

    onUpdateRecord({
      dataPoints: nextPoints,
      revisionCount: (groupRecord.revisionCount ?? 0) + 1,
      status: nextStatus,
    });
  };

  const handleFillSimulated = () => {
    const nowIso = new Date().toISOString();
    const nextPoints = groupRecord.dataPoints.map((pt) => ({
      ...pt,
      yValue: config.simulateValue(pt.xValue),
    }));
    const nextSimLog = [
      ...(groupRecord.simulationLog ?? []),
      ...groupRecord.dataPoints.map((pt) => ({
        xValue: pt.xValue,
        simulatedY: config.simulateValue(pt.xValue),
        recordedAt: nowIso,
      })),
    ];
    onUpdateRecord({
      dataPoints: nextPoints,
      simulationLog: nextSimLog,
      controlledCheckedIds: config.controlledVariables.map((c) => c.id),
      revisionCount: (groupRecord.revisionCount ?? 0) + 1,
      status:
        groupRecord.status === "completed" ? "completed" : "measuring",
    });
  };

  const handleResetMeasurements = () => {
    const nextPoints = groupRecord.dataPoints.map((pt) => ({
      ...pt,
      yValue: null,
    }));
    onUpdateRecord({
      dataPoints: nextPoints,
      conclusion: "",
      revisionCount: (groupRecord.revisionCount ?? 0) + 1,
      status: "ready",
    });
  };

  const chartData = groupRecord.dataPoints.map((pt) => ({
    name: pt.stepLabel,
    측정값: pt.yValue,
  }));

  return (
    <div className="space-y-6">
      <ExperimentHeaderAndSafety
        config={config}
        studentSession={studentSession}
        groupRecord={groupRecord}
      />

      <VariableControlSection
        config={config}
        groupRecord={groupRecord}
        onUpdateRecord={onUpdateRecord}
      />

      {simulatorSlot && (
        <section className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          {simulatorSlot}
        </section>
      )}

      {/* 모둠 측정 기록표 & 실시간 그래프 */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                📝 우리 모둠 실험 기록장
              </h3>
              <p className="text-xs text-slate-500">
                값을 입력하는 즉시 선생님 전자칠판 비교 그래프에 실시간 반영돼요!
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleFillSimulated}
                title="가상 실험 예시 측정값 자동 입력"
                className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                <Sparkles className="h-3.5 w-3.5" />
                예시값 채우기
              </button>
              <button
                type="button"
                onClick={handleResetMeasurements}
                title="입력값 지우기"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                초기화
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 text-xs font-extrabold text-slate-700 sm:text-sm">
                  <th className="py-3 pl-4 pr-2">
                    {indep.name} ({indep.unit})
                  </th>
                  <th className="py-3 pl-2 pr-4">
                    {config.dependentVariable.name} (
                    {config.dependentVariable.unit})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {groupRecord.dataPoints.map((pt, idx) => (
                  <tr key={pt.xValue} className="hover:bg-slate-50/80">
                    <td className="py-3 pl-4 pr-2 font-extrabold text-slate-800">
                      <span
                        className={`inline-block rounded-lg ${theme.badgeBg} ${theme.badgeText} px-3 py-1 text-sm`}
                      >
                        {pt.stepLabel}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 pr-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          placeholder="측정값 입력"
                          value={pt.yValue === null ? "" : pt.yValue}
                          onChange={(e) =>
                            handleValueChange(idx, e.target.value)
                          }
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-base font-extrabold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                        <span className="shrink-0 text-xs font-bold text-slate-500">
                          {config.dependentVariable.unit}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                📊 한눈에 보는 실험 결과 그래프
              </h3>
              <p className="text-xs text-slate-500">
                가로축: {indep.name}({indep.unit}) · 세로축:{" "}
                {config.dependentVariable.name}({config.dependentVariable.unit})
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setChartMode("line")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  chartMode === "line"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LineChartIcon className="h-3.5 w-3.5" />
                꺾은선
              </button>
              <button
                type="button"
                onClick={() => setChartMode("bar")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  chartMode === "bar"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                막대
              </button>
            </div>
          </div>

          <div className="mt-5 h-72 w-full min-w-0">
            {filledCount === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                <LineChartIcon className="h-10 w-10 text-slate-300" />
                <p className="mt-2 text-base font-bold text-slate-600">
                  왼쪽 실험 기록장에 첫 번째 측정값을 입력해 보세요!
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  숫자를 넣는 즉시 그래프가 자동으로 그려집니다.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === "line" ? (
                  <LineChart
                    data={chartData}
                    margin={{ top: 12, right: 20, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 13, fontWeight: 700, fill: "#334155" }}
                    />
                    <YAxis
                      unit={config.dependentVariable.unit}
                      tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                    />
                    <Tooltip
                      formatter={(val) => [
                        `${val ?? "-"} ${config.dependentVariable.unit}`,
                        config.dependentVariable.name,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="측정값"
                      stroke={theme.chartHex}
                      strokeWidth={4}
                      dot={{ r: 6, strokeWidth: 2, fill: "#ffffff" }}
                      activeDot={{ r: 8 }}
                      connectNulls
                    />
                  </LineChart>
                ) : (
                  <BarChart
                    data={chartData}
                    margin={{ top: 12, right: 20, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 13, fontWeight: 700, fill: "#334155" }}
                    />
                    <YAxis
                      unit={config.dependentVariable.unit}
                      tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                    />
                    <Tooltip
                      formatter={(val) => [
                        `${val ?? "-"} ${config.dependentVariable.unit}`,
                        config.dependentVariable.name,
                      ]}
                    />
                    <Bar
                      dataKey="측정값"
                      fill={theme.chartHex}
                      radius={[10, 10, 0, 0]}
                      maxBarSize={54}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <AiCoachAndConclusionSection
        config={config}
        studentSession={studentSession}
        groupRecord={groupRecord}
        onUpdateRecord={onUpdateRecord}
      />

      <AnonymousSurveySection config={config} studentSession={studentSession} />
    </div>
  );
}
