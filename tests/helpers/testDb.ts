// 테스트용 SQLite DB를 만들고 치우는 도우미.
//
// ⚠ 이 파일의 가장 중요한 역할은 속도가 아니라 **사용자의 실제 데이터를 지키는 것**이다.
// `prisma7.config.ts`가 `dotenv/config`로 `.env`를 읽기 때문에 아무 생각 없이 Prisma를 부르면
// DATABASE_URL이 실사용 `dev.db`를 가리킨다. 그래서 여기서는 환경변수를 절대 신뢰하지 않고,
// 항상 경로를 명시하며, 그 경로가 안전한 자리인지 먼저 확인(assertSafeTestDbPath)한 뒤에만
// 파일을 건드린다.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, "..", "..");
export const TMP_DIR = path.join(PROJECT_ROOT, "tests", ".tmp");
const TEMPLATE_DB = path.join(TMP_DIR, "_template.db");
const SCHEMA = path.join(PROJECT_ROOT, "prisma", "schema.prisma");

/**
 * 이 경로에 테스트 DB를 만들어도 되는지 확인한다. 조건을 하나라도 어기면 던진다.
 * 순수 함수라 단위 테스트로 직접 검증한다 (tests/unit/testDbGuard.test.ts).
 */
export function assertSafeTestDbPath(dbPath: string): void {
  if (!path.isAbsolute(dbPath)) {
    throw new Error(`테스트 DB 경로는 절대 경로여야 합니다: ${dbPath}`);
  }
  const normalized = path.resolve(dbPath);
  const base = path.basename(normalized);

  if (!base.endsWith(".db")) {
    throw new Error(`테스트 DB 파일명은 .db 로 끝나야 합니다: ${base}`);
  }
  // 이름만으로도 실사용 DB로 오해될 여지가 있는 것은 전부 막는다.
  if (/^dev\.db$/i.test(base)) {
    throw new Error(`실사용 DB 이름(dev.db)은 테스트에 쓸 수 없습니다: ${normalized}`);
  }
  // tests/.tmp 밖은 전부 거부한다 — 프로젝트 루트, backups/, 홈 디렉토리 등 포함.
  const rel = path.relative(TMP_DIR, normalized);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`테스트 DB는 tests/.tmp 안에만 만들 수 있습니다: ${normalized}`);
  }
}

function fileUrlFor(dbPath: string) {
  // Prisma의 SQLite 커넥터는 "file:" + 경로 형태를 받는다 (윈도우 절대 경로도 그대로 통한다).
  return `file:${dbPath.replace(/\\/g, "/")}`;
}

/**
 * 스키마만 있고 데이터가 없는 템플릿 DB를 한 번 만들어 두고 재사용한다.
 * `prisma db push`는 1초쯤 걸리지만 파일 복사는 순식간이라, 테스트 파일마다 push 하지 않는다.
 * 스키마가 템플릿보다 새로우면 자동으로 다시 만든다.
 */
function ensureTemplate(): string {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const templateFresh =
    fs.existsSync(TEMPLATE_DB) && fs.statSync(TEMPLATE_DB).mtimeMs >= fs.statSync(SCHEMA).mtimeMs;
  if (templateFresh) return TEMPLATE_DB;

  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TEMPLATE_DB + suffix, { force: true });
  }
  // npx / .bin 래퍼(.cmd)는 Node가 shell 없이 실행하길 거부하므로(윈도우 EINVAL),
  // Prisma CLI의 진입 스크립트를 node로 직접 실행한다 — 셸을 안 거쳐서 인용 문제도 없다.
  const prismaBin = path.join(PROJECT_ROOT, "node_modules", "prisma", "build", "index.js");
  // --url 로 명시 오버라이드한다. 환경변수(.env → dev.db)에 절대 의존하지 않기 위해서다.
  execFileSync(process.execPath, [prismaBin, "db", "push", "--url", fileUrlFor(TEMPLATE_DB)], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
  });
  return TEMPLATE_DB;
}

export interface TestDb {
  /** 절대 경로 */
  path: string;
  /** DATABASE_URL 에 넣을 값 */
  url: string;
  /** 파일과 WAL 사이드카를 지운다 */
  dispose(): void;
}

/**
 * 빈 테스트 DB를 만들고 `process.env.DATABASE_URL` 을 그쪽으로 돌려놓는다.
 *
 * ⚠ 반드시 `@/lib/prisma` 를 (직접이든 서버 액션을 통해서든) **불러오기 전에** 호출할 것.
 * `prisma.ts` 는 모듈을 읽는 시점에 DATABASE_URL 을 붙잡고 클라이언트를 만들기 때문에,
 * 나중에 환경변수를 바꿔도 이미 만들어진 연결은 옛 DB를 계속 본다.
 * 그래서 테스트 파일은 이 함수를 부른 뒤 `await import("@/lib/actions/...")` 로 늦게 불러온다.
 *
 * `node --test` 는 테스트 파일마다 별도 프로세스를 띄우므로, 파일 단위로 DB가 완전히 격리된다.
 */
export function createTestDb(name: string): TestDb {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dbPath = path.join(TMP_DIR, `${safeName}-${process.pid}.db`);

  assertSafeTestDbPath(dbPath);
  ensureTemplate();

  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
  fs.copyFileSync(TEMPLATE_DB, dbPath);

  const url = fileUrlFor(dbPath);
  process.env.DATABASE_URL = url;

  return {
    path: dbPath,
    url,
    async dispose() {
      assertSafeTestDbPath(dbPath);
      // 윈도우는 파일 핸들이 하나라도 남아 있으면 EPERM 을 낸다. 연결을 닫은 직후에도
      // 잠깐 잠겨 있는 경우가 있어 몇 번 재시도한다. 그래도 안 지워지면 임시 파일이니
      // 테스트를 실패시키지 않고 넘어간다(다음 실행에서 덮어쓴다).
      for (let attempt = 0; attempt < 5; attempt++) {
        let remaining = false;
        for (const suffix of ["", "-wal", "-shm"]) {
          try {
            fs.rmSync(dbPath + suffix, { force: true });
          } catch {
            remaining = true;
          }
        }
        if (!remaining) return;
        await new Promise((r) => setTimeout(r, 50));
      }
    },
  };
}

/**
 * 파일을 지우기 전에 Prisma 연결을 닫는다. 안 닫으면 윈도우에서 파일이 잠겨 있다.
 * 액션을 한 번도 부르지 않아 클라이언트가 안 만들어졌으면 조용히 넘어간다.
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  } catch {}
}
