// Shared by /cuenta/ and /crear/ (AR platform): session, API calls and the branded QR.
(function () {
  const KEY = "vvr-sesion";
  const api = (document.currentScript && document.currentScript.dataset.api) || new URLSearchParams(location.search).get("api") || "..";
  const get = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s && s.token ? s : null; } catch (e) { return null; } };
  const set = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  const clear = () => { try { localStorage.removeItem(KEY); localStorage.removeItem("vvr-crear"); } catch (e) {} };

  async function call(path, opt = {}) {
    const headers = Object.assign({}, opt.headers || {});
    const s = get(); if (s) headers.Authorization = "Bearer " + s.token;
    if (opt.json !== undefined) { headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(opt.json); }
    const r = await fetch(`${api}/api/${path}`, { method: opt.method || (opt.body ? "POST" : "GET"), headers, body: opt.body });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && s && path !== "login") clear();
    if (!r.ok) { const err = new Error(j.error || "Algo salió mal. Intenta de nuevo."); err.status = r.status; err.data = j; throw err; }
    return j;
  }

  // QR 1024×1150: modules in deep purple, the Vórtice VR mark in the middle; underneath the hint and a small logo (no link text)
  const base = (document.currentScript && document.currentScript.src || "").replace(/plataforma\.js.*$/, "");
  const icon = new Image(); icon.src = base + "icono.png";
  const logo = new Image(); logo.src = base + "logo-vorticevr.png";
  function drawQR(canvas, url, caption) {
    const qr = qrcode(0, "H"); qr.addData(url); qr.make(); const n = qr.getModuleCount();
    const x = canvas.getContext("2d"), W = 1024, M = 80, cell = Math.floor((W - 2 * M) / n), off = Math.floor((W - cell * n) / 2);
    canvas.width = 1024; canvas.height = 1150;
    x.fillStyle = "#fff"; x.fillRect(0, 0, canvas.width, canvas.height); x.fillStyle = "#1b0a36";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect(off + c * cell, off + r * cell, cell, cell);
    if (icon.complete && icon.naturalWidth) { const s = cell * n * .2, p = (W - s) / 2; x.fillStyle = "#fff"; x.beginPath(); x.roundRect ? x.roundRect(p - 14, p - 14, s + 28, s + 28, 24) : x.rect(p - 14, p - 14, s + 28, s + 28); x.fill(); x.drawImage(icon, p, p, s, s); }
    x.fillStyle = "#6b279b"; x.font = "500 32px 'IBM Plex Sans', sans-serif"; x.textAlign = "center"; x.fillText(caption || "Escanea y apunta tu cámara a la imagen", W / 2, W + 14);
    if (logo.complete && logo.naturalWidth) { const w = 230, h = w * logo.naturalHeight / logo.naturalWidth; x.drawImage(logo, (W - w) / 2, W + 44, w, h); }
  }
  const loaded = img => new Promise(r => { if (img.complete) r(); else { img.onload = r; img.onerror = r; } });
  const iconReady = Promise.all([loaded(icon), loaded(logo)]);
  function downloadCanvas(canvas, name) {
    canvas.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, "image/png");
  }
  window.VVR = { api, session: get, setSession: set, clearSession: clear, call, drawQR, iconReady, downloadCanvas };
})();
