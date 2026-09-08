import BetterSqlite3 from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  walReady: boolean | undefined;
};

// SQLite 기본 저널 모드(delete)는 커밋마다 저널 파일을 만들고 지우며 fsync를 두 번 한다.
// WAL로 바꾸면 커밋이 append-only로 끝나서 이 PC 기준 쓰기 지연이 1.42ms → 0.03ms (약 48배)로 줄어든다.
// journal_mode는 DB 파일 헤더에 저장되는 영구 설정이라 부팅 시 한 번만 켜두면 이후 모든 연결이 이어받는다.
// (Prisma 어댑터는 커넥션별 pragma 훅을 노출하지 않으므로 여기서 별도 연결로 한 번 설정한다.)
function enableWalMode() {
  if (globalForPrisma.walReady) return;
  globalForPrisma.walReady = true;

  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith(":memory:")) return;

  try {
    const db = new BetterSqlite3(url.replace(/^file:/, ""), { fileMustExist: true });
    db.pragma("journal_mode = WAL");
    db.close();
  } catch {
    // 마이그레이션 전이라 DB 파일이 아직 없거나 잠겨 있으면 조용히 넘어간다 —
    // 성능 최적화일 뿐이라 실패해도 앱은 그대로 동작해야 한다.
  }
}

enableWalMode();

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
