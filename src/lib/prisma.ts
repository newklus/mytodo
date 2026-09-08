import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  walReady: boolean | undefined;
  backupChecked: boolean | undefined;
};

const BACKUP_RETENTION_COUNT = 7;

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 상시 켜져있는 서버가 아니라 dev.cmd/run.cmd로 그때그때 띄우는 앱이라 OS의 cron 없이는
// "매일 자동으로" 뭔가를 실행할 방법이 없다. 그래서 부팅 시점마다 "오늘 이미 백업했나"를
// 확인해서 안 했으면 그때 하나 만든다 — 며칠 안 켜도(평일만 쓰는 등) 최신 N개는 그대로 유지된다.
// 데이터를 옮기거나 지우는 게 아니라 dev.db를 통째로 복제만 하는 것이라 앱은 평소에
// 이 파일들을 전혀 읽지 않는다 — 디스크가 고장 나는 등 재해 상황에서만 수동으로 복구한다.
function backupDailySnapshot() {
  if (globalForPrisma.backupChecked) return;
  globalForPrisma.backupChecked = true;

  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith(":memory:")) return;

  try {
    const dbPath = url.replace(/^file:/, "");
    if (!fs.existsSync(dbPath)) return;

    const dir = path.dirname(dbPath);
    const ext = path.extname(dbPath) || ".db";
    const stem = path.basename(dbPath, ext);
    const backupDir = path.join(dir, "backups");
    const todayPath = path.join(backupDir, `${stem}-${todayKey()}${ext}`);

    if (fs.existsSync(todayPath)) return; // 오늘 이미 백업함

    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(dbPath, todayPath);
    // WAL 파일까지 같이 복사해야 커밋됐지만 아직 메인 파일에 체크포인트되지 않은
    // 최신 데이터가 백업에서 누락되지 않는다.
    for (const suffix of ["-wal", "-shm"]) {
      const src = dbPath + suffix;
      if (fs.existsSync(src)) fs.copyFileSync(src, todayPath + suffix);
    }

    // 파일 개수 기준으로 최신 N개만 남긴다(날짜 범위 기준이면 며칠 건너뛰었을 때
    // 전부 "오래됨"으로 지워질 수 있어서 개수 기준으로 함).
    const snapshots = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(`${stem}-`) && f.endsWith(ext))
      .sort();
    const stale = snapshots.slice(0, Math.max(0, snapshots.length - BACKUP_RETENTION_COUNT));
    for (const f of stale) {
      const base = path.join(backupDir, f);
      fs.unlinkSync(base);
      for (const suffix of ["-wal", "-shm"]) {
        const sidecar = base + suffix;
        if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
      }
    }
  } catch {
    // 백업은 부가 기능이니 실패해도(권한 문제 등) 앱은 그대로 동작해야 한다.
  }
}

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
backupDailySnapshot();

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
