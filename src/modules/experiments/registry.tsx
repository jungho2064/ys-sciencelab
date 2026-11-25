"use client";

import { createElement, type ComponentType } from "react";
import dynamic from "next/dynamic";
import type { ExperimentModuleProps } from "./types";

function ExperimentLoadingFallback() {
  return (
    <div className="rounded-3xl border-2 border-slate-200 bg-white p-10 text-center shadow-xs">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      <p className="mt-4 text-base font-extrabold text-slate-800">
        실험실 교구와 기록장을 불러오고 있어요...
      </p>
      <p className="mt-1 text-xs text-slate-500">
        선택한 학년·단원 플러그인 모듈을 동적으로 준비 중입니다.
      </p>
    </div>
  );
}

/**
 * 단원별 실험 컴포넌트 동적 로더 레지스트리 (`next/dynamic` 코드 스플리팅)
 * 메인 화면에서 학년(3~6학년)과 단원을 선택했을 때 해당 단원의 번들만 온디맨드로 로드됩니다.
 *
 * [내년 2월 새 학년/단원 추가 방법]
 * 1. `src/modules/experiments/<새-단원-폴더>/` 안에 `config.ts`와 `ExperimentModule.tsx` 생성
 * 2. `src/modules/experiments/configs.ts` 배열에 config 추가
 * 3. 아래 `DYNAMIC_EXPERIMENT_MODULES` 객체에 `dynamic(() => import(...))` 1줄 추가!
 */
export const DYNAMIC_EXPERIMENT_MODULES: Record<
  string,
  ComponentType<ExperimentModuleProps>
> = {
  "g3-spring-weight": dynamic(
    () => import("./g3-spring-weight/ExperimentModule"),
    { loading: () => <ExperimentLoadingFallback /> }
  ),
  "g4-shadow-size": dynamic(
    () => import("./g4-shadow-size/ExperimentModule"),
    { loading: () => <ExperimentLoadingFallback /> }
  ),
  "sample-dissolution": dynamic(
    () => import("./sample-dissolution/ExperimentModule"),
    { loading: () => <ExperimentLoadingFallback /> }
  ),
  "g5-dissolution-temp": dynamic(
    () => import("./g5-dissolution-temp/ExperimentModule"),
    { loading: () => <ExperimentLoadingFallback /> }
  ),
  "g6-electromagnet": dynamic(
    () => import("./g6-electromagnet/ExperimentModule"),
    { loading: () => <ExperimentLoadingFallback /> }
  ),
};

export function hasDynamicExperimentModule(experimentId: string): boolean {
  return Boolean(DYNAMIC_EXPERIMENT_MODULES[experimentId]);
}

export function DynamicExperimentHost(
  props: ExperimentModuleProps & { experimentId: string }
) {
  const { experimentId, ...moduleProps } = props;
  const target = DYNAMIC_EXPERIMENT_MODULES[experimentId];
  if (!target) return null;
  return createElement(target, moduleProps);
}
