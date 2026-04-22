"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/lib/socketClient";
import { getStudents, getLocations, logCallHistory } from "@/actions/admin";
import { BellRing, Users, MapPin, Search, X } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import AdminTabs from "@/components/AdminTabs";

type StudentType = { id: number; grade: number; class: number; number: number; name: string; studentId: string };
type LocationType = { id: number; name: string };

const LS_SESSION  = "hs_session";
const LS_LOCATION = "hs_location";
const LS_REASON   = "hs_reason";

export default function AdminCallPage() {
  const [students, setStudents]   = useState<StudentType[]>([]);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [reason, setReason] = useState("");
  const [sessionCode, setSessionCode] = useState("");

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    Promise.all([getStudents(), getLocations()]).then(([st, loc]) => {
      setStudents(st);
      setLocations(loc);
    });
    setSessionCode(localStorage.getItem(LS_SESSION) || "");
    setSelectedLocation(localStorage.getItem(LS_LOCATION) || "");
    setReason(localStorage.getItem(LS_REASON) || "");
  }, []);

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.trim();
    if (!q) return true;
    return s.name.includes(q) || s.studentId.includes(q) || `${s.grade}학년`.includes(q) || `${s.class}반`.includes(q);
  });

  const allFiltered = filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.studentId));

  const toggleStudent = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      allFiltered ? filteredStudents.forEach((s) => n.delete(s.studentId)) : filteredStudents.forEach((s) => n.add(s.studentId));
      return n;
    });

  const handleCall = async () => {
    if (selectedIds.size === 0)   { alert("호출할 학생을 선택해주세요."); return; }
    if (!selectedLocation)         { alert("호출 장소를 선택해주세요."); return; }
    if (!reason.trim())            { alert("용무 내용을 입력해주세요."); return; }
    if (!socket || !isConnected)   { alert("서버와 연결되어 있지 않습니다."); return; }
    const code = localStorage.getItem(LS_SESSION) || sessionCode;
    if (!code)                     { alert("세션 코드가 설정되어 있지 않습니다."); return; }

    const locInfo = locations.find((l) => l.id.toString() === selectedLocation);
    if (!locInfo) return;

    const targets = students.filter((s) => selectedIds.has(s.studentId));
    for (const student of targets) {
      const payload = { studentId: student.studentId, studentName: student.name, reason: reason.trim(), locationName: locInfo.name, sessionCode: code };
      socket.emit("call-student", { sessionCode: code, data: payload });
      await logCallHistory(payload);
      if (targets.length > 1) await new Promise((r) => setTimeout(r, 300));
    }
    alert(`${targets.map((s) => s.name).join(", ")} 학생을 호출했습니다.`);
  };

  const selectedSummary = (() => {
    const sel = students.filter((s) => selectedIds.has(s.studentId));
    if (!sel.length) return null;
    if (sel.length <= 3) return sel.map((s) => s.name).join(", ");
    return `${sel.slice(0, 2).map((s) => s.name).join(", ")} 외 ${sel.length - 2}명`;
  })();

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-4 py-6">
      <AdminHeader />
      <AdminTabs />

      {students.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          ⚠️ 학생 명단이 없습니다. <strong>설정</strong> 탭에서 엑셀을 업로드해주세요.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* 학생 선택 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-500" /> 학생 선택
            </h2>
            {selectedIds.size > 0 && (
              <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                <X className="w-3 h-3" /> 선택 해제
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="이름 또는 학번 검색"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div className="border border-slate-100 rounded-lg overflow-hidden">
            {filteredStudents.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-500 hover:bg-slate-100 border-b border-slate-100"
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-white text-[10px] flex-shrink-0 ${allFiltered ? "bg-blue-500 border-blue-500" : "border-slate-300"}`}>
                  {allFiltered ? "✓" : ""}
                </span>
                전체 선택 ({filteredStudents.length}명)
              </button>
            )}
            <ul className="max-h-52 overflow-y-auto divide-y divide-slate-50">
              {filteredStudents.length === 0 && <li className="px-3 py-4 text-sm text-slate-400 text-center">검색 결과 없음</li>}
              {filteredStudents.map((s) => {
                const checked = selectedIds.has(s.studentId);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => toggleStudent(s.studentId)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition ${checked ? "bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-white text-[10px] ${checked ? "bg-blue-500 border-blue-500" : "border-slate-300"}`}>
                        {checked ? "✓" : ""}
                      </span>
                      <span className="font-medium text-slate-800">{s.name}</span>
                      <span className="text-slate-400 text-xs ml-auto">{s.grade}학년 {s.class}반 {s.number}번</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {selectedSummary && (
            <p className="text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg font-medium">선택됨: {selectedSummary}</p>
          )}
        </div>

        {/* 장소 + 용무 */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-500" /> 호출 장소
            </h2>
            <select
              value={selectedLocation}
              onChange={(e) => { setSelectedLocation(e.target.value); localStorage.setItem(LS_LOCATION, e.target.value); }}
              className="border border-slate-300 px-3 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              <option value="">장소 선택</option>
              {locations.map((l) => <option key={l.id} value={l.id.toString()}>{l.name}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-slate-700">용무 내용</h2>
            <input
              type="text"
              value={reason}
              onChange={(e) => { setReason(e.target.value); localStorage.setItem(LS_REASON, e.target.value); }}
              placeholder="예: 수행평가 확인"
              className="border border-slate-300 px-3 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleCall()}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCall}
        disabled={!isConnected || selectedIds.size === 0}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl transition shadow-md"
      >
        {!isConnected ? "서버 연결 대기 중..." : selectedIds.size === 0 ? "학생을 선택하세요" : `${selectedIds.size}명 호출 전송 → "${sessionCode || '...'}" 세션`}
      </button>

      <div className="flex items-center gap-2 mt-2">
        <BellRing className="w-4 h-4 text-slate-300" />
        <p className="text-xs text-slate-400">학생 명단·장소가 비어있으면 <strong>설정</strong> 탭에서 먼저 등록하세요.</p>
      </div>
    </div>
  );
}
