# MyTodo 인수인계서

> 작성: 2026-09-08, **8회차 세션 종료 + 환경 이전(다음은 회사 PC에서 진행)**. 이 세션에서 한 일: ① 사이드바 프로젝트 필터에 선택 표시(회색 체크) ② 인라인 "할 일 추가" 폼의 고장난 프로젝트 자동채움 제거 ③ 포트 3000→3333 ④ PWA로 설치해 독립 창처럼 쓰기(`launch_handler: focus-existing`로 중복 창 방지) ⑤ 로그인 시 서버 자동기동(작업 스케줄러) ⑥ Phase 3/4 백로그 등록 ⑦ `DEPLOY.md` 신규 작성. 전부 커밋·푸시 완료 — `origin/main` 최신 커밋 `3f4a4dd`.
>
> **가장 먼저 [`requirements.md`](requirements.md)를 전체 읽을 것.** 기능 스펙의 SSOT는 항상 `requirements.md`, 성능 이력은 [`PERF.md`](PERF.md), 테스트 실행법은 `requirements.md` 11절, **실행/배포 방법은 [`DEPLOY.md`](DEPLOY.md)**(이번에 신설, 기존엔 이 문서에만 있던 실행법을 분리해서 정리함).

---

## 0. ⚠ 회사 PC로 옮길 때 반드시 확인할 것

이 세션은 "다음 작업은 회사 PC에서 진행한다"는 전제로 마무리됐다. `git push`로 코드는 이미 `origin/main`에 다 올라가 있지만, **git으로 안 옮겨지는 것들**이 있다.

1. **DB 데이터(`dev.db`)는 git에 없다** (`.gitignore`). 지금 이 PC의 `dev.db`엔 실제 업무 데이터가 있다(Task 35 / Project 5 / Tag 4, 아래 2절). 회사 PC에서 이어 쓰고 싶으면:
   - **`dev.db` + `dev.db-wal` + `dev.db-shm` 세 파일을 함께** 옮길 것(WAL 모드라 최신 데이터가 wal/shm에 있을 수 있음). 옮기기 전에 서버를 끈 상태에서 복사할 것(`requirements.md` 10.2절)
   - 옮긴 뒤 새 PC에서 `npx prisma migrate status`로 스키마가 맞는지 확인
   - 아니면 회사 PC에서는 빈 DB로 새로 시작(`.env` 만들고 `npx prisma migrate dev`) — 회사 업무용이면 오히려 이쪽이 맞을 수도 있음, 판단 필요
   - **이 이관 절차 자체가 아직 도구화돼 있지 않다** — `requirements.md` 12절(Phase 4)에 "작업환경 이전 시 DB 이관 방법 마련"으로 백로그 등록만 해둔 상태. 지금은 위 수동 절차가 유일한 방법
2. **`.env`도 git에 없다** — 새 PC에서 직접 생성: `DATABASE_URL="file:./dev.db"`
3. **PWA 설치·로그인 자동기동은 이 PC의 브라우저/Windows 설정이라 옮겨지지 않는다.** 확인해보니 **이 PC에서도 아직 둘 다 실행 안 한 상태**(작업 스케줄러에 `MyTodoServer` 없음, Start Menu에 설치된 앱도 없음) — 그래서 회사 PC에서 `DEPLOY.md` 절차를 처음부터 밟으면 된다(빠뜨린 단계 없음)
4. **Windows 전용 전제**: `autostart-*.ps1`/`.vbs`/`.cmd`는 전부 Windows 것. 회사 PC도 Windows가 아니면 이 부분은 다시 설계해야 함
5. Node.js가 PowerShell PATH에 안 잡혀 있을 수 있음(아래 3절 참고, `dev.cmd`/`run.cmd`는 내부에서 처리하므로 무관)

---

## 1. 이 프로젝트가 뭔지

- Claude Code 사용법 학습 + 효율적인 프롬프트 작성법 연습용 실습 프로젝트 (배경: [`BG.md`](BG.md))
- 실습 소재로 **회사 업무에 실제로 쓸 수 있는 개인용 TODO 앱**을 Next.js로 만들고 있다
- 사용자는 한국어로 요구사항을 배치 단위로 던지고, 그때마다 구현 후 문서를 갱신하는 방식으로 8회차까지 진행했다

## 2. 지금 상태 (한눈에)

| 항목 | 상태 |
|---|---|
| 워킹 트리 | **clean.** 미커밋 작업 없음 |
| 최신 커밋 | `3f4a4dd` (PWA+자동기동), 그 앞이 `dbb431e`(사이드바 체크·프리필 제거), 그 앞이 `37356cb`(7→8회차 인수서). `origin/main` 동기화 완료 |
| 테스트 | **182개 전부 통과** — 순수 함수 51 / 서버 액션 71 / 라우트 60 |
| 검증 | `tsc --noEmit` · `eslint` · 프로덕션 빌드(경고 0건) 전부 통과 |
| 실 DB | `dev.db` = Task 35 / Project 5 / Tag 4 / TaskTag 5 / PriorityColor 4 (이 세션에서 데이터 자체는 안 건드림) |
| 마이그레이션 | 전부 적용됨 (`npx prisma migrate status` → up to date) |
| **서버 포트** | **3333** (3000에서 변경, 3000은 다른 용도로 예약됨) |
| PWA 설치 / 자동기동 | **둘 다 아직 미실행** — 스크립트만 준비됨, 회사 PC에서 `DEPLOY.md` 대로 처음 실행하면 됨 |

## 3. 실행하는 법

**이번 세션부터 실행/배포 방법은 [`DEPLOY.md`](DEPLOY.md)로 분리했다.** 요약:

| 목적 | 실행 |
|---|---|
| 앱을 실제로 쓸 때 | `run.cmd` (프로덕션 빌드 후 기동, **http://localhost:3333**. 코드를 고치면 다시 실행해야 반영됨) |
| 코드를 개발/수정할 때 | `dev.cmd` (HMR 자동 반영, 포트는 동일하게 3333, 대신 느림) |
| 앱처럼 설치해서 쓰기 + 로그인 자동기동 | `DEPLOY.md` 3~4절 (PWA 설치, `autostart-install.ps1`) |
| 로직 검증 | `npm test` (약 0.4초, 빌드 불필요) |
| 전체 검증 | `npm run test:all` (`test` → `build` → `test:routes`, 약 30초) |

- **포트 3333이 이미 점유돼 있다면** 먼저 그게 이 프로젝트 것인지 확인할 것(`curl http://localhost:3333` 응답 + `Get-CimInstance Win32_Process -Filter 'ProcessId=<pid>'`의 CommandLine). 이 프로젝트 것이면 dev/prod 구분은 HTML에 `hmr-client`·`next-devtools`가 있는지로 판별(있으면 dev). 종료가 필요하면 **PID를 특정해서만** 죽일 것 — `taskkill /F /IM node.exe`로 전체 종료 금지
- Node가 PowerShell PATH에 안 잡혀 있으면: `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`

### 3.1 DB 관련 주의

- SQLite. `.env`의 `DATABASE_URL`이 가리키는 `dev.db` (`dev.db`·`.env` 둘 다 gitignore)
- **여기 들어있는 건 사용자의 실제 업무 데이터다. 절대 삭제·초기화하지 말 것.** 조회는 `better-sqlite3`로 readonly로 열 것
- WAL 모드다. `dev.db-wal`/`dev.db-shm`이 같이 생기고 최신 데이터가 그 두 파일에 있을 수 있으니 수동으로 옮길 땐 세 파일을 함께 (0절 참고 — 지금 딱 이 상황)
- 부팅할 때마다 `backups/dev-YYYY-MM-DD.db`가 자동 생성된다(최신 7개 유지, `requirements.md` 10.7절). 앱은 이걸 읽지 않으며 재해 복구용이다
- 처음 세팅하는 환경이면 `.env`에 `DATABASE_URL="file:./dev.db"` 만들고 `npx prisma migrate dev`

### 3.2 작업 완료 기준

**항상** `npm test` + `npx tsc --noEmit` + `npm run lint` 통과. 라우트까지 볼 거면 `npm run test:all`.
UI를 바꿨으면 브라우저로 직접 클릭 확인(자동화가 못 덮는 영역, 6절 참고).
성능 작업은 **반드시 전/후 측정값을 남길 것** — "빨라진 것 같다"가 아니라 숫자로.

## 4. 지금까지 진행 상황

1~6회차 요약은 `requirements.md` 5~10절, `PERF.md` 1~2회차 참고 (기능 스캐폴딩 → 성능 최적화 → 버그수정/캘린더/undo/백업 → 페이지네이션).

**7회차 · 자동화 테스트 도입** (커밋 `8958425`) — 테스트 0개 → 182개(순수 함수·서버 액션·라우트 3계층, 추가 의존성 없이 Node 내장 러너), 실데이터 보호 가드, 주간보고 "지난 주"/"다음 주" 링크 버그 발견·수정. 상세는 `requirements.md` 11절.

**8회차 · 사이드바 표시 정리 + 앱처럼 설치/자동기동** (커밋 `dbb431e`, `3f4a4dd`)

1. **사이드바 프로젝트 필터에 선택 표시** — 필터 중인 프로젝트명 오른쪽에 회색 체크(✓). "전체 프로젝트"가 선택 상태(필터 없음)면 거기에 표시. 기존엔 선택돼도 호버 색과 똑같은 배경이라 구분이 잘 안 됐음
2. **인라인 "할 일 추가" 폼의 프로젝트 자동채움 제거** — 프로젝트 필터 중일 때 상단 퀵애드 폼에 그 프로젝트가 기본 칩으로 채워지던 기능이 있었는데, `SmartTitleInput`이 `resetKey`(제출 시에만 증가)로만 리마운트돼서 **필터를 바꿔도 안 갱신되는 버그**였다. 버그이기도 하고 사용자가 "과한 기능"이라 판단해서 관련 코드(`defaultProjectId`/`defaultProject`) 전부 제거
3. **서버 포트 3000 → 3333**: 3000번이 다른 용도로 예약돼 있어서 옮김 (`package.json` dev/start/serve 스크립트, `run.cmd`, `.claude/launch.json`, `README.md`)
4. **PWA로 설치해 독립 창처럼 쓰기** (`src/app/manifest.ts`, Next.js `manifest.ts` 파일 규칙): `display: "standalone"` + **`launch_handler.client_mode: "focus-existing"`**로 이미 떠 있는 앱을 다시 열면 새 창 대신 기존 창 포커스. 아이콘은 `src/app/icons/icon-192`, `icon-512`가 `next/og`의 `ImageResponse`로 생성(체크마크를 유니코드 문자로 넣었더니 Satori 기본 폰트에 글리프가 없어 깨졌음 — `<svg><path>`로 직접 그려서 해결)
5. **로그인 시 서버 자동기동**: `autostart-install.ps1`/`autostart-uninstall.ps1`이 작업 스케줄러에 `MyTodoServer` 태스크를 등록/제거(관리자 권한 불필요). 콘솔 창 안 뜨게 `autostart-hidden.vbs`(`WScript.Shell.Run` WindowStyle=0) → `autostart-server.cmd`로 감쌌고, 이 스크립트는 `run.cmd`와 달리 **이미 빌드가 있으면 재빌드 안 하고 바로 `npm start`**(로그인마다 재빌드하면 느리고, 소스가 WIP면 실패할 수 있어서). `MultipleInstances IgnoreNew` + 포트 점유 체크로 중복 기동 이중 방지
6. **PWA 설치와 자동기동 등록은 완전히 독립적**(하나를 지워도 다른 하나는 안 지워짐) — 확인 안 하고 넘어가기 쉬운 부분이라 `DEPLOY.md`에 명시해둠
7. **Phase 3/4 백로그 등록**: `requirements.md` 7.4절에 "Confluence에 맞춰서 주간보고 양식 및 방법 설계" 할일 추가, 12절에 Phase 4(Confluence 주간보고 자동등록 / 캘린더 연동(검토 필요) / 메일 읽어와 일정 등록 / DB 이관 방법)를 **설계·구현 없이 등록만**

## 5. 코드를 새로 읽지 않으면 놓치기 쉬운 것들

### 5.1 8회차에서 새로 생기거나 바뀐 파일

- `src/app/manifest.ts` (신규) — PWA manifest, Next.js가 자동으로 `<head>`에 링크
- `src/app/icons/icon-192/route.tsx`, `icon-512/route.tsx` (신규) — `ImageResponse`로 아이콘 동적 생성. **유니코드 문자(예: `✓`)를 텍스트로 넣지 말 것** — Satori 기본 폰트에 글리프가 없으면 빈 사각형으로 깨진다. `<svg><path>` 등 벡터로 그릴 것
- `autostart-install.ps1` / `autostart-uninstall.ps1` / `autostart-hidden.vbs` / `autostart-server.cmd` (신규) — 로그인 자동기동 한 세트. `DEPLOY.md` 4절이 사용법
- `DEPLOY.md` (신규) — 배포 파일 실행법 가이드. 이제 "어떻게 켜는가"는 이 문서가 우선 참고 대상, `HANDOVER.md` 3절은 요약만
- `src/components/Sidebar.tsx` — `ProjectFilterCheck` 컴포넌트(회색 체크 아이콘) 추가, 프로젝트/전체 프로젝트 링크에 `justify-between`으로 배치
- `src/components/QuickAddForm.tsx`, `src/components/SmartTitleInput.tsx` — `defaultProjectId`/`defaultProject` prop 전부 제거

### 5.2 7회차 테스트 관련 (변경 없음, 참고용)

- `tests/helpers/hooks.mjs` — Node 러너용 모듈 훅. `@/` 별칭 해석 + `next/cache` 스텁 교체 + Prisma 생성 코드의 확장자 없는 상대 임포트 보완. **테스트 실행의 전제라 여기가 깨지면 전부 안 돈다**
- `tests/helpers/testDb.ts` — 임시 DB 생성/폐기 + `assertSafeTestDbPath()` 가드
- `tests/helpers/factory.ts` — 픽스처 삽입과 검증용 조회. `localDateKey()`가 여기 있다
- `tests/helpers/server.ts` — 라우트 테스트용 프로덕션 서버 기동(포트는 매번 동적으로 잡으므로 3333 변경과 무관) + HTML 파서
- `tests/unit/` 7파일(51) · `tests/actions/` 7파일(71) · `tests/routes/` 5파일(60)

### 5.3 그 이전부터 있던 설계 결정 (요약, 상세는 이전 인수서 히스토리 참고)

- `src/lib/startPage.ts`, `src/lib/pageSize.ts`는 `"use client"` 없는 순수 유틸(서버/클라이언트 공용)
- `CalendarSplit.tsx`는 `flex-1`/`min-h-*`를 **의도적으로 뺐다** — 다시 넣으면 겹침 버그가 재발
- `src/lib/prisma.ts`의 `fs` 호출에는 `/*turbopackIgnore: true*/`가 붙어 있다 — 빼면 빌드가 프로젝트 전체를 서버 번들에 넣는다

## 6. 브라우저 자동화(`mcp__Claude_Browser__*`) 한계 — 회차마다 쌓아온 목록

- **라우트 검증은 브라우저보다 HTML이 낫다**: 뷰 필터·정렬·페이지네이션·500 여부는 `tests/routes/`처럼 서버를 띄워 HTML만 봐도 전부 확인된다. **브라우저는 클릭·드래그·CSS처럼 HTML로 못 보는 것에만 쓸 것**
- **리액트 위임 이벤트가 잘 안 잡힌다**: `new FocusEvent`/`KeyboardEvent`를 dispatch해도 리액트의 `onBlur`/`onKeyDown`이 안 불리는 경우가 있다. `form.requestSubmit()`처럼 네이티브 API 경로는 잘 동작. `document.addEventListener`로 직접 건 핸들러는 dispatch가 잘 먹는다
- ⚠ **선택 상태가 조작 사이에 살아남는다** (실제 사고 있었음, 백업으로 복원): 파괴적 조작은 **반드시 벤치 DB에서만**, 실행 직전 `Esc`로 선택 비우고 `aria-pressed="true"` 개수로 확인
- **좌표 클릭이 엉뚱한 곳을 누른다**: 스크린샷 좌표 프레임과 실제 뷰포트가 안 맞을 수 있다. Link 클릭은 `coordinate`/`ref` 대신 `javascript_exec`로 `querySelector(...).click()` 후 `window.location.href`로 검증하는 게 안정적
- `document.hasFocus()`가 항상 `false`다 → blur 로직은 `focusout`을 직접 dispatch
- `confirm()`은 `window.confirm = () => true`로 미리 덮어쓸 것
- `requestAnimationFrame`은 pane이 hidden이면 실행 안 됨 → 동기 코드 또는 `MutationObserver`
- 토스트·타이머 검증은 "생성 → 액션 → 결과 확인"을 **한 번의 `javascript_exec` 호출 안에서**
- `javascript_exec`는 45초 제한 — 폴링은 짧게 끊어서 여러 번
- DOM 전체 넓은 셀렉터로 정리하지 말 것 — 항상 자기가 만든 요소의 컨테이너로 스코프
- `li.querySelectorAll('button')`처럼 순서 의존 선택 금지 — `aria-label`/텍스트로 고를 것
- 탭을 오래 재사용하면 콘솔 로그가 누적됨 — 의심스러운 에러는 새 탭에서 재확인
- **(8회차 추가) `resize_window`로 커스텀 크기를 준 뒤엔 `preset: "desktop"`으로 반드시 리셋할 것** — 리셋 안 하고 이어서 스크린샷을 찍으면 줌/좌표가 이상하게 어긋난다

## 7. 다음 세션(회사 PC)에서 조심할 것

### 7.1 환경 이전 직후 확인 순서

1. `git clone`(또는 `pull`) → `origin/main`이 `3f4a4dd`인지 확인
2. `dev.db`(+wal/shm) 가져올지 빈 DB로 시작할지 결정 (0절)
3. `.env` 생성, 마이그레이션 (`npx prisma migrate dev` 또는 이관한 DB면 `migrate status`만)
4. `npm install` → `npm run test:all`로 환경이 제대로 돌아가는지 먼저 확인
5. `DEPLOY.md` 순서대로 PWA 설치 + 자동기동 등록(원하면)

### 7.2 미해결 항목 (Phase 4, `requirements.md` 12절)

- **DB 이관 방법이 아직 도구화 안 됨** — 지금은 수동 파일 복사가 유일한 방법. 여러 PC를 오가는 일이 반복되면 이 항목 우선순위를 올릴 것
- Confluence 연동(주간보고 자동등록·캘린더) — 설계 전, 7.4절의 양식 설계가 먼저
- 메일 읽어와 일정 등록 — 설계 전

### 7.3 페이지네이션 관련 — 지우면 안 되는 것들 (기존과 동일)

- `src/app/page.tsx`의 `orderBy` 마지막 `{ id: "asc" }`
- `TaskList`의 `selectedIds` `useMemo` 필터
- 페이지당 개수 상한 200(SQLite 파라미터 한도, `requirements.md` 10.8절)

### 7.4 테스트를 늘린다면 (기존과 동일)

- 날짜 비교는 `localDateKey()`, 화면 문구 확인은 `hasText()`를 거칠 것
- 액션 테스트는 `createTestDb()`로 `DATABASE_URL`을 돌려놓은 뒤 늦게 `import`
- `node --test`에 디렉토리를 넘기면 `.ts`를 못 찾는다 — glob으로 지정
- 윈도우에서 `npx.cmd`는 Node가 셸 없이 실행하길 거부(EINVAL) → `node <진입스크립트>`로 직접 부를 것

### 7.5 성능 작업을 또 하게 되면 (기존과 동일)

- `PERF.md`는 회차 기록 — 기존 회차 수정 금지, 맨 아래에 새 회차 추가
- 측정은 반드시 프로덕션(`next start -p 3333`)으로
- 스케일 검증은 합성 DB로(`tests/helpers/testDb.ts` 재활용 가능)
- 남은 과제는 `PERF.md` 2회차 맨 아래 참고

## 8. 이 사용자와 일할 때 지켜온 규칙

- 사용자는 **한국어**로 요구사항을 준다. 짧은 한 줄 요청이 많고, 앱을 직접 써보면서 버그를 그때그때 리포트하는 스타일 — 재현이 안 되면 섣불리 고치지 말고 재현 시나리오를 구체적으로 되물을 것
- **8회차부터: 기본이 "설계만"으로 바뀜.** 요청이 오면 우선 방향/트레이드오프를 2~3문장으로 제안하고, **명시적인 "구현해줘" 지시가 있어야 코드를 작성**한다(예전엔 탐색적 질문에만 이렇게 했는데, 이제 새 기능·수정 요청 전반의 기본값이 됐다)
- 큰 작업은 **단계를 나눠 각 단계마다 결과를 보고**하고 다음으로 넘어갈 것
- **`requirements.md`는 항상 최신 상태로 유지.** 관련 없는 절은 임의로 안 바꾸고, 새 기능은 속하는 절에 자연스럽게 추가. 문서 맨 위 "마지막 갱신" 줄에 한 줄 덧붙이는 관례. **섹션 번호는 내부 참조가 많아서 함부로 재배치하지 말 것** — 8회차에서 Phase 4를 논리적으론 8절 자리가 맞았지만 기존 8~11절 참조가 많아 그냥 맨 뒤(12절)에 추가했음
- **성능 관련 작업만 `PERF.md`에 회차 추가**, **실행/배포 방법은 `DEPLOY.md`**로 분리(8회차부터)
- **커밋/푸시는 명시적으로 요청받았을 때만.** 8회차에서도 "회사 PC로 옮길 건데 어떻게 할지" 먼저 물어봤고, 사용자가 "커밋+푸시" 선택한 뒤에 진행함 — 이관처럼 커밋 여부가 결과에 영향을 주는 상황이면 먼저 확인하는 게 맞았다
- **측정 없는 주장 금지** — DB 직접 조회, `getBoundingClientRect()`/`scrollTop` 등 실제 값으로 검증할 것
- DB 조회/수정 스크립트, 벤치 DB, 측정 스크립트는 **스크래치패드 디렉토리에만** 만들 것 (커밋에 안 섞이게)
- **사용자의 실제 데이터를 함부로 지우지 않기.** 파괴적 조작은 테스트 DB에서만. 실 DB를 만져야 하면 먼저 백업하고, 끝나고 전 테이블을 대조해 무결성을 확인할 것
- **자기 실수를 숨기지 말 것.**
