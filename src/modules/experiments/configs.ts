import type { ExperimentConfig, GradeLevel } from "./types";
import { g3SpringWeightConfig } from "./g3-spring-weight/config";
import { g4ShadowSizeConfig } from "./g4-shadow-size/config";
import { g5DissolutionTempConfig } from "./g5-dissolution-temp/config";
import { g6ElectromagnetConfig } from "./g6-electromagnet/config";

/**
 * 전체 실험 단원 플러그인 메타데이터 목록 (가벼운 순수 설정 객체)
 * 새 실험 모듈을 추가할 때 이곳에 config만 등록하면
 * 서버 API와 클라이언트 화면 양쪽에서 자동으로 학년/단원 목록을 인식합니다.
 */
export const EXPERIMENT_CONFIGS: ExperimentConfig[] = [
  g3SpringWeightConfig,
  g4ShadowSizeConfig,
  g5DissolutionTempConfig,
  g6ElectromagnetConfig,
];

export function getExperimentsByGrade(grade: GradeLevel): ExperimentConfig[] {
  return EXPERIMENT_CONFIGS.filter((cfg) => cfg.grade === grade).sort(
    (a, b) => a.semester - b.semester || a.unitNumber - b.unitNumber
  );
}

export function getExperimentConfigById(
  id: string
): ExperimentConfig | undefined {
  return EXPERIMENT_CONFIGS.find((cfg) => cfg.id === id);
}
