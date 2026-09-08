# MyTodo 인수인계서

> 작성: 2026-09-08, **7회차 세션 종료 시점**. 이 세션에서 한 일은 ① 성능 최적화 2회차 ② 자동화 테스트 도입이고, 둘 다 커밋·푸시까지 끝났다.
>
> **가장 먼저 [`requirements.md`](requirements.md)를 전체 읽을 것.** 이 문서는 "지금 상태로 오게 된 맥락과 다음에 뭘 하면 좋을지"만 담은 보조 문서다. 기능 스펙의 단일 기준(SSOT)은 항상 `requirements.md`이고, 성능 이력은 [`PERF.md`](PERF.md), 테스트 실행법·규칙은 `requirements.md` 11절이다.

---

## 1. 이 프로젝트가 뭔지

- Claude Code 사용법 학습 + 효율적인 프롬프트 작성법 연습용 실습 프로젝트 (배경: [`BG.md`](BG.md))
- 실습 소재로 **회사 업무에 실제로 쓸 수 있는 개인용 TODO 앱**을 Next.js로 만들고 있다
- 사용자는 한국어로 요구사항을 배치 단위로 던지고, 그때마다 구현 후 문서를 갱신하는 방식으로 7회차까지 진행했다

## 2. 지금 상태 (한눈에)

| 항목 | 상태 |
|---|---|
| 워킹 트리 | **clean.** 미커밋 작업 없음 |
| 최신 커밋 | `8958425` (테스트 도입 + 주간보고 버그 수정), 그 앞이 `717b174` (성능 2회차). `origin/main` 동기화 완료 |
| 테스트 | **182개 전부 통과** — 순수 함수 51 / 서버 액션 71 / 라우트 60 |
| 검증 | `tsc --noEmit` · `eslint` · 프로덕션 빌드(경고 0건) 전부 통과 |
| 실 DB | `dev.db` = Task 35 / Project 5 / Tag 4 / TaskTag 5 / PriorityColor 4 |
| 마이그레이션 | 전부 적용됨 (`npx prisma migrate status` → up to date) |
| 포트 3000 | **`dev.cmd`(개발 서버)가 떠 있는 상태로 종료** — 사용자가 직접 띄운 것. 자세한 건 아래 3절 |

## 3. 실행하는 법

| 목적 | 실행 |
|---|---|
| 앱을 실제로 쓸 때 | `run.cmd` (프로덕션 빌드 후 기동. **코드를 고치면 다시 실행해야 반영됨**) |
| 코드를 개발/수정할 때 | `dev.cmd` (HMR 자동 반영, 대신 느림) |
| 로직 검증 | `npm test` (약 0.4초, 빌드 불필요) |
| 전체 검증 | `npm run test:all` (`test` → `build` → `test:routes`, 약 30초) |

- 앱은 둘 다 http://localhost:3000
- **포트 3000이 이미 점유돼 있다면** 먼저 그게 이 프로젝트 것인지 확인할 것(`curl http://localhost:3000` 응답 + `Get-CimInstance Win32_Process -Filter 'ProcessId=<pid>'` 의 CommandLine). 이 프로젝트 것이면 dev/prod 구분은 HTML에 `hmr-client`·`next-devtools`가 있는지로 판별된다(있으면 dev). 종료가 필요하면 **PID를 특정해서만** 죽일 것 — `taskkill /F /IM node.exe`로 전체 종료 금지
- Node가 PowerShell PATH에 안 잡혀 있으면: `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")` (`dev.cmd`/`run.cmd`는 내부에서 처리하므로 무관)

### 3.1 DB 관련 주의

- SQLite. `.env`의 `DATABASE_URL`이 가리키는 `dev.db` (`dev.db`·`.env` 둘 다 gitignore)
- **여기 들어있는 건 사용자의 실제 업무 데이터다. 절대 삭제·초기화하지 말 것.** 조회는 `better-sqlite3`로 readonly로 열 것
- WAL 모드다. `dev.db-wal`/`dev.db-shm`이 같이 생기고 최신 데이터가 그 두 파일에 있을 수 있으니 수동으로 옮길 땐 세 파일을 함께
- 부팅할 때마다 `backups/dev-YYYY-MM-DD.db`가 자동 생성된다(최신 7개 유지, `requirements.md` 10.7절). 앱은 이걸 읽지 않으며 재해 복구용이다
- 처음 세팅하는 환경이면 `.env`에 `DATABASE_URL="file:./dev.db"` 만들고 `npx prisma migrate dev`

### 3.2 작업 완료 기준

**항상** `npm test` + `npx tsc --noEmit` + `npm run lint` 통과. 라우트까지 볼 거면 `npm run test:all`.
UI를 바꿨으면 브라우저로 직접 클릭 확인(자동화가 못 덮는 영역, 6절 참고).
성능 작업은 **반드시 전/후 측정값을 남길 것** — "빨라진 것 같다"가 아니라 숫자로.

## 4. 지금까지 진행 상황

1~3회차 요약은 `requirements.md` 5~10절과 `PERF.md` 1회차 참고 (기능 스캐폴딩 → 성능 최적화 1회차 → 버그수정/캘린더/undo/백업).

**4회차** (커밋 `2c1035e`) — 일반 선택 vs 다중 선택(조합키) 구분, 편집 진입 조건 변경 / 완료 뷰 15일 제한, 전 뷰 정렬 통일 / 캘린더 겹침 버그 수정, 사이드바·캘린더 크기 드래그 / 하단 단축키 바, 메모 기본 펼침, 시작 페이지 설정

**5회차** (커밋 `90d414c`) — 캘린더에 프로젝트 필터 연결(그리드·패널·미등록 세 곳) / 캘린더 "미등록 일정" 클라이언트 페이지네이션(7회차에 서버 방식으로 교체되며 없어짐)

**6회차 · 성능 최적화 2회차** (커밋 `717b174`, 상세는 `PERF.md` 2회차)

1. **목록 4개 뷰에 서버 페이지네이션 도입** (`?page=N`, DB 쿼리의 `skip`/`take`). 사이드바 "⚙ 설정"에 **"페이지당 개수"** 직접 입력 추가(기본 50 · 1~200, 쿠키 `mytodo_page_size`)
2. 이건 속도 문제만이 아니었다 — **미완료 최상위가 1,000건을 넘으면 목록 화면이 500으로 죽고 있었다**(Prisma `P2029`, SQLite 파라미터 한도 999). 실측 임계점: 900건 정상 / 1,125건 실패
3. 캘린더: 그리드 쿼리를 `select`로 좁히고, 관계가 필요한 사이드 패널은 "선택한 하루"만 따로 조회. "미등록 일정"도 서버 페이지네이션으로 통일
4. 크기 조절 드래그에서 리액트 상태를 빼고 **CSS 변수만 갱신** — 드래그 중 리액트 렌더 0회
5. 목록 공통 설정(다중 선택 조합키·메모 기본 펼침)을 행마다 읽던 것을 `TaskList`가 한 번만 읽어 내려주도록
6. `undoDelete`를 한 트랜잭션으로 묶음(개수만큼 왕복 → 커밋 1회, 부분 복원 불가)
7. 빌드 경고(프로젝트 전체 트레이싱) 제거

> 대표 수치: 1,000건 `/?view=all` 68.8ms·2.07MB → **7.5ms·160KB**. 목록 화면 비용이 데이터량과 무관해졌다(3,000건에서도 8ms).

**7회차 · 자동화 테스트 도입** (커밋 `8958425`, 상세는 `requirements.md` 11절)

1. **테스트가 0개였는데 182개가 됐다.** `npm test` 0.4초 / `npm run test:all` 약 30초
2. **추가 의존성 0개** — Vitest/Jest 없이 Node 내장 러너 + 타입 스트리핑으로 프로젝트 `.ts` 소스를 그대로 읽는다
3. **실데이터 보호 가드**를 먼저 만들고 그 가드에도 테스트를 붙였다(8개). `.env` 때문에 실수 한 번이면 테스트가 `dev.db`를 건드릴 수 있어서다
4. **테스트가 실제 버그를 하나 잡았다**: 주간보고 "다음 주" 버튼이 제자리, "지난 주"가 2주 전으로 가고 있었다. 링크를 `toISOString()`으로 만들어 KST에서 월요일이 아닌 전날 일요일을 가리킨 탓. `formatISODate()`로 수정
5. 브라우저 E2E(Playwright)는 **의도적으로 보류** — 6절의 한계 목록을 보면 유지비가 잡는 버그보다 크다고 판단

## 5. 코드를 새로 읽지 않으면 놓치기 쉬운 것들

### 5.1 테스트 (7회차 신규)

- `tests/helpers/hooks.mjs` — Node 러너용 모듈 훅. `@/` 별칭 해석 + `next/cache` 스텁 교체 + Prisma 생성 코드의 확장자 없는 상대 임포트 보완. **테스트 실행의 전제라 여기가 깨지면 전부 안 돈다**
- `tests/helpers/testDb.ts` — 임시 DB 생성/폐기 + `assertSafeTestDbPath()` 가드. 템플릿 DB를 한 번 만들어 복사한다(파일마다 `prisma db push` 하면 느리다)
- `tests/helpers/factory.ts` — 픽스처 삽입과 검증용 조회. **준비는 SQL, 검증도 SQL, 실행만 액션**이라는 원칙. `localDateKey()`가 여기 있다
- `tests/helpers/server.ts` — 라우트 테스트용 프로덕션 서버 기동 + HTML 파서(`hasText`/`paginationInfo`/`renderedTaskTitles`)
- `tests/helpers/nextCacheStub.ts` — `next/cache` 대체. `.mjs`가 아니라 `.ts`인 건 테스트가 직접 임포트해 타입을 봐야 해서다
- `tests/unit/` 7파일(51) · `tests/actions/` 7파일(71) · `tests/routes/` 5파일(60)
- **각 테스트 파일 상단 주석이 "왜 이걸 검증하는가"를 설명한다.** 별도 설계 문서는 없다

### 5.2 6회차에서 생기거나 바뀐 파일

- `src/lib/pageSize.ts` (신규) — 페이지당 개수·페이지 번호 파싱. `startPage.ts`처럼 `"use client"` 없는 **순수 유틸**(서버/클라이언트 공용)
- `src/components/ListPagination.tsx` (신규) — 목록과 캘린더 "미등록 일정"이 같이 쓴다(`pathname`/`paramName` props로 구분). 버튼이 아니라 `Link`라서 페이지 이동이 곧 새 조회다
- `src/components/PaginatedTaskList.tsx` (**삭제**) — 클라이언트에서 배열만 자르고 서버는 전건을 조회하던 방식이라 없앴다
- `src/app/page.tsx` — 쿠키에서 페이지 크기를 읽고 `count` + `skip`/`take`. 정렬 마지막의 `{ id: "asc" }`는 **지우면 안 된다**(7.1절)
- `src/app/calendar/page.tsx` — 그리드용 `select` 축소 / 선택 날짜 전용 쿼리 / 미등록 서버 페이지네이션(`?unscheduled=N`)
- `src/lib/sidebarWidth.ts` — 커스텀 이벤트 + `useState` 구독을 **CSS 변수**(`--mytodo-sidebar-width`)로 교체. `useSidebarWidth`는 없어지고 `SIDEBAR_WIDTH_VAR`/`applySidebarWidth`/`useStoredSidebarWidth`가 생겼다
- `src/components/CalendarSplit.tsx` — 같은 방식(`--mytodo-calendar-grid-percent`)
- `src/lib/memoSettings.ts` — `useMemoDefaultExpanded()` 훅 추가(+변경 이벤트)
- `src/components/TaskList.tsx` — 선택 목록을 `useMemo`로 "지금 화면에 있는 id"만 남기도록 파생. **지우면 안 된다**(7.1절)
- `src/components/CollapsibleSection.tsx` — `defaultOpen` prop(미등록 일정 페이지 이동 시 섹션이 닫히지 않게)

### 5.3 그 이전부터 있던 설계 결정

- `src/lib/startPage.ts`는 다른 `lib` 파일과 달리 `"use client"`가 없는 순수 유틸(서버/클라이언트 공용, 쿠키 이름·타입 공유 목적)
- `Sidebar.tsx`의 "⚙ 설정" 스크롤과 `CollapsibleSection.tsx`는 스크롤 대상 컨테이너가 달라 **의도적으로 로직을 통합하지 않았다**
- `CalendarSplit.tsx`는 `flex-1`/`min-h-*`를 **의도적으로 뺐다** — 다시 넣으면 겹침 버그가 재발한다 (`requirements.md` 5.8절 마지막 항목)
- `src/lib/prisma.ts`의 `fs` 호출에는 `/*turbopackIgnore: true*/`가 붙어 있다 — 빼면 빌드가 프로젝트 전체를 서버 번들에 넣는다

## 6. 브라우저 자동화(`mcp__Claude_Browser__*`) 한계 — 회차마다 쌓아온 목록

- **라우트 검증은 브라우저보다 HTML이 낫다** *(7회차)*: 뷰 필터·정렬·페이지네이션·500 여부는 `tests/routes/`처럼 서버를 띄워 HTML만 봐도 전부 확인된다. 훨씬 빠르고 아래 함정들에 안 걸린다. **브라우저는 클릭·드래그·CSS처럼 HTML로 못 보는 것에만 쓸 것**
- **리액트 위임 이벤트가 잘 안 잡힌다** *(6회차)*: `new FocusEvent('focusout')`/`new KeyboardEvent('keydown')`을 dispatch 해도 리액트의 `onBlur`/`onKeyDown`이 안 불리는 경우가 반복됐다(편집 폼 자동저장·Ctrl+Enter 저장 둘 다). **`form.requestSubmit()`처럼 네이티브 API를 직접 부르는 경로는 잘 동작**한다. 반대로 `document.addEventListener`로 직접 건 핸들러(`TaskList`의 `d`/`r`/`Esc`)는 dispatch가 잘 먹는다
- ⚠ **선택 상태가 조작 사이에 살아남는다** *(6회차, 실제 사고)*: 클릭 측정을 하고 나면 선택이 남아 있는데, 그 상태로 Ctrl+클릭을 더해 일괄 삭제하면 **의도하지 않은 태스크까지 지워진다.** 실제로 실데이터 1건을 그렇게 지웠다(백업으로 복원). 파괴적 조작은 **반드시 벤치 DB에서만** 하고, 실행 직전에 `Esc`로 선택을 비운 뒤 `aria-pressed="true"` 개수를 세어 확인할 것
- **좌표 클릭이 엉뚱한 곳을 누른다** *(5회차)*: `screenshot`은 800x450인데 실제 뷰포트는 1280x720이고 `devicePixelRatio`가 3이라 좌표 프레임이 안 맞는다. Link 클릭은 `coordinate`/`ref` 대신 `javascript_exec`로 `document.querySelector('a[href*="..."]').click()` 후 `window.location.href`로 검증하는 게 훨씬 안정적이었다
- `document.hasFocus()`가 항상 `false`다 → blur 로직은 `focusout`을 직접 dispatch
- `confirm()`은 `window.confirm = () => true`로 미리 덮어쓸 것
- `requestAnimationFrame`은 pane이 hidden이면 실행되지 않는다 → 동기 코드로 짜거나 `MutationObserver`로 커밋 시점을 잡을 것
- 토스트·타이머 검증은 "생성 → 액션 → 결과 확인"을 **한 번의 `javascript_exec` 호출 안에서** 끝낼 것 (8초 자동 소멸 등)
- `javascript_exec`는 45초 제한이 있다. 폴링 루프는 짧게 끊고 여러 호출로 나눌 것
- DOM 전체에 걸친 넓은 셀렉터로 정리하지 말 것 — 항상 자기가 만든 요소의 컨테이너로 스코프
- `li.querySelectorAll('button')`처럼 순서에 의존해 버튼을 고르지 말 것 — 서브태스크 행과 "추가" 버튼이 섞여 인덱스가 밀린다. `aria-label`이나 텍스트로 고를 것
- 탭을 오래 재사용하며 여러 번 고치면 콘솔 로그가 누적된다 — 의심스러운 에러는 새 탭에서 재확인

## 7. 다음 세션에서 조심할 것

### 7.1 페이지네이션 관련 — 지우면 안 되는 것들

- `src/app/page.tsx`의 `orderBy` 마지막 **`{ id: "asc" }`** — 동점(같은 우선순위+생성일, 일괄 완료의 같은 `completedAt`)일 때 페이지 경계에서 항목이 중복되거나 빠질 수 있다
- `TaskList`의 `selectedIds` **`useMemo` 필터** — 없으면 이전 페이지에서 고른 항목이 선택에 남아 `d`/`r`이 화면에 없는 태스크를 건드린다 (6절의 사고와 같은 종류)
- 페이지당 개수 **상한 200은 임의값이 아니다** — 관계까지 `include`하는 조회는 1,000행 근처에서 SQLite 파라미터 한도로 실패한다(`requirements.md` 10.8절)
- 2페이지 이후에서 태스크를 추가하면 그 태스크는 보통 1페이지에 들어가 화면에 안 보인다 — 알려진 동작으로 `requirements.md` 9절에 적어뒀다

### 7.2 테스트를 늘린다면

- 우선순위가 높은 건 이미 다 덮었다. 남은 후보와 **보류 이유**:
  - 브라우저 E2E — 6절의 한계 목록 때문에 유지비가 크다. L1~L3가 자리 잡은 뒤 재검토
  - React 컴포넌트 렌더 테스트 — jsdom+RTL+Vitest가 필요해 "의존성 0" 원칙이 깨진다. 로직은 이미 액션·라우트가 덮고 있어 남는 건 마크업 스냅샷뿐이라 회수가 낮다
  - 성능 회귀 테스트 — 수치가 머신마다 흔들려 거짓 실패한다. `PERF.md` 회차 측정으로 대체
- **날짜 비교는 `localDateKey()`, 화면 문구 확인은 `hasText()`를 거칠 것.** 전자는 마감일이 "로컬 자정"인데 UTC로 저장돼 KST에서 하루 밀리고, 후자는 React가 SSR 시 인접 표현식 사이에 `<!-- -->`를 끼워 넣기 때문이다. 둘 다 이것 때문에 처음에 테스트가 헛되게 실패했다
- 액션 테스트는 `createTestDb()`로 DB를 만들어 `DATABASE_URL`을 돌려놓은 **뒤에** `await import("@/lib/actions/...")`로 늦게 불러와야 한다. `src/lib/prisma.ts`가 모듈 로드 시점에 `DATABASE_URL`을 붙잡는다
- `node --test`에 **디렉토리를 넘기면 `.ts`를 못 찾는다** — glob으로 지정할 것(`package.json` 스크립트 참고). 테스트 안 상대 임포트에는 **확장자를 붙이지 않는다**(TS는 그대로 해석, 런타임은 훅이 보완)
- 윈도우에서 `npx.cmd`는 Node가 셸 없이 실행하길 거부한다(EINVAL) → CLI는 `node <진입스크립트>`로 직접 부를 것

### 7.3 성능 작업을 또 하게 되면

- **`PERF.md`는 회차 기록이다.** 기존 회차(1·2회차)는 수정하지 말고 맨 아래에 새 회차를 추가할 것. 형식은 기존 항목을 그대로 따라가면 된다(요청 배경 → 측정 환경 → 결과 요약 표 → 무엇을 바꿨나 → **측정해 보고 안 고친 것** → 검증 → 다음에 손댈 곳)
- 현재 적용된 설정의 "지금 상태"는 `requirements.md` 10절(10.1~10.9). 손대기 전에 먼저 읽을 것
- **측정은 반드시 프로덕션(`next start`)으로.** 개발 서버 수치는 의미 없다(`PERF.md` 1회차 ①)
- **스케일 검증은 실 DB가 아니라 합성 DB로.** 2회차에서 쓴 방법: `dev.db`를 스크래치패드로 복사 → 내용 비우고 합성 데이터 삽입 → `DATABASE_URL=file:<그 경로>`로 별도 포트에 `next start`. 이제는 `tests/helpers/testDb.ts`를 재활용해도 된다
- **남은 과제는 `PERF.md` 2회차 맨 아래 "다음에 손댈 만한 곳"** — 요약: ① `/report`가 이제 유일하게 데이터량을 그대로 받는 화면(3,000건에서 41.5ms·1.35MB) ② 캘린더 그리드는 한 달치를 다 조회해야 칩을 그릴 수 있다 ③ 가상 스크롤은 페이지당 개수를 200으로 쓰는 사용자가 생기면 그때
- **측정 없는 주장 금지.** 2회차에서 "서버 액션 왕복 줄이기"와 "주간보고 OR 쿼리"는 **재보고 나서 안 고치기로** 했다(각각 0.02ms, 2.46ms). 이런 판단도 숫자와 함께 남길 것

## 8. 이 사용자와 일할 때 지켜온 규칙

- 사용자는 **한국어**로 요구사항을 준다. 짧은 한 줄 요청이 많고, 앱을 직접 써보면서 버그를 그때그때 리포트하는 스타일 — 재현이 안 되면 섣불리 고치지 말고 재현 시나리오를 구체적으로 되물을 것
- **탐색적 질문에는 먼저 제안, 확정 지시가 오면 구현.** 7회차에서도 그랬다: "고치기 전에 리스트업해줘"에 측정값과 함께 후보 9개를 제시 → 우선순위와 옵션(페이지네이션 방식·페이지당 개수)을 지정받은 뒤 착수. "자동화 테스트 설계해줘"에도 설계만 먼저 내고 "순서대로 구현해줘"를 받고 시작했다
- 큰 작업은 **단계를 나눠 각 단계마다 결과를 보고**하고 다음으로 넘어갈 것 (7회차 테스트 도입을 4단계로 진행)
- **`requirements.md`는 항상 최신 상태로 유지.** 관련 없는 절은 임의로 안 바꾸고, 새 기능은 속하는 절에 자연스럽게 추가. 문서 맨 위 "마지막 갱신" 줄에 무엇을 바꿨는지 한 줄 덧붙이는 관례가 있다
- **성능 관련 작업만 `PERF.md`에 회차 추가**
- **커밋/푸시는 명시적으로 요청받았을 때만.** 지금까지 전부 `main` 직행이다(솔로 실습 저장소)
- **측정 없는 주장 금지** — DB 직접 조회, `getBoundingClientRect()`/`scrollTop` 등 실제 값으로 검증할 것
- DB 조회/수정 스크립트, 벤치 DB, 측정 스크립트는 **스크래치패드 디렉토리에만** 만들 것 (커밋에 안 섞이게)
- **사용자의 실제 데이터를 함부로 지우지 않기.** 파괴적 조작은 테스트 DB에서만. 실 DB를 만져야 하면 먼저 백업하고, 끝나고 전 테이블을 대조해 무결성을 확인할 것 (7회차에 실제로 사고가 나서 이 절차로 복구했다)
- **자기 실수를 숨기지 말 것.** 위 사고도 발견 즉시 보고하고 복원 과정을 다 보여줬고, 사용자는 그걸 문제 삼지 않았다
