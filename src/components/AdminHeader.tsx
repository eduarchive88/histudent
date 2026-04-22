"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/lib/socketClient";
import { Settings2, Wifi, WifiOff } from "lucide-react";

const LS_SESSION = "hs_session";

export default function AdminHeader() {
  const [sessionCode, setSessionCode] = useState("");
  const { isConnected } = useSocket();

  useEffect(() => {
    const saved = localStorage.getItem(LS_SESSION);
    if (saved) {
      setSessionCode(saved);
    } else {
      const code = `class${Math.floor(Math.random() * 10) + 1}`;
      setSessionCode(code);
      localStorage.setItem(LS_SESSION, code);
    }
  }, []);

  const handleChange = (val: string) => {
    setSessionCode(val);
    localStorage.setItem(LS_SESSION, val);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings2 className="text-blue-500 w-6 h-6" /> 교사 관리자 패널
        </h1>
        <div
          title={isConnected ? "실시간 호출 서버에 연결되었습니다" : "실시간 호출 서버에 연결 중입니다. 잠시 기다려주세요."}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-default ${
            isConnected ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 animate-pulse" />}
          {isConnected ? "실시간 연결됨" : "서버 연결 중"}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">세션 코드</span>
        <input
          type="text"
          value={sessionCode}
          onChange={(e) => handleChange(e.target.value.trim())}
          placeholder="예: class1"
          className="border border-slate-300 px-3 py-1.5 rounded-lg flex-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
        <span className="text-xs text-slate-400 hidden sm:block whitespace-nowrap">디스플레이와 같은 코드 사용</span>
      </div>
    </div>
  );
}
