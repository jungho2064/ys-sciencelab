import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { GradeLevel, GroupLabRecord } from "@/modules/experiments/types";
import { getExperimentConfigById } from "@/modules/experiments/configs";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "lab-sessions.json");

// 서버리스(읽기 전용 파일시스템) 환경을 대비한 인메모리 폴백 저장소
const memoryStore = new Map<string, GroupLabRecord>();
let hydratedFromDisk = false;

async function ensureHydrated(): Promise<void> {
  if (hydratedFromDisk) return;
  hydratedFromDisk = true;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, GroupLabRecord>;
    for (const [key, record] of Object.entries(parsed)) {
      memoryStore.set(key, record);
    }
  } catch {
    // 최초 실행 시 파일 없음 무시
  }
}

async function persistToDisk(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const obj = Object.fromEntries(memoryStore.entries());
    await fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch {
    // 읽기 전용 배포 환경에서는 인메모리 저장소만 유지
  }
}

export async function GET(request: Request) {
  await ensureHydrated();
  const { searchParams } = new URL(request.url);
  const experimentId = searchParams.get("experimentId");
  const gradeParam = searchParams.get("grade");
  const classNumParam = searchParams.get("classNum");
  const groupNumParam = searchParams.get("groupNum");

  let records = Array.from(memoryStore.values());

  if (experimentId) {
    records = records.filter((r) => r.experimentId === experimentId);
  }
  if (gradeParam) {
    const g = Number(gradeParam);
    records = records.filter((r) => r.grade === g);
  }
  if (classNumParam) {
    const c = Number(classNumParam);
    records = records.filter((r) => r.classNum === c);
  }
  if (groupNumParam) {
    const m = Number(groupNumParam);
    records = records.filter((r) => r.groupNum === m);
  }

  return NextResponse.json({ records });
}

interface PostPayload {
  action?: "upsert" | "seed_demo" | "reset_class";
  record?: GroupLabRecord;
  experimentId?: string;
  grade?: GradeLevel;
  classNum?: number;
}

const SAMPLE_CONCLUSIONS: Record<string, string[]> = {
  "g3-spring-weight": [
    "추의 개수가 늘어날수록 용수철이 늘어난 길이도 일정하게 길어집니다.",
    "추를 1개 더 걸 때마다 용수철이 약 2cm씩 규칙적으로 늘어났어요!",
    "물체의 무게가 무거울수록 용수철이 더 많이 늘어납니다.",
    "추의 무게가 2배, 3배가 되면 늘어난 길이도 약 2배, 3배가 됩니다.",
    "용수철이 늘어난 길이는 매단 추의 개수에 비례하여 커집니다.",
  ],
  "g4-shadow-size": [
    "손전등과 물체 사이의 거리가 가까울수록 그림자의 크기가 커집니다!",
    "손전등을 멀리 이동하면 스크린에 생기는 그림자가 점점 작아졌어요.",
    "거리가 멀어질수록 그림자 가로 길이가 줄어드는 규칙을 찾았습니다.",
    "손전등이 10cm일 때 가장 크고 30cm일 때 그림자가 가장 작았어요.",
    "빛이 직진하기 때문에 손전등을 물체에 가까이 대면 그림자가 커집니다.",
  ],
  "g5-dissolution-temp": [
    "물의 온도가 높을수록 물에 녹는 백반의 양이 많아집니다.",
    "20°C보다 80°C의 뜨거운 물에서 백반이 훨씬 많이 녹았어요!",
    "온도가 올라갈수록 녹는 백반 숟가락 수가 빠르게 늘어났습니다.",
    "물의 온도와 백반이 용해되는 양은 온도가 높을수록 커지는 관계예요.",
    "차가운 물에서는 조금만 녹고 따뜻한 물에서는 많이 녹았습니다.",
  ],
  "g6-electromagnet": [
    "직렬로 연결한 전지의 수가 많을수록 전자석에 붙는 클립 수가 많아집니다.",
    "전지를 1개에서 4개로 늘릴수록 전자석의 세기가 점점 강해졌어요!",
    "전지 개수가 늘어날수록 클립이 약 6개씩 더 많이 붙었습니다.",
    "전류가 세게 흐를수록 전자석의 자기력이 세진다는 것을 알게 되었어요.",
    "전지 4개를 연결했을 때 클립이 가장 많이 붙어 전자석이 가장 셌습니다.",
  ],
};

export async function POST(request: Request) {
  await ensureHydrated();
  const body = (await request.json()) as PostPayload;
  const action = body.action ?? "upsert";

  if (action === "upsert" && body.record) {
    const rec: GroupLabRecord = {
      ...body.record,
      updatedAt: new Date().toISOString(),
    };
    memoryStore.set(rec.recordKey, rec);
    await persistToDisk();
    return NextResponse.json({ ok: true, record: rec });
  }

  if (
    action === "seed_demo" &&
    body.experimentId &&
    body.grade &&
    body.classNum
  ) {
    const config = getExperimentConfigById(body.experimentId);
    if (!config) {
      return NextResponse.json(
        { ok: false, error: "실험 모듈을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const indep = config.independentVariables[0];
    const conclusions = SAMPLE_CONCLUSIONS[config.id] ?? [
      "조작변인이 변함에 따라 실험 결과도 규칙적으로 변했습니다.",
    ];
    const now = Date.now();
    const seeded: GroupLabRecord[] = [];

    // 1~6모둠의 현실감 있는 교실 실험 데이터 생성 (완료 4모둠, 측정 중 2모둠)
    const offsets = [-0.2, 0.3, 0.0, -0.4, 0.2, 0.5];
    for (let groupNum = 1; groupNum <= 6; groupNum++) {
      const recordKey = `${config.id}__g${body.grade}-c${body.classNum}-m${groupNum}`;
      const isCompleted = groupNum <= 4 || groupNum === 6;
      const measuredCount = isCompleted
        ? indep.presetValues.length
        : Math.max(2, indep.presetValues.length - (groupNum === 5 ? 2 : 1));

      const dataPoints = indep.presetValues.map((xVal, idx) => {
        if (idx >= measuredCount) {
          return {
            stepLabel: `${xVal}${indep.unit}`,
            xValue: xVal,
            yValue: null,
          };
        }
        const ideal = config.simulateValue(xVal);
        const jitter = offsets[(groupNum + idx) % offsets.length];
        const isIntegerUnit =
          config.dependentVariable.unit === "개" ||
          config.dependentVariable.unit === "숟가락";
        const realisticY = isIntegerUnit
          ? Math.max(0, Math.round(ideal + jitter * 2.2))
          : Math.max(0, Number((ideal + jitter).toFixed(1)));

        return {
          stepLabel: `${xVal}${indep.unit}`,
          xValue: xVal,
          yValue: realisticY,
        };
      });

      const checkedIds = isCompleted
        ? config.controlledVariables.map((c) => c.id)
        : config.controlledVariables.slice(0, 2).map((c) => c.id);

      const rec: GroupLabRecord = {
        recordKey,
        experimentId: config.id,
        grade: body.grade,
        classNum: body.classNum,
        groupNum,
        status: isCompleted ? "completed" : "measuring",
        controlledCheckedIds: checkedIds,
        dataPoints,
        conclusion: isCompleted
          ? conclusions[(groupNum - 1) % conclusions.length]
          : "",
        updatedAt: new Date(now - (6 - groupNum) * 25000).toISOString(),
      };

      memoryStore.set(recordKey, rec);
      seeded.push(rec);
    }

    await persistToDisk();
    return NextResponse.json({ ok: true, records: seeded });
  }

  if (
    action === "reset_class" &&
    body.experimentId &&
    body.grade &&
    body.classNum
  ) {
    const prefix = `${body.experimentId}__g${body.grade}-c${body.classNum}-`;
    for (const key of Array.from(memoryStore.keys())) {
      if (key.startsWith(prefix)) {
        memoryStore.delete(key);
      }
    }
    await persistToDisk();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, error: "잘못된 요청 형식입니다." },
    { status: 400 }
  );
}
