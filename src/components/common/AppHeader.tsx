"use client";

import Link from "next/link";
import { FlaskConical, MonitorPlay, UserCheck, RefreshCw } from "lucide-react";
import type { StudentSession } from "@/modules/experiments/types";

interface AppHeaderProps {
  mode: "student" | "teacher";
  studentSession?: StudentSession | null;
  onEditStudentSession?: () => void;
  onGoHomeUnitList?: () => void;
}

export function AppHeader({
  mode,
  studentSession,
  onEditStudentSession,
  onGoHomeUnitList,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* 브랜드 로고 */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={onGoHomeUnitList}
            className="flex items-center gap-2.5 group"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm transition group-hover:scale-105">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                  Science Lab
                </span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-extrabold text-indigo-700">
                  초등 과학 실험실
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500">
                3~6학년 플러그인형 스마트 탐구 수업 플랫폼
              </p>
            </div>
          </Link>
        </div>

        {/* 우측 모드 전환 및 학생 모둠 표시 */}
        <div className="flex flex-wrap items-center gap-2.5">
          {mode === "student" && studentSession && (
            <button
              type="button"
              onClick={onEditStudentSession}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-xs font-extrabold text-indigo-900 transition hover:bg-indigo-100 sm:text-sm"
            >
              <UserCheck className="h-4 w-4 text-indigo-600" />
              <span>
                {studentSession.grade}학년 {studentSession.classNum}반 ·{" "}
                {studentSession.groupNum}모둠
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-indigo-600 shadow-2xs">
                <RefreshCw className="h-3 w-3" />
                변경
              </span>
            </button>
          )}

          {mode === "student" ? (
            <Link
              href="/teacher"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-slate-800 sm:text-sm"
            >
              <MonitorPlay className="h-4 w-4 text-amber-300" />
              교사(전자칠판) 모드
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-slate-800 transition hover:bg-slate-100 sm:text-sm"
            >
              <FlaskConical className="h-4 w-4 text-indigo-600" />
              학생 실험실 화면으로
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
