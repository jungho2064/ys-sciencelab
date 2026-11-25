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

export interface SimulationDataEntry {
  xValue: number;
  simulatedY: number;
  recordedAt: string;
}

export type LabProgressStatus = "ready" | "measuring" | "completed";

export interface StudentSession {
  grade: GradeLevel;
  classNum: number; // 1~20반
  groupNum: number; // 1~6모둠
}

export interface GroupLabRecord {
  /** DB row UUID (Supabase 연동 시 채워짐) */
  id?: string;
  /** science_lab.classes.id */
  classId?: string;
  /** 고유 키: `${experimentId}__g${grade}-c${classNum}-m${groupNum}` */
  recordKey: string;
  experimentId: string;
  grade: GradeLevel;
  classNum: number;
  groupNum: number;
  status: LabProgressStatus;
  controlledCheckedIds: string[];
  dataPoints: ExperimentDataPoint[];
  /** 가상 실험 시뮬레이터 조작 이력 (simulation_data JSON) */
  simulationLog: SimulationDataEntry[];
  /** AI 탐구 코칭 사용 횟수 (연구대회 분석용) */
  aiFeedbackCount: number;
  /** 변인·측정값 수정 횟수 (연구대회 분석용) */
  revisionCount: number;
  conclusion: string;
  updatedAt: string;
}

export type GroupLabRecordPatch = Partial<
  Pick<
    GroupLabRecord,
    | "dataPoints"
    | "controlledCheckedIds"
    | "simulationLog"
    | "aiFeedbackCount"
    | "revisionCount"
    | "conclusion"
    | "status"
  >
>;

export interface ExperimentModuleProps {
  config: ExperimentConfig;
  studentSession: StudentSession;
  groupRecord: GroupLabRecord;
  onUpdateRecord: (patch: GroupLabRecordPatch) => void;
}

export interface RegisteredExperimentPlugin {
  config: ExperimentConfig;
  Component: ComponentType<ExperimentModuleProps>;
}

/** Supabase `science_lab.classes` 테이블 행 타입 */
export interface DbClassRow {
  id: string;
  grade: number;
  class_num: number;
  teacher_pin: string;
  created_at: string;
}

/** Supabase `science_lab.controlled_vars` JSON 항목 타입 */
export interface DbControlledVarJson {
  id: string;
  name: string;
  fixedValue: string;
  checked: boolean;
}

/** Supabase `science_lab.independent_var` JSON 타입 */
export interface DbIndependentVarJson {
  id: string;
  name: string;
  unit: string;
  presetValues: number[];
}

/** Supabase `science_lab.experiment_logs` 테이블 행 타입 */
export interface DbExperimentLogRow {
  id: string;
  class_id: string;
  experiment_slug: string;
  group_num: number;
  status: LabProgressStatus;
  independent_var: DbIndependentVarJson;
  controlled_vars: DbControlledVarJson[];
  measured_data: ExperimentDataPoint[];
  simulation_data: SimulationDataEntry[];
  ai_feedback_count: number;
  revision_count: number;
  conclusion: string;
  updated_at: string;
}

/** Supabase `science_lab.survey_logs` 테이블 행 타입 */
export interface DbSurveyLogRow {
  id: string;
  class_id: string | null;
  anon_student_code: string;
  survey_phase: "pre" | "post" | "reflection";
  experiment_slug: string | null;
  interest_score: number | null;
  inquiry_confidence_score: number | null;
  collaboration_score: number | null;
  responses: Record<string, unknown>;
  reflection_text: string;
  created_at: string;
}
