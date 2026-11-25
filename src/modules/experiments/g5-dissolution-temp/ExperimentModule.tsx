"use client";

import { useState } from "react";
import { ArrowDownToLine, RotateCcw, Sparkles, Thermometer } from "lucide-react";
import { StandardExperimentWorkspace } from "@/components/lab/StandardExperimentWorkspace";
import type { ExperimentModuleProps } from "../types";

export default function G5DissolutionTempModule(props: ExperimentModuleProps) {
  const { config, groupRecord, onUpdateRecord } = props;
  const [waterTemp, setWaterTemp] = useState<number>(40);
  const [addedSpoons, setAddedSpoons] = useState<number>(0);

  const maxDissolvable = config.simulateValue(waterTemp);
  const dissolvedNow = Math.min(addedSpoons, maxDissolvable);
  const remainingCrystals = Math.max(0, addedSpoons - maxDissolvable);

  const selectTemp = (nextTemp: number) => {
    setWaterTemp(nextTemp);
    setAddedSpoons(0);
  };

  const applyToTable = () => {
    const idx = groupRecord.dataPoints.findIndex(
      (pt) => pt.xValue === waterTemp
    );
    if (idx === -1) return;
    const nextPoints = groupRecord.dataPoints.map((pt, i) =>
      i === idx ? { ...pt, yValue: maxDissolvable } : pt
    );
    const nextSimLog = [
      ...(groupRecord.simulationLog ?? []),
      {
        xValue: waterTemp,
        simulatedY: maxDissolvable,
        recordedAt: new Date().toISOString(),
      },
    ];
    onUpdateRecord({
      dataPoints: nextPoints,
      simulationLog: nextSimLog,
      revisionCount: (groupRecord.revisionCount ?? 0) + 1,
      status:
        groupRecord.status === "completed" ? "completed" : "measuring",
    });
  };

  const waterBg =
    waterTemp <= 20
      ? "from-sky-200/80 to-sky-300/90"
      : waterTemp <= 40
        ? "from-cyan-200/80 to-teal-200/90"
        : waterTemp <= 60
          ? "from-amber-100/80 to-orange-200/90"
          : "from-orange-200/80 to-rose-300/90";

  const simulator = (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
            가상 비커 실험실
          </span>
          <h3 className="mt-1.5 text-lg font-extrabold text-slate-900">
            🧪 물의 온도를 고르고 약숟가락으로 백반을 넣어 녹여 보세요!
          </h3>
        </div>
        <button
          type="button"
          onClick={applyToTable}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-emerald-700"
        >
          <ArrowDownToLine className="h-4 w-4" />
          {waterTemp}°C 최대 용해량({maxDissolvable}숟가락) 기록표에 넣기
        </button>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-12">
        {/* 온도 및 약숟가락 조작 */}
        <div className="flex flex-col justify-between rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 md:col-span-6">
          <div>
            <div className="text-sm font-bold text-emerald-950">
              1단계: 비커 속 물(50mL)의 온도 선택
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {[20, 40, 60, 80].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => selectTemp(t)}
                  className={`rounded-xl py-2.5 text-sm font-extrabold transition ${
                    waterTemp === t
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "border border-emerald-200 bg-white text-slate-700 hover:bg-emerald-100"
                  }`}
                >
                  {t}°C
                </button>
              ))}
            </div>

            <div className="mt-4 text-sm font-bold text-emerald-950">
              2단계: 백반 넣고 유리막대로 젓기
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAddedSpoons((s) => s + 1)}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-slate-800"
              >
                🥄 +1숟가락 넣기
              </button>
              <button
                type="button"
                onClick={() => setAddedSpoons((s) => s + 3)}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-100"
              >
                🥄 +3숟가락 넣기
              </button>
              <button
                type="button"
                onClick={() => setAddedSpoons(0)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                새 비커
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3.5">
            {remainingCrystals > 0 ? (
              <p className="text-sm font-extrabold text-rose-600">
                앗! 바닥에 녹지 않은 백반이 남았어요! {waterTemp}°C 물 50mL에는{" "}
                <span className="underline">{maxDissolvable}숟가락</span>까지만 완전히 녹아요.
              </p>
            ) : (
              <p className="text-sm font-bold text-slate-700">
                현재 넣은 백반:{" "}
                <span className="font-black text-emerald-700">
                  {addedSpoons}숟가락
                </span>{" "}
                (모두 투명하게 잘 녹았어요!)
              </p>
            )}
          </div>
        </div>

        {/* 비커 & 온도계 시각화 */}
        <div className="flex min-h-[230px] items-center justify-center gap-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:col-span-6">
          {/* 비커 */}
          <div className="relative flex h-44 w-36 flex-col justify-end overflow-hidden rounded-b-2xl border-4 border-t-0 border-slate-400 bg-white/80 shadow-inner">
            <div className="absolute top-3 left-2 text-[10px] font-bold text-slate-400">
              100mL
            </div>
            <div className="absolute top-16 left-2 z-10 text-[10px] font-extrabold text-slate-600">
              50mL ─
            </div>
            <div
              className={`relative flex h-28 w-full flex-col items-center justify-end bg-gradient-to-b ${waterBg} p-2 transition-colors duration-300`}
            >
              {dissolvedNow > 0 && remainingCrystals === 0 && (
                <div className="mb-6 flex items-center gap-1 text-xs font-extrabold text-slate-700">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  용해됨 ({dissolvedNow}스푼)
                </div>
              )}
              {/* 가라앉은 백반 결정 표현 */}
              {remainingCrystals > 0 && (
                <div className="flex flex-wrap justify-center gap-1 pb-1">
                  {Array.from({
                    length: Math.min(remainingCrystals * 3, 15),
                  }).map((_, i) => (
                    <span
                      key={i}
                      className="h-2.5 w-2.5 rounded-xs border border-slate-300 bg-white shadow-2xs"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 수온계 */}
          <div className="flex flex-col items-center">
            <div className="flex h-36 w-8 flex-col justify-end rounded-full border-2 border-slate-300 bg-white p-1">
              <div
                style={{ height: `${waterTemp}%` }}
                className="w-full rounded-full bg-rose-500 transition-all duration-300"
              />
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700">
              <Thermometer className="h-3.5 w-3.5" />
              {waterTemp}°C
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return <StandardExperimentWorkspace {...props} simulatorSlot={simulator} />;
}
