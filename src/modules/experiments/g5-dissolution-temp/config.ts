import type { ExperimentConfig } from "../types";

export const g5DissolutionTempConfig: ExperimentConfig = {
  id: "g5-dissolution-temp",
  grade: 5,
  semester: 1,
  unitNumber: 4,
  unitName: "용해와 용액",
  title: "물의 온도에 따라 백반이 용해되는 양",
  subtitle: "물의 온도가 높아지면 물에 녹는 백반의 양은 어떻게 달라질까요?",
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
      step: 10,
      description: "비커에 담긴 물의 온도를 20°C부터 80°C까지 다르게 준비해요.",
    },
  ],
  controlledVariables: [
    {
      id: "water-volume",
      name: "물의 양",
      fixedValue: "눈금실린더로 50mL씩 일정하게 측정",
      checkLabel: "모든 비커에 담긴 처음 물의 양을 50mL로 똑같게 맞추었나요?",
    },
    {
      id: "solute-type",
      name: "용질의 종류",
      fixedValue: "백반 가루만 사용",
      checkLabel: "소금이나 설탕을 섞지 않고 백반 가루만 사용했나요?",
    },
    {
      id: "spoon-amount",
      name: "약숟가락으로 넣는 한 스푼의 양",
      fixedValue: "약숟가락 작은 쪽으로 평평하게 깎아서 넣기",
      checkLabel: "백반을 넣을 때 약숟가락 위를 평평하게 깎아 일정한 양씩 넣었나요?",
    },
  ],
  dependentVariable: {
    name: "완전히 녹은 백반의 양",
    unit: "숟가락",
    chartType: "bar",
  },
  safetyNotes: [
    "뜨거운 물(60°C~80°C)이 담긴 비커를 만질 때는 반드시 면장갑이나 집게를 사용해요.",
    "실험에 사용하는 백반 용액은 절대 맛을 보거나 손으로 만진 뒤 눈을 비비지 않아요.",
  ],
  inquiryTip:
    "바닥에 백반 알갱이가 더 이상 녹지 않고 남기 직전까지 녹은 숟가락 수를 기록해 보세요!",
  themeColor: "emerald",
  iconName: "FlaskConical",
  simulateValue: (xValue: number) => {
    // 20°C: 3숟가락, 40°C: 6숟가락, 60°C: 12숟가락, 80°C: 22숟가락 근사
    if (xValue <= 20) return 3;
    if (xValue <= 30) return 4;
    if (xValue <= 40) return 6;
    if (xValue <= 50) return 9;
    if (xValue <= 60) return 12;
    if (xValue <= 70) return 17;
    return 22;
  },
};
