"use client";

import { useState } from "react";
import { Plus, Minus, ArrowDownToLine } from "lucide-react";
import { StandardExperimentWorkspace } from "@/components/lab/StandardExperimentWorkspace";
import type { ExperimentModuleProps } from "../types";

export default function G3SpringWeightModule(props: ExperimentModuleProps) {
  const { config, groupRecord, onUpdateRecord } = props;
  const [weightCount, setWeightCount] = useState<number>(1);

  const stretchedCm = config.simulateValue(weightCount);
  const baseSpringHeight = 56;
  const springHeight = baseSpringHeight + weightCount * 22;

  const applyToTable = () => {
    const idx = groupRecord.dataPoints.findIndex(
      (pt) => pt.xValue === weightCount
    );
    if (idx === -1) return;
    const nextPoints = groupRecord.dataPoints.map((pt, i) =>
      i === idx ? { ...pt, yValue: stretchedCm } : pt
    );
    onUpdateRecord({
      dataPoints: nextPoints,
      status:
        groupRecord.status === "completed" ? "completed" : "measuring",
    });
  };

  const canApplyToTable = groupRecord.dataPoints.some(
    (pt) => pt.xValue === weightCount
  );

  const simulator = (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-800">
            가상 실험대
          </span>
          <h3 className="mt-1.5 text-lg font-extrabold text-slate-900">
            🪝 용수철에 추를 걸어 늘어난 길이를 관찰해 볼까요?
          </h3>
        </div>
        {canApplyToTable && (
          <button
            type="button"
            onClick={applyToTable}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-amber-600"
          >
            <ArrowDownToLine className="h-4 w-4" />
            추 {weightCount}개 측정값({stretchedCm}cm) 기록표에 넣기
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-12">
        {/* 조작 패널 */}
        <div className="flex flex-col justify-between rounded-2xl bg-amber-50/70 p-4 border border-amber-200/80 md:col-span-5">
          <div>
            <div className="text-sm font-bold text-amber-900">
              매단 추의 개수 선택 (1개 = 20g)
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setWeightCount((prev) => Math.max(0, prev - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                aria-label="추 줄이기"
              >
                <Minus className="h-5 w-5" />
              </button>
              <div className="flex-1 rounded-xl bg-white py-2 text-center shadow-2xs border border-amber-200">
                <span className="text-2xl font-black text-amber-700">
                  {weightCount}개
                </span>
                <span className="ml-1.5 text-xs font-bold text-slate-500">
                  ({weightCount * 20}g)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWeightCount((prev) => Math.min(5, prev + 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                aria-label="추 늘리기"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setWeightCount(cnt)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                    weightCount === cnt
                      ? "bg-amber-500 text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  {cnt === 0 ? "추 없음(0개)" : `${cnt}개`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white p-3.5 border border-amber-200">
            <div className="text-xs font-bold text-slate-500">
              처음 길이보다 늘어난 길이
            </div>
            <div className="mt-1 text-2xl font-black text-amber-600">
              {stretchedCm.toFixed(1)} cm
            </div>
          </div>
        </div>

        {/* 용수철 & 눈금자 시각화 */}
        <div className="relative flex min-h-[260px] items-start justify-center rounded-2xl border border-slate-200 bg-slate-50 p-5 md:col-span-7">
          {/* 스탠드 가로대 */}
          <div className="relative flex items-start gap-10">
            <div className="flex flex-col items-center">
              <div className="h-3 w-36 rounded-full bg-slate-700" />
              {/* 용수철 SVG */}
              <svg
                width="80"
                height={springHeight + 20}
                viewBox={`0 0 80 ${springHeight + 20}`}
                className="transition-all duration-300"
              >
                <line
                  x1="40"
                  y1="0"
                  x2="40"
                  y2="10"
                  stroke="#475569"
                  strokeWidth="4"
                />
                {Array.from({ length: 7 }).map((_, i) => {
                  const seg = (springHeight - 16) / 7;
                  const y1 = 10 + i * seg;
                  const y2 = y1 + seg / 2;
                  const y3 = y1 + seg;
                  return (
                    <path
                      key={i}
                      d={`M 22 ${y1} L 58 ${y2} L 22 ${y3}`}
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
                {/* 끝부분 빨간 지침 화살표 */}
                <line
                  x1="22"
                  y1={springHeight - 6}
                  x2="78"
                  y2={springHeight - 6}
                  stroke="#ef4444"
                  strokeWidth="3"
                />
              </svg>

              {/* 매달린 추 표현 */}
              <div className="-mt-2 flex flex-col items-center gap-1">
                {Array.from({ length: weightCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex h-6 w-14 items-center justify-center rounded-md border-2 border-amber-700 bg-amber-400 text-[11px] font-black text-amber-950 shadow-2xs"
                  >
                    20g
                  </div>
                ))}
              </div>
            </div>

            {/* 눈금자 (0cm ~ 10cm) */}
            <div className="mt-3 flex flex-col rounded-xl border-2 border-slate-300 bg-yellow-50 px-3 py-2 shadow-2xs">
              <span className="mb-1 text-[10px] font-extrabold text-slate-500">
                늘어난 길이 자
              </span>
              {[0, 2, 4, 6, 8, 10].map((cm) => {
                const active = Math.abs(stretchedCm - cm) < 0.2;
                return (
                  <div
                    key={cm}
                    className="flex h-[22px] items-center gap-2 text-xs"
                  >
                    <div
                      className={`h-0.5 ${
                        active ? "w-5 bg-red-500" : "w-3 bg-slate-400"
                      }`}
                    />
                    <span
                      className={
                        active
                          ? "font-black text-red-600"
                          : "font-semibold text-slate-600"
                      }
                    >
                      {cm}cm
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return <StandardExperimentWorkspace {...props} simulatorSlot={simulator} />;
}
