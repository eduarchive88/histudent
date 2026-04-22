"use client";

import { useState, useEffect, useRef } from "react";
import { read, utils } from "xlsx";
import { useSocket } from "@/lib/socketClient";
import {
  getStudents,
  bulkInsertStudents,
  getLocations,
  addLocation,
  deleteLocation,
  logCallHistory,
} from "@/actions/admin";
import {
  Upload, Trash2, BellRing, Settings2, Users,
  MapPin, Download, Wifi, WifiOff, Search, X,
} from "lucide-react";

type StudentType = { id: number; grade: number; class: number; number: number; name: string; studentId: string };
type LocationType = { id: number; name: string };
type Tab = "call" | "settings";

const LS_SESSION  = "hs_session";
const LS_LOCATION = "hs_location";
const LS_REASON   = "hs_reason";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("call");
  const [sessionCode, setSessionCode] = useState("");
  const [students, setStudents]   = useState<StudentType[]>([]);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { socket, isConnected } = useSocket();

  // 다중 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [reason, setReason] = useState("");

  const refreshData = async () => {
    const [st, loc] = await Promise.all([getStudents(), getLocations()]);
    setStudents(st);
    setLocations(loc);
  };

  useEffect(() => {
    refreshData();
    const session = localStorage.getItem(LS_SESSION) || `class${Math.floor(Math.random() * 10) + 1}`;
    setSessionCode(session);
    localStorage.setItem(LS_SESSION, session);
    setSelectedLocation(localStorage.getItem(LS_LOCATION) || "");
    setReason(localStorage.getItem(LS_REASON) || "");
  }, []);

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.trim();
    if (!q) return true;
    return (
      s.name.includes(q) ||
      s.studentId.includes(q) ||
      `${s.grade}학년`.includes(q) ||
      `${s.class}반`.includes(q)
    );
  });

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filteredStudents.every((s) => selectedIds.has(s.studentId))) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.delete(s.studentId));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredStudents.forEach((s) => next.add(s.studentId));
        return next;
      });
    }
  };

  const parseExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadStatus("파일 읽는 중...");
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json<Record<string, unknown>>(worksheet);

      const parsedStudents = jsonData.map((row) => {
        const getVal = (keys: string[]) => {
          const key = Object.keys(row).find((k) => keys.some((pk) => k.includes(pk)));
          return key ? row[key] : null;
        };
        const grade = parseInt(String(getVal(["학년", "grade"]) ?? "1")) || 1;
        const cls   = parseInt(String(getVal(["반", "class"]) ?? "1")) || 1;
        const num   = parseInt(String(getVal(["번호", "num", "number"]) ?? "1")) || 1;
        const name  = String(getVal(["이름", "name"]) ?? "이름없음");
        const studentId = `${grade}${String(cls).padStart(2, "0")}${String(num).padStart(2, "0")}`;
        return { grade, class: cls, number: num, name, studentId };
      });

      if (parsedStudents.length === 0) {
        setUploadStatus("❌ 학생 데이터를 찾지 못했습니다. 헤더(학년/반/번호/이름)를 확인하세요.");
        return;
      }
      if (!confirm(`총 ${parsedStudents.length}명의 학생 데이터를 덮어쓰시겠습니까?`)) {
        setUploadStatus(null);
        return;
      }
      setUploadStatus("저장 중...");
      const res = await bulkInsertStudents(parsedStudents, true);
      if (res.success) {
        setUploadStatus(`✅ ${parsedStudents.length}명 업로드 완료!`);
        refreshData();
      } else {
        setUploadStatus(`❌ 오류: ${res.error}`);
      }
    } catch {
      setUploadStatus("❌ 파일을 읽는 중 오류가 발생했습니다.");
    }
  };

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;
    const res = await addLocation(newLocationName.trim());
    if (res.success) { setNewLocationName(""); refreshData(); }
    else alert(res.error);
  };

  const handleDeleteLocation = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteLocation(id);
    refreshData();
  };

  const handleCallStudents = async () => {
    if (selectedIds.size === 0) { alert("호출할 학생을 선택해주세요."); return; }
    if (!selectedLocation)       { alert("호출 장소를 선택해주세요."); return; }
    if (!reason.trim())          { alert("용무 내용을 입력해주세요."); return; }
    if (!socket || !isConnected) { alert("서버와 연결되어 있지 않습니다."); return; }

    const locInfo = locations.find((l) => l.id.toString() === selectedLocation);
    if (!locInfo) { alert("장소 정보를 찾을 수 없습니다."); return; }

    const targets = students.filter((s) => selectedIds.has(s.studentId));

    for (const student of targets) {
      const payload = {
        studentId: student.studentId,
        studentName: student.name,
        reason: reason.trim(),
        locationName: locInfo.name,
        sessionCode,
      };
      socket.emit("call-student", { sessionCode, data: payload });
      await logCallHistory(payload);
      if (targets.length > 1) await new Promise((r) => setTimeout(r, 300));
    }

    alert(`${targets.map((s) => s.name).join(", ")} 학생을 호출했습니다.`);
  };

  // 선택된 학생 이름 요약
  const selectedSummary = (() => {
    const sel = students.filter((s) => selectedIds.has(s.studentId));
    if (sel.length === 0) return null;
    if (sel.length <= 3) return sel.map((s) => s.name).join(", ");
    return `${sel.slice(0, 2).map((s) => s.name).join(", ")} 외 ${sel.length - 2}명`;
  })();

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings2 className="text-blue-500 w-6 h-6" /> 교사 관리자 패널
        </h1>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
          isConnected ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"
        }`}>
          {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isConnected ? "실시간 연결됨" : "연결 중..."}
        </div>
      </div>

      {/* Session */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">세션 코드</span>
        <input
          type="text"
          value={sessionCode}
          onChange={(e) => { setSessionCode(e.target.value.trim()); localStorage.setItem(LS_SESSION, e.target.value.trim()); }}
          placeholder="예: class1"
          className="border border-slate-300 px-3 py-1.5 rounded-lg flex-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
        <span className="text-xs text-slate-400 hidden sm:block whitespace-nowrap">디스플레이와 같은 코드 사용</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("call")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
            tab === "call"
              ? "bg-blue-600 text-white shadow"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <BellRing className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          실시간 호출
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
            tab === "settings"
              ? "bg-blue-600 text-white shadow"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Settings2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          설정
        </button>
      </div>

      {/* ── 실시간 호출 탭 ── */}
      {tab === "call" && (
        <div className="flex flex-col gap-4">

          {students.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              ⚠️ 학생 명단이 없습니다. &quot;설정&quot; 탭에서 엑셀을 업로드해주세요.
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
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
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
                {/* 전체 선택 */}
                {filteredStudents.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-500 hover:bg-slate-100 border-b border-slate-100"
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-white text-[10px] ${
                      filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.studentId))
                        ? "bg-blue-500 border-blue-500" : "border-slate-300"
                    }`}>
                      {filteredStudents.every((s) => selectedIds.has(s.studentId)) ? "✓" : ""}
                    </span>
                    전체 선택 ({filteredStudents.length}명)
                  </button>
                )}

                <ul className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                  {filteredStudents.length === 0 && (
                    <li className="px-3 py-4 text-sm text-slate-400 text-center">검색 결과 없음</li>
                  )}
                  {filteredStudents.map((s) => {
                    const checked = selectedIds.has(s.studentId);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => toggleStudent(s.studentId)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition ${
                            checked ? "bg-blue-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-white text-[10px] ${
                            checked ? "bg-blue-500 border-blue-500" : "border-slate-300"
                          }`}>
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
                <p className="text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg font-medium">
                  선택됨: {selectedSummary}
                </p>
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
                  {locations.map((l) => (
                    <option key={l.id} value={l.id.toString()}>{l.name}</option>
                  ))}
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
                  onKeyDown={(e) => e.key === "Enter" && handleCallStudents()}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleCallStudents}
            disabled={!isConnected || selectedIds.size === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl transition shadow-md"
          >
            {!isConnected
              ? "서버 연결 대기 중..."
              : selectedIds.size === 0
              ? "학생을 선택하세요"
              : `${selectedIds.size}명 호출 전송 → "${sessionCode}" 세션`}
          </button>
        </div>
      )}

      {/* ── 설정 탭 ── */}
      {tab === "settings" && (
        <div className="flex flex-col gap-6">

          {/* 학생 명단 */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-500 w-5 h-5" /> 학생 명단 관리
              </h2>
              <span className="text-xs text-slate-400">현재 {students.length}명</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">엑셀(.xlsx) 헤더: <strong>학년 / 반 / 번호 / 이름</strong></p>

            <div className="flex gap-2 mb-3">
              <input type="file" accept=".xlsx,.xls" className="hidden" ref={fileInputRef} onChange={parseExcel} />
              <button
                type="button"
                onClick={() => { setUploadStatus(null); fileInputRef.current?.click(); }}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 transition text-sm"
              >
                <Upload className="w-4 h-4" /> 엑셀 업로드 및 갱신
              </button>
              <a
                href="/api/sample-xlsx"
                className="flex items-center gap-2 bg-slate-100 text-slate-700 font-semibold py-2.5 px-4 rounded-lg hover:bg-slate-200 transition text-sm border border-slate-200 whitespace-nowrap"
              >
                <Download className="w-4 h-4" /> 샘플 양식
              </a>
            </div>

            {uploadStatus && (
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
                {uploadStatus}
              </p>
            )}

            {students.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {["학년","반","번호","이름"].map((h) => (
                        <th key={h} className="py-2 px-3 text-left text-slate-500 font-semibold">{h}</th>
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
                <li key={loc.id} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-sm">
                  <span>{loc.name}</span>
                  <button onClick={() => handleDeleteLocation(loc.id)} className="text-slate-300 hover:text-red-500 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

        </div>
      )}
    </div>
  );
}
