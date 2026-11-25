import type { ExperimentConfig } from "../types";

export const g4ShadowSizeConfig: ExperimentConfig = {
  id: "g4-shadow-size",
  grade: 4,
  semester: 1,
  unitNumber: 3,
  unitName: "그림자와 거울",
  title: "손전등과 물체 사이의 거리에 따른 그림자 크기",
  subtitle: "손전등을 물체에 가까이 가져가면 그림자의 크기는 어떻게 달라질까요?",
  achievementStandard: {
    code: "[4과07-02]",
    description:
      "물체와 손전등 사이의 거리에 따라 그림자의 크기가 달라짐을 실험을 통해 설명할 수 있다.",
  },
  independentVariables: [
    {
      id: "light-object-distance",
      name: "손전등과 물체 사이의 거리",
      unit: "cm",
      presetValues: [10, 15, 20, 25, 30],
      min: 10,
      max: 30,
      step: 5,
      description: "손전등과 물체 사이의 거리를 5cm씩 멀리 이동하며 측정해요.",
    },
  ],
  controlledVariables: [
    {
      id: "object-screen-distance",
      name: "물체와 스크린 사이의 거리",
      fixedValue: "15cm로 고정",
      checkLabel: "물체와 스크린 사이의 거리를 움직이지 않고 고정했나요?",
    },
    {
      id: "same-object",
      name: "물체의 모양과 크기",
      fixedValue: "가로 6cm 모양 판 사용",
      checkLabel: "실험 도중 물체를 바꾸지 않고 같은 모양 판을 사용했나요?",
    },
    {
      id: "light-angle",
      name: "손전등을 비추는 높이와 방향",
      fixedValue: "물체 중심과 수평이 되게 정면에서 비추기",
      checkLabel: "손전등 빛이 물체 한가운데를 똑바로 향하게 비추었나요?",
    },
  ],
  dependentVariable: {
    name: "그림자의 가로 길이",
    unit: "cm",
    chartType: "line",
  },
  safetyNotes: [
    "손전등 불빛을 친구의 눈에 직접 비추지 않도록 꼭 약속해요.",
    "교실 조명을 살짝 어둡게 하면 그림자 끝 경계를 더 정확하게 잴 수 있어요.",
  ],
  inquiryTip:
    "빛이 직진하기 때문에 손전등이 물체에 가까울수록 빛이 넓게 퍼져 그림자가 커져요!",
  themeColor: "sky",
  iconName: "Sun",
  simulateValue: (xValue: number) => {
    // 물체 가로 6cm, 물체-스크린 거리 15cm일 때 기하학적 그림자 길이: 6 * (x + 15) / x
    const raw = (6 * (xValue + 15)) / Math.max(xValue, 5);
    return Number(raw.toFixed(1));
  },
};
