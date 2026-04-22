"use client";

import { useState, useEffect, useTransition } from "react";
import { getStudents, getLocations, addLocation, deleteLocation, uploadStudentsFromExcel } from "@/actions/admin";
import { Upload, Trash2, Users, MapPin, Download } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import AdminTabs from "@/components/AdminTabs";

type StudentType = { id: number; grade: number; class: number; number: number; name: string; studentId: string };
type LocationType = { id: number; name: string };

export default function AdminSettingsPage() {
  const [students, setStudents]   = useState<StudentType[]>([]);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshData = async () => {
    const [st, loc] = await Promise.all([getStudents(), getLocations()]);
    setStudents(st);
    setLocations(loc);
  };

  useEffect(() => { refreshData(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";          // 같은 파일 재선택 허용
    if (!file) return;

    setUploadMsg(null);

    const formData = new FormData();
    formData.append("excel", file);

    startTransition(async () => {
      const result = await uploadStudentsFromExcel(null, formData);
      if (result.error) {
        setUploadMsg({ type: "err", text: result.error });
      } else {
        setUploadMsg({ type: "ok", text: `${result.count}명 업로드 완료!` });
        refreshData();
      }
    });
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
        <p className="text-xs text-slate-400 mb-4">
          엑셀(.xlsx) 헤더: <strong>학년 / 반 / 번호 / 이름</strong>
        </p>

        <div className="flex gap-2 mb-3">
          <label className={`flex-1 flex items-center justify-center gap-2 font-semibold py-2.5 px-4 rounded-lg text-sm transition ${
            isPending
              ? "bg-indigo-300 text-white cursor-wait"
              : "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
          }`}>
            <Upload className="w-4 h-4" />
            {isPending ? "서버에서 처리 중..." : "엑셀 파일 선택 → 즉시 업로드"}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={isPending}
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

        {isPending && (
          <div className="mb-3 flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            <span className="animate-spin">⏳</span> 파일을 서버로 전송하고 있습니다...
          </div>
        )}
        {!isPending && uploadMsg && (
          <div className={`mb-3 text-sm rounded-lg px-3 py-2 border font-medium ${
            uploadMsg.type === "ok"
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-red-600 bg-red-50 border-red-200"
          }`}>
            {uploadMsg.type === "ok" ? "✅ " : "❌ "}{uploadMsg.text}
          </div>
        )}

        {students.length > 0 && (
          <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {["학년", "반", "번호", "이름"].map((h) => (
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
          {locations.length === 0 && (
            <li className="text-sm text-slate-400 py-3 text-center">등록된 장소가 없습니다.</li>
          )}
          {locations.map((loc) => (
            <li key={loc.id} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-sm">
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
