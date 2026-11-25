"use client";

import { useState } from "react";
import { ArrowDownToLine, BatteryCharging, Magnet, Paperclip, Zap } from "lucide-react";
import { StandardExperimentWorkspace } from "@/components/lab/StandardExperimentWorkspace";
import type { ExperimentModuleProps } from "../types";

export default function G6ElectromagnetModule(props: ExperimentModuleProps) {
  const { config, groupRecord, onUpdateRecord } = props;
  const [batteryCount, setBatteryCount] = useState<number>(2);
  const [switchClosed, setSwitchClosed] = useState<boolean>(true);

  const attachedClips = switchClosed ? config.simulateValue(batteryCount) : 0;

  const applyToTable = () => {
    const idx = groupRecord.dataPoints.findIndex(
      (pt) => pt.xValue === batteryCount
    );
    if (idx === -1) return;
    const val = config.simulateValue(batteryCount);
    const nextPoints = groupRecord.dataPoints.map((pt, i) =>
      i === idx ? { ...pt, yValue: val } : pt
    );
    onUpdateRecord({
      dataPoints: nextPoints,
      status:
        groupRecord.status === "completed" ? "completed" : "measuring",
    });
  };

  const simulator = (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-extrabold text-violet-800">
            전자석 회로 시뮬레이터
          </span>
          <h3 className="mt-1.5 text-lg font-extrabold text-slate-900">
            🧲 전지 개수를 바꾸고 스위치를 눌러 클립이 몇 개 붙는지 확인해 보세요!
          </h3>
        </div>
        <button
          type="button"
          onClick={applyToTable}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-violet-700"
        >
          <ArrowDownToLine className="h-4 w-4" />
          전지 {batteryCount}개 측정값({config.simulateValue(batteryCount)}개) 기록표에 넣기
        </button>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-12">
        {/* 조작 영역 */}
        <div className="flex flex-col justify-between rounded-2xl border border-violet-200 bg-violet-50/60 p-4 md:col-span-5">
          <div>
            <div className="text-sm font-bold text-violet-950">
              직렬로 연결할 전지(1.5V) 개수 선택
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setBatteryCount(cnt)}
                  className={`rounded-xl py-2.5 text-sm font-extrabold transition ${
                    batteryCount === cnt
                      ? "bg-violet-600 text-white shadow-xs"
                      : "border border-violet-200 bg-white text-slate-700 hover:bg-violet-100"
                  }`}
                >
                  {cnt}개
                </button>
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setSwitchClosed((prev) => !prev)}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold transition ${
                  switchClosed
                    ? "bg-amber-400 text-slate-950 shadow-sm hover:bg-amber-300"
                    : "border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Zap className="h-4 w-4" />
                {switchClosed
                  ? "스위치 ON (전류가 흐르는 중!)"
                  : "스위치 OFF (눌러서 전류 흘리기)"}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-violet-200 bg-white p-3.5">
            <div className="text-xs font-bold text-slate-500">
              쇠못 끝에 붙은 클립의 수
            </div>
            <div className="mt-1 text-2xl font-black text-violet-700">
              {attachedClips} 개
            </div>
          </div>
        </div>

        {/* 회로 및 전자석 시각화 */}
        <div className="flex min-h-[230px] flex-col items-center justify-between rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white md:col-span-7">
          {/* 직렬 전지 표시 */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: batteryCount }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 rounded-lg border border-amber-400/70 bg-amber-400/20 px-3 py-1.5 text-xs font-extrabold text-amber-300"
              >
                <BatteryCharging className="h-4 w-4" />
                1.5V
              </div>
            ))}
          </div>

          {/* 에나멜선 감긴 쇠못 전자석 */}
          <div className="my-3 flex flex-col items-center">
            <div
              className={`flex items-center gap-2 rounded-full px-6 py-3 border-2 transition-all ${
                switchClosed
                  ? "border-amber-400 bg-violet-600/40 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
                  : "border-slate-600 bg-slate-800"
              }`}
            >
              <Magnet
                className={`h-6 w-6 ${
                  switchClosed ? "text-amber-300" : "text-slate-400"
                }`}
              />
              <span className="text-sm font-extrabold">
                에나멜선 80회 감은 전자석
              </span>
            </div>

            {/* 달라붙은 클립 아이콘 모음 */}
            <div className="mt-4 flex min-h-[56px] max-w-xs flex-wrap items-center justify-center gap-1.5">
              {attachedClips === 0 ? (
                <span className="text-xs font-semibold text-slate-400">
                  스위치가 꺼져 있어 전자석의 성질이 사라졌어요.
                </span>
              ) : (
                Array.from({ length: attachedClips }).map((_, i) => (
                  <span
                    key={i}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-sky-300 ring-1 ring-sky-400/50"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return <StandardExperimentWorkspace {...props} simulatorSlot={simulator} />;
}
