"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";
    socket = io(url, {
      path: "/socket.io",
      // Nginx 등 리버스 프록시 환경에서 연결 안정성을 위해 폴링/웹소켓 병행 허용
      transports: ["polling", "websocket"],
      reconnectionAttempts: 5,
    });
  }
  return socket;
};

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socketInstance.on("connect", onConnect);
    socketInstance.on("disconnect", onDisconnect);

    setIsConnected(socketInstance.connected);

    return () => {
      socketInstance.off("connect", onConnect);
      socketInstance.off("disconnect", onDisconnect);
    };
  }, []);

  return { socket: getSocket(), isConnected };
};
