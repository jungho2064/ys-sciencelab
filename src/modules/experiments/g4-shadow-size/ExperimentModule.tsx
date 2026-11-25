"use client";

import { useState } from "react";
import { ArrowDownToLine, Flashlight, Star } from "lucide-react";
import { StandardExperimentWorkspace } from "@/components/lab/StandardExperimentWorkspace";
import type { ExperimentModuleProps } from "../types";

export default function G4ShadowSizeModule(props: ExperimentModuleProps) {
  const { config, groupRecord, onUpdateRecord } = props;
  const [distanceCm, setDistanceCm] = useState<number>(15);

  const shadowSizeCm = config.simulateValue(distanceCm);

  const applyToTable = () => {
    const idx = groupRecord.dataPoints.findIndex(
      (pt) => pt.xValue === distanceCm
    );
    if (idx === -1) return;
    const nextPoints = groupRecord.dataPoints.map((pt, i) =>
      i === idx ? { ...pt, yValue: shadowSizeCm } : pt
    );
    onUpdateRecord({
      dataPoints: nextPoints,
      status:
        groupRecord.status === "completed" ? "completed" : "measuring",
    });
  };

  // 손전등 시각 위치 (10cm -> 물체에 가까움, 30cm -> 물체에서 멂)
  const flashlightLeftPercent = 42 - ((distanceCm - 10) / 20) * 34; // 42% ~ 8%
  const shadowPixelSize = Math.round(shadowSizeCm * 6.2);

  const simulator = (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-extrabold text-sky-800">
            어두운 암실 시뮬레이터
          </span>
          <h3 className="mt-1.5 text-lg font-extrabold text-slate-900">
            🔦 손전등을 앞뒤로 움직여 그림자 크기를 비교해 보세요!
          </h3>
        </div>
        <button
          type="button"
          onClick={applyToTable}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-sky-600"
        >
          <ArrowDownToLine className="h-4 w-4" />
          거리 {distanceCm}cm 측정값({shadowSizeCm}cm) 기록표에 넣기
        </button>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-12">
        {/* 거리 조절 컨트롤 */}
        <div className="flex flex-col justify-between rounded-2xl border border-sky-200 bg-sky-50/70 p-4 md:col-span-5">
          <div>
            <div className="text-sm font-bold text-sky-950">
              손전등과 물체 사이의 거리 조절
            </div>
            <input
              type="range"
              min={10}
              max={30}
              step={5}
              value={distanceCm}
              onChange={(e) => setDistanceCm(Number(e.target.value))}
              className="mt-4 w-full accent-sky-600"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[10, 15, 20, 25, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistanceCm(d)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                    distanceCm === d
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "border border-sky-200 bg-white text-slate-700 hover:bg-sky-100"
                  }`}
                >
                  {d}cm
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-sky-200 bg-white p-3">
              <div className="text-[11px] font-bold text-slate-500">
                손전등-물체 거리
              </div>
              <div className="mt-0.5 text-xl font-black text-sky-700">
                {distanceCm} cm
              </div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white p-3">
              <div className="text-[11px] font-bold text-slate-500">
                스크린 그림자 크기
              </div>
              <div className="mt-0.5 text-xl font-black text-indigo-700">
                {shadowSizeCm} cm
              </div>
            </div>
          </div>
        </div>

        {/* 암실 시각 무대 */}
        <div className="relative flex h-60 items-center overflow-hidden rounded-2xl bg-slate-900 p-5 text-white md:col-span-7">
          {/* 손전등 */}
          <div
            style={{ left: `${flashlightLeftPercent}%` }}
            className="absolute z-20 flex flex-col items-center transition-all duration-300"
          >
            <div className="flex h-11 w-14 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-lg">
              <Flashlight className="h-6 w-6" />
            </div>
            <span className="mt-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-amber-300">
              손전등 ({distanceCm}cm)
            </span>
          </div>

          {/* 노란 빛 퍼짐 표현 */}
          <div
            style={{ left: `${flashlightLeftPercent + 6}%` }}
            className="pointer-events-none absolute right-14 h-36 bg-gradient-to-r from-amber-300/40 via-amber-200/20 to-transparent blur-xs transition-all duration-300"
          />

          {/* 고정된 별 모양 판 (중앙 오른쪽 56%) */}
          <div
            style={{ left: "56%" }}
            className="absolute z-20 flex flex-col items-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-sky-300 bg-sky-500/30">
              <Star className="h-8 w-8 fill-sky-300 text-sky-200" />
            </div>
            <span className="mt-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-sky-200">
              물체(6cm 고정)
            </span>
          </div>

          {/* 오른쪽 스크린 및 그림자 */}
          <div className="absolute right-5 z-20 flex h-48 w-24 flex-col items-center justify-center rounded-xl border-2 border-slate-300 bg-slate-100 shadow-inner">
            <Star
              style={{
                width: `${shadowPixelSize}px`,
                height: `${shadowPixelSize}px`,
              }}
              className="fill-slate-900 text-slate-900 transition-all duration-300"
            />
            <span className="absolute bottom-1.5 text-[11px] font-extrabold text-slate-700">
              그림자 {shadowSizeCm}cm
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return <StandardExperimentWorkspace {...props} simulatorSlot={simulator} />;
}
