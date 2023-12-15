import express from "express";
import { config } from "dotenv";
import { Server } from "socket.io";
import { createServer } from "node:http";

config();

const app = express();
const frontendOrigin =
  process.env.NODE_ENV === "production"
    ? "https://rtc-v1.netlify.app"
    : "http://localhost:5173";

console.log("frontend URI=>", frontendOrigin, "running");

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    // origin: frontendOrigin,
    methods: ["GET", "POST"],
  },
});

const offers:
  | {
      offererSocket: string;
      offer: any;
      offerIceCandidate: any[];
      answererSocket: null | string;
      answer: null;
      answerIceCandidate: any[];
    }[]
  | [] = [];

app.get("/", (req, res) => res.json({ status: "success" }));
io.on("connection", (socket) => {
  console.log("socket is connected", socket.id);

  socket.on("_ring:accept", (data) => {
    socket.to(data.to).emit("_ring:accept");
  });

  socket.on("_offer", (newOffer) => {
    const prep = {
      offererSocket: socket.id,
      offer: newOffer,
      offerIceCandidate: [],
      answererSocket: null,
      answer: null,
      answerIceCandidate: [],
    };

    offers.push(prep);

    socket.broadcast.emit("_offer", offers.slice(-1));
  });

  socket.on("_answer", (offerObj, ackFunction) => {
    const toSend = offerObj.offererSocket;

    const offerToUpdate = offers.find(
      (o) => o.offererSocket == offerObj.offererSocket
    );

    if (!offerToUpdate) {
      console.log("not found offer to update");
      return;
    }
    ackFunction(offerToUpdate.offerIceCandidate);
    offerToUpdate.answer = offerObj.answer;
    offerToUpdate.answererSocket = socket.id;

    socket.to(toSend).emit("_answer", offerToUpdate);
  });

  socket.on("_candidate", (iceCandidateObj) => {
    const { iceCandidate, iceSenderSocket, didIOffer } = iceCandidateObj;

    if (didIOffer) {
      const offerInOffers = offers.find(
        (o) => o.offererSocket === iceSenderSocket
      );

      if (offerInOffers) {
        offerInOffers.offerIceCandidate.push(iceCandidate);

        if (offerInOffers.answererSocket) {
          socket
            .to(offerInOffers.answererSocket)
            .emit("_candidate", iceCandidate);
        } else {
          console.log("Ice candidate recieved but could not find answere");
          console.log(offerInOffers);
        }
      } else {
        console.log("not found ice offerer");
      }
    } else {
      // coming from answerer
      // pass it to offerer
      const offerInOffers = offers.find(
        (o) => o.answererSocket === iceSenderSocket
      );

      if (offerInOffers?.offererSocket) {
        socket.to(offerInOffers.offererSocket).emit("_candidate", iceCandidate);
      } else {
        console.log("Ice candidate recieved but could not find offerer");
        console.log(offerInOffers);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected ->", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () =>
  console.log(`server is running on http://localhost:${PORT}`)
);
