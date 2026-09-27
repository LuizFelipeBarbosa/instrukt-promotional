/* ============================================================
   Instrukt promo — interactions
   ============================================================ */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- nav ---------- */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- stat counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const cio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      cio.unobserve(el);
      const target = +el.dataset.count;
      if (prefersReduced) { el.textContent = target; continue; }
      const t0 = performance.now();
      const dur = 1200;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  counters.forEach((el) => cio.observe(el));

  /* ---------- marquee: duplicate for seamless loop ---------- */
  const track = document.getElementById("marqueeTrack");
  track.innerHTML += track.innerHTML;

  /* ---------- waveform bars ---------- */
  const wave = document.getElementById("waveVisual");
  if (wave) {
    for (let i = 0; i < 30; i++) {
      const bar = document.createElement("i");
      bar.style.setProperty("--i", i);
      wave.insertBefore(bar, wave.firstChild);
    }
  }

  /* ============================================================
     ASCII SCANNER
     A benchtop microcentrifuge is procedurally shaded offscreen,
     sampled into a character field, and revealed by a scan beam.
     ============================================================ */
  const canvas = document.getElementById("asciiCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  // -- luminance field of the machine photo (precomputed from machine.png) --
  const CW = 7, CH = 12;
  const COLS = Math.floor(W / CW), ROWS = Math.floor(H / CH);
  const RAMP = " .·:;=+*x#%@";
  const field = new Float32Array(COLS * ROWS); // density 0..1

  {
    const enc = "0123456789abcdefghijklmnopqrstuvwxyz";
    const src = window.MACHINE_FIELD;
    for (let i = 0; i < field.length && i < src.data.length; i++)
      field[i] = enc.indexOf(src.data[i]) / 35;
  }

  const hudStatus = document.getElementById("hudStatus");
  const hudPct = document.getElementById("hudPct");
  const scanCaption = document.getElementById("scanCaption");

  const SCAN_MS = 3400, HOLD_MS = 2600, WIPE_MS = 1400;
  const CYCLE = SCAN_MS + HOLD_MS + WIPE_MS;
  let t0 = performance.now();
  let seed = 42;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  // dim scrim behind the ASCII overlay, following the scan beam
  const scrim = document.createElement("canvas");
  scrim.width = W; scrim.height = H;
  const sctx = scrim.getContext("2d");

  function renderFrame(now) {
    const t = (now - t0) % CYCLE;
    let scanX, phase;
    if (t < SCAN_MS) {
      phase = "scan";
      const p = t / SCAN_MS;
      scanX = -40 + (W + 80) * (1 - Math.pow(1 - p, 2)); // ease-out sweep
      hudStatus.textContent = "SCANNING GEOMETRY";
      hudPct.textContent = String(Math.floor(p * 100)).padStart(3, "0") + "%";
      scanCaption.style.opacity = "0";
    } else if (t < SCAN_MS + HOLD_MS) {
      phase = "hold";
      scanX = W + 80;
      hudStatus.textContent = "MODEL LOCKED · 5 PARTS";
      hudPct.textContent = "100%";
      scanCaption.style.opacity = "1";
    } else {
      phase = "wipe";
      const p = (t - SCAN_MS - HOLD_MS) / WIPE_MS;
      scanX = W + 80 - (W + 160) * p;
      hudStatus.textContent = "RELEASING FRAME";
      hudPct.textContent = String(Math.floor((1 - p) * 100)).padStart(3, "0") + "%";
      scanCaption.style.opacity = "0";
    }

    // transparent canvas: the machine photo shows through behind the overlay
    ctx.clearRect(0, 0, W, H);
    sctx.clearRect(0, 0, W, H);
    sctx.fillStyle = "rgba(16,22,18,0.62)";
    sctx.fillRect(0, 0, Math.min(W, scanX), H);
    ctx.drawImage(scrim, 0, 0);

    ctx.font = "11px 'IBM Plex Mono', monospace";
    ctx.textBaseline = "top";

    const flick = now * 0.004;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = field[r * COLS + c];
        const x = c * CW, y = r * CH;
        const probed = x < scanX;

        if (!probed) {
          // unprobed: faint drifting dots hover over the photo
          if (d > 0.06 && ((c * 31 + r * 17 + Math.floor(flick)) % 23) < 3) {
            ctx.fillStyle = "rgba(215,230,218,0.30)";
            ctx.fillText("·", x, y);
          }
          continue;
        }

        if (d < 0.05) continue; // bright background stays empty

        const ci = Math.min(RAMP.length - 1, Math.floor(Math.pow(d, 0.85) * RAMP.length));
        const ch = RAMP[ci];
        const dist = scanX - x;

        if (phase === "scan" && dist < 46) {
          // beam glow
          const glow = 1 - dist / 46;
          ctx.fillStyle = `rgba(190,255,215,${0.55 + glow * 0.45})`;
          ctx.fillText(ch, x, y);
        } else {
          const lum = 0.5 + d * 0.5;
          ctx.fillStyle = `rgba(${Math.floor(175 + d * 65)},${Math.floor(215 + d * 40)},${Math.floor(190 + d * 50)},${lum})`;
          ctx.fillText(ch, x, y);
        }
      }
    }

    // beam line
    if (phase === "scan" || phase === "wipe") {
      const bx = Math.max(0, Math.min(W, scanX));
      const grad = ctx.createLinearGradient(bx - 30, 0, bx + 4, 0);
      grad.addColorStop(0, "rgba(143,212,174,0)");
      grad.addColorStop(1, "rgba(143,212,174,0.35)");
      ctx.fillStyle = grad;
      ctx.fillRect(bx - 30, 0, 34, H);
      ctx.fillStyle = "rgba(190,255,215,0.9)";
      ctx.fillRect(bx, 0, 1.5, H);
    }

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(renderFrame);
  }

  if (prefersReduced) {
    // static "locked" frame
    t0 = performance.now() - SCAN_MS - 1;
    renderFrame(performance.now());
  } else {
    requestAnimationFrame(renderFrame);
  }

  /* ============================================================
     GUIDED-MODE DEMO — rotatable point cloud + step walkthrough
     ============================================================ */
  const cloud = document.getElementById("cloudCanvas");
  const cctx = cloud.getContext("2d");
  const viewport = document.getElementById("viewport");
  const calloutTag = document.getElementById("calloutTag");

  // --- build the point cloud: benchtop microcentrifuge ---
  const pts = []; // {x,y,z,part}
  const addBox = (cx, cy, cz, w, h, d, part, step = 6, jitter = 0.7) => {
    for (let x = -w / 2; x <= w / 2; x += step)
      for (let y = -h / 2; y <= h / 2; y += step)
        for (let z = -d / 2; z <= d / 2; z += step) {
          const onSurface =
            Math.abs(Math.abs(x) - w / 2) < step * 0.6 ||
            Math.abs(Math.abs(y) - h / 2) < step * 0.6 ||
            Math.abs(Math.abs(z) - d / 2) < step * 0.6;
          if (onSurface && rand() > 0.1)
            pts.push({
              x: cx + x + (rand() - 0.5) * jitter,
              y: cy + y + (rand() - 0.5) * jitter,
              z: cz + z + (rand() - 0.5) * jitter,
              part,
            });
        }
  };
  addBox(0, 0, 0, 168, 118, 148, "body", 7);           // body
  addBox(0, 68, -6, 178, 22, 158, "lid", 6);           // lid slab
  addBox(0, 20, 76, 96, 46, 4, "keypad", 5);           // front panel
  // rotor ring on top of the lid opening (visible when "open")
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    for (let rr2 = 24; rr2 <= 44; rr2 += 4) {
      pts.push({
        x: Math.cos(a) * rr2 + (rand() - 0.5) * 1.2,
        y: 56 + (rand() - 0.5) * 2,
        z: -6 + Math.sin(a) * rr2 + (rand() - 0.5) * 1.2,
        part: "rotor",
      });
    }
  }
  // tube holes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    for (let k = 0; k < 14; k++) {
      const aa = rand() * Math.PI * 2, rr3 = rand() * 5;
      pts.push({
        x: Math.cos(a) * 35 + Math.cos(aa) * rr3,
        y: 52 + rand() * 4,
        z: -6 + Math.sin(a) * 35 + Math.sin(aa) * rr3,
        part: "rotor",
      });
    }
  }

  const PART_COLOR = {
    body: [139, 150, 141],
    lid: [62, 138, 99],
    rotor: [176, 188, 178],
    keypad: [201, 162, 39],
  };

  const STEPS = [
    {
      title: "Open the lid",
      desc: "Lift the lid by its front edge until it stays open on the hinge.",
      checks: ["Lid lifted", "Hinge holds open"],
      callout: "LID",
      anchor: { x: -70, y: 84, z: 40 },
      cam: { yaw: 0.55, pitch: 0.5 },
      t: "00:04–00:11", badge: "observed",
    },
    {
      title: "Load the tubes",
      desc: "Place tubes opposite each other so the rotor stays balanced.",
      checks: ["Tubes opposite each other", "Rotor balanced"],
      callout: "ROTOR",
      anchor: { x: 30, y: 58, z: -6 },
      cam: { yaw: 0.15, pitch: 0.95 },
      t: "00:12–00:25", badge: "observed",
    },
    {
      title: "Close the lid",
      desc: "Press the lid down until the latch engages.",
      checks: ["Lid lowered", "Latch engaged"],
      callout: "LATCH",
      anchor: { x: 0, y: 68, z: 78 },
      cam: { yaw: 0.4, pitch: 0.35 },
      t: "00:26–00:31", badge: "observed",
    },
    {
      title: "Set time and speed",
      desc: "Dial in 6 minutes at 13,000 rpm and confirm the program.",
      checks: ["Program confirmed"],
      callout: "KEYPAD",
      anchor: { x: -20, y: 20, z: 80 },
      cam: { yaw: 0.0, pitch: 0.18 },
      t: "00:32–00:44", badge: "documented",
    },
    {
      title: "Press start",
      desc: "Hold START for one second. The run begins and the lid locks.",
      checks: ["Run started"],
      callout: "START",
      anchor: { x: 34, y: 8, z: 80 },
      cam: { yaw: -0.25, pitch: 0.25 },
      t: "00:45–00:52", badge: "inferred",
    },
  ];

  // camera state
  let yaw = 0.55, pitch = 0.5, targetYaw = 0.55, targetPitch = 0.5;
  let dragging = false, lastX = 0, lastY = 0, lastInteract = 0;

  const stepK = document.getElementById("stepK");
  const stepPct = document.getElementById("stepPct");
  const stepTitle = document.getElementById("stepTitle");
  const stepDesc = document.getElementById("stepDesc");
  const progressBar = document.getElementById("progressBar");
  const checkList = document.getElementById("checkList");
  const btnBack = document.getElementById("btnBack");
  const btnNext = document.getElementById("btnNext");

  let stepIdx = 0;
  let finished = false;

  function renderStep() {
    const s = STEPS[stepIdx];
    stepK.textContent = finished ? "Complete" : `Step ${stepIdx + 1} of ${STEPS.length}`;
    const pct = finished ? 100 : Math.round((stepIdx / STEPS.length) * 100);
    stepPct.textContent = `${pct}% done`;
    progressBar.style.width = (finished ? 100 : pct) + "%";
    stepTitle.textContent = finished ? "Run complete" : s.title;
    stepDesc.textContent = finished
      ? "The rotor is spinning. Instrukt logged every step against the source video — the next person follows the exact same path."
      : s.desc;

    checkList.innerHTML = "";
    if (!finished) {
      s.checks.forEach((c) => {
        const row = document.createElement("div");
        row.className = "demo-check";
        row.innerHTML = `<span class="cbox"><svg viewBox="0 0 12 12"><path d="M2 6.5 L5 9 L10 3"/></svg></span>${c}`;
        row.addEventListener("click", () => row.classList.toggle("done"));
        checkList.appendChild(row);
      });
    } else {
      const row = document.createElement("div");
      row.className = "demo-check done";
      row.innerHTML = `<span class="cbox"><svg viewBox="0 0 12 12"><path d="M2 6.5 L5 9 L10 3"/></svg></span>Procedure finished · 5/5 steps`;
      checkList.appendChild(row);
    }

    btnBack.disabled = stepIdx === 0 && !finished;
    btnBack.style.opacity = btnBack.disabled ? 0.4 : 1;
    btnNext.innerHTML = finished
      ? `Restart walkthrough <span class="arrow">↺</span>`
      : stepIdx === STEPS.length - 1
        ? `Finish <span class="arrow">✓</span>`
        : `Next step <span class="arrow">→</span>`;

    targetYaw = finished ? 0.9 : s.cam.yaw;
    targetPitch = finished ? 0.6 : s.cam.pitch;
    calloutTag.textContent = finished ? "DONE" : s.callout;
  }

  btnNext.addEventListener("click", () => {
    if (finished) {
      finished = false;
      stepIdx = 0;
    } else if (stepIdx === STEPS.length - 1) {
      finished = true;
    } else {
      // auto-tick current checks for a satisfying advance
      checkList.querySelectorAll(".demo-check").forEach((r) => r.classList.add("done"));
      setTimeout(() => { stepIdx++; renderStep(); }, 260);
      return;
    }
    renderStep();
  });
  btnBack.addEventListener("click", () => {
    if (finished) { finished = false; renderStep(); return; }
    if (stepIdx > 0) { stepIdx--; renderStep(); }
  });

  // details tab
  const tabGuide = document.getElementById("tabGuide");
  const tabDetails = document.getElementById("tabDetails");
  const guideContent = document.getElementById("guideContent");
  const detailsPane = document.getElementById("detailsPane");
  const detailsList = document.getElementById("detailsList");
  STEPS.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML = `<span class="t">${s.t}</span><span class="name">${i + 1}. ${s.title}</span><span class="badge ${s.badge}">${s.badge}</span>`;
    detailsList.appendChild(row);
  });
  const setTab = (guide) => {
    tabGuide.classList.toggle("active", guide);
    tabDetails.classList.toggle("active", !guide);
    guideContent.classList.toggle("hide", !guide);
    detailsPane.classList.toggle("show", !guide);
  };
  tabGuide.addEventListener("click", () => setTab(true));
  tabDetails.addEventListener("click", () => setTab(false));

  // drag to rotate
  const onDown = (e) => {
    dragging = true;
    lastX = e.clientX ?? e.touches[0].clientX;
    lastY = e.clientY ?? e.touches[0].clientY;
  };
  const onMove = (e) => {
    if (!dragging) return;
    const x = e.clientX ?? e.touches[0].clientX;
    const y = e.clientY ?? e.touches[0].clientY;
    targetYaw += (x - lastX) * 0.008;
    targetPitch = Math.max(0.05, Math.min(1.35, targetPitch + (y - lastY) * 0.006));
    lastX = x; lastY = y;
    lastInteract = performance.now();
  };
  const onUp = () => { dragging = false; };
  viewport.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  viewport.addEventListener("touchstart", onDown, { passive: true });
  viewport.addEventListener("touchmove", onMove, { passive: true });
  viewport.addEventListener("touchend", onUp);

  // keyboard: left/right arrows navigate steps
  window.addEventListener("keydown", (e) => {
    const r = viewport.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < innerHeight;
    if (!visible) return;
    if (e.key === "ArrowRight") btnNext.click();
    if (e.key === "ArrowLeft") btnBack.click();
  });

  // render loop
  const projected = new Array(pts.length);
  let anchorScreen = { x: 0, y: 0 };

  function sizeCloud() {
    const r = viewport.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cloud.width = Math.max(1, r.width * dpr);
    cloud.height = Math.max(1, r.height * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(sizeCloud).observe(viewport);
  sizeCloud();

  function renderCloud(now) {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    cctx.clearRect(0, 0, w, h);

    // idle auto-rotate
    if (!dragging && now - lastInteract > 4000 && !prefersReduced) targetYaw += 0.0016;
    yaw += (targetYaw - yaw) * 0.07;
    pitch += (targetPitch - pitch) * 0.07;

    // floor shadow
    cctx.fillStyle = "rgba(30,35,32,0.07)";
    cctx.beginPath();
    cctx.ellipse(w / 2, h * 0.78, w * 0.26, h * 0.06, 0, 0, Math.PI * 2);
    cctx.fill();

    const cx = w / 2, cy = h * 0.58;
    const scale = Math.min(w, h) / 290;
    const f = 640;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

    const order = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      // rotate Y
      let x = p.x * cosY - p.z * sinY;
      let z = p.x * sinY + p.z * cosY;
      // rotate X (pitch)
      let y = p.y * cosP - z * sinP;
      z = p.y * sinP + z * cosP;
      const s = f / (f + z + 260);
      order.push([z, i, cx + x * scale * s * 1.6, cy - (y - 10) * scale * s * 1.6, s]);
    }
    order.sort((a, b) => b[0] - a[0]);

    for (const [z, i, sx, sy, s] of order) {
      const p = pts[i];
      const col = PART_COLOR[p.part];
      const depth = Math.max(0.25, Math.min(1, 1 - (z + 200) / 620));
      const activePart = !finished && STEPS[stepIdx].callout &&
        ((STEPS[stepIdx].callout === "LID" && p.part === "lid") ||
         (STEPS[stepIdx].callout === "ROTOR" && p.part === "rotor") ||
         (STEPS[stepIdx].callout === "LATCH" && p.part === "lid") ||
         ((STEPS[stepIdx].callout === "KEYPAD" || STEPS[stepIdx].callout === "START") && p.part === "keypad"));
      const boost = activePart ? 1.25 : 1;
      cctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.24 + depth * 0.68) * (activePart ? 1 : 0.8)})`;
      const sz = Math.max(1.1, 2.6 * s * boost);
      cctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
    }

    // callout anchor → screen
    const a = STEPS[Math.min(stepIdx, STEPS.length - 1)].anchor;
    let x = a.x * cosY - a.z * sinY;
    let z = a.x * sinY + a.z * cosY;
    let y = a.y * cosP - z * sinP;
    z = a.y * sinP + z * cosP;
    const s2 = f / (f + z + 260);
    anchorScreen = { x: cx + x * scale * s2 * 1.6, y: cy - (y - 10) * scale * s2 * 1.6 };

    // pulsing anchor dot
    const pulse = prefersReduced ? 0.5 : (Math.sin(now * 0.005) + 1) / 2;
    cctx.fillStyle = "rgba(46,107,79,0.9)";
    cctx.beginPath();
    cctx.arc(anchorScreen.x, anchorScreen.y, 4, 0, Math.PI * 2);
    cctx.fill();
    cctx.strokeStyle = `rgba(46,107,79,${0.5 - pulse * 0.4})`;
    cctx.lineWidth = 1.5;
    cctx.beginPath();
    cctx.arc(anchorScreen.x, anchorScreen.y, 8 + pulse * 9, 0, Math.PI * 2);
    cctx.stroke();

    // position the tag near the anchor
    const tagX = Math.min(w - 90, Math.max(10, anchorScreen.x + 16));
    const tagY = Math.max(10, anchorScreen.y - 34);
    calloutTag.style.transform = `translate(${tagX}px, ${tagY}px)`;
    calloutTag.style.left = "0";
    calloutTag.style.top = "0";

    requestAnimationFrame(renderCloud);
  }
  renderStep();
  requestAnimationFrame(renderCloud);
})();
