import type { ComponentType } from "react";

export type GradeLevel = 3 | 4 | 5 | 6;
export type Semester = 1 | 2;
export type ThemeColor = "amber" | "sky" | "emerald" | "violet";

export interface IndependentVariableConfig {
  id: string;
  /** 조작변인 이름 (다르게 해야 할 조건) */
  name: string;
  /** 측정 단위 (예: 개, cm, °C) */
  unit: string;
  /** 실험 표에 기본으로 제시할 측정 단계 값 목록 */
  presetValues: number[];
  /** 가상 시뮬레이터 슬라이더 범위 */
  min: number;
  max: number;
  step: number;
  /** 초등학생 눈높이 설명 */
  description: string;
}

export interface ControlledVariableConfig {
  id: string;
  /** 통제변인 이름 (같게 해야 할 조건) */
  name: string;
  /** 고정할 기준 조건 */
  fixedValue: string;
  /** 실험 전 모둠원 스스로 점검하는 체크리스트 문구 */
  checkLabel: string;
}

export interface DependentVariableConfig {
  /** 종속변인 이름 (측정할 실험 결과) */
  name: string;
  /** 결과 단위 */
  unit: string;
  /** 기본 추천 차트 형태 */
  chartType: "line" | "bar";
}

export interface ExperimentConfig {
  /** 고유 모듈 식별자 (폴더명과 동일 권장) */
  id: string;
  /** 대상 학년 (3~6학년) */
  grade: GradeLevel;
  /** 학기 (1~2학기) */
  semester: Semester;
  /** 단원 번호 */
  unitNumber: number;
  /** 교과서 단원명 */
  unitName: string;
  /** 실험 주제명 */
  title: string;
  /** 호기심을 자극하는 탐구 질문 */
  subtitle: string;
  /** 교육과정 성취기준 정보 */
  achievementStandard: {
    code: string;
    description: string;
  };
  /** 조작변인 목록 (다르게 하는 조건) */
  independentVariables: IndependentVariableConfig[];
  /** 통제변인 목록 (같게 하는 조건) */
  controlledVariables: ControlledVariableConfig[];
  /** 종속변인 (실험을 통해 측정하는 값) */
  dependentVariable: DependentVariableConfig;
  /** 실험실 안전 약속 */
  safetyNotes: string[];
  /** 규칙성 발견 힌트 */
  inquiryTip: string;
  /** 학년/단원 테마 색상 */
  themeColor: ThemeColor;
  /** 단원 대표 아이콘 식별자 */
  iconName: "Scale" | "Sun" | "Flame" | "Magnet" | "FlaskConical" | "Sparkles";
  /** 가상 실험 시뮬레이션 및 교사용 예시 데이터 산출 함수 */
  simulateValue: (xValue: number) => number;
}

export interface ExperimentDataPoint {
  stepLabel: string;
  xValue: number;
  yValue: number | null;
}

export type LabProgressStatus = "ready" | "measuring" | "completed";

export interface StudentSession {
  grade: GradeLevel;
  classNum: number; // 1~10반
  groupNum: number; // 1~6모둠
}

export interface GroupLabRecord {
  /** 고유 키: `${experimentId}__g${grade}-c${classNum}-m${groupNum}` */
  recordKey: string;
  experimentId: string;
  grade: GradeLevel;
  classNum: number;
  groupNum: number;
  status: LabProgressStatus;
  controlledCheckedIds: string[];
  dataPoints: ExperimentDataPoint[];
  conclusion: string;
  updatedAt: string;
}

export interface ExperimentModuleProps {
  config: ExperimentConfig;
  studentSession: StudentSession;
  groupRecord: GroupLabRecord;
  onUpdateRecord: (
    patch: Partial<
      Pick<
        GroupLabRecord,
        "dataPoints" | "controlledCheckedIds" | "conclusion" | "status"
      >
    >
  ) => void;
}

export interface RegisteredExperimentPlugin {
  config: ExperimentConfig;
  Component: ComponentType<ExperimentModuleProps>;
}
