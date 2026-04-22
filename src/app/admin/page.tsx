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
  Upload,
  Trash2,
  BellRing,
  Settings2,
  Users,
  MapPin,
  Download,
  Wifi,
  WifiOff,
} from "lucide-react";

type StudentType = {
  id: number;
  grade: number;
  class: number;
  number: number;
  name: string;
  studentId: string;
};
type LocationType = { id: number; name: string };
type Tab = "settings" | "call";

const LS_SESSION = "hs_session";
const LS_LOCATION = "hs_location";
const LS_REASON = "hs_reason";
const LS_STUDENT = "hs_student";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("call");
  const [sessionCode, setSessionCode] = useState("");
  const [students, setStudents] = useState<StudentType[]>([]);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { socket, isConnected } = useSocket();

  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [reason, setReason] = useState("");

  const refreshData = async () => {
    const [st, loc] = await Promise.all([getStudents(), getLocations()]);
    setStudents(st);
    setLocations(loc);
  };

  // Load localStorage on mount
  useEffect(() => {
    refreshData();
    const session = localStorage.getItem(LS_SESSION) || `class${Math.floor(Math.random() * 10) + 1}`;
    const loc = localStorage.getItem(LS_LOCATION) || "";
    const rsn = localStorage.getItem(LS_REASON) || "";
    const stu = localStorage.getItem(LS_STUDENT) || "";
    setSessionCode(session);
    setSelectedLocation(loc);
    setReason(rsn);
    setSelectedStudent(stu);
    localStorage.setItem(LS_SESSION, session);
  }, []);

  const handleSessionChange = (val: string) => {
    setSessionCode(val);
    localStorage.setItem(LS_SESSION, val);
  };

  const handleLocationChange = (val: string) => {
    setSelectedLocation(val);
    localStorage.setItem(LS_LOCATION, val);
  };

  const handleReasonChange = (val: string) => {
    setReason(val);
    localStorage.setItem(LS_REASON, val);
  };

  const handleStudentChange = (val: string) => {
    setSelectedStudent(val);
    localStorage.setItem(LS_STUDENT, val);
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
        const cls = parseInt(String(getVal(["반", "class"]) ?? "1")) || 1;
        const num = parseInt(String(getVal(["번호", "num", "number"]) ?? "1")) || 1;
        const name = String(getVal(["이름", "name"]) ?? "이름없음");
        const studentId = `${grade}${String(cls).padStart(2, "0")}${String(num).padStart(2, "0")}`;
        return { grade, class: cls, number: num, name, studentId };
      });

      if (parsedStudents.length === 0) {
        setUploadStatus("❌ 학생 데이터를 찾지 못했습니다. 헤더(학년/반/번호/이름)를 확인해주세요.");
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
    if (res.success) {
      setNewLocationName("");
      refreshData();
    } else {
      alert(res.error);
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteLocation(id);
    refreshData();
  };

  const handleCallStudent = async () => {
    if (!selectedStudent || !selectedLocation || !reason.trim()) {
      alert("학생, 장소, 용무를 모두 입력(선택)해주세요.");
      return;
    }
    if (!socket || !isConnected) {
      alert("서버와 연결되어 있지 않습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    const studentInfo = students.find((s) => s.studentId === selectedStudent);
    const locInfo = locations.find((l) => l.id.toString() === selectedLocation);
    if (!studentInfo || !locInfo) {
      alert("학생 또는 장소 정보를 찾을 수 없습니다.");
      return;
    }

    const payload = {
      studentId: studentInfo.studentId,
      studentName: studentInfo.name,
      reason: reason.trim(),
      locationName: locInfo.name,
      sessionCode,
    };

    socket.emit("call-student", { sessionCode, data: payload });
    await logCallHistory(payload);

    alert(`[${studentInfo.name}] 학생을 호출했습니다.`);
  };

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-0 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings2 className="text-blue-500 w-6 h-6" /> 교사 관리자 패널
        </h1>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            isConnected
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-600 border-red-200"
          }`}
        >
          {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isConnected ? "실시간 연결됨" : "연결 중..."}
        </div>
      </div>

      {/* Session Code */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-5">
        <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">세션 코드</span>
        <input
          type="text"
          value={sessionCode}
          onChange={(e) => handleSessionChange(e.target.value.trim())}
          placeholder="예: class1"
          className="border border-slate-300 px-3 py-1.5 rounded-lg flex-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
        <span className="text-xs text-slate-400 whitespace-nowrap">디스플레이와 같은 코드를 사용하세요</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setTab("call")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition -mb-px ${
            tab === "call"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BellRing className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          실시간 호출
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition -mb-px ${
            tab === "settings"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Settings2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          설정
        </button>
      </div>

      {/* Tab: 실시간 호출 */}
      {tab === "call" && (
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl border-2 border-blue-400 shadow p-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-5">
              <BellRing className="text-blue-500 w-5 h-5" /> 학생 실시간 호출
            </h2>

            <div className="grid md:grid-cols-3 gap-4 mb-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">호출할 학생</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  className="border border-slate-300 px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
                >
                  <option value="">학생 선택 ({students.length}명)</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.studentId}>
                      {s.grade}학년 {s.class}반 {s.number}번 {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">호출 장소</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="border border-slate-300 px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
                >
                  <option value="">장소 선택</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id.toString()}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">용무 내용</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  placeholder="예: 수행평가 확인"
                  className="border border-slate-300 px-3 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleCallStudent()}
                />
              </div>
            </div>

            {students.length === 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
                ⚠️ 학생 명단이 없습니다. &quot;설정&quot; 탭에서 엑셀을 업로드해주세요.
              </p>
            )}

            <button
              onClick={handleCallStudent}
              disabled={!isConnected}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl transition shadow-md"
            >
              {isConnected
                ? `"${sessionCode}" 세션으로 호출 전송`
                : "서버 연결 대기 중..."}
            </button>
          </div>
        </div>
      )}

      {/* Tab: 설정 */}
      {tab === "settings" && (
        <div className="flex flex-col gap-6">
          {/* 학생 명단 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Users className="text-indigo-500 w-5 h-5" /> 학생 명단 관리
              <span className="ml-auto text-xs font-normal text-slate-400">현재 {students.length}명 등록됨</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              엑셀(.xlsx) 헤더: <strong>학년 / 반 / 번호 / 이름</strong>
            </p>

            <div className="flex gap-2 mb-3">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                ref={fileInputRef}
                onChange={parseExcel}
              />
              <button
                type="button"
                onClick={() => {
                  setUploadStatus(null);
                  fileInputRef.current?.click();
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 transition text-sm"
              >
                <Upload className="w-4 h-4" /> 엑셀 업로드 및 갱신
              </button>
              <a
                href="/api/sample-xlsx"
                className="flex items-center gap-2 bg-slate-100 text-slate-700 font-semibold py-2.5 px-4 rounded-lg hover:bg-slate-200 transition text-sm border border-slate-200"
              >
                <Download className="w-4 h-4" /> 샘플 양식
              </a>
            </div>

            {uploadStatus && (
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                {uploadStatus}
              </p>
            )}

            {students.length > 0 && (
              <div className="mt-4 max-h-48 overflow-y-auto border border-slate-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="py-2 px-3 text-left text-slate-500 font-semibold">학년</th>
                      <th className="py-2 px-3 text-left text-slate-500 font-semibold">반</th>
                      <th className="py-2 px-3 text-left text-slate-500 font-semibold">번호</th>
                      <th className="py-2 px-3 text-left text-slate-500 font-semibold">이름</th>
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
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
                <li
                  key={loc.id}
                  className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-sm"
                >
                  <span>{loc.name}</span>
                  <button
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
      )}
    </div>
  );
}
