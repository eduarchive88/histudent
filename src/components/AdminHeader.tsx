"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/lib/socketClient";
import { Settings2, Wifi, WifiOff, Monitor, RefreshCw, AlertCircle } from "lucide-react";

const LS_SESSION    = "hs_session";
const LS_SESSION_OK = "hs_session_ok"; // "true" | "false" — 호출 페이지가 읽어서 버튼 차단에 사용

export default function AdminHeader() {
  const [sessionCode,      setSessionCode]      = useState("");
  const [sessionError,     setSessionError]     = useState(""); // 빨간 에러 메시지
  const [displayConnected, setDisplayConnected] = useState(false);
  const { socket, isConnected } = useSocket();
  const registeredCodeRef = useRef(""); // 현재 서버에 등록된 코드
  const checkTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── 초기 로드: localStorage에서 세션 불러오기 / 없으면 자동 생성 ─
  useEffect(() => {
    const saved = localStorage.getItem(LS_SESSION);
    if (saved) {
      setSessionCode(saved);
    } else {
      const code = Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 6);
      setSessionCode(code);
      localStorage.setItem(LS_SESSION, code);
    }
  }, []);

  // ─── 서버에 관리자 세션 등록 ───────────────────────────────────
  const registerAdmin = useCallback((code: string) => {
    if (!socket || !isConnected || !code) return;
    if (registeredCodeRef.current === code) return; // 이미 같은 코드로 등록됨

    socket.emit("register-admin", code);
  }, [socket, isConnected]);

  // ─── 소켓 연결되면 현재 세션 코드로 등록 시도 ─────────────────
  useEffect(() => {
    if (!socket || !isConnected || !sessionCode) return;
    registerAdmin(sessionCode);
  }, [socket, isConnected, sessionCode, registerAdmin]);

  // ─── 서버 응답 리스너 등록 ─────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // register-admin 응답
    const onAdminRegistered = ({ ok, error }: { ok: boolean; error?: string }) => {
      if (ok) {
        registeredCodeRef.current = sessionCode;
        setSessionError("");
        localStorage.setItem(LS_SESSION_OK, "true");
        // ✅ 등록 성공 시 디스플레이 현재 상태를 즉시 조회 (새로고침 버그 해결)
        socket.emit("check-session", sessionCode);
      } else {
        registeredCodeRef.current = "";
        setSessionError(error || "세션 등록에 실패했습니다.");
        localStorage.setItem(LS_SESSION_OK, "false");
      }
    };

    // check-session 실시간 조회 응답
    const onSessionStatus = ({
      adminTaken,
      displayConnected: dc,
    }: {
      adminTaken: boolean;
      displayConnected: boolean;
    }) => {
      setDisplayConnected(dc);
      if (adminTaken) {
        if (registeredCodeRef.current !== sessionCode) {
          setSessionError(`"${sessionCode}" 세션은 이미 다른 교사가 사용 중입니다. 다른 코드를 사용해주세요.`);
          localStorage.setItem(LS_SESSION_OK, "false");
        }
      } else {
        if (registeredCodeRef.current !== sessionCode) {
          setSessionError("");
        }
      }
    };

    // ✅ 디스플레이 접속/해제 실시간 알림 (서버 브로드캐스트)
    const onDisplayStatusChanged = ({ displayConnected: dc }: { displayConnected: boolean }) => {
      setDisplayConnected(dc);
    };

    socket.on("admin-registered",       onAdminRegistered);
    socket.on("session-status",         onSessionStatus);
    socket.on("display-status-changed", onDisplayStatusChanged);

    return () => {
      socket.off("admin-registered",       onAdminRegistered);
      socket.off("session-status",         onSessionStatus);
      socket.off("display-status-changed", onDisplayStatusChanged);
    };
  }, [socket, sessionCode]);

  // ─── 세션 코드 변경 핸들러 ─────────────────────────────────────
  const handleChange = (val: string) => {
    const trimmed = val.trim();
    setSessionCode(trimmed);
    setSessionError("");           // 에러 초기화
    setDisplayConnected(false);
    localStorage.setItem(LS_SESSION, trimmed);
    localStorage.setItem(LS_SESSION_OK, "false"); // 재검증 전까지 false
    registeredCodeRef.current = ""; // 재등록 유도

    // 디바운스: 500ms 후 실시간 중복 조회
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    if (!trimmed) return;
    checkTimerRef.current = setTimeout(() => {
      if (socket && isConnected) {
        socket.emit("check-session", trimmed);
      }
      // 조회 후 서버 등록 시도
      registerAdmin(trimmed);
    }, 500);
  };

  // ─── 새 코드 자동 생성 ─────────────────────────────────────────
  const handleRegen = () => {
    const code = Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 6);
    handleChange(code);
  };

  // ─── 렌더링 ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {/* 상단 타이틀 + 연결 상태 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings2 className="text-blue-500 w-6 h-6" /> 교사 관리자 패널
        </h1>
        <div
          title={isConnected ? "실시간 호출 서버에 연결되었습니다" : "실시간 호출 서버에 연결 중입니다."}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-default ${
            isConnected
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {isConnected
            ? <Wifi className="w-3.5 h-3.5" />
            : <WifiOff className="w-3.5 h-3.5 animate-pulse" />}
          {isConnected ? "실시간 연결됨" : "서버 연결 중"}
        </div>
      </div>

      {/* 세션 코드 영역 */}
      <div className={`rounded-xl px-4 py-3 flex flex-col gap-2 border ${
        sessionError
          ? "bg-red-50 border-red-300"
          : "bg-slate-50 border-slate-200"
      }`}>
        {/* 입력 행 */}
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold whitespace-nowrap ${sessionError ? "text-red-600" : "text-slate-600"}`}>
            세션 코드
          </span>
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="예: ab12-cd34"
            className={`border px-3 py-1.5 rounded-lg flex-1 text-sm font-mono focus:ring-2 focus:outline-none ${
              sessionError
                ? "border-red-400 bg-white focus:ring-red-300 text-red-700"
                : "border-slate-300 focus:ring-blue-400"
            }`}
          />
          <button
            type="button"
            onClick={handleRegen}
            title="새 고유 코드 자동 생성"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 새 코드
          </button>
        </div>

        {/* ── 에러 배너 (중복 사용 중) ── */}
        {sessionError && (
          <div className="flex items-start gap-2 bg-red-100 border border-red-300 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">⚠️ 세션 코드 중복 사용 불가</p>
              <p className="text-xs text-red-600 mt-0.5">{sessionError}</p>
              <p className="text-xs text-red-500 mt-1">
                입력란에서 다른 코드로 변경하거나, <button
                  type="button"
                  onClick={handleRegen}
                  className="underline font-semibold hover:text-red-700"
                >[새 코드]</button> 버튼을 눌러 자동 생성하세요.
              </p>
            </div>
          </div>
        )}

        {/* 안내 문구 */}
        {!sessionError && (
          <p className="text-xs text-slate-400 leading-relaxed">
            💡 코드는 <strong className="text-slate-500">자동 생성</strong>되며, 입력란에서 직접 원하는 코드로 바꿀 수 있습니다.
            디스플레이 화면에서 <strong className="text-slate-500">같은 코드를 입력</strong>하면 연결됩니다.
            단, 이미 다른 사람이 사용 중인 코드는 사용할 수 없습니다.
          </p>
        )}

        {/* 디스플레이 접속 상태 */}
        {!sessionError && (
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">디스플레이 화면:</span>
            {displayConnected
              ? <span className="text-xs text-green-600 font-semibold">✅ 접속됨</span>
              : <span className="text-xs text-slate-400">대기 중 (아직 미접속)</span>}
          </div>
        )}
      </div>
    </div>
  );
}
