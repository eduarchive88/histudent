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
   * key: sessionCode
   * value: {
   *   displaySocketId: string|null  — 디스플레이 화면 (1개만 허용)
   *   adminSocketId:   string|null  — 관리자 교사 (1명만 허용, PC 단위)
   * }
   */
  const sessions = new Map();

  /** 소켓 → { sessionCode, role } 역방향 맵 */
  const socketToSession = new Map();

  /** 세션에서 소켓 제거, 세션이 완전히 비면 삭제 */
  function releaseSocket(socketId) {
    const entry = socketToSession.get(socketId);
    if (!entry) return;

    const { sessionCode, role } = entry;
    const session = sessions.get(sessionCode);
    if (!session) { socketToSession.delete(socketId); return; }

    if (role === "display") {
      session.displaySocketId = null;
      console.log(`[Socket] Display 해제: session=${sessionCode}`);

      // 같은 세션의 관리자에게 디스플레이 해제 실시간 알림
      io.to(sessionCode).emit("display-status-changed", { displayConnected: false });
    } else if (role === "admin") {
      session.adminSocketId = null;
      console.log(`[Socket] Admin 해제: session=${sessionCode}`);
    }

    // 디스플레이도 없고 관리자도 없으면 세션 완전 삭제
    if (!session.displaySocketId && !session.adminSocketId) {
      sessions.delete(sessionCode);
      console.log(`[Socket] 세션 삭제: ${sessionCode}`);
    }

    socketToSession.delete(socketId);
  }

  io.on("connection", (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);

    // ─────────────────────────────────────────────────────────
    // 디스플레이 화면 세션 입장 (중복 방지)
    // emit: join-session  → 응답: session-joined { ok, error? }
    // ─────────────────────────────────────────────────────────
    socket.on("join-session", (sessionCode) => {
      if (!sessionCode || typeof sessionCode !== "string") {
        socket.emit("session-joined", { ok: false, error: "세션 코드가 올바르지 않습니다." });
        return;
      }

      const code = sessionCode.trim();
      const session = sessions.get(code);

      // 이미 다른 디스플레이가 점유 중이면 차단
      if (session && session.displaySocketId && session.displaySocketId !== socket.id) {
        socket.emit("session-joined", {
          ok: false,
          error: `"${code}" 세션 디스플레이는 이미 다른 화면에서 연결 중입니다.`,
        });
        return;
      }

      releaseSocket(socket.id);

      if (!sessions.has(code)) {
        sessions.set(code, { displaySocketId: null, adminSocketId: null });
      }
      sessions.get(code).displaySocketId = socket.id;
      socketToSession.set(socket.id, { sessionCode: code, role: "display" });

      socket.join(code);
      socket.emit("session-joined", { ok: true });
      console.log(`[Socket] Display 입장: session=${code}, socket=${socket.id}`);

      // 같은 세션의 관리자에게 디스플레이 접속 상태 실시간 알림 (display 자신 제외)
      socket.to(code).emit("display-status-changed", { displayConnected: true });
    });

    // ─────────────────────────────────────────────────────────
    // 관리자(교사) 세션 등록 — 1개 세션에 1명만 허용
    // emit: register-admin  → 응답: admin-registered { ok, error? }
    // ─────────────────────────────────────────────────────────
    socket.on("register-admin", (sessionCode) => {
      if (!sessionCode || typeof sessionCode !== "string") {
        socket.emit("admin-registered", { ok: false, error: "세션 코드가 올바르지 않습니다." });
        return;
      }

      const code = sessionCode.trim();
      const session = sessions.get(code);

      // 다른 교사가 이미 이 세션 코드를 사용 중이면 차단
      if (session && session.adminSocketId && session.adminSocketId !== socket.id) {
        console.log(`[Socket] Admin 중복 차단: session=${code} (점유자: ${session.adminSocketId})`);
        socket.emit("admin-registered", {
          ok: false,
          error: `"${code}" 세션은 이미 다른 교사가 사용 중입니다. 다른 세션 코드를 사용해주세요.`,
        });
        return;
      }

      releaseSocket(socket.id);

      if (!sessions.has(code)) {
        sessions.set(code, { displaySocketId: null, adminSocketId: null });
      }
      sessions.get(code).adminSocketId = socket.id;
      socketToSession.set(socket.id, { sessionCode: code, role: "admin" });

      socket.join(code);
      socket.emit("admin-registered", { ok: true });
      console.log(`[Socket] Admin 등록: session=${code}, socket=${socket.id}`);
    });

    // ─────────────────────────────────────────────────────────
    // 세션 코드 실시간 사용 가능 여부 확인
    // emit: check-session  → 응답: session-status { adminTaken, displayConnected }
    // ─────────────────────────────────────────────────────────
    socket.on("check-session", (sessionCode) => {
      const code = (sessionCode || "").trim();
      const session = sessions.get(code);

      // 자기 자신이 이미 이 세션의 admin이면 → 사용 중이어도 ok(자기 것)
      const myEntry = socketToSession.get(socket.id);
      const isMine = myEntry && myEntry.sessionCode === code && myEntry.role === "admin";

      const adminTaken = !!(session && session.adminSocketId && !isMine);
      const displayConnected = !!(session && session.displaySocketId);

      socket.emit("session-status", { adminTaken, displayConnected });
    });

    // ─────────────────────────────────────────────────────────
    // 학생 호출 브로드캐스트 — 해당 세션 룸 전체에 전송
    // ─────────────────────────────────────────────────────────
    socket.on("call-students", ({ sessionCode, students }) => {
      const code = (sessionCode || "").trim();
      console.log(`[Socket] call to session=${code}`, students.map(s => s.studentName));
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
