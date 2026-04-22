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

  io.on("connection", (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);

    // 특정 세션(방)에 입장
    socket.on("join-session", (sessionCode) => {
      socket.join(sessionCode);
      console.log(`[Socket] ${socket.id} joined session: ${sessionCode}`);
    });

    // 교사가 특정 세션으로 학생 호출 (배치)
    socket.on("call-students", ({ sessionCode, students }) => {
      console.log(`[Socket] emit batch call to session ${sessionCode}`, students);
      io.to(sessionCode).emit("new-calls", students);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] disconnected: ${socket.id}`);
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
