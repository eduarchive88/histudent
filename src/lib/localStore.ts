/**
 * localStore.ts
 * 모든 데이터를 브라우저 localStorage에 저장/조회하는 유틸리티
 * 서버 DB를 사용하지 않으므로 각 선생님의 PC에만 데이터가 저장됩니다.
 */

// ─── 타입 정의 ───────────────────────────────────────────────
export type LocalStudent = {
  id: number;       // 로컬 자동 증가 ID
  grade: number;    // 학년
  class: number;    // 반
  number: number;   // 번호
  name: string;     // 이름
  studentId: string; // 5자리 학번 (예: 31101)
};

export type LocalLocation = {
  id: number;   // 로컬 자동 증가 ID
  name: string; // 장소명 (예: 과학실, 1교무실)
};

export type LocalTeacher = {
  id: number;   // 로컬 자동 증가 ID
  name: string; // 교사명
};

export type LocalCallHistory = {
  id: number;
  studentId: string;
  studentName: string;
  reason: string;
  locationName: string;
  callerName?: string;
  sessionCode: string;
  createdAt: string; // ISO 문자열
};

// ─── localStorage 키 상수 ────────────────────────────────────
const KEY_STUDENTS    = "hs_students";
const KEY_LOCATIONS   = "hs_locations";
const KEY_TEACHERS    = "hs_teachers";
const KEY_CALL_HISTORY = "hs_call_history";
const KEY_ID_COUNTER  = "hs_id_counter";

// ─── 공통 유틸 ───────────────────────────────────────────────

/** 로컬 자동 증가 ID 생성 */
function nextId(): number {
  const current = parseInt(localStorage.getItem(KEY_ID_COUNTER) || "0", 10);
  const next = current + 1;
  localStorage.setItem(KEY_ID_COUNTER, String(next));
  return next;
}

/** JSON 파싱 헬퍼 (파싱 실패 시 기본값 반환) */
function parseJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── 학생 명단 ───────────────────────────────────────────────

/** 저장된 학생 전체 조회 (학년→반→번호 순 정렬) */
export function getStudents(): LocalStudent[] {
  return parseJson<LocalStudent[]>(KEY_STUDENTS, []).sort(
    (a, b) => a.grade - b.grade || a.class - b.class || a.number - b.number
  );
}

/** 학생 전체 저장 (기존 데이터 교체) */
export function saveStudents(students: LocalStudent[]): void {
  localStorage.setItem(KEY_STUDENTS, JSON.stringify(students));
}

/** 학생 배열을 파싱된 데이터로 통째로 교체 */
export function replaceStudents(
  rows: Omit<LocalStudent, "id">[]
): LocalStudent[] {
  const withIds: LocalStudent[] = rows.map((r) => ({ ...r, id: nextId() }));
  localStorage.setItem(KEY_STUDENTS, JSON.stringify(withIds));
  return withIds;
}

// ─── 호출 장소 ───────────────────────────────────────────────

/** 저장된 장소 전체 조회 */
export function getLocations(): LocalLocation[] {
  return parseJson<LocalLocation[]>(KEY_LOCATIONS, []).sort((a, b) =>
    a.name.localeCompare(b.name, "ko")
  );
}

/** 장소 추가 */
export function addLocation(name: string): LocalLocation {
  const list = getLocations();
  const item: LocalLocation = { id: nextId(), name: name.trim() };
  list.push(item);
  localStorage.setItem(KEY_LOCATIONS, JSON.stringify(list));
  return item;
}

/** 장소 삭제 */
export function deleteLocation(id: number): void {
  const filtered = getLocations().filter((l) => l.id !== id);
  localStorage.setItem(KEY_LOCATIONS, JSON.stringify(filtered));
}

// ─── 교사 목록 ───────────────────────────────────────────────

/** 저장된 교사 전체 조회 */
export function getTeachers(): LocalTeacher[] {
  return parseJson<LocalTeacher[]>(KEY_TEACHERS, []);
}

/** 교사 추가 */
export function addTeacher(name: string): LocalTeacher {
  const list = getTeachers();
  const item: LocalTeacher = { id: nextId(), name: name.trim() };
  list.push(item);
  localStorage.setItem(KEY_TEACHERS, JSON.stringify(list));
  return item;
}

/** 교사 삭제 */
export function deleteTeacher(id: number): void {
  const filtered = getTeachers().filter((t) => t.id !== id);
  localStorage.setItem(KEY_TEACHERS, JSON.stringify(filtered));
}

// ─── 호출 기록 ───────────────────────────────────────────────

/** 저장된 호출 기록 전체 조회 (최신순) */
export function getCallHistory(): LocalCallHistory[] {
  return parseJson<LocalCallHistory[]>(KEY_CALL_HISTORY, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** 호출 기록 추가 */
export function addCallHistory(
  data: Omit<LocalCallHistory, "id" | "createdAt">
): LocalCallHistory {
  const list = parseJson<LocalCallHistory[]>(KEY_CALL_HISTORY, []);
  const item: LocalCallHistory = {
    ...data,
    id: nextId(),
    createdAt: new Date().toISOString(),
  };
  list.push(item);
  localStorage.setItem(KEY_CALL_HISTORY, JSON.stringify(list));
  return item;
}
