import { NextResponse } from "next/server";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { getExperimentConfigById } from "@/modules/experiments/configs";

const MAX_AI_FEEDBACK_PER_SESSION = 5;
const GEMINI_MODEL_CANDIDATES = Array.from(
  new Set([
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash-lite",
  ])
);

// 서버 재시작 전까지 동일 모둠의 호출 횟수를 이중 방어하기 위한 인메모리 카운터
const sessionUsageFallback = new Map<string, number>();

interface CoachRequestBody {
  experimentId: string;
  grade: number;
  classNum: number;
  groupNum: number;
  clientFeedbackCount?: number;
  controlledCheckedIds?: string[];
  controlViolations?: string[];
  activeSimulationSettings?: Record<string, unknown>;
  simulationLog?: Array<Record<string, unknown>>;
  measuredData?: Array<{
    stepLabel: string;
    xValue: number;
    yValue: number | null;
  }>;
  conclusion?: string;
}

function getServerSupabaseDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "science_lab";
  if (!url || !key) return null;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.schema(schema);
}

async function readDbFeedbackState(
  grade: number,
  classNum: number,
  experimentId: string,
  groupNum: number
): Promise<{ classId: string | null; logId: string | null; count: number }> {
  try {
    const db = getServerSupabaseDb();
    if (!db) return { classId: null, logId: null, count: 0 };

    const { data: cls } = await db
      .from("classes")
      .select("id")
      .eq("grade", grade)
      .eq("class_num", classNum)
      .maybeSingle<{ id: string }>();

    if (!cls) return { classId: null, logId: null, count: 0 };

    const { data: log } = await db
      .from("experiment_logs")
      .select("id, ai_feedback_count")
      .eq("class_id", cls.id)
      .eq("experiment_slug", experimentId)
      .eq("group_num", groupNum)
      .maybeSingle<{ id: string; ai_feedback_count: number }>();

    return {
      classId: cls.id,
      logId: log?.id ?? null,
      count: log?.ai_feedback_count ?? 0,
    };
  } catch {
    return { classId: null, logId: null, count: 0 };
  }
}

async function persistDbFeedbackCount(
  logId: string | null,
  nextCount: number
): Promise<void> {
  if (!logId) return;
  try {
    const db = getServerSupabaseDb();
    if (!db) return;
    await db
      .from("experiment_logs")
      .update({ ai_feedback_count: nextCount })
      .eq("id", logId);
  } catch {
    // DB 업데이트 실패 시에도 클라이언트 upsert가 이어서 동기화
  }
}

function limitToTwoSentences(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const matches = cleaned.match(/[^.!?]+[.!?]+/g);
  if (!matches || matches.length === 0) {
    return cleaned;
  }
  return matches.slice(0, 2).join(" ").trim();
}

export async function POST(request: Request) {
  let body: CoachRequestBody;
  try {
    body = (await request.json()) as CoachRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: "잘못된 요청 형식입니다." },
      { status: 400 }
    );
  }

  const {
    experimentId,
    grade,
    classNum,
    groupNum,
    clientFeedbackCount = 0,
    controlledCheckedIds = [],
    controlViolations = [],
    activeSimulationSettings,
    simulationLog = [],
    measuredData = [],
    conclusion = "",
  } = body;

  if (!experimentId || !grade || !classNum || !groupNum) {
    return NextResponse.json(
      { ok: false, message: "학년·반·모둠 및 실험 ID 정보가 필요합니다." },
      { status: 400 }
    );
  }

  const usageKey = `${experimentId}__g${grade}-c${classNum}-m${groupNum}`;
  const dbState = await readDbFeedbackState(
    grade,
    classNum,
    experimentId,
    groupNum
  );
  const memCount = sessionUsageFallback.get(usageKey) ?? 0;
  const currentCount = Math.max(dbState.count, memCount, clientFeedbackCount);

  // 비용 방어: 1차시 모둠당 최대 5회 제한
  if (currentCount >= MAX_AI_FEEDBACK_PER_SESSION) {
    sessionUsageFallback.set(usageKey, currentCount);
    return NextResponse.json(
      {
        ok: false,
        limitReached: true,
        aiFeedbackCount: currentCount,
        maxCount: MAX_AI_FEEDBACK_PER_SESSION,
        message: `이번 차시 AI 탐구 코칭 기회(${MAX_AI_FEEDBACK_PER_SESSION}회)를 모두 사용했어요! 이제 모둠 친구들과 함께 실험 결과를 정리해 볼까요?`,
      },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "서버에 GEMINI_API_KEY가 설정되지 않아 AI 코칭을 호출할 수 없습니다.",
      },
      { status: 503 }
    );
  }

  const cfg = getExperimentConfigById(experimentId);
  const uncheckedVars =
    cfg?.controlledVariables
      .filter((cv) => !controlledCheckedIds.includes(cv.id))
      .map((cv) => `${cv.name} (기준: ${cv.fixedValue})`) ?? [];

  const filledMeasured = measuredData.filter((d) => d.yValue !== null);
  const hasNumericInConclusion = /\d/.test(conclusion);

  const systemInstruction = `당신은 대한민국 초등학교 과학 전담 수업을 돕는 다정하고 명쾌한 'AI 과학 탐구 코치'입니다.
다음 규칙을 반드시 지키세요:
1. 실험의 정답("온도가 높을수록 많이 녹아요", "설탕이 8숟가락 녹아요" 등)이나 완성된 결론 문장을 절대 직접 알려주지 마세요.
2. 학생이 통제변인을 잘못 설정했거나(예: 물의 양을 50mL/100mL로 다르게 두거나, 용질을 섞거나, 통제변인 체크를 빠뜨림) 결론에 구체적인 수치(예: 온도 °C, 숟가락 수 등)가 빠져 있다면, 학생이 스스로 오류나 빈틈을 깨닫도록 소크라테스식 질문으로 힌트를 주세요.
3. 초등학생(${grade}학년) 눈높이에 맞는 쉬운 말로, 반드시 2문장 이내(1~2문장)로만 대답하세요. 3문장 이상 절대 쓰지 마세요.`;

  const userPrompt = [
    `[실험 정보]`,
    `- 대상: ${grade}학년 ${classNum}반 ${groupNum}모둠`,
    `- 단원/주제: ${cfg ? `${cfg.unitName} - ${cfg.title}` : experimentId}`,
    `- 조작변인: ${cfg?.independentVariables.map((v) => `${v.name}(${v.unit})`).join(", ") ?? "실험 단계"}`,
    `- 종속변인: ${cfg ? `${cfg.dependentVariable.name}(${cfg.dependentVariable.unit})` : "측정 결과"}`,
    ``,
    `[학생의 현재 변인 설계 및 조작 상태]`,
    `- 통제변인 체크리스트 미확인 항목: ${uncheckedVars.length > 0 ? uncheckedVars.join(", ") : "모두 확인함"}`,
    `- 감지된 통제변인 오류: ${controlViolations.length > 0 ? controlViolations.join(" / ") : "특이 오류 없음"}`,
    `- 현재 시뮬레이터 설정: ${activeSimulationSettings ? JSON.stringify(activeSimulationSettings) : "없음"}`,
    `- 가상 실험 누적 기록: ${simulationLog.length > 0 ? JSON.stringify(simulationLog.slice(-6)) : "아직 기록 없음"}`,
    ``,
    `[실제 측정값 및 결론]`,
    `- 입력된 측정 데이터(${filledMeasured.length}/${measuredData.length}단계): ${JSON.stringify(measuredData)}`,
    `- 학생 작성 결론: "${conclusion.trim() || "(아직 작성하지 않음)"}"`,
    `- 결론 내 구체적 숫자 포함 여부: ${hasNumericInConclusion ? "포함됨" : "숫자 없음"}`,
    ``,
    `위 상태를 점검하여 가장 중요한 한 가지 포인트에 대해 초등학생 눈높이의 소크라테스식 질문 2문장 이내로 코칭해 주세요.`,
  ].join("\n");

  try {
    const ai = new GoogleGenAI({ apiKey });
    let responseText = "";
    let usedModel = GEMINI_MODEL_CANDIDATES[0];
    let lastErr: unknown = null;

    for (const modelName of GEMINI_MODEL_CANDIDATES) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.4,
            maxOutputTokens: 800,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        const text = response.text?.trim() ?? "";
        if (text) {
          responseText = text;
          usedModel = modelName;
          break;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!responseText && lastErr) {
      throw lastErr;
    }

    const feedback =
      limitToTwoSentences(responseText) ||
      "우리 모둠이 같게 유지해야 할 조건을 잘 지켰는지와 결론에 측정한 숫자가 들어갔는지 함께 살펴볼까요?";

    const nextCount = currentCount + 1;
    sessionUsageFallback.set(usageKey, nextCount);
    await persistDbFeedbackCount(dbState.logId, nextCount);

    return NextResponse.json({
      ok: true,
      feedback,
      aiFeedbackCount: nextCount,
      maxCount: MAX_AI_FEEDBACK_PER_SESSION,
      remainingCount: Math.max(0, MAX_AI_FEEDBACK_PER_SESSION - nextCount),
      model: usedModel,
    });
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : "AI 코칭 호출 중 오류가 발생했습니다.";
    return NextResponse.json(
      {
        ok: false,
        aiFeedbackCount: currentCount,
        maxCount: MAX_AI_FEEDBACK_PER_SESSION,
        message: `AI 탐구 코치 연결 중 문제가 발생했습니다. (${errMsg})`,
      },
      { status: 502 }
    );
  }
}
