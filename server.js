// server.js
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  /**
   * 활성 세션 레지스트리
   * key: sessionCode (문자열)
   * value: { displaySocketId, adminSocketIds }
   *   - displaySocketId: 디스플레이 화면의 소켓 ID (1개만 허용)
   *   - adminSocketIds: 관리자 소켓 ID 집합 (여러 탭/기기 허용)
   */
  const sessions = new Map();
  // Map<sessionCode, { displaySocketId: string|null, adminSocketIds: Set<string> }>

  /** 소켓이 현재 점유 중인 세션 코드 역방향 맵 */
  const socketToSession = new Map(); // socketId -> { sessionCode, role }

  /** 세션에서 소켓 해제 */
  function releaseSocket(socketId) {
    const entry = socketToSession.get(socketId);
    if (!entry) return;

    const { sessionCode, role } = entry;
    const session = sessions.get(sessionCode);
    if (!session) { socketToSession.delete(socketId); return; }

    if (role === "display") {
      session.displaySocketId = null;
      console.log(`[Socket] Display 해제: session=${sessionCode}`);
    } else if (role === "admin") {
      session.adminSocketIds.delete(socketId);
      console.log(`[Socket] Admin 해제: session=${sessionCode}, remaining=${session.adminSocketIds.size}`);
    }

    // 디스플레이도 없고 관리자도 없으면 세션 완전 삭제
    if (!session.displaySocketId && session.adminSocketIds.size === 0) {
      sessions.delete(sessionCode);
      console.log(`[Socket] 세션 삭제: ${sessionCode}`);
    }

    socketToSession.delete(socketId);
  }

  io.on("connection", (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);

    /**
     * 디스플레이 화면 세션 입장 (중복 방지)
     * 클라이언트: socket.emit("join-session", sessionCode)
     * 응답: socket.emit("session-joined", { ok, error? })
     */
    socket.on("join-session", (sessionCode) => {
      if (!sessionCode || typeof sessionCode !== "string") {
        socket.emit("session-joined", { ok: false, error: "세션 코드가 올바르지 않습니다." });
        return;
      }

      const code = sessionCode.trim();
      const session = sessions.get(code);

      // 이미 다른 디스플레이가 해당 세션을 점유 중인지 확인
      if (session && session.displaySocketId && session.displaySocketId !== socket.id) {
        console.log(`[Socket] 세션 중복 차단: ${code} (점유자: ${session.displaySocketId})`);
        socket.emit("session-joined", {
          ok: false,
          error: `"${code}" 세션은 이미 다른 화면에서 사용 중입니다. 다른 세션 코드를 사용해주세요.`,
        });
        return;
      }

      // 이전 세션 해제 후 새 세션 등록
      releaseSocket(socket.id);

      if (!sessions.has(code)) {
        sessions.set(code, { displaySocketId: null, adminSocketIds: new Set() });
      }
      sessions.get(code).displaySocketId = socket.id;
      socketToSession.set(socket.id, { sessionCode: code, role: "display" });

      socket.join(code);
      socket.emit("session-joined", { ok: true });
      console.log(`[Socket] Display 입장: session=${code}, socket=${socket.id}`);
    });

    /**
     * 관리자 세션 등록 (중복 방지 없음 — 같은 세션 코드로 여러 관리자 탭 허용)
     * 클라이언트: socket.emit("register-admin", sessionCode)
     * 응답: socket.emit("admin-registered", { ok, error? })
     */
    socket.on("register-admin", (sessionCode) => {
      if (!sessionCode || typeof sessionCode !== "string") {
        socket.emit("admin-registered", { ok: false, error: "세션 코드가 올바르지 않습니다." });
        return;
      }

      const code = sessionCode.trim();

      // 이미 다른 소켓이 이 코드로 디스플레이에 등록된 경우 → 관리자는 허용
      // 단, 다른 관리자가 같은 코드 사용 중이면 경고만 (차단하지 않음)
      releaseSocket(socket.id);

      if (!sessions.has(code)) {
        sessions.set(code, { displaySocketId: null, adminSocketIds: new Set() });
      }
      sessions.get(code).adminSocketIds.add(socket.id);
      socketToSession.set(socket.id, { sessionCode: code, role: "admin" });

      socket.join(code);
      socket.emit("admin-registered", { ok: true });
      console.log(`[Socket] Admin 등록: session=${code}, socket=${socket.id}`);
    });

    /**
     * 세션 코드 사용 가능 여부 확인 (관리자가 코드 입력 시 실시간 체크)
     * 클라이언트: socket.emit("check-session", sessionCode)
     * 응답: socket.emit("session-status", { available, displayConnected })
     */
    socket.on("check-session", (sessionCode) => {
      const code = (sessionCode || "").trim();
      const session = sessions.get(code);
      const displayConnected = !!(session && session.displaySocketId);
      socket.emit("session-status", {
        available: !displayConnected,
        displayConnected,
      });
    });

    // 교사가 특정 세션으로 학생 호출 (배치)
    socket.on("call-students", ({ sessionCode, students }) => {
      const code = (sessionCode || "").trim();
      console.log(`[Socket] emit batch call to session ${code}`, students);
      io.to(code).emit("new-calls", students);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] disconnected: ${socket.id}`);
      releaseSocket(socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
