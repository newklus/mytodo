// "next/cache" 대체품 (hooks.mjs가 이 파일로 바꿔치기한다).
// 서버 액션은 작업이 끝나면 refresh()로 현재 라우트를 다시 그리게 한다. 테스트에는 렌더러가
// 없으므로 실제로 할 일은 없지만, "액션이 화면 갱신을 요청했는가"도 검증할 가치가 있어서
// 아무것도 안 하는 대신 호출 횟수를 센다.
let calls = 0;

export function refresh() {
  calls += 1;
}

export function refreshCallCount() {
  return calls;
}

export function resetRefreshCallCount() {
  calls = 0;
}
