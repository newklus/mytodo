// Node 내장 테스트 러너(`node --test`)가 이 프로젝트의 소스를 그대로 읽게 해주는 모듈 훅.
// 별도 테스트 프레임워크(Vitest/Jest)를 쓰지 않는 대신 필요한 세 가지만 여기서 메운다.
//
//   1) tsconfig의 "@/*" 별칭 — Node는 tsconfig를 안 읽으므로 직접 src/ 로 매핑
//   2) "next/cache" — 서버 액션이 끝날 때마다 refresh()를 부르는데 테스트에는 렌더러가 없다.
//      호출 횟수만 세는 스텁으로 바꿔서, 액션이 화면 갱신을 요청했는지도 검증할 수 있게 한다.
//   3) 확장자 없는 상대 임포트 — Prisma가 생성한 클라이언트가 `./enums` 처럼 쓰는데
//      Node의 ESM 해석기는 확장자를 보완해주지 않는다. 실패했을 때만 .ts 를 붙여 재시도.
//
// TypeScript는 Node 22.6+ 의 타입 스트리핑이 알아서 처리하므로 트랜스파일 단계가 없다.
// 사용: node --import ./tests/helpers/hooks.mjs --test tests/unit
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ""));
const PROJECT_ROOT = path.resolve(HERE, "..", "..");
const SRC = path.join(PROJECT_ROOT, "src");
// .ts 로 두는 이유: 테스트가 이 스텁을 직접 임포트해 refresh 호출 횟수를 볼 때
// TypeScript가 타입을 알아야 하기 때문. Node는 타입 스트리핑으로 그대로 읽는다.
const NEXT_CACHE_STUB = pathToFileURL(path.join(HERE, "nextCacheStub.ts")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      // format을 지정하면 타입 스트리핑을 건너뛰어 버리므로 url만 돌려준다.
      return { url: pathToFileURL(path.join(SRC, specifier.slice(2) + ".ts")).href, shortCircuit: true };
    }
    if (specifier === "next/cache") {
      return { url: NEXT_CACHE_STUB, shortCircuit: true };
    }
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith(".") && context.parentURL) {
        for (const candidate of [specifier + ".ts", specifier + "/index.ts"]) {
          const url = new URL(candidate, context.parentURL);
          if (fs.existsSync(url)) return { url: url.href, shortCircuit: true };
        }
      }
      throw err;
    }
  },
});
