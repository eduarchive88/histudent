import Link from "next/link";
import { BellRing, Monitor, Settings2 } from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <BellRing className="w-10 h-10 text-blue-600" />
          <h1 className="text-5xl font-black text-slate-900 tracking-tight">HiStudent</h1>
        </div>
        <p className="text-xl text-slate-500">학생 실시간 호출 알림 시스템</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 w-full max-w-xl">
        <Link
          href="/display"
          className="flex flex-col items-center gap-4 bg-slate-900 text-white rounded-2xl p-8 shadow-lg hover:bg-slate-800 transition"
        >
          <Monitor className="w-10 h-10 text-yellow-400" />
          <div className="text-center">
            <div className="text-xl font-bold mb-1">학생 디스플레이</div>
            <div className="text-slate-400 text-sm">교실 TV·모니터에 띄우는 화면</div>
          </div>
        </Link>

        <Link
          href="/admin"
          className="flex flex-col items-center gap-4 bg-blue-600 text-white rounded-2xl p-8 shadow-lg hover:bg-blue-700 transition"
        >
          <Settings2 className="w-10 h-10 text-white" />
          <div className="text-center">
            <div className="text-xl font-bold mb-1">교사 관리자</div>
            <div className="text-blue-200 text-sm">학생 호출 및 명단 관리</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
