import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
// 확장자를 붙이지 않는다: TypeScript는 이대로 해석하고, Node 쪽은 hooks.mjs 가
// 확장자 없는 상대 임포트에 .ts 를 보완해준다 (tsconfig를 건드리지 않기 위한 선택).
import { PROJECT_ROOT, TMP_DIR, assertSafeTestDbPath } from "../helpers/testDb";

// 이 가드가 테스트 전체에서 가장 중요한 코드다.
// prisma7.config.ts 가 .env 를 읽기 때문에, 실수 한 번이면 테스트가 사용자의 실제 dev.db를
// 건드린다. 그래서 "막아야 할 것"을 명시적으로 못 박아 둔다.

test("tests/.tmp 안의 .db 파일은 허용", () => {
  assert.doesNotThrow(() => assertSafeTestDbPath(path.join(TMP_DIR, "actions-1234.db")));
});

test("실사용 DB(dev.db)는 어디에 있든 거부", () => {
  assert.throws(() => assertSafeTestDbPath(path.join(PROJECT_ROOT, "dev.db")), /dev\.db/);
  // 설령 tests/.tmp 안에 있더라도 그 이름은 쓰지 않는다
  assert.throws(() => assertSafeTestDbPath(path.join(TMP_DIR, "dev.db")), /dev\.db/);
  assert.throws(() => assertSafeTestDbPath(path.join(TMP_DIR, "DEV.DB")), /dev\.db/i);
});

test("tests/.tmp 바깥은 전부 거부", () => {
  for (const p of [
    path.join(PROJECT_ROOT, "scratch.db"),
    path.join(PROJECT_ROOT, "backups", "dev-2026-09-08.db"),
    path.join(PROJECT_ROOT, "prisma", "test.db"),
    path.join(PROJECT_ROOT, "tests", "test.db"),
    path.resolve(PROJECT_ROOT, "..", "test.db"),
  ]) {
    assert.throws(() => assertSafeTestDbPath(p), /tests[/\\]\.tmp/, p);
  }
});

// ".." 로 tests/.tmp 를 빠져나가는 경로가 통과하면 가드가 무의미해진다
test("상위로 빠져나가는 경로는 거부", () => {
  assert.throws(() => assertSafeTestDbPath(path.join(TMP_DIR, "..", "..", "escape.db")));
});

test("tests/.tmp 디렉토리 자체는 거부", () => {
  assert.throws(() => assertSafeTestDbPath(TMP_DIR));
});

test("상대 경로는 거부 (실행 위치에 따라 달라지므로)", () => {
  assert.throws(() => assertSafeTestDbPath("tests/.tmp/x.db"), /절대 경로/);
});

test(".db 가 아닌 파일은 거부", () => {
  assert.throws(() => assertSafeTestDbPath(path.join(TMP_DIR, "notes.txt")), /\.db/);
});

test("tests/.tmp 하위 디렉토리는 허용", () => {
  assert.doesNotThrow(() => assertSafeTestDbPath(path.join(TMP_DIR, "nested", "x.db")));
});
