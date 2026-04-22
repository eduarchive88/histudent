"use client";

import { useState, useEffect, useRef } from "react";
import { read, utils } from "xlsx";
import { getStudents, bulkInsertStudents, getLocations, addLocation, deleteLocation } from "@/actions/admin";
import { Upload, Trash2, Users, MapPin, Download } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import AdminTabs from "@/components/AdminTabs";

type StudentType = { id: number; grade: number; class: number; number: number; name: string; studentId: string };
type LocationType = { id: number; name: string };

export default function AdminSettingsPage() {
  const [students, setStudents]   = useState<StudentType[]>([]);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = async () => {
    const [st, loc] = await Promise.all([getStudents(), getLocations()]);
    setStudents(st);
    setLocations(loc);
  };

  useEffect(() => { refreshData(); }, []);

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

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-4 py-6">
      <AdminHeader />
      <AdminTabs />

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
          <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">{uploadStatus}</p>
        )}

        {students.length > 0 && (
          <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg">
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
            type="button"
            onClick={handleAddLocation}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition text-sm font-semibold"
          >
            추가
          </button>
        </div>
        <ul className="flex flex-col gap-1.5">
          {locations.length === 0 && <li className="text-sm text-slate-400 py-3 text-center">등록된 장소가 없습니다.</li>}
          {locations.map((loc) => (
            <li key={loc.id} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-sm">
              <span>{loc.name}</span>
              <button type="button" onClick={() => handleDeleteLocation(loc.id)} className="text-slate-300 hover:text-red-500 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
