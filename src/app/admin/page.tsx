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
import { Save, Upload, Trash2, BellRing, Settings2, Users, MapPin } from "lucide-react";

type StudentType = { id: number; grade: number; class: number; number: number; name: string; studentId: string };
type LocationType = { id: number; name: string };

export default function AdminPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [students, setStudents] = useState<StudentType[]>([]);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { socket, isConnected } = useSocket();

  // Call Selection Form
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [reason, setReason] = useState("");

  const refreshData = async () => {
    const [st, loc] = await Promise.all([getStudents(), getLocations()]);
    setStudents(st);
    setLocations(loc);
  };

  useEffect(() => {
    refreshData();
    const savedSession = localStorage.getItem("histudent_admin_session");
    if (savedSession) {
      setSessionCode(savedSession);
    } else {
      const randomCode = `class${Math.floor(Math.random() * 10) + 1}`;
      setSessionCode(randomCode);
      localStorage.setItem("histudent_admin_session", randomCode);
    }
  }, []);

  const handleSessionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setSessionCode(val);
    localStorage.setItem("histudent_admin_session", val);
  };

  const parseExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = utils.sheet_to_json<any>(worksheet);

    const parsedStudents = jsonData.map((row) => {
      // Find keys that match meanings or default to exact matches
      const getVal = (possibleKeys: string[]) => {
        const key = Object.keys(row).find(k => possibleKeys.some(pk => k.includes(pk)));
        return key ? row[key] : null;
      };

      const grade = parseInt(getVal(["학년", "grade"])) || 1;
      const cls = parseInt(getVal(["반", "class"])) || 1;
      const num = parseInt(getVal(["번호", "num"])) || 1;
      const name = String(getVal(["이름", "name"]) || "이름없음");
      
      const studentId = `${grade}${String(cls).padStart(2, "0")}${String(num).padStart(2, "0")}`;

      return { grade, class: cls, number: num, name, studentId };
    });

    if (parsedStudents.length === 0) {
      alert("엑셀 파일에서 학생 데이터를 찾지 못했습니다.");
      return;
    }

    if (confirm(`총 ${parsedStudents.length}명의 학생 데이터를 덮어쓰시겠습니까?`)) {
      const res = await bulkInsertStudents(parsedStudents, true);
      if (res.success) {
        alert("업데이트 완료!");
        refreshData();
      } else {
        alert(`오류 발생: ${res.error}`);
      }
    }
  };

  const handleAddLocation = async () => {
    if (!newLocationName) return;
    const res = await addLocation(newLocationName);
    if (res.success) {
      setNewLocationName("");
      refreshData();
    } else {
      alert(res.error);
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      const res = await deleteLocation(id);
      if (res.success) Object;
      refreshData();
    }
  };

  const handleCallStudent = async () => {
    if (!selectedStudent || !selectedLocation || !reason) {
      alert("학생, 장소, 용무를 모두 입력(선택)해주세요.");
      return;
    }
    
    if (!socket || !isConnected) {
      alert("서버와 연결되어 있지 않습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    if (!sessionCode) {
      alert("세션 코드가 설정되어 있지 않습니다.");
      return;
    }

    const studentInfo = students.find((s) => s.studentId === selectedStudent);
    if (!studentInfo) {
      alert("선택한 학생 정보를 찾을 수 없습니다.");
      return;
    }

    const locInfo = locations.find((l) => l.id.toString() === selectedLocation);
    const locName = locInfo ? locInfo.name : selectedLocation; // 수동입력 대비

    const payload = {
      studentId: studentInfo.studentId,
      studentName: studentInfo.name,
      reason,
      locationName: locName,
      sessionCode,
    };

    // 실시간 소켓 전송
    socket.emit("call-student", { sessionCode, data: payload });

    // DB 내역 저장
    await logCallHistory(payload);

    alert(`[${studentInfo.name}] 학생을 호출했습니다.`);
    setSelectedStudent("");
    setReason("");
  };

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-8 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Settings2 className="text-blue-500" /> 교사 관리자 패널
        </h1>
        <p className="text-slate-500 text-sm mb-6">학생 호출 시스템을 관리하고 호출을 실행합니다.</p>
        
        <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
          <label className="font-semibold text-slate-700 whitespace-nowrap">현재 세션 코드</label>
          <input
            type="text"
            value={sessionCode}
            onChange={handleSessionChange}
            placeholder="예: class1"
            className="border-slate-300 border px-3 py-2 rounded flex-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${isConnected ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}>
            {isConnected ? "소켓 연결됨" : "소켓 연결중..."}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 학생 명단 관리 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-500 w-5 h-5"/> 학생 명단 관리 (총 {students.length}명)
          </h2>
          <div className="text-xs text-slate-500">
            엑셀 파일(.xlsx)을 업로드하여 학생 명단을 갱신합니다.<br />
            (헤더: 학년, 반, 번호, 이름 지원)
          </div>
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={parseExcel}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 font-medium py-2 px-4 rounded-lg hover:bg-indigo-100 transition"
          >
            <Upload className="w-4 h-4" /> 엑셀 업로드 및 갱신
          </button>
        </div>

        {/* 호출 장소 관리 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="text-rose-500 w-5 h-5"/> 호출 장소 관리
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="장소명 (예: 교무실)"
              className="border-slate-300 border px-3 py-2 rounded flex-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
            />
            <button
              onClick={handleAddLocation}
              className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700 transition"
            >
              추가
            </button>
          </div>
          <ul className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-2">
            {locations.length === 0 && <li className="text-sm text-slate-400 py-2">등록된 장소가 없습니다.</li>}
            {locations.map((loc) => (
              <li key={loc.id} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded border border-slate-100 text-sm">
                <span>{loc.name}</span>
                <button onClick={() => handleDeleteLocation(loc.id)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 호출 실행 */}
      <div className="bg-white rounded-xl shadow border-2 border-blue-400 p-6 flex flex-col gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-2">
          <BellRing className="text-blue-500" /> 학생 실시간 호출
        </h2>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">호출할 학생</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="border-slate-300 border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">학생 선택</option>
              {students.map((s) => (
                <option key={s.id} value={s.studentId}>
                  {s.studentId} {s.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">호출 장소</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="border-slate-300 border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">장소 선택</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">용무 내용</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 수행평가 확인"
              className="border-slate-300 border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleCallStudent()}
            />
          </div>
        </div>

        <button
          onClick={handleCallStudent}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-4 leading-none rounded-xl transition shadow-md shadow-blue-200"
        >
          {sessionCode} 세션으로 호출 전송하기
        </button>
      </div>

    </div>
  );
}
