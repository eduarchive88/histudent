"use client";

import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/lib/socketClient";

type CallPayload = {
  studentId: string;
  studentName: string;
  reason: string;
  locationName: string;
  sessionCode: string;
};

export default function DisplayPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [activeCall, setActiveCall] = useState<CallPayload | null>(null);
  const [countdown, setCountdown] = useState(0);

  const { socket, isConnected } = useSocket();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  }, []);

  // Socket listener for exact session matching
  useEffect(() => {
    if (!socket || !isJoined || !sessionCode) return;

    const handleNewCall = (data: CallPayload) => {
      // Re-check target session just in case
      if (data.sessionCode === sessionCode) {
        setActiveCall(data);
        setCountdown(60);
        // Play sound if possible
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.warn("Audio autoplay blocked:", e));
        }
      }
    };

    socket.on("new-call", handleNewCall);

    return () => {
      socket.off("new-call", handleNewCall);
    };
  }, [socket, isJoined, sessionCode]);

  // Load saved session
  useEffect(() => {
    const saved = localStorage.getItem("histudent_display_session");
    if (saved) {
      setSessionCode(saved);
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && activeCall) {
      setActiveCall(null);
    }
    return () => clearTimeout(timer);
  }, [countdown, activeCall]);

  const handleJoin = async () => {
    if (!sessionCode.trim()) {
      alert("세션 코드를 입력해주세요.");
      return;
    }
    
    // Play audio immediately to grant browser media permission
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        audioRef.current!.currentTime = 0;
      }).catch(() => {
        console.warn("User needs to interact more to play audio.");
      });
    }

    if (socket) {
      socket.emit("join-session", sessionCode.trim());
      setIsJoined(true);
      localStorage.setItem("histudent_display_session", sessionCode.trim());
    }
  };

  const handleDisconnect = () => {
    setIsJoined(false);
    setActiveCall(null);
  };

  // 1. Alert view
  if (activeCall) {
    return (
      <div className="fixed inset-0 z-50 bg-yellow-400 text-slate-900 flex flex-col justify-center items-center p-8 animate-in fade-in zoom-in duration-300">
        <div className="absolute top-8 right-8 text-2xl font-bold bg-black/10 px-4 py-2 rounded-full">
          {countdown}초 후 닫힘
        </div>
        
        <h1 className="text-[6vw] font-black leading-tight text-center drop-shadow-sm mb-8 tracking-tight">
          <span className="text-blue-700 bg-white px-6 py-2 rounded-3xl shadow-sm border-4 border-blue-700 inline-block mb-4">
            [{activeCall.studentId}] {activeCall.studentName}
          </span>
          <br/>
          학생, <span className="text-red-600 underline decoration-double underline-offset-8">{activeCall.reason}</span> 용무로<br/>
          &quot;{activeCall.locationName}&quot;(으)로 오세요.
        </h1>

        <button
          onClick={() => setActiveCall(null)}
          className="mt-12 text-3xl font-bold bg-slate-900 text-white px-12 py-6 rounded-full hover:bg-slate-800 transition shadow-2xl active:scale-95"
        >
          확인했습니다
        </button>
      </div>
    );
  }

  // 2. Waiting view
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

  // 3. Join / Setup view
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">학생 디스플레이</h1>
        <p className="text-slate-500 mb-8">안내받은 세션 코드를 입력하세요.<br/>연결 시 '소리' 권한을 요구할 수 있습니다.</p>
        
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="세션 코드 입력 (예: class1)"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
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
