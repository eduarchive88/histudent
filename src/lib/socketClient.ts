"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    // No URL = connects to same origin automatically, works through any proxy
    socket = io({
      path: "/socket.io",
      transports: ["polling", "websocket"],
      // retry indefinitely
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
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
