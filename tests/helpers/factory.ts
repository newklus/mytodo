// 서버 액션 테스트용 픽스처. 액션을 거치지 않고 DB에 직접 넣어서, 테스트가 "무엇을 검증하는지"와
// "무엇을 준비하는지"를 섞지 않게 한다 (준비까지 액션으로 하면 준비가 깨질 때 원인 파악이 어렵다).
//
// better-sqlite3 를 직접 쓰는 이유: Prisma 클라이언트는 DATABASE_URL 을 모듈 로드 시점에 붙잡으므로
// 준비 단계에서 또 하나의 클라이언트를 만들면 헷갈린다. 준비는 SQL, 검증도 SQL, 실행만 액션이다.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Database = require("better-sqlite3") as any;

export interface Db {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prepare(sql: string): any;
  close(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction(fn: (...args: any[]) => void): (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pragma(source: string): any;
  exec(sql: string): void;
}

export function openDb(dbPath: string): Db {
  return new Database(dbPath);
}

let seq = 0;
function nextId(prefix: string) {
  seq += 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

const iso = (d: Date) => d.toISOString().replace("Z", "+00:00");

export interface TaskSeed {
  id?: string;
  title?: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: number;
  completed?: boolean;
  completedAt?: Date | null;
  recurrence?: string | null;
  projectId?: string | null;
  parentId?: string | null;
  createdAt?: Date;
}

export function insertProject(db: Db, seed: { id?: string; name?: string; color?: string | null } = {}) {
  const row = {
    id: seed.id ?? nextId("p"),
    name: seed.name ?? "프로젝트",
    color: seed.color ?? "#3b82f6",
    createdAt: iso(new Date(2026, 0, 1)),
  };
  db.prepare("insert into Project (id,name,color,createdAt) values (@id,@name,@color,@createdAt)").run(row);
  return row;
}

export function insertTag(db: Db, seed: { id?: string; name?: string; color?: string | null } = {}) {
  const row = { id: seed.id ?? nextId("g"), name: seed.name ?? nextId("태그"), color: seed.color ?? "#22c55e" };
  db.prepare("insert into Tag (id,name,color) values (@id,@name,@color)").run(row);
  return row;
}

export function insertTask(db: Db, seed: TaskSeed = {}) {
  const created = seed.createdAt ?? new Date(2026, 0, 1);
  const row = {
    id: seed.id ?? nextId("t"),
    title: seed.title ?? "태스크",
    description: seed.description ?? null,
    dueDate: seed.dueDate ? iso(seed.dueDate) : null,
    priority: seed.priority ?? 3,
    completed: seed.completed ? 1 : 0,
    completedAt: seed.completedAt ? iso(seed.completedAt) : null,
    recurrence: seed.recurrence ?? null,
    order: 0,
    projectId: seed.projectId ?? null,
    parentId: seed.parentId ?? null,
    createdAt: iso(created),
    updatedAt: iso(created),
  };
  db.prepare(
    'insert into Task (id,title,description,dueDate,priority,completed,completedAt,recurrence,"order",projectId,parentId,createdAt,updatedAt)' +
      " values (@id,@title,@description,@dueDate,@priority,@completed,@completedAt,@recurrence,@order,@projectId,@parentId,@createdAt,@updatedAt)"
  ).run(row);
  return row;
}

export function linkTag(db: Db, taskId: string, tagId: string) {
  db.prepare("insert or ignore into TaskTag (taskId,tagId) values (?,?)").run(taskId, tagId);
}

/**
 * 저장된 날짜를 **로컬 기준** YYYY-MM-DD 로 바꾼다.
 *
 * 앱은 마감일을 "로컬 자정"으로 다루는데(캘린더의 toDateKey, 편집 폼의 toDateInputValue 모두
 * getFullYear/getMonth/getDate 를 쓴다), DB에는 그 순간이 UTC로 저장된다. KST(+9)에서는
 * 로컬 9/16 00:00 이 UTC 9/15T15:00 이라 **저장된 문자열을 그냥 잘라 쓰면 하루가 밀린다.**
 * 검증은 반드시 이 함수를 거칠 것.
 */
export function localDateKey(value: string | Date | null): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---- 검증용 조회 ----

export function getTask(db: Db, id: string) {
  return db.prepare("select * from Task where id = ?").get(id) ?? null;
}

export function countTasks(db: Db, where = "1=1") {
  return db.prepare(`select count(*) c from Task where ${where}`).get().c as number;
}

export function taskTitles(db: Db, where = "1=1") {
  return db
    .prepare(`select title from Task where ${where} order by title`)
    .all()
    .map((r: { title: string }) => r.title);
}

export function tagIdsOf(db: Db, taskId: string): string[] {
  return db
    .prepare("select tagId from TaskTag where taskId = ? order by tagId")
    .all(taskId)
    .map((r: { tagId: string }) => r.tagId);
}

export function projectNames(db: Db): string[] {
  return db
    .prepare("select name from Project order by name")
    .all()
    .map((r: { name: string }) => r.name);
}

export function tagNames(db: Db): string[] {
  return db
    .prepare("select name from Tag order by name")
    .all()
    .map((r: { name: string }) => r.name);
}
