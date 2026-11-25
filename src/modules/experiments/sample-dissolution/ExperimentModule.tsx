"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Droplets,
  Flame,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
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
  VariableControlSection,
} from "@/components/lab/LabSharedSections";
import type {
  ExperimentModuleProps,
  LabProgressStatus,
} from "../types";
import {
  PARTICLES_PER_EXCESS_SPOON,
  calculateMaxDissolvableSpoons,
  type SoluteType,
  type WaterVolumeMl,
} from "./config";

interface VirtualStepRecord {
  value: number;
  solute: SoluteType;
  waterVolumeMl: WaterVolumeMl;
}

const PRESET_TEMPS = [20, 40, 60, 80];

/**
 * 포화 상태를 초과한 입자를 비커 바닥(x: 68..212, y: 234 위로 층층이)에
 * 결정론적 좌표로 배치하여 실제 알갱이 개수가 정확히 쌓이도록 렌더링합니다.
 */
function buildSettledParticleCoords(count: number) {
  const perRow = 12;
  const coords: Array<{ x: number; y: number; rot: number }> = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    // 위 층으로 갈수록 중앙 쪽으로 살짝 모이는 자연스러운 더미 형태
    const rowIndent = Math.min(row * 5, 20);
    const span = 144 - rowIndent * 2;
    const xStep = span / Math.max(perRow - 1, 1);
    const xOffset = row % 2 === 1 ? 4 : 0;
    const x = 68 + rowIndent + col * xStep + xOffset;
    const y = 235 - row * 7.5 - ((i % 3) * 1.1);
    const rot = ((i * 29) % 45) - 22;
    coords.push({ x, y, rot });
  }
  return coords;
}

export default function SampleDissolutionModule(props: ExperimentModuleProps) {
  const { config, studentSession, groupRecord, onUpdateRecord } = props;

  // 좌측 컨트롤 패널 상태
  const [tempC, setTempC] = useState<number>(40);
  const [solute, setSolute] = useState<SoluteType>("설탕");
  const [spoons, setSpoons] = useState<number>(5);
  const [waterVolumeMl, setWaterVolumeMl] = useState<WaterVolumeMl>(50);

  // 우측 데이터 패널용 가상 실험 측정 기록 (20, 40, 60, 80°C)
  const [virtualRecords, setVirtualRecords] = useState<
    Record<number, VirtualStepRecord>
  >({});

  // 용해도 계산
  const maxCapacity = calculateMaxDissolvableSpoons(
    tempC,
    solute,
    waterVolumeMl
  );
  const dissolvedSpoons = Math.min(spoons, maxCapacity);
  const excessSpoons = Math.max(0, spoons - maxCapacity);
  const particleCount = excessSpoons * PARTICLES_PER_EXCESS_SPOON;
  const settledCoords = useMemo(
    () => buildSettledParticleCoords(particleCount),
    [particleCount]
  );

  // 온도에 따른 수증기 강도 설정
  const steamSpecs = useMemo(() => {
    if (tempC < 35) {
      return {
        paths: [140],
        opacity: 0.22,
        durationSec: 3.4,
        label: "매우 약한 수증기",
      };
    }
    if (tempC < 55) {
      return {
        paths: [108, 140, 172],
        opacity: 0.45,
        durationSec: 2.5,
        label: "잔잔한 수증기",
      };
    }
    if (tempC < 75) {
      return {
        paths: [92, 124, 156, 188],
        opacity: 0.72,
        durationSec: 1.8,
        label: "활발한 수증기",
      };
    }
    return {
      paths: [82, 105, 128, 152, 175, 198],
      opacity: 0.95,
      durationSec: 1.2,
      label: "아주 강한 김(수증기)",
    };
  }, [tempC]);

  // 물의 양에 따른 수위 (50mL vs 100mL)
  const waterTopY = waterVolumeMl === 100 ? 112 : 162;
  const waterHeight = 244 - waterTopY;

  // 통제변인 오류 실시간 감지 (AI 코치 및 경고 배지용)
  const controlViolations = useMemo(() => {
    const issues: string[] = [];
    if (waterVolumeMl !== 50) {
      issues.push(
        `현재 가상 실험의 물의 양이 기본 기준(50mL)이 아닌 ${waterVolumeMl}mL로 설정되어 있습니다.`
      );
    }
    const recordedList = Object.values(virtualRecords);
    const volumes = new Set(recordedList.map((r) => r.waterVolumeMl));
    if (volumes.size > 1) {
      issues.push(
        "가상 실험 기록 중 물의 양(50mL와 100mL)이 온도 단계마다 다르게 섞여 있습니다."
      );
    }
    const solutes = new Set(recordedList.map((r) => r.solute));
    if (solutes.size > 1) {
      issues.push(
        "가상 실험 기록 중 용질 종류(설탕과 소금)가 서로 다르게 섞여 있습니다."
      );
    }
    return issues;
  }, [waterVolumeMl, virtualRecords]);

  // 현재 온도 조건을 가상 실험 기록표에 저장
  const recordCurrentVirtualStep = (targetTemp: number) => {
    const cap = calculateMaxDissolvableSpoons(targetTemp, solute, waterVolumeMl);
    setVirtualRecords((prev) => ({
      ...prev,
      [targetTemp]: {
        value: cap,
        solute,
        waterVolumeMl,
      },
    }));
    onUpdateRecord({
      simulationLog: [
        ...(groupRecord.simulationLog ?? []),
        {
          xValue: targetTemp,
          simulatedY: cap,
          solute,
          waterVolumeMl,
          spoons,
          excessSpoons,
          recordedAt: new Date().toISOString(),
        },
      ],
      revisionCount: (groupRecord.revisionCount ?? 0) + 1,
      status:
        groupRecord.status === "completed" ? "completed" : "measuring",
    });
  };

  // 현재 선택한 용질·물의 양 기준으로 4단계(20~80°C) 가상 실험값 한 번에 기록
  const fillAllVirtualSteps = () => {
    const nowIso = new Date().toISOString();
    const nextVirtual: Record<number, VirtualStepRecord> = {};
    const newLogs = PRESET_TEMPS.map((t) => {
      const cap = calculateMaxDissolvableSpoons(t, solute, waterVolumeMl);
      nextVirtual[t] = { value: cap, solute, waterVolumeMl };
      return {
        xValue: t,
        simulatedY: cap,
        solute,
        waterVolumeMl,
        spoons: cap,
        excessSpoons: 0,
        recordedAt: nowIso,
      };
    });
    setVirtualRecords(nextVirtual);
    onUpdateRecord({
      simulationLog: [...(groupRecord.simulationLog ?? []), ...newLogs],
      revisionCount: (groupRecord.revisionCount ?? 0) + 1,
      status:
        groupRecord.status === "completed" ? "completed" : "measuring",
    });
  };

  // 실제 과학실 측정값 입력 처리 -> Supabase `measured_data` 및 교사 Recharts 즉시 반영
  const handleRealMeasuredChange = (index: number, raw: string) => {
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

  const handleResetComparison = () => {
    setVirtualRecords({});
    onUpdateRecord({
      dataPoints: groupRecord.dataPoints.map((pt) => ({ ...pt, yValue: null })),
      conclusion: "",
      revisionCount: (groupRecord.revisionCount ?? 0) + 1,
      status: "ready",
    });
  };

  const isPresetTemp = PRESET_TEMPS.includes(tempC);

  const comparisonChartData = groupRecord.dataPoints.map((pt) => ({
    name: pt.stepLabel,
    가상실험값: virtualRecords[pt.xValue]?.value ?? null,
    실제측정값: pt.yValue,
  }));

  const hasChartData = comparisonChartData.some(
    (d) => d.가상실험값 !== null || d.실제측정값 !== null
  );

  return (
    <div className="space-y-6">
      {/* 상단 단원 헤더 & 안전 약속 */}
      <ExperimentHeaderAndSafety
        config={config}
        studentSession={studentSession}
        groupRecord={groupRecord}
      />

      {/* 변인 통제 체크리스트 */}
      <VariableControlSection
        config={config}
        groupRecord={groupRecord}
        onUpdateRecord={onUpdateRecord}
      />

      {/* 핵심 3단 시각적 가상 실험실 + 오차 비교 패널 */}
      <section className="rounded-3xl border-2 border-emerald-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
              플러그인 검증용 시각적 가상 실험실
            </span>
            <h3 className="mt-1.5 text-xl font-black text-slate-900">
              🧪 물의 온도에 따른 용해도 가상 실험 & 오차 비교
            </h3>
          </div>

          {controlViolations.length > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-extrabold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>통제변인 주의: {controlViolations[0]}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              통제변인 기준(물 50mL · {solute}) 유지 중
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-12">
          {/* 1) 좌측 컨트롤 패널 */}
          <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 xl:col-span-4">
            <div className="space-y-4">
              {/* 물의 온도 슬라이더 (20°C ~ 80°C) */}
              <div className="rounded-2xl bg-white p-3.5 shadow-2xs border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
                    <Flame className="h-4 w-4 text-rose-500" />
                    물의 온도 (조작변인)
                  </span>
                  <span className="rounded-lg bg-rose-100 px-2.5 py-0.5 text-sm font-black text-rose-700">
                    {tempC}°C
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={tempC}
                  onChange={(e) => setTempC(Number(e.target.value))}
                  className="mt-3 w-full accent-rose-500"
                />
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {PRESET_TEMPS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTempC(t)}
                      className={`rounded-lg py-1.5 text-xs font-extrabold transition ${
                        tempC === t
                          ? "bg-rose-500 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t}°C
                    </button>
                  ))}
                </div>
              </div>

              {/* 용질 선택 (설탕 / 소금) */}
              <div className="rounded-2xl bg-white p-3.5 shadow-2xs border border-slate-200/70">
                <div className="text-sm font-extrabold text-slate-800">
                  용질 선택
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["설탕", "소금"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSolute(item);
                        onUpdateRecord({
                          revisionCount: (groupRecord.revisionCount ?? 0) + 1,
                        });
                      }}
                      className={`rounded-xl py-2.5 text-sm font-extrabold transition ${
                        solute === item
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {item === "설탕" ? "🍬 설탕" : "🧂 소금"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 넣는 숟가락 수 (1 ~ 8숟가락) */}
              <div className="rounded-2xl bg-white p-3.5 shadow-2xs border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-800">
                    넣는 숟가락 수
                  </span>
                  <span className="rounded-lg bg-indigo-100 px-2.5 py-0.5 text-sm font-black text-indigo-700">
                    {spoons}숟가락
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSpoons((s) => Math.max(1, s - 1))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    aria-label="숟가락 줄이기"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={spoons}
                    onChange={(e) => setSpoons(Number(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setSpoons((s) => Math.min(8, s + 1))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    aria-label="숟가락 늘리기"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 물의 양 (50mL / 100mL - 통제변인 오류 테스트용) */}
              <div className="rounded-2xl bg-white p-3.5 shadow-2xs border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
                    <Droplets className="h-4 w-4 text-sky-500" />
                    물의 양 (통제변인)
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    기준: 50mL
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([50, 100] as const).map((vol) => (
                    <button
                      key={vol}
                      type="button"
                      onClick={() => {
                        setWaterVolumeMl(vol);
                        onUpdateRecord({
                          revisionCount: (groupRecord.revisionCount ?? 0) + 1,
                        });
                      }}
                      className={`rounded-xl py-2 text-sm font-extrabold transition ${
                        waterVolumeMl === vol
                          ? vol === 50
                            ? "bg-sky-600 text-white shadow-xs"
                            : "bg-amber-500 text-white shadow-xs"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {vol}mL {vol === 100 ? "(2배)" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                recordCurrentVirtualStep(
                  isPresetTemp
                    ? tempC
                    : PRESET_TEMPS.reduce((prev, curr) =>
                        Math.abs(curr - tempC) < Math.abs(prev - tempC)
                          ? curr
                          : prev
                      )
                )
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {isPresetTemp
                ? `${tempC}°C 가상 결과(${maxCapacity}숟가락) 비교표에 기록`
                : `가까운 단계(${PRESET_TEMPS.reduce((p, c) => (Math.abs(c - tempC) < Math.abs(p - tempC) ? c : p))}°C)에 기록`}
            </button>
          </div>

          {/* 2) 중앙 시각적 반응 (순수 React SVG + CSS 애니메이션) */}
          <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/80 p-4 xl:col-span-4">
            <div className="flex w-full items-center justify-between text-xs font-bold">
              <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-2xs">
                💨 {steamSpecs.label} ({tempC}°C)
              </span>
              <span
                className={`rounded-full px-3 py-1 font-extrabold ${
                  excessSpoons > 0
                    ? "bg-rose-100 text-rose-700"
                    : spoons === maxCapacity
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {excessSpoons > 0
                  ? "포화 초과 (침전 발생)"
                  : spoons === maxCapacity
                    ? "딱 포화 상태!"
                    : "모두 투명하게 용해"}
              </span>
            </div>

            <svg
              viewBox="0 0 280 285"
              className="my-2 h-64 w-full max-w-[270px]"
              role="img"
              aria-label={`${tempC}도 물 ${waterVolumeMl}mL에 ${solute} ${spoons}숟가락을 넣은 비커 시뮬레이션`}
            >
              <defs>
                <linearGradient id="beakerWater" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={tempC >= 60 ? "#bae6fd" : "#e0f2fe"}
                    stopOpacity="0.72"
                  />
                  <stop
                    offset="100%"
                    stopColor={tempC >= 60 ? "#38bdf8" : "#7dd3fc"}
                    stopOpacity="0.82"
                  />
                </linearGradient>
                <clipPath id="beakerClip">
                  <path d="M 56 76 L 56 232 Q 56 246 70 246 L 210 246 Q 224 246 224 232 L 224 76 Z" />
                </clipPath>
              </defs>

              {/* 비커 위 수증기 애니메이션 (온도별 개수·속도·투명도 변화) */}
              <g
                style={
                  {
                    "--steam-opacity": steamSpecs.opacity,
                  } as React.CSSProperties
                }
              >
                {steamSpecs.paths.map((xPos, idx) => (
                  <path
                    key={`${xPos}-${steamSpecs.paths.length}`}
                    d={`M ${xPos} 64 Q ${xPos - 8} 48 ${xPos} 32 Q ${xPos + 8} 16 ${xPos} 4`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={tempC >= 60 ? "3" : "2.2"}
                    strokeLinecap="round"
                    className="animate-steam-rise"
                    style={{
                      animationDuration: `${steamSpecs.durationSec}s`,
                      animationDelay: `${idx * 0.28}s`,
                    }}
                  />
                ))}
              </g>

              {/* 비커 내부 용액 (50mL / 100mL 수위 변화) */}
              <g clipPath="url(#beakerClip)">
                <rect
                  x="56"
                  y={waterTopY}
                  width="168"
                  height={waterHeight}
                  fill="url(#beakerWater)"
                  className="transition-all duration-500"
                />
                {/* 수면 하이라이트 */}
                <ellipse
                  cx="140"
                  cy={waterTopY}
                  rx="84"
                  ry="6"
                  fill="#e0f2fe"
                  opacity="0.85"
                  className="transition-all duration-500"
                />

                {/* 녹아서 투명하게 사라지는 용질 반짝임 애니메이션 */}
                {Array.from({ length: Math.min(dissolvedSpoons, 8) }).map(
                  (_, i) => (
                    <circle
                      key={`dissolved-${i}`}
                      cx={80 + i * 17}
                      cy={waterTopY + 26 + (i % 3) * 14}
                      r="3"
                      fill={solute === "설탕" ? "#fef3c7" : "#ffffff"}
                      className="animate-dissolve-shimmer"
                      style={{ animationDelay: `${i * 0.22}s` }}
                    />
                  )
                )}

                {/* 포화 상태를 초과해 비커 바닥에 가라앉은 실제 입자들 */}
                {settledCoords.map((pt, idx) => (
                  <rect
                    key={`settled-${idx}`}
                    x={pt.x - 3.5}
                    y={pt.y - 3.5}
                    width="7"
                    height="7"
                    rx={solute === "설탕" ? "2" : "1"}
                    transform={`rotate(${pt.rot} ${pt.x} ${pt.y})`}
                    fill={solute === "설탕" ? "#fde68a" : "#ffffff"}
                    stroke={solute === "설탕" ? "#b45309" : "#64748b"}
                    strokeWidth="1.2"
                  />
                ))}
              </g>

              {/* 비커 유리 외곽선 및 주둥이 */}
              <path
                d="M 46 72 L 56 80 L 56 232 Q 56 246 70 246 L 210 246 Q 224 246 224 232 L 224 72"
                fill="none"
                stroke="#334155"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 비커 눈금 (50mL / 100mL) */}
              <line
                x1="58"
                y1="162"
                x2="78"
                y2="162"
                stroke="#0f172a"
                strokeWidth="2"
              />
              <text
                x="82"
                y="166"
                fontSize="11"
                fontWeight="800"
                fill="#0f172a"
              >
                50mL
              </text>
              <line
                x1="58"
                y1="112"
                x2="78"
                y2="112"
                stroke="#0f172a"
                strokeWidth="2"
              />
              <text
                x="82"
                y="116"
                fontSize="11"
                fontWeight="800"
                fill="#0f172a"
              >
                100mL
              </text>

              {/* 하단 핫플레이트 받침 */}
              <rect
                x="44"
                y="252"
                width="192"
                height="16"
                rx="8"
                fill="#1e293b"
              />
              <rect
                x="70"
                y="255"
                width="140"
                height="4"
                rx="2"
                fill={
                  tempC >= 70
                    ? "#ef4444"
                    : tempC >= 50
                      ? "#f97316"
                      : tempC >= 35
                        ? "#fbbf24"
                        : "#64748b"
                }
              />
            </svg>

            {/* 하단 용해·침전 입자 수치 요약 */}
            <div className="grid w-full grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border border-emerald-200 bg-white p-2.5">
                <div className="text-[11px] font-bold text-slate-500">
                  투명하게 녹은 양
                </div>
                <div className="mt-0.5 text-base font-black text-emerald-700">
                  {dissolvedSpoons}숟가락
                </div>
              </div>
              <div className="rounded-xl border border-rose-200 bg-white p-2.5">
                <div className="text-[11px] font-bold text-slate-500">
                  바닥에 쌓인 알갱이
                </div>
                <div className="mt-0.5 text-base font-black text-rose-600">
                  {excessSpoons}숟가락 ({particleCount}개)
                </div>
              </div>
            </div>
          </div>

          {/* 3) 우측 데이터 패널: 가상 실험 vs 실제 측정값 오차 비교 폼 */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    📊 가상 vs 실제 오차 비교표
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    가상 결과와 실제 과학실 값을 나란히 넣어 오차를 확인해요.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={fillAllVirtualSteps}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-extrabold text-indigo-700 hover:bg-indigo-100"
                  >
                    <Sparkles className="h-3 w-3" />
                    가상값 채우기
                  </button>
                  <button
                    type="button"
                    onClick={handleResetComparison}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    비우기
                  </button>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-center text-xs">
                  <thead>
                    <tr className="bg-slate-100 font-extrabold text-slate-700">
                      <th className="py-2.5 px-2">온도</th>
                      <th className="py-2.5 px-2">가상 실험</th>
                      <th className="py-2.5 px-2">실제 측정</th>
                      <th className="py-2.5 px-2">오차</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {groupRecord.dataPoints.map((pt, idx) => {
                      const vRec = virtualRecords[pt.xValue];
                      const virtualVal = vRec?.value ?? null;
                      const realVal = pt.yValue;
                      const diff =
                        virtualVal !== null && realVal !== null
                          ? Number(Math.abs(virtualVal - realVal).toFixed(1))
                          : null;

                      return (
                        <tr key={pt.xValue} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-2 font-black text-slate-800">
                            {pt.stepLabel}
                          </td>
                          <td className="py-2 px-1.5">
                            {virtualVal !== null ? (
                              <div>
                                <span className="font-black text-emerald-700">
                                  {virtualVal}숟가락
                                </span>
                                <div className="text-[10px] font-semibold text-slate-400">
                                  {vRec.waterVolumeMl}mL·{vRec.solute}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-300">
                                미기록
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-1.5">
                            <input
                              type="number"
                              step="any"
                              inputMode="decimal"
                              placeholder="입력"
                              value={realVal === null ? "" : realVal}
                              onChange={(e) =>
                                handleRealMeasuredChange(idx, e.target.value)
                              }
                              className="w-16 rounded-lg border-2 border-slate-200 bg-white px-1.5 py-1 text-center text-xs font-black text-slate-900 outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="py-2 px-1.5">
                            {diff !== null ? (
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-black ${
                                  diff === 0
                                    ? "bg-emerald-100 text-emerald-700"
                                    : diff <= 1
                                      ? "bg-sky-100 text-sky-700"
                                      : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {diff === 0 ? "0 (일치)" : `±${diff}`}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 가상 vs 실제 비교 미니 그래프 */}
            <div className="mt-4">
              <div className="text-xs font-extrabold text-slate-700">
                📈 가상 실험 vs 실제 측정 비교 그래프
              </div>
              <div className="mt-2 h-48 w-full min-w-0">
                {!hasChartData ? (
                  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-xs font-semibold text-slate-400">
                    가상 결과나 실제 측정값을 입력하면 비교 그래프가 그려집니다.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={comparisonChartData}
                      margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fontWeight: 700, fill: "#475569" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fontWeight: 600, fill: "#64748b" }}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Line
                        type="monotone"
                        dataKey="가상실험값"
                        stroke="#059669"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="실제측정값"
                        stroke="#4f46e5"
                        strokeWidth={3}
                        strokeDasharray="5 3"
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI 탐구 코치 (Gemini 2.5 Flash, 최대 5회 제한) + 결론 + 전자칠판 제출 */}
      <AiCoachAndConclusionSection
        config={config}
        studentSession={studentSession}
        groupRecord={groupRecord}
        onUpdateRecord={onUpdateRecord}
        controlViolations={controlViolations}
        activeSimulationSettings={{
          tempC,
          solute,
          spoons,
          waterVolumeMl,
          maxCapacity,
          dissolvedSpoons,
          excessSpoons,
        }}
      />

      {/* 익명 과학 탐구 설문 및 소감 */}
      <AnonymousSurveySection config={config} studentSession={studentSession} />
    </div>
  );
}
