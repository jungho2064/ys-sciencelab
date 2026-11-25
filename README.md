# 🔬 Science Lab (사이언스 랩)

초등 과학 전담 수업 및 교육연구대회 출품용 **플러그인 확장형 초등 과학 스마트 실험실** 웹 애플리케이션입니다.
내년 2월 학년 배정(3~6학년) 이후에도 새로운 실험 단원을 **독립된 폴더 플러그인** 형태로 손쉽게 추가할 수 있도록 설계되었습니다.

---

## ✨ 주요 기능

1. **플러그인형 실험 모듈 아키텍처 (`src/modules/experiments/`)**
   - 각 실험 단원이 독립된 폴더 안에 `config.ts`(학년, 학기, 단원명, 성취기준 코드, 조작변인/통제변인 목록, 종속변인 정보)와 `ExperimentModule.tsx`를 가집니다.
   - 메인 화면에서 **학년(3~6학년)**과 **단원**을 선택하면 `next/dynamic` 코드 스플리팅을 통해 해당 실험 모듈만 온디맨드로 동적 로드됩니다.
   - 기본 제공 샘플 모듈 (전 학년 즉시 시연 가능):
     - **3학년 1학기** (`g3-spring-weight`): 추의 무게와 용수철이 늘어난 길이 `[4과01-02]`
     - **4학년 1학기** (`g4-shadow-size`): 손전등과 물체 사이의 거리에 따른 그림자 크기 `[4과07-02]`
     - **5학년 1학기 [시각적 가상 실험 샘플]** (`sample-dissolution`): 물의 온도에 따른 용해도 (설탕/소금 · 50mL/100mL · 수증기/입자 침전 SVG · 오차 비교) `[6과03-02]`
     - **5학년 1학기** (`g5-dissolution-temp`): 물의 온도에 따라 백반이 용해되는 양 `[6과03-02]`
     - **6학년 2학기** (`g6-electromagnet`): 전지 연결 개수에 따른 전자석의 세기 `[6과13-03]`

2. **학생 모드 (`/`) — 비밀번호 없는 3초 빠른 입장**
   - 회원가입이나 로그인 없이 **[학년 / 반 / 모둠(1~6모둠)]** 버튼만 선택해 즉시 입장합니다.
   - 실험 전 **통제변인 자가 점검 체크리스트**, **단원별 가상 실험 시뮬레이터**, **모둠 측정 기록표 & 실시간 Recharts 그래프(꺾은선/막대 전환)**, **Gemini Flash(`gemini-3.8-flash`) 기반 AI 탐구 코치(`/api/coach`, 모둠당 1차시 최대 5회 제한)**, **규칙성 결론 제출** 기능을 제공합니다.

3. **교사(전자칠판) 모드 (`/teacher`) — 실시간 학급 통합 대시보드 & 연구대회 CSV 분석**
   - 전자칠판 터치 친화형 **관리자 PIN 키패드**로 입장합니다 (`science_lab.classes.teacher_pin` 연동, 기본 PIN: `1234`).
   - **Supabase Realtime (`science_lab.experiment_logs`)** 웹소켓 구독으로 모둠 태블릿에서 변인이나 측정값을 저장하는 즉시 새로고침 없이 비교 그래프가 자동 갱신됩니다.
   - 연구대회 통계 분석을 위한 **[전체 실험 로그 CSV 다운로드]** 및 **[설문 로그 CSV 다운로드]** 버튼을 제공합니다 (UTF-8 BOM 적용으로 엑셀·한셀·SPSS 한글 깨짐 방지).

---

## 🗄️ Supabase 데이터베이스 구조 (`science_lab` 전용 스키마)

- `science_lab.classes`: `id`, `grade`, `class_num`, `teacher_pin`, `created_at`
- `science_lab.experiment_logs`: `id`, `class_id`, `experiment_slug`, `group_num`, `status`, `independent_var`(JSONB), `controlled_vars`(JSONB), `measured_data`(JSONB), `simulation_data`(JSONB), `ai_feedback_count`, `revision_count`, `conclusion`, `updated_at` (**Supabase Realtime 활성화**)
- `science_lab.survey_logs`: `id`, `class_id`, `anon_student_code`, `survey_phase`, `experiment_slug`, `interest_score`, `inquiry_confidence_score`, `collaboration_score`, `responses`(JSONB), `reflection_text`, `created_at`

---

## 📂 폴더 구조

```text
src/
├── app/
│   ├── api/lab-sessions/route.ts   # 모둠 실험 기록 실시간 동기화 API
│   ├── teacher/page.tsx            # 교사(전자칠판) 모드 페이지
│   ├── layout.tsx                  # 루트 한국어 레이아웃
│   └── page.tsx                    # 학생 메인 & 동적 실험실 페이지
├── components/
│   ├── common/AppHeader.tsx        # 상단 공통 헤더 및 모드 전환
│   ├── lab/StandardExperimentWorkspace.tsx # 모든 실험 플러그인 공통 워크스페이스
│   ├── student/ScienceLabHome.tsx  # 학생 빠른 입장 및 학년·단원 선택 허브
│   └── teacher/TeacherDashboard.tsx # 교사용 전자칠판 대시보드
├── lib/
│   └── lab-client.ts               # 실시간 동기화(API + BroadcastChannel) 클라이언트
└── modules/
    └── experiments/                # 🔌 학년별 실험 플러그인 디렉터리
        ├── types.ts                # 실험 모듈 및 변인 공통 타입 정의
        ├── configs.ts              # 실험 설정 목록 등록소
        ├── registry.tsx            # next/dynamic 동적 모듈 로더 레지스트리
        ├── _template/              # 새 실험 단원 추가용 복제 템플릿
        ├── g3-spring-weight/       # 3학년 실험 플러그인
        ├── g4-shadow-size/         # 4학년 실험 플러그인
        ├── g5-dissolution-temp/    # 5학년 실험 플러그인
        └── g6-electromagnet/       # 6학년 실험 플러그인
```

---

## 🧩 새 실험 단원 플러그인 추가 방법 (3단계)

1. `src/modules/experiments/_template` 폴더를 복사하여 새 단원 폴더(예: `g4-water-boiling`)를 만듭니다.
2. 폴더 안의 `config.ts`에서 **학년, 학기, 단원명, 성취기준 코드, 조작변인, 통제변인, 종속변인**을 입력합니다.
3. `src/modules/experiments/configs.ts`와 `src/modules/experiments/registry.tsx`에 각 1줄씩 등록하면 학생 화면과 교사 전자칠판 대시보드에 자동 반영됩니다.

---

## 🚀 실행 및 GitHub 업로드 안내

### 로컬 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000` (학생 화면) 및 `http://localhost:3000/teacher` (교사 전자칠판 화면, 초기 PIN `1234`)로 접속합니다.

### GitHub 저장소(`jungho2064/ys-sciencelab`) 푸시
원격 저장소 `origin`이 `https://github.com/jungho2064/ys-sciencelab.git`으로 설정되어 있습니다.
```bash
git add .
git commit -m "feat: Science Lab 초등 과학 플러그인 실험실 초기 구축"
git push -u origin main
```
