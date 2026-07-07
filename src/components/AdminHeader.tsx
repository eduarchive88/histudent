"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/lib/socketClient";
import { Settings2, Wifi, WifiOff, Monitor, RefreshCw } from "lucide-react";

const LS_SESSION = "hs_session";

export default function AdminHeader() {
  const [sessionCode, setSessionCode] = useState("");
  const [displayConnected, setDisplayConnected] = useState(false); // 디스플레이 접속 여부
  const { socket, isConnected } = useSocket();
  const registeredCodeRef = useRef(""); // 현재 서버에 등록된 세션 코드

  // ─── localStorage에서 세션 불러오기 + 고유코드 자동 생성 ─────
  useEffect(() => {
    const saved = localStorage.getItem(LS_SESSION);
    if (saved) {
      setSessionCode(saved);
    } else {
      // 고유 8자리 랜덤 코드 자동 생성 (충돌 가능성 극히 낮음)
      const code = Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 6);
      setSessionCode(code);
      localStorage.setItem(LS_SESSION, code);
    }
  }, []);

  // ─── 소켓 연결 후 세션 등록 및 상태 확인 ────────────────────
  useEffect(() => {
    if (!socket || !isConnected || !sessionCode) return;

    // 이미 같은 코드로 등록했으면 건너뜀
    if (registeredCodeRef.current === sessionCode) return;

    // 관리자로 서버에 세션 등록
    socket.emit("register-admin", sessionCode);
    registeredCodeRef.current = sessionCode;

    // 현재 디스플레이 접속 상태 조회
    socket.emit("check-session", sessionCode);

    // 등록 결과 수신
    const onAdminRegistered = ({ ok }: { ok: boolean }) => {
      if (!ok) console.warn("[Admin] 세션 등록 실패");
    };

    // 디스플레이 접속 상태 수신
    const onSessionStatus = ({ displayConnected }: { displayConnected: boolean }) => {
      setDisplayConnected(displayConnected);
    };

    socket.on("admin-registered", onAdminRegistered);
    socket.on("session-status", onSessionStatus);

    return () => {
      socket.off("admin-registered", onAdminRegistered);
      socket.off("session-status", onSessionStatus);
    };
  }, [socket, isConnected, sessionCode]);

  // ─── 세션 코드 변경 ──────────────────────────────────────────
  const handleChange = (val: string) => {
    const trimmed = val.trim();
    setSessionCode(trimmed);
    setDisplayConnected(false);
    localStorage.setItem(LS_SESSION, trimmed);
    registeredCodeRef.current = ""; // 재등록 유도
  };

  // ─── 새 고유 코드 자동 생성 ──────────────────────────────────
  const handleRegen = () => {
    const code = Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 6);
    handleChange(code);
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

      {/* 세션 코드 입력 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">세션 코드</span>
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="예: ab12-cd34"
            className="border border-slate-300 px-3 py-1.5 rounded-lg flex-1 text-sm font-mono focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
          {/* 새 코드 자동 생성 버튼 */}
          <button
            type="button"
            onClick={handleRegen}
            title="새 고유 코드 자동 생성"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 새 코드
          </button>
        </div>

        {/* 디스플레이 접속 상태 표시 */}
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">디스플레이 화면:</span>
          {displayConnected ? (
            <span className="text-xs text-green-600 font-semibold">✅ 접속됨</span>
          ) : (
            <span className="text-xs text-slate-400">대기 중 (아직 미접속)</span>
          )}
          <span className="text-xs text-slate-300 ml-auto hidden sm:block">
            디스플레이에서 같은 코드를 입력하면 연결됩니다
          </span>
        </div>
      </div>
    </div>
  );
}
