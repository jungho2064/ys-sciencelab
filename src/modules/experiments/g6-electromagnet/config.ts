import type { ExperimentConfig } from "../types";

export const g6ElectromagnetConfig: ExperimentConfig = {
  id: "g6-electromagnet",
  grade: 6,
  semester: 2,
  unitNumber: 1,
  unitName: "전기의 이용",
  title: "전지 연결 개수에 따른 전자석의 세기",
  subtitle: "직렬로 연결한 전지의 수를 늘리면 전자석에 클립이 몇 개나 붙을까요?",
  achievementStandard: {
    code: "[6과13-03]",
    description:
      "전자석을 만들어 영구 자석과 비교하고 전자석의 세기에 영향을 주는 요인을 탐구할 수 있다.",
  },
  independentVariables: [
    {
      id: "battery-count",
      name: "직렬 연결한 전지의 수",
      unit: "개",
      presetValues: [1, 2, 3, 4],
      min: 1,
      max: 4,
      step: 1,
      description: "1.5V 건전지를 1개부터 4개까지 직렬로 연결하며 비교해요.",
    },
  ],
  controlledVariables: [
    {
      id: "coil-turns",
      name: "에나멜선 감은 수",
      fixedValue: "쇠못에 80회 감기로 고정",
      checkLabel: "에나멜선을 감은 횟수(80회)를 바꾸지 않고 똑같은 전자석을 썼나요?",
    },
    {
      id: "iron-nail",
      name: "쇠못의 크기와 종류",
      fixedValue: "열처리된 같은 길이의 둥근 머리 쇠못",
      checkLabel: "같은 크기와 재질의 쇠못 전자석으로 실험했나요?",
    },
    {
      id: "clip-size",
      name: "클립의 크기와 전자석 접촉 부위",
      fixedValue: "작은 철 클립 사용, 쇠못 머리 끝부분에만 붙이기",
      checkLabel: "모두 같은 크기의 클립을 사용하고 쇠못 머리 끝부분에만 대었나요?",
    },
  ],
  dependentVariable: {
    name: "붙은 클립의 수",
    unit: "개",
    chartType: "bar",
  },
  safetyNotes: [
    "스위치를 너무 오랫동안 누르고 있으면 에나멜선과 전지가 뜨거워지니 측정할 때만 눌러요.",
    "에나멜선 양 끝의 피복을 사포로 벗길 때 손가락이 다치지 않도록 조심해요.",
  ],
  inquiryTip:
    "직렬로 연결한 전지의 개수가 많아질수록 코일에 흐르는 전류의 세기가 세져서 전자석도 강해져요!",
  themeColor: "violet",
  iconName: "Magnet",
  simulateValue: (xValue: number) => Math.round(xValue * 6),
};
