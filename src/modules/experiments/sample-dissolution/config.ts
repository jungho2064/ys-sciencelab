import type { ExperimentConfig } from "../types";

export type SoluteType = "설탕" | "소금";
export type WaterVolumeMl = 50 | 100;

export const PARTICLES_PER_EXCESS_SPOON = 5;

/**
 * 초등 5학년 '용해와 용액' 교육과정 기반 용해도 공식 (약숟가락 단위)
 * - 설탕: 물의 온도가 높아질수록 녹는 양이 크게 증가 (50mL 기준 20°C=2, 40°C=4, 60°C=6, 80°C=8)
 * - 소금: 물의 온도가 변해도 녹는 양의 변화가 거의 없음 (50mL 기준 20~50°C=2, 60~80°C=3)
 * - 물의 양이 100mL(2배)가 되면 최대로 녹을 수 있는 양도 2배가 됨
 */
export function calculateMaxDissolvableSpoons(
  tempC: number,
  solute: SoluteType,
  waterVolumeMl: WaterVolumeMl
): number {
  const base50Ml =
    solute === "설탕"
      ? Math.max(1, Math.round(tempC / 10))
      : tempC >= 60
        ? 3
        : 2;

  return waterVolumeMl === 100 ? base50Ml * 2 : base50Ml;
}

export const sampleDissolutionConfig: ExperimentConfig = {
  id: "sample-dissolution",
  grade: 5,
  semester: 1,
  unitNumber: 4,
  unitName: "용해와 용액",
  title: "물의 온도에 따른 용해도 (시각적 가상 실험)",
  subtitle:
    "물의 온도, 용질(설탕·소금), 물의 양을 조절하며 녹는 양과 비커 바닥에 남는 알갱이를 관찰해요!",
  achievementStandard: {
    code: "[6과03-02]",
    description:
      "물의 온도에 따라 용질이 물에 녹는 양이 달라짐을 실험을 통해 설명할 수 있다.",
  },
  independentVariables: [
    {
      id: "water-temperature",
      name: "물의 온도",
      unit: "°C",
      presetValues: [20, 40, 60, 80],
      min: 20,
      max: 80,
      step: 5,
      description: "물의 온도를 20°C부터 80°C까지 다르게 변화시키며 관찰해요.",
    },
  ],
  controlledVariables: [
    {
      id: "water-volume",
      name: "물의 양",
      fixedValue: "50mL로 똑같게 유지",
      checkLabel: "모든 온도 단계에서 비커의 물의 양을 50mL로 똑같게 맞추었나요?",
    },
    {
      id: "solute-type",
      name: "용질의 종류",
      fixedValue: "설탕 또는 소금 중 한 가지로 통일",
      checkLabel: "온도별로 비교할 때 같은 종류의 용질만 사용했나요?",
    },
    {
      id: "spoon-amount",
      name: "약숟가락 한 스푼의 양",
      fixedValue: "평평하게 깎아서 1숟가락씩 일정하게 넣기",
      checkLabel: "매번 같은 크기의 숟가락으로 일정한 양씩 넣었나요?",
    },
  ],
  dependentVariable: {
    name: "완전히 녹은 양",
    unit: "숟가락",
    chartType: "line",
  },
  safetyNotes: [
    "실제 과학실에서 60°C~80°C의 뜨거운 물을 다룰 때는 반드시 면장갑이나 비커 집게를 사용해요.",
    "가상 실험에서도 물의 양(50mL/100mL)이나 용질이 중간에 바뀌면 공정한 실험이 되지 않으니 주의해요!",
  ],
  inquiryTip:
    "20°C, 40°C, 60°C, 80°C일 때 각각 몇 숟가락까지 투명하게 녹는지 숫자로 비교해 보고, 설탕과 소금의 차이도 찾아보세요!",
  themeColor: "emerald",
  iconName: "FlaskConical",
  simulateValue: (xValue: number) =>
    calculateMaxDissolvableSpoons(xValue, "설탕", 50),
};
