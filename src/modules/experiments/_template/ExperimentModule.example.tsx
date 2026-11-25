"use client";

import { StandardExperimentWorkspace } from "@/components/lab/StandardExperimentWorkspace";
import type { ExperimentModuleProps } from "../types";

/**
 * [새 실험 모듈 기본 뷰 템플릿]
 * 별도의 커스텀 시뮬레이터 그래픽이 없더라도 `StandardExperimentWorkspace`만 연결하면
 * 성취기준 헤더, 조작변인/통제변인 체크리스트, 실험 기록표, Recharts 그래프, 교사 칠판 연동이 즉시 동작합니다.
 */
export default function TemplateExperimentModule(props: ExperimentModuleProps) {
  return <StandardExperimentWorkspace {...props} />;
}
