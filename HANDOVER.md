# MyTodo 인수인계서

> 작성: 2026-09-08 (6회차 세션 종료 시점 — 성능 최적화 2회차를 진행한 세션).
> **가장 먼저 [`requirements.md`](requirements.md)를 전체 읽을 것** — 이 문서는 "지금 상태로 오게 된 맥락과 다음에 뭘 하면 좋을지"만 요약한 보조 문서이고, 기능 스펙의 단일 기준(SSOT)은 항상 `requirements.md`다. 성능 이력은 [`PERF.md`](PERF.md).

## 1. 이 프로젝트가 뭔지

- Claude Code 사용법 학습 + 효율적인 프롬프트 작성법 연습용 실습 프로젝트 (배경: [`BG.md`](BG.md))
- 실습 소재로 실제 회사 업무에 쓸 수 있는 **개인용 TODO 앱**을 Next.js로 만들고 있음
- 사용자는 한국어로 요구사항을 배치 단위로 던지고, 그때마다 구현 후 `requirements.md`를 갱신하는 방식으로 진행해왔음

## 2. 지금 당장 실행하는 법

| 목적 | 실행 |
|---|---|
| 앱을 실제로 쓸 때 | `run.cmd` (프로덕션 빌드, 코드 고치면 재실행 필요) |
| 코드를 개발/수정할 때 | `dev.cmd` (HMR 자동 반영, 느림) |

- 둘 다 http://localhost:3000
- Node가 PowerShell PATH에 안 잡혀 있으면: `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")` (`dev.cmd`/`run.cmd`는 내부에서 처리하므로 무관)
- **DB**: SQLite, `.env`의 `DATABASE_URL`이 가리키는 `dev.db` (`dev.db`/`.env` 둘 다 gitignore). 처음 세팅하는 환경이면 `.env`에 `DATABASE_URL="file:./dev.db"` 만들고 `npx prisma migrate dev`
- 이미 이 PC에서 개발 중이라면 `dev.db`/`.env`가 이미 있고 **사용자의 실제 태스크 데이터**가 들어있음 — 절대 삭제/초기화하지 말 것
- DB는 WAL 모드다. `dev.db-wal`/`dev.db-shm`이 같이 생기고, 최신 데이터가 이 두 파일에 있을 수 있으니 수동으로 옮길 땐 세 파일을 같이
- **마이그레이션은 전부 적용된 상태다** (`npx prisma migrate status` → up to date)
- 부팅할 때마다 `backups/dev-YYYY-MM-DD.db`가 자동 생성된다 (최신 7개 유지, `requirements.md` 10.7절). 앱은 이걸 안 읽으니 무시해도 되고, 재해 복구용으로만 존재
- **이 세션(6회차)은 포트 3000에 `next start`(프로덕션 서버)를 띄워둔 상태로 종료함** — 성능 측정을 위해 프로덕션으로 띄운 것이고, 코드를 고치면 반영이 안 되니 개발을 이어갈 거면 그 프로세스를 종료하고 `dev.cmd`로 다시 띄울 것. 포트 3000이 점유돼 있으면 그 프로세스가 이 프로젝트 것인지 확인 후(포트 3000 응답 확인) PID를 특정해서만 종료할 것 (`taskkill /F /IM node.exe`로 전체 종료 금지)
- 작업 완료 기준: **항상** `npx tsc --noEmit` + `npm run lint` 통과. UI 변경은 브라우저로 직접 클릭 확인. **성능 작업은 반드시 측정값(전/후)을 남길 것** — "빨라진 것 같다"가 아니라 숫자로

## 3. 지금까지 진행 상황

- **6회차 작업은 아직 커밋하지 않았다** (사용자가 커밋을 요청하지 않았음). 최신 커밋은 5회차까지 반영된 `fa53d29`이고, 그 위에 아래 6회차 변경이 워킹 트리에 올라가 있다
- 1~3회차 요약은 `requirements.md` 5~10절, `PERF.md` 참고 (전작: 기능 스캐폴딩 → 성능 최적화 1회차 → 버그수정/캘린더/undo/백업)
- **4회차 요약** (지난 세션, 이번 세션 초반에 커밋만 함 — 상세는 git log `2c1035e` 및 이전 `HANDOVER.md` 버전 참고):
  1. 일반 선택 vs 다중 선택(조합키) 클릭 구분, 편집 진입 조건 변경
  2. 완료 뷰 15일 제한, 전 뷰 정렬 통일(우선순위→생성일)
  3. 캘린더 그리드/패널 겹침 버그 수정, 사이드바·캘린더 분할 크기 드래그 조절
  4. 화면 하단 단축키 바(잠금/재배정), 태스크 메모 기본 펼침, 시작 페이지 설정(쿠키)
- **5회차 요약 (이번 세션, 커밋 `90d414c`)**:
  1. **캘린더에 프로젝트 필터 연결**: 사이드바 프로젝트를 캘린더 페이지에서 누르면 `/calendar?project=...`로 이동, 그리드/패널/미등록 일정 세 곳 모두 필터링. 현재 보던 달/선택 날짜(`month`/`date`)는 유지됨
  2. **캘린더 "미등록 일정" 10개씩 페이지네이션**: `PaginatedTaskList.tsx` 신설, 추가 서버 조회 없이 이미 불러온 목록을 클라이언트에서 잘라서 보여줌 + 이전/다음 버튼

- **6회차 요약 (이번 세션 · 성능 최적화 2회차 — 상세는 `PERF.md` 2회차)**:
  1. **목록 4개 뷰에 서버 페이지네이션 도입** (`?page=N`, DB 쿼리의 `skip`/`take`에서 자름). 사이드바 "⚙ 설정"에 **"페이지당 개수"** 직접 입력 추가(기본 50 · 1~200, 쿠키 `mytodo_page_size`)
  2. 이건 속도 문제만이 아니었다 — **미완료 최상위가 1,000건을 넘으면 목록 화면이 500 에러로 죽고 있었다**(Prisma `P2029`, SQLite 파라미터 한도 999). 실측 임계점 900건 정상 / 1,125건 실패
  3. 캘린더: 그리드 쿼리를 `select`로 좁히고, 관계가 필요한 사이드 패널은 "선택한 하루"만 따로 조회. "미등록 일정"도 같은 서버 페이지네이션으로 통일(`PaginatedTaskList.tsx` 삭제)
  4. 크기 조절 드래그(사이드바·캘린더 분할)에서 리액트 상태를 빼고 **CSS 변수만 갱신**하도록 변경 — 드래그 중 리액트 렌더 0회
  5. 목록 공통 설정(다중 선택 조합키·메모 기본 펼침)을 태스크 행마다 읽던 것을 `TaskList`가 한 번만 읽어 내려주도록 변경
  6. `undoDelete`를 한 트랜잭션으로 묶음(개수만큼 왕복하던 것 → 커밋 1회, 부분 복원 불가)
  7. 빌드 경고(프로젝트 전체 트레이싱) 제거 — `prisma.ts`의 `fs` 호출에 `turbopackIgnore`

## 4. 코드를 새로 읽지 않으면 놓치기 쉬운 것들

### 4.1 6회차에서 새로 생기거나 바뀐 파일

- `src/lib/pageSize.ts` (신규) — 페이지당 개수·페이지 번호 파싱. `startPage.ts`와 같이 `"use client"` 없는 **순수 유틸**(서버/클라이언트 공용, 쿠키 이름·범위 공유 목적)
- `src/components/ListPagination.tsx` (신규) — 목록과 캘린더 "미등록 일정"이 같이 쓴다(`pathname`/`paramName` props로 구분). 버튼이 아니라 `Link`라서 페이지 이동이 곧 새 조회다
- `src/components/PaginatedTaskList.tsx` (**삭제**) — 클라이언트에서 배열을 자르던 방식이라 서버가 전건을 조회하는 문제가 남아 있었음
- `src/app/page.tsx` — 쿠키에서 페이지 크기를 읽고 `count` + `skip`/`take`. 정렬 마지막에 `{ id: "asc" }` 타이브레이커 추가(페이지 경계 중복/누락 방지 — **지우지 말 것**)
- `src/app/calendar/page.tsx` — 그리드용 `select` 축소 / 선택 날짜 전용 쿼리 / 미등록 서버 페이지네이션(`?unscheduled=N`)
- `src/lib/sidebarWidth.ts` — 커스텀 이벤트 + `useState` 구독 방식을 **CSS 변수**(`--mytodo-sidebar-width`)로 교체. `useSidebarWidth`는 없어지고 `SIDEBAR_WIDTH_VAR`/`applySidebarWidth`/`useStoredSidebarWidth`가 생김
- `src/components/CalendarSplit.tsx` — 같은 방식(`--mytodo-calendar-grid-percent`)
- `src/lib/memoSettings.ts` — `useMemoDefaultExpanded()` 훅 추가(+변경 이벤트). `TaskItem`이 각자 읽던 것을 `TaskList`가 한 번만 읽어 props로 내려준다
- `src/components/TaskList.tsx` — 선택 목록을 `useMemo`로 "지금 화면에 있는 id"만 남기도록 파생시킴(페이지가 바뀌면 선택 자동 해제)
- `src/components/CollapsibleSection.tsx` — `defaultOpen` prop 추가(미등록 일정 페이지 이동 시 섹션이 닫히지 않게)

### 4.2 그 이전부터 있던, 코드만 봐선 놓치기 쉬운 설계 결정 (요약 — 상세는 이전 `HANDOVER.md` 버전이나 `requirements.md` 참고)

- `src/lib/startPage.ts`는 다른 `lib` 파일과 달리 `"use client"`가 없는 순수 유틸(서버/클라이언트 공용, 쿠키 이름·타입 공유 목적)
- `Sidebar.tsx`의 "⚙ 설정" 스크롤과 `CollapsibleSection.tsx`(캘린더 "미등록 일정")는 스크롤 대상 컨테이너가 달라서 의도적으로 로직을 통합하지 않음 (`requirements.md`/이전 handover 4.2절)
- `CalendarSplit.tsx`는 `flex-1`/`min-h-*`를 의도적으로 뺐다 — 다시 넣고 싶어지면 겹침 버그 재발하니 주의 (`requirements.md` 5.8절 마지막 항목)

## 5. 브라우저 자동화(`mcp__Claude_Browser__*`) 환경 한계 — 계속 쌓아온 것 + 이번에 새로 겪은 것

- `document.hasFocus()` 항상 `false` → blur 로직은 `dispatchEvent(new FocusEvent('focusout', ...))`로 직접 발생시켜야 함
- Enter 네이티브 암묵 제출 잘 안 먹음 → `form.requestSubmit()` 사용
- 물리 키 입력이 안 닿을 때 있음 → `document.dispatchEvent(new KeyboardEvent('keydown', {key:'x', bubbles:true}))`
- `confirm()`은 `window.confirm = () => true`로 미리 덮어쓸 것
- 토스트/타이머 검증은 "생성 → 액션 → 결과 확인"을 한 번의 `javascript_exec` 호출 안에서 처리할 것
- DOM 전체에 걸친 넓은 셀렉터로 정리하지 말 것 — 항상 자신이 만든 요소의 컨테이너로 스코프
- `requestAnimationFrame`은 pane이 hidden이면 실행 안 됨 — 동기 코드로 짤 것
- 탭을 오래 재사용하며 여러 번 고치면 콘솔 로그가 누적된다 — 의심스러운 에러는 새 탭에서 재확인
- **(신규, 6회차) 리액트 위임 이벤트가 잘 안 잡힌다**: `new FocusEvent('focusout')`/`new KeyboardEvent('keydown')`을 직접 dispatch 해도 리액트의 `onBlur`/`onKeyDown`이 안 불리는 경우가 반복됐다(태스크 편집 폼 자동저장·Ctrl+Enter 저장 둘 다). **`form.requestSubmit()`처럼 네이티브 API를 직접 호출하는 경로는 잘 동작**했으니, 폼 저장을 확인해야 하면 그 쪽을 쓸 것. 반대로 `document.addEventListener`로 직접 건 핸들러(TaskList의 d/r/Esc 단축키)는 dispatch가 잘 먹는다
- **(신규, 6회차) 선택 상태가 측정 사이에 살아남는다**: 클릭 측정을 하고 나면 선택이 남아 있는데, 그 상태로 Ctrl+클릭을 더해 일괄 삭제를 하면 **의도하지 않은 태스크까지 지워진다**. 실제로 이번 세션에서 실데이터 1건을 그렇게 지웠다(백업으로 복원함). 파괴적 조작은 **반드시 벤치 DB에서만** 하고, 하기 직전에 `Esc`로 선택을 비우고 `aria-pressed="true"` 개수를 세어 확인할 것
- **(신규, 5회차)** 이번 세션에서 `computer` 툴의 `coordinate`/`ref` 클릭이 캘린더 사이드바 프로젝트 링크에서 반복적으로 엉뚱한 곳을 클릭했다 — `screenshot`이 800x450인데 실제 페이지 뷰포트(`window.innerWidth/innerHeight`)는 1280x720이고 `devicePixelRatio`가 3인 환경이라 좌표 프레임이 안 맞았던 것으로 보인다(`read_page`가 보고하는 논리 뷰포트와 `screenshot` 반환 크기가 다름). **Link 클릭 후 실제로 이동했는지 애매하면 `coordinate`/`ref` 대신 `javascript_exec`로 `document.querySelector('a[href*="..."]').click()`을 쓰고 `window.location.href`로 결과를 검증하는 게 훨씬 안정적이었다.** 순수 시각적 확인(스크린샷)이 꼭 필요한 게 아니라면 이 방법을 우선 고려할 것

## 6. 다음 세션 시작할 때 참고할 것

### 6.1 아직 커밋 안 된 상태다

6회차 변경(위 3절)이 전부 워킹 트리에만 있다. `npx tsc --noEmit` + `npm run lint` + 프로덕션 빌드(경고 0건)는 통과했고 브라우저 확인도 끝났으니, 사용자가 커밋을 요청하면 그대로 올리면 된다. 변경 파일은 4.1절 목록 그대로 + `requirements.md`/`PERF.md`/`HANDOVER.md`.

### 6.2 성능 작업을 또 하게 되면

- **`PERF.md`는 회차 기록이다 — 기존 회차(1·2회차)는 수정하지 말고 맨 아래에 새 회차를 추가할 것.** 형식은 기존 항목을 따라가면 됨(요청 배경 → 측정 환경 → 결과 요약 표 → 무엇을 바꿨나 → 측정해 보고 안 고친 것 → 검증 → 다음에 손댈 곳)
- **현재 적용된 성능 설정의 "지금 상태"는 `requirements.md` 10절**(10.1~10.9). 다시 손대기 전에 먼저 읽을 것
- **측정은 반드시 프로덕션(`next start`)으로.** 개발 서버 수치는 의미 없다(1회차 ①)
- **스케일 검증은 실 DB가 아니라 합성 DB로.** 2회차에서 쓴 방법: `dev.db`를 스크래치패드로 복사 → 내용 비우고 합성 데이터 삽입 → `DATABASE_URL=file:<그 경로>`로 별도 포트에 `next start`. 스크립트는 스크래치패드에만 두고 커밋하지 말 것
- **2회차에서 남긴 다음 과제는 `PERF.md` 2회차 맨 아래 "다음에 손댈 만한 곳"** — 요약하면 ① `/report`가 이제 유일하게 데이터량을 그대로 받는 화면(3,000건에서 41.5ms·1.35MB) ② 캘린더 그리드는 한 달치를 다 조회해야 칩을 그릴 수 있음 ③ 가상 스크롤은 페이지당 개수를 200으로 쓰는 사용자가 생기면 그때
- **측정 없는 주장 금지.** 2회차에서 "서버 액션 왕복 줄이기"와 "주간보고 OR 쿼리"는 **재보고 나서 안 고치기로** 했다(각각 0.02ms, 2.46ms) — 이런 판단도 숫자와 함께 문서에 남길 것

### 6.3 페이지네이션 관련해서 깨지기 쉬운 지점

- `src/app/page.tsx`의 `orderBy` 마지막 `{ id: "asc" }`는 **지우면 안 된다** — 동점(같은 우선순위+생성일, 일괄 완료의 같은 completedAt)일 때 페이지 경계에서 항목이 중복되거나 빠질 수 있다
- `TaskList`의 `selectedIds` `useMemo` 필터도 **지우면 안 된다** — 없으면 이전 페이지에서 고른 항목이 선택에 남아 `d`/`r`이 화면에 없는 태스크를 건드린다
- 페이지당 개수 상한 200은 임의값이 아니다: 관계까지 `include`하는 조회는 1,000행 근처에서 SQLite 파라미터 한도로 실패한다(`requirements.md` 10.8절)
- 2페이지 이후에서 태스크를 추가하면 그 태스크는 보통 1페이지에 들어가서 화면에 안 보인다 — 알려진 동작으로 `requirements.md` 9절에 적어뒀다

## 7. 작업 스타일 관련 — 이 사용자와 일할 때 지켜온 규칙

- 사용자는 **한국어**로 요구사항을 준다. 짧은 한 줄 요청이 많고, 실제로 앱을 써보면서 버그를 그때그때 리포트하는 스타일 — 재현이 안 되면 섣불리 고치지 말고 재현 시나리오를 구체적으로 되물을 것
- 탐색적 질문(예: "~어때?", "~할 방법?")에는 추천안 + 트레이드오프를 2~3문장으로 먼저 제시하고, 확정 지시("~해줘", "구현해줘")가 왔을 때 실제로 구현할 것 — 6회차에서도 그랬다: "고치기 전에 리스트업해줘"라는 요청에 측정값과 함께 후보 9개를 먼저 제시하고, 우선순위와 옵션(페이지네이션 방식·페이지당 개수)을 지정받은 뒤에 착수했다
- **`requirements.md`는 항상 최신 상태로 유지**, 관련 없는 절은 임의로 안 바꿈. 새 기능은 속하는 절에 자연스럽게 추가
- **성능 관련 작업만 `PERF.md`에 회차 추가** (6회차에서 2회차 항목을 추가했음)
- **커밋/푸시는 명시적으로 요청받았을 때만**
- **측정 없는 주장 금지** — DB 직접 조회, `getBoundingClientRect()`/`scrollTop` 등 실제 값으로 검증할 것
- DB 직접 조회/수정 스크립트는 **스크래치패드 디렉토리**에만 만들 것 (커밋에 안 섞이게)
- **사용자의 실제 데이터를 함부로 지우지 않기.** 테스트는 전용 접두사로만 하고 끝나면 지운다
