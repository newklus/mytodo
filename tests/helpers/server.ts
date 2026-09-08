// L3(라우트 스모크)용: 시드된 테스트 DB를 물린 프로덕션 서버를 띄우고 HTTP로 두드린다.
//
// 브라우저를 쓰지 않는 이유: 여기서 확인하려는 건 클릭 동작이 아니라 **페이지가 무엇을 조회해
// 무엇을 렌더하는가**(뷰 필터·정렬·페이지네이션·500 여부)다. 그건 HTML만 봐도 충분하고,
// 브라우저 자동화보다 훨씬 빠르고 덜 깨진다.
//
// ⚠ 반드시 `next build` 가 끝난 상태여야 한다 (npm run test:all 이 그 순서를 보장한다).
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
import { PROJECT_ROOT } from "./testDb";

const NEXT_BIN = path.join(PROJECT_ROOT, "node_modules", "next", "dist", "bin", "next");

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

export interface TestServer {
  port: number;
  /** 페이지를 받아 상태·본문을 돌려준다. cookie 로 설정(페이지당 개수 등)을 흉내낸다. */
  get(pathname: string, options?: { cookie?: string }): Promise<{ status: number; html: string }>;
  stop(): Promise<void>;
}

export async function startTestServer(dbPath: string): Promise<TestServer> {
  if (!fs.existsSync(path.join(PROJECT_ROOT, ".next", "BUILD_ID"))) {
    throw new Error("프로덕션 빌드가 없습니다. `npm run build` 를 먼저 실행하세요 (npm run test:all 이 대신 해줍니다).");
  }

  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(port)], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`, NODE_ENV: "production" },
    stdio: "ignore",
  });

  const get: TestServer["get"] = async (pathname, options = {}) => {
    const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      headers: options.cookie ? { cookie: options.cookie } : {},
    });
    return { status: res.status, html: await res.text() };
  };

  // 기동 대기 — 최대 30초. 죽었으면 바로 알린다(무한 대기 방지).
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`테스트 서버가 기동 중 종료됐습니다 (exit ${child.exitCode})`);
    try {
      const res = await get("/?view=today");
      if (res.status < 500) break;
    } catch {}
    if (Date.now() > deadline) {
      child.kill("SIGKILL");
      throw new Error("테스트 서버가 30초 안에 기동하지 않았습니다.");
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    port,
    get,
    async stop() {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
        await new Promise((r) => setTimeout(r, 300));
      }
    },
  };
}

/** 목록에 그려진 태스크 제목을 렌더된 HTML에서 순서대로 뽑는다. */
export function renderedTaskTitles(html: string): string[] {
  // TaskItem 의 제목은 <p class="text-sm ...">제목</p> 로 나온다.
  const titles: string[] = [];
  for (const m of html.matchAll(/<p class="text-sm[^"]*">([^<]*)<\/p>/g)) {
    titles.push(decodeEntities(m[1]));
  }
  return titles;
}

/**
 * React가 끼워 넣은 `<!-- -->` 주석을 걷어낸 HTML.
 *
 * 서버 렌더 시 인접한 표현식 사이에는 주석이 들어간다(하이드레이션 때 텍스트 노드 경계를
 * 되찾기 위한 것). 그래서 `할 일 {n}개` 는 원문에서 `할 일 <!-- -->2<!-- -->개` 로 나온다.
 * 화면에 보이는 문구를 찾을 때는 반드시 이걸 거칠 것 — 안 그러면 있는데도 없다고 나온다.
 */
export function visibleHtml(html: string): string {
  return html.replace(/<!--.*?-->/g, "");
}

/** 화면 문구가 실제로 렌더됐는지 확인한다 (React 주석을 걷어낸 뒤 비교). */
export function hasText(html: string, text: string): boolean {
  return visibleHtml(html).includes(text);
}

/** "3 / 12 · 21–30 / 총 118개" 같은 페이지 표시줄을 파싱한다. 없으면 null. */
export function paginationInfo(html: string): {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
} | null {
  const m = visibleHtml(html).match(/(\d+)\s*\/\s*(\d+)\s*·\s*(\d+)[–-](\d+)\s*\/\s*총\s*(\d+)개/);
  if (!m) return null;
  return {
    page: Number(m[1]),
    totalPages: Number(m[2]),
    from: Number(m[3]),
    to: Number(m[4]),
    total: Number(m[5]),
  };
}

function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
