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
  // DOM
  const ownSocketId = document.querySelector("[ownSocketId]");
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

  askCameraPermissionBtn?.addEventListener("click", () => {
    navigator.permissions
      // @ts-ignore
      .query({ name: "camera" })
      .then((data) => console.log(data))
      .catch((err) => console.log(err));
    console.log("hello");
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

  // localConnection.onicecandidate = (e) =>
  //   console.log("local ice", localConnection.localDescription);

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
  // remoteConnection.onicecandidate = (e) =>
  //   console.log("remote ice", remoteConnection.localDescription);

  remoteConnection.ondatachannel = (e) => {
    receiveChannel = e.channel;
    receiveChannel.onmessage = (e) => console.log("remote", e.data);
    receiveChannel.onopen = () => console.log("receive-open");
    receiveChannel.onclose = () => console.log("receive-close");
    receiveChannel.onerror = () => console.log("receive-error");
    remoteConnection.channel = receiveChannel;
  };

  const socket = io("http://localhost:3000");

  socket.on("connect", () => {
    ownSocketId?.setAttribute("ownSocketId", socket.id);
    console.log(socket.id);
  });

  socket.on("disconnect", () => console.log("disconnect", socket.id));

  socket.on("rtc_offer", (data) => {
    console.log("rtc offer", data);
    const isAcceptedOffer = confirm("are you sure");
    isAcceptedOffer && peerConnectionAccept(data);
  });

  socket.on("rtc_answer", (data) => {
    localConnection
      .setRemoteDescription(data.answer)
      .then(() => console.log("rtc_answer successful"))
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
    remoteVideo.srcObject = remoteSteam;
  });

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
    steam
      .getTracks()
      .forEach((track) => localConnection.addTrack(track, steam));

    // const videoTracks = steam.getVideoTracks();

    window._steam = steam; // making available to steam to window
    ownVideo.srcObject = steam;
  }
}

addEventListener("DOMContentLoaded", init);
