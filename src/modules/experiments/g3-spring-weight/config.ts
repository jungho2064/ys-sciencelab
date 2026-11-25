import type { ExperimentConfig } from "../types";

export const g3SpringWeightConfig: ExperimentConfig = {
  id: "g3-spring-weight",
  grade: 3,
  semester: 1,
  unitNumber: 1,
  unitName: "힘과 우리 생활",
  title: "추의 무게와 용수철이 늘어난 길이",
  subtitle: "용수철에 매단 추의 개수를 늘리면 용수철의 길이는 어떻게 변할까요?",
  achievementStandard: {
    code: "[4과01-02]",
    description:
      "물체의 무게와 늘어난 용수철의 길이 사이의 관계를 실험을 통해 탐구할 수 있다.",
  },
  independentVariables: [
    {
      id: "weight-count",
      name: "매단 추의 개수",
      unit: "개",
      presetValues: [1, 2, 3, 4, 5],
      min: 0,
      max: 6,
      step: 1,
      description: "무게가 같은 추를 1개부터 5개까지 차례대로 늘려 매달아요.",
    },
  ],
  controlledVariables: [
    {
      id: "same-spring",
      name: "용수철의 종류와 처음 길이",
      fixedValue: "같은 용수철 사용 (처음 길이 일정)",
      checkLabel: "실험하는 동안 처음과 똑같은 용수철을 사용했나요?",
    },
    {
      id: "same-unit-weight",
      name: "추 1개의 무게",
      fixedValue: "모두 20g짜리 추로 통일",
      checkLabel: "매다는 추 1개의 무게가 모두 똑같은지 확인했나요?",
    },
    {
      id: "eye-level",
      name: "눈금을 읽는 눈높이",
      fixedValue: "용수철 끝 표시선과 수평 맞추기",
      checkLabel: "자가 흔들리지 않게 멈춘 뒤 눈높이를 수평으로 맞춰 읽었나요?",
    },
  ],
  dependentVariable: {
    name: "용수철이 늘어난 길이",
    unit: "cm",
    chartType: "line",
  },
  safetyNotes: [
    "용수철을 너무 세게 잡아당기면 원래 모양으로 돌아오지 않으니 주의해요.",
    "추가 발등이나 책상 아래로 떨어지지 않게 고리에 단단히 걸어요.",
  ],
  inquiryTip:
    "추의 개수가 1개, 2개, 3개로 늘어날 때 늘어난 길이가 몇 cm씩 일정하게 커지는지 살펴보세요!",
  themeColor: "amber",
  iconName: "Scale",
  simulateValue: (xValue: number) => Number((xValue * 2.0).toFixed(1)),
};
