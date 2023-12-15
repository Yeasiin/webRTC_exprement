import "./style.css";
import { io } from "socket.io-client";
declare global {
  interface Window {
    _localConnection: RTCPeerConnection;
    _remoteConnection: RTCPeerConnection;
    _steam: MediaStream;
  }
  interface RTCPeerConnection {
    channel: RTCDataChannel;
  }
}

// store;

const store = {
  isLocal: false,
  isAcceptOffer: false,
  isFirst: true,
  socketId: "",
  remoteSocketId: "",
};

const mediaConfig = {
  video: true,
  audio: false,
};

// types
type RecipientType = {
  to: string;
  from: string;
};
// initialize the app
function init() {
  // socket init
  const socketBackend = import.meta.env.PROD
    ? "https://webrtcexprement-production.up.railway.app"
    : "https://capable-subtle-raven.ngrok-free.app";
  // : "http://localhost:3000";

  console.log(socketBackend);

  const socket = io(socketBackend);

  // DOM
  const ownSocketId = document.querySelector("[ownSocketId]");
  const callMeBtn = document.querySelector(".call-me-btn");
  const callBtn = document.querySelector(".call-start");
  const callBtnRing = document.querySelector(".call-start-ring");

  const ownVideo = document.querySelector(
    "video[localPeer]"
  ) as HTMLVideoElement;

  const remoteVideo = document.querySelector(
    "video[remotePeer]"
  ) as HTMLVideoElement;

  const askCameraPermissionBtn = document.querySelector(".permission-camera");

  ownSocketId?.addEventListener("click", function () {
    navigator.clipboard.writeText(
      ownSocketId.getAttribute("ownSocketId") ?? "no-id"
    );

    ownSocketId.textContent =
      "Copy - " + ownSocketId.getAttribute("ownSocketId");
  });

  callMeBtn?.addEventListener("click", () => {
    if (store.socketId) {
      socket?.emit("call-me", store.socketId);
      callMeBtn.textContent = "Ready 👍";
    } else {
      callMeBtn.textContent = "Not Ready 👎";
    }
    console.log(store);
  });

  callBtn?.addEventListener("click", () => {
    const args = { to: store.remoteSocketId, from: store.socketId };
    if (!args.to || !args.from) return console.log("what are you doing?");

    socket?.emit("ring", args);
  });
  callBtnRing?.addEventListener("click", () => {
    // const args = { to: store.remoteSocketId, from: store.socketId };
    // if (!args.to || !args.from) return console.log("what are you doing?");
    socket?.emit("ring");
  });

  // rtc connection

  const iceConfiguration: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun1.l.google.com:19302" }],
  };

  // local
  let localConnection: RTCPeerConnection;
  window._localConnection = localConnection = new RTCPeerConnection(
    iceConfiguration
  );

  navigator.mediaDevices
    .getUserMedia(mediaConfig)
    .then(handleSteamSuccess)
    .catch((err) => console.log("err", err));

  localConnection.onicecandidate = () =>
    console.log("local ice", localConnection.localDescription);

  const sendChannel = localConnection.createDataChannel("channel");
  sendChannel.onmessage = (e) => console.log("local", e.data);
  sendChannel.onopen = () => console.log("send-open");
  sendChannel.onclose = () => console.log("send-close");
  sendChannel.onerror = () => console.log("send-error");

  // remote
  let remoteConnection: RTCPeerConnection;
  let receiveChannel: RTCDataChannel;

  window._remoteConnection = remoteConnection = new RTCPeerConnection(
    iceConfiguration
  );

  remoteConnection.onicecandidate = () =>
    console.log("remote ice", remoteConnection.localDescription);

  remoteConnection.ondatachannel = (e) => {
    receiveChannel = e.channel;
    receiveChannel.onmessage = (e) => console.log("remote", e.data);
    receiveChannel.onopen = () => console.log("receive-open");
    receiveChannel.onclose = () => console.log("receive-close");
    receiveChannel.onerror = () => console.log("receive-error");
    remoteConnection.channel = receiveChannel;
  };

  // socket implementation

  socket.on("connect", () => {
    if (ownSocketId) {
      ownSocketId.setAttribute("ownSocketId", socket.id);
      store.socketId = socket.id;
      ownSocketId.textContent = socket.id;
    }
    console.log(socket.id);
  });

  socket.on("disconnect", () => console.log("disconnect", socket.id));

  socket.on("call-him", (data) => {
    store.remoteSocketId = data;
    if (store.remoteSocketId) {
      callBtn?.setAttribute("isVisible", "true");
    }
  });

  socket.on("ring", (data) => {
    if (!store.isAcceptOffer) {
      store.isAcceptOffer = confirm("are you sure");
    }

    const args = { to: data.from, from: data.to };
    if (store.isAcceptOffer) {
      socket.emit("ring-agree", args);
      socket.emit("ring:agree", args);
    }
  });

  socket.on("ring-agree", (data) => {
    const arg = { from: data.to, to: data.from };

    if (!arg.to || !arg.from) return console.log("what are you doing?");

    console.log(sendChannel);
    peerConnectionOffer(arg as RecipientType);
  });
  socket.on("ring:agree", (data) => {
    const arg = { from: data.to, to: data.from };

    if (!arg.to || !arg.from) return console.log("what are you doing?");

    console.log(sendChannel);
    peerConnectionOffer(arg as RecipientType);
  });

  socket.on("rtc_offer", (data) => {
    console.log("rtc offer");
    // const isAcceptedOffer = confirm("are you sure");
    // isAcceptedOffer && peerConnectionAccept(data);
    peerConnectionAccept(data);
  });

  // socket.on("ice-candidate", (candidate) => {
  //   // Add ICE candidate received from peer
  //   console.log("ice setting on local");
  //   localConnection?.addIceCandidate(new RTCIceCandidate(candidate));
  // });

  socket.on("rtc_answer", (data) => {
    console.log("rtc_answer");
    localConnection
      .setRemoteDescription(data.answer)
      .then(() => {
        if (store.isFirst) {
          const args = { to: data.from, from: data.to };
          if (!args.to || !args.from) return console.log("what are you doing?");
          // socket?.emit("ring", args);
          store.isFirst = false;
        }
      })

      .catch((err) => console.log("failed", err));
  });

  socket.on("from_server", (msg) => console.log(msg));

  socket.on("offer_accept", (msg) => console.log(msg));

  const socketForm = document.querySelector("form[name=socket]");
  const rtcForm = document.querySelector("form[name=rtc]");

  const textValue = rtcForm?.querySelector(
    "textarea[name=message]"
  ) as HTMLInputElement;

  const otherSocketId = socketForm?.querySelector(
    "input[name=otherSocketId]"
  ) as HTMLInputElement;

  socketForm?.addEventListener("submit", (e) => {
    e.preventDefault();

    store.isLocal = true;

    const requirement = {
      to: otherSocketId.value,
      from: ownSocketId?.getAttribute("ownSocketId"),
    };
    if (!requirement.to || !requirement.from)
      return console.log("what are you doing?");

    console.log(sendChannel);
    peerConnectionOffer(requirement as RecipientType);
  });

  rtcForm?.addEventListener("submit", (e) => {
    e.preventDefault();

    // console.log(textValue.value);

    if (store.isLocal) {
      sendChannel.send(textValue.value);
    } else {
      receiveChannel.send(textValue.value);
    }
    textValue.value = "";
  });

  remoteConnection.addEventListener("track", async (event) => {
    const [remoteSteam] = event.streams;
    console.log(remoteSteam);
    remoteVideo.classList.add("remoteVisible");
    ownVideo.classList.add("remoteVisible");
    remoteVideo.srcObject = remoteSteam;
    console.log("remote 😀 -track");
  });

  remoteConnection.addEventListener("connectionstatechange", (event) => {
    switch (remoteConnection.connectionState) {
      case "closed":
        console.log("remote call disconnect");
        break;
    }
  });
  remoteConnection.addEventListener("iceconnectionstatechange", () => {
    switch (remoteConnection.iceConnectionState) {
      case "closed":
        console.log("remote call closed by ice");
        break;

      case "disconnected":
        console.log(" remote call disconnected by ice");
        remoteVideo.classList.remove("remoteVisible");
        ownVideo.classList.remove("remoteVisible");

        break;

      case "connected":
      case "completed":
        console.log("ice remote connected");
        // You can handle the call being connected here.
        break;
    }
  });
  localConnection.addEventListener("connectionstatechange", (event) => {
    switch (localConnection.connectionState) {
      case "closed":
        console.log("remote call disconnect");
        break;
    }
  });
  localConnection.addEventListener("iceconnectionstatechange", () => {
    switch (localConnection.iceConnectionState) {
      case "closed":
        console.log("local call closed by ice");
        break;

      case "disconnected":
        console.log(" local call disconnected by ice");
        remoteVideo.classList.remove("remoteVisible");
        ownVideo.classList.remove("remoteVisible");
        break;

      case "connected":
      case "completed":
        console.log("ice local connected");
        // You can handle the call being connected here.
        break;
    }
  });

  localConnection.addEventListener("track", async (event) => {
    const [remoteSteam] = event.streams;
    console.log(remoteSteam);
    remoteVideo.classList.add("remoteVisible");
    ownVideo.classList.add("remoteVisible");
    remoteVideo.srcObject = remoteSteam;
    console.log("local 😀 -track");
  });

  // localConnection.addEventListener("icecandidate", (event) => {
  //   if (event.candidate) {
  //     socket?.emit("ice-candidate", event.candidate, {
  //       to: store.remoteSocketId,
  //       from: store.socketId,
  //     });
  //     console.log("local", event.candidate);
  //   }
  // });
  // remoteConnection.addEventListener("icecandidate", (event) => {
  //   if (event.candidate) {
  //     socket?.emit("ice-candidate", event.candidate, {
  //       to: store.remoteSocketId,
  //       from: store.socketId,
  //     });
  //     console.log("remote", event.candidate);
  //   }
  // });

  function peerConnectionOffer({ to, from }: RecipientType) {
    localConnection
      .createOffer()
      .then((offer) => localConnection.setLocalDescription(offer))
      .then(() =>
        socket.emit("rtc_offer", {
          offer: localConnection.localDescription,
          to,
          from,
        })
      )
      .catch(() => console.log("failed to offer"));
  }

  type PeerConnectionAcceptProps = {
    offer: RTCSessionDescriptionInit;
    to: string;
    from: string;
  };

  function peerConnectionAccept(data: PeerConnectionAcceptProps) {
    // crateRemoteConnection();
    remoteConnection
      .setRemoteDescription(data.offer)
      // add media stream
      .then(() => console.log("set remote offer"))
      .catch(() => console.log("failed"));

    remoteConnection
      .createAnswer()
      .then((e) => remoteConnection.setLocalDescription(e))
      .then(() =>
        socket.emit("rtc_answer", {
          answer: remoteConnection.localDescription,
          to: data.from,
          from: data.to,
        })
      )
      .catch((e) => console.log("failed", e));
  }

  function handleSteamSuccess(steam: MediaStream) {
    steam.getTracks().forEach((track) => {
      localConnection.addTrack(track, steam);
      remoteConnection.addTrack(track, steam);
    });

    window._steam = steam; // making available to steam to window
    ownVideo.srcObject = steam;
  }
}

addEventListener("DOMContentLoaded", init);
