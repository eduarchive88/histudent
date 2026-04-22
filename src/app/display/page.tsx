"use client";

import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/lib/socketClient";

type CallPayload = {
  studentId: string;
  studentName: string;
  reason: string;
  locationName: string;
  callerName?: string;
  sessionCode: string;
};

export default function DisplayPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [activeCalls, setActiveCalls] = useState<CallPayload[]>([]);
  const [countdown, setCountdown] = useState(0);

  const { socket } = useSocket();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  }, []);

  useEffect(() => {
    if (!socket || !isJoined || !sessionCode) return;

    const handleNewCalls = (students: CallPayload[]) => {
      const mine = students.filter((s) => s.sessionCode === sessionCode);
      if (mine.length === 0) return;
      setActiveCalls(mine);
      setCountdown(60);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((e) => console.warn("Audio autoplay blocked:", e));
      }
    };

    socket.on("new-calls", handleNewCalls);
    return () => { socket.off("new-calls", handleNewCalls); };
  }, [socket, isJoined, sessionCode]);

  useEffect(() => {
    const saved = localStorage.getItem("histudent_display_session");
    if (saved) setSessionCode(saved);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      if (activeCalls.length > 0) setActiveCalls([]);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, activeCalls.length]);

  const handleJoin = () => {
    if (!sessionCode.trim()) { alert("세션 코드를 입력해주세요."); return; }
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        audioRef.current!.currentTime = 0;
      }).catch(() => {});
    }
    if (socket) {
      socket.emit("join-session", sessionCode.trim());
      setIsJoined(true);
      localStorage.setItem("histudent_display_session", sessionCode.trim());
    }
  };

  const handleDisconnect = () => {
    setIsJoined(false);
    setActiveCalls([]);
  };

  const eulo = (word: string) => {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    if (code < 0 || code > 11171) return "으로";
    const jongseong = code % 28;
    return jongseong === 0 || jongseong === 8 ? "로" : "으로";
  };

  const buildMessage = (call: CallPayload) => {
    const loc = call.locationName;
    if (call.callerName) {
      return `${call.reason} 용무로 ${loc}${eulo(loc)} ${call.callerName}에게 오세요.`;
    }
    return `${call.reason} 용무로 ${loc}${eulo(loc)} 오세요.`;
  };

  // Alert view
  if (activeCalls.length > 0) {
    return (
      <div className="fixed inset-0 z-50 bg-yellow-400 text-slate-900 flex flex-col justify-center items-center p-6 animate-in fade-in zoom-in duration-300">
        <div className="absolute top-6 right-6 text-xl font-bold bg-black/10 px-4 py-2 rounded-full">
          {countdown}초 후 닫힘
        </div>

        <div className="w-full max-w-3xl flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
          {activeCalls.map((call) => (
            <div key={call.studentId} className="bg-white rounded-3xl shadow-lg border-4 border-blue-700 px-8 py-6 text-center">
              <p className="text-[4vw] font-black leading-tight tracking-tight">
                <span className="text-blue-700 text-[3.5vw]">[{call.studentId}] {call.studentName}</span>
                <br />
                <span className="text-slate-700 text-[2.8vw]">{buildMessage(call)}</span>
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setActiveCalls([])}
          className="mt-8 text-2xl font-bold bg-slate-900 text-white px-10 py-5 rounded-full hover:bg-slate-800 transition shadow-2xl active:scale-95"
        >
          확인했습니다
        </button>
      </div>
    );
  }

  // Waiting view
  if (isJoined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 text-white p-12 rounded-3xl shadow-xl text-center max-w-2xl w-full border-4 border-slate-800">
          <div className="w-24 h-24 bg-green-500 rounded-full mx-auto mb-8 animate-pulse shadow-[0_0_40px_rgba(34,197,94,0.6)]" />
          <h2 className="text-4xl font-extrabold mb-4 text-slate-100">호출 대기 중</h2>
          <p className="text-2xl text-slate-400 mb-12">선생님의 호출을 기다리고 있습니다.</p>
          <div className="bg-slate-800 rounded-2xl p-6">
            <span className="text-slate-400 block mb-2 text-lg">접속 중인 세션 코드</span>
            <span className="text-5xl font-mono text-yellow-400 font-bold tracking-widest">{sessionCode}</span>
          </div>
          <button onClick={handleDisconnect} className="mt-8 text-slate-500 hover:text-white underline underline-offset-4">
            연결 해제하기
          </button>
        </div>
      </div>
    );
  }

  // Join view
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">학생 디스플레이</h1>
        <p className="text-slate-500 mb-8">안내받은 세션 코드를 입력하세요.<br />연결 시 '소리' 권한을 요구할 수 있습니다.</p>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="세션 코드 입력 (예: class1)"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="w-full border-2 border-slate-300 px-4 py-4 rounded-xl text-xl text-center font-bold tracking-widest focus:border-blue-500 focus:outline-none uppercase"
          />
          <button
            onClick={handleJoin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl py-4 rounded-xl shadow-md transition"
          >
            대기 화면으로 접속
          </button>
        </div>
      </div>
    </div>
  );
}
