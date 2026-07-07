"use client";

import { useState, useEffect } from "react";
import { read, utils } from "xlsx";
import {
  getStudents,
  getLocations,
  getTeachers,
  addLocation,
  deleteLocation,
  addTeacher,
  deleteTeacher,
  replaceStudents,
  LocalStudent,
  LocalLocation,
  LocalTeacher,
} from "@/lib/localStore";
import { Upload, Trash2, Users, MapPin, Download, UserCheck } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import AdminTabs from "@/components/AdminTabs";

export default function AdminSettingsPage() {
  // ─── 상태 ─────────────────────────────────────────────────
  const [students,   setStudents]   = useState<LocalStudent[]>([]);
  const [locations,  setLocations]  = useState<LocalLocation[]>([]);
  const [teachers,   setTeachers]   = useState<LocalTeacher[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [newTeacherName,  setNewTeacherName]  = useState("");
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // ─── 초기 로드 (localStorage에서 불러오기) ─────────────────
  const refreshData = () => {
    setStudents(getStudents());
    setLocations(getLocations());
    setTeachers(getTeachers());
  };

  useEffect(() => {
    refreshData();
  }, []);

  // ─── 엑셀 파싱 (클라이언트에서 직접 처리) ─────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;

    setUploadMsg(null);
    setIsUploading(true);

    try {
      // 파일을 ArrayBuffer로 읽기
      const bytes = await file.arrayBuffer();
      const workbook = read(bytes);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json<Record<string, unknown>>(worksheet);

      if (jsonData.length === 0) {
        setUploadMsg({ type: "err", text: "데이터를 찾지 못했습니다. 헤더(학년/반/번호/이름)를 확인하세요." });
        return;
      }

      // 실제 헤더 목록 — 이름 컬럼 못 찾을 때 진단용
      const detectedHeaders = Object.keys(jsonData[0]).join(", ");

      // 유연한 컬럼 매핑 헬퍼
      const getVal = (row: Record<string, unknown>, keys: string[]) => {
        const key = Object.keys(row).find((k) =>
          keys.some((pk) =>
            k.replace(/\s/g, "").toLowerCase().includes(pk.replace(/\s/g, "").toLowerCase())
          )
        );
        return key ? row[key] : null;
      };

      const rows = jsonData.map((row) => {
        const grade     = parseInt(String(getVal(row, ["학년", "grade", "년"]) ?? "1")) || 1;
        const cls       = parseInt(String(getVal(row, ["반", "class", "학급", "班"]) ?? "1")) || 1;
        const number    = parseInt(String(getVal(row, ["번호", "num", "number", "출석", "No", "no"]) ?? "1")) || 1;
        const name      = String(getVal(row, ["이름", "성명", "학생명", "name", "성 명", "학생 이름"]) ?? "");
        const studentId = `${grade}${String(cls).padStart(2, "0")}${String(number).padStart(2, "0")}`;
        return { grade, class: cls, number, name: name || "이름없음", studentId };
      });

      // 이름 컬럼 확인
      const noNames = jsonData.every((row) => {
        const val = getVal(row, ["이름", "성명", "학생명", "name", "성 명", "학생 이름"]);
        return !val;
      });

      if (noNames) {
        setUploadMsg({
          type: "err",
          text: `이름 열을 찾지 못했습니다. 파일의 헤더: [${detectedHeaders}] — 이름/성명/학생명 중 하나가 있어야 합니다.`,
        });
        return;
      }

      // localStorage에 저장 (기존 데이터 교체)
      replaceStudents(rows);
      setUploadMsg({ type: "ok", text: `${rows.length}명 업로드 완료! (이 PC에만 저장됩니다)` });
      refreshData();
    } catch (err: unknown) {
      setUploadMsg({ type: "err", text: err instanceof Error ? err.message : "알 수 없는 오류" });
    } finally {
      setIsUploading(false);
    }
  };

  // ─── 장소 CRUD ────────────────────────────────────────────
  const handleAddLocation = () => {
    if (!newLocationName.trim()) return;
    addLocation(newLocationName.trim());
    setNewLocationName("");
    refreshData();
  };

  const handleDeleteLocation = (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    deleteLocation(id);
    refreshData();
  };

  // ─── 교사 CRUD ────────────────────────────────────────────
  const handleAddTeacher = () => {
    if (!newTeacherName.trim()) return;
    addTeacher(newTeacherName.trim());
    setNewTeacherName("");
    refreshData();
  };

  const handleDeleteTeacher = (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    deleteTeacher(id);
    refreshData();
  };

  // ─── 렌더링 ───────────────────────────────────────────────
  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-4 py-6">
      <AdminHeader />
      <AdminTabs />

      {/* 로컬 저장 안내 배너 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        💾 <strong>모든 데이터는 이 PC의 브라우저에만 저장됩니다.</strong> 다른 선생님의 명단과 공유되지 않으며, 브라우저 데이터를 지우면 초기화됩니다.
      </div>

      {/* 학생 명단 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-500 w-5 h-5" /> 학생 명단 관리
          </h2>
          <span className="text-xs text-slate-400">현재 {students.length}명</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          엑셀(.xlsx) 헤더: <strong>학년 / 반 / 번호 / 이름</strong>
        </p>

        <div className="flex gap-2 mb-3">
          <label
            className={`flex-1 flex items-center justify-center gap-2 font-semibold py-2.5 px-4 rounded-lg text-sm transition ${
              isUploading
                ? "bg-indigo-300 text-white cursor-wait"
                : "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
            }`}
          >
            <Upload className="w-4 h-4" />
            {isUploading ? "파일 처리 중..." : "엑셀 파일 선택 → 즉시 업로드"}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={isUploading}
              onChange={handleFileChange}
            />
          </label>
          <a
            href="/api/sample-xlsx"
            className="flex items-center gap-2 bg-slate-100 text-slate-700 font-semibold py-2.5 px-4 rounded-lg hover:bg-slate-200 transition text-sm border border-slate-200 whitespace-nowrap"
          >
            <Download className="w-4 h-4" /> 샘플 양식
          </a>
        </div>

        {isUploading && (
          <div className="mb-3 flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            <span className="animate-spin">⏳</span> 파일을 분석하고 있습니다...
          </div>
        )}
        {!isUploading && uploadMsg && (
          <div
            className={`mb-3 text-sm rounded-lg px-3 py-2 border font-medium ${
              uploadMsg.type === "ok"
                ? "text-green-700 bg-green-50 border-green-200"
                : "text-red-600 bg-red-50 border-red-200"
            }`}
          >
            {uploadMsg.type === "ok" ? "✅ " : "❌ "}
            {uploadMsg.text}
          </div>
        )}

        {students.length > 0 && (
          <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {["학년", "반", "번호", "이름"].map((h) => (
                    <th key={h} className="py-2 px-3 text-left text-slate-500 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="py-1.5 px-3">{s.grade}</td>
                    <td className="py-1.5 px-3">{s.class}</td>
                    <td className="py-1.5 px-3">{s.number}</td>
                    <td className="py-1.5 px-3 font-medium">{s.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 호출 교사 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
          <UserCheck className="text-emerald-500 w-5 h-5" /> 호출 교사 관리
        </h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newTeacherName}
            onChange={(e) => setNewTeacherName(e.target.value)}
            placeholder="교사명 (예: 담임, 과학쌤, 홍길동)"
            className="border border-slate-300 px-3 py-2 rounded-lg flex-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleAddTeacher()}
          />
          <button
            type="button"
            onClick={handleAddTeacher}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition text-sm font-semibold"
          >
            추가
          </button>
        </div>
        <ul className="flex flex-col gap-1.5">
          {teachers.length === 0 && (
            <li className="text-sm text-slate-400 py-3 text-center">등록된 교사가 없습니다.</li>
          )}
          {teachers.map((t) => (
            <li
              key={t.id}
              className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-sm"
            >
              <span>{t.name}</span>
              <button
                type="button"
                onClick={() => handleDeleteTeacher(t.id)}
                className="text-slate-300 hover:text-red-500 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* 호출 장소 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
          <MapPin className="text-rose-500 w-5 h-5" /> 호출 장소 관리
        </h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            placeholder="장소명 (예: 교무실)"
            className="border border-slate-300 px-3 py-2 rounded-lg flex-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
          />
          <button
            type="button"
            onClick={handleAddLocation}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition text-sm font-semibold"
          >
            추가
          </button>
        </div>
        <ul className="flex flex-col gap-1.5">
          {locations.length === 0 && (
            <li className="text-sm text-slate-400 py-3 text-center">등록된 장소가 없습니다.</li>
          )}
          {locations.map((loc) => (
            <li
              key={loc.id}
              className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-sm"
            >
              <span>{loc.name}</span>
              <button
                type="button"
                onClick={() => handleDeleteLocation(loc.id)}
                className="text-slate-300 hover:text-red-500 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
