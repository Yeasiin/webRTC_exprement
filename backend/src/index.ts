import express from "express";
import { config } from "dotenv";
import { Server } from "socket.io";
import { createServer } from "node:http";

config();

const app = express();
const frontendOrigin =
  process.env.NODE_ENV === "production"
    ? process.env.frontend_url
    : "http://localhost:5173";

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: frontendOrigin,
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => res.json({ status: "success" }));

io.on("connection", (socket) => {
  console.log("socket is connected");

  socket.on("from_client", (msg) => {
    socket.broadcast.emit("from_server", msg);
  });

  socket.on("from_client_to_specific", (id, msg) => {
    socket.to(id).emit("from_server", msg);
  });

  socket.on("rtc_offer", (data) => {
    socket.to(data.to).emit("rtc_offer", data);
  });

  socket.on("rtc_answer", (data) => {
    socket.to(data.to).emit("rtc_answer", data);
  });

  socket.on("disconnect", () => console.log("user disconnected ->", socket.id));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () =>
  console.log(`server is running on http://localhost:${PORT}`)
);
