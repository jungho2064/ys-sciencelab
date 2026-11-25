/**
 * [새 실험 모듈 추가용 템플릿]
 * 1. 이 `_template` 폴더를 복사해 `g4-water-boiling` 등 새 폴더 이름으로 바꿉니다.
 * 2. 아래 설정값(학년, 학기, 단원명, 성취기준, 조작변인, 통제변인, 종속변인)을 수정합니다.
 * 3. `src/modules/experiments/registry.ts`에 config와 동적 import 1줄만 추가하면 메인 화면과 전자칠판에 자동 반영됩니다!
 */
import type { ExperimentConfig } from "../types";

export const templateExperimentConfig: ExperimentConfig = {
  id: "g4-template-example",
  grade: 4,
  semester: 2,
  unitNumber: 1,
  unitName: "물의 상태 변화",
  title: "물이 끓을 때 시간에 따른 온도 변화",
  subtitle: "물을 계속 가열하면 온도가 끝없이 올라갈까요, 일정하게 유지될까요?",
  achievementStandard: {
    code: "[4과12-02]",
    description:
      "물이 증발하거나 끓을 때의 변화를 관찰하여 물의 상태 변화를 설명할 수 있다.",
  },
  independentVariables: [
    {
      id: "heating-time",
      name: "가열 시간",
      unit: "분",
      presetValues: [0, 2, 4, 6, 8, 10],
      min: 0,
      max: 10,
      step: 2,
      description: "2분 간격으로 초시계를 보며 물의 온도를 측정해요.",
    },
  ],
  controlledVariables: [
    {
      id: "initial-water-amount",
      name: "처음 물의 양",
      fixedValue: "삼각 플라스크에 물 100mL",
      checkLabel: "처음 물의 양을 눈금에 맞춰 일정하게 넣었나요?",
    },
    {
      id: "flame-strength",
      name: "가열 장치의 불꽃 세기",
      fixedValue: "핫플레이트 눈금 고정",
      checkLabel: "실험 도중 가열 세기를 바꾸지 않고 일정하게 유지했나요?",
    },
  ],
  dependentVariable: {
    name: "물의 온도",
    unit: "°C",
    chartType: "line",
  },
  safetyNotes: [
    "끓는 물과 수증기에 화상을 입지 않도록 보안경과 실험 장갑을 착용해요.",
  ],
  inquiryTip: "물이 보글보글 끓기 시작한 뒤에도 온도가 계속 변하는지 확인해 보세요!",
  themeColor: "sky",
  iconName: "Flame",
  simulateValue: (xValue: number) => Math.min(100, 24 + xValue * 12),
};
