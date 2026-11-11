/* Flowing Asanas docs: interaction only (drag-rotate, reveal, nav, attention map, benchmark rendering).
   The 3D skeleton, pipeline and layer stack are pure HTML/CSS; this file only adds interactivity. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  /* ---------------------------------------------------------- motion toggle */
  var toggle = document.getElementById("motionToggle");
  function setPaused(p) {
    root.classList.toggle("paused", p);
    root.classList.toggle("play", !p);
    if (toggle) {
      toggle.textContent = p ? "Play motion" : "Pause motion";
      toggle.setAttribute("aria-pressed", String(p));
    }
  }
  setPaused(!!reduceMQ.matches);
  if (toggle) toggle.addEventListener("click", function () { setPaused(!root.classList.contains("paused")); });

  /* ---------------------------------------------------------- drag to rotate the skeleton */
  var stage = document.getElementById("stage");
  var rig = document.getElementById("rig");
  if (stage && rig) {
    var yaw = -35, tilt = -14, sx = 0, sy = 0, sYaw = 0, sTilt = 0, dragging = false;
    var apply = function () {
      rig.style.setProperty("--yaw", yaw.toFixed(1) + "deg");
      rig.style.setProperty("--tilt", tilt.toFixed(1) + "deg");
    };
    stage.addEventListener("pointerdown", function (e) {
      dragging = true; sx = e.clientX; sy = e.clientY; sYaw = yaw; sTilt = tilt;
      stage.classList.add("dragging");
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    stage.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      yaw = sYaw + (e.clientX - sx) * 0.5;
      tilt = Math.max(-45, Math.min(12, sTilt - (e.clientY - sy) * 0.3));
      apply();
    });
    var end = function () { dragging = false; stage.classList.remove("dragging"); };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    stage.addEventListener("dblclick", function () { yaw = -35; tilt = -14; apply(); });
  }

  /* ---------------------------------------------------------- scroll reveal */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMQ.matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------------------------------------------------------- active nav link */
  var links = Array.prototype.slice.call(document.querySelectorAll(".navlinks a"));
  if ("IntersectionObserver" in window && links.length) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && byId[en.target.id]) {
          links.forEach(function (a) { a.classList.remove("active"); });
          byId[en.target.id].classList.add("active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) navIO.observe(s); });
  }

  /* ---------------------------------------------------------- layer list <-> 3D plates */
  var plates = document.querySelectorAll("#stack .plate");
  document.querySelectorAll(".layers li").forEach(function (li) {
    var i = +li.getAttribute("data-layer");
    var on = function () { if (plates[i]) plates[i].classList.add("hl"); li.classList.add("hl"); };
    var off = function () { if (plates[i]) plates[i].classList.remove("hl"); li.classList.remove("hl"); };
    li.addEventListener("mouseenter", on); li.addEventListener("mouseleave", off);
    li.tabIndex = 0; li.addEventListener("focus", on); li.addEventListener("blur", off);
  });

  /* ---------------------------------------------------------- attention map (top-5 joints per pose, from the notebook) */
  var PTS = [[100,40],[104,34],[108,34],[111,34],[96,34],[92,34],[89,34],[116,38],[84,38],[104,47],[96,47],
    [128,70],[72,70],[146,108],[54,108],[156,146],[44,146],[162,158],[38,158],[157,163],[43,163],[150,157],[50,157],
    [116,150],[84,150],[120,210],[80,210],[122,265],[78,265],[119,275],[81,275],[136,281],[64,281]];
  var EDGES = [[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],[11,12],[11,13],[13,15],[15,17],[15,19],[15,21],[17,19],
    [12,14],[14,16],[16,18],[16,20],[16,22],[18,20],[11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28],[27,29],[28,30],
    [29,31],[30,32],[27,31],[28,32]];
  var NAMES = ["nose","L eye in","L eye","L eye out","R eye in","R eye","R eye out","L ear","R ear","mouth L","mouth R",
    "L shoulder","R shoulder","L elbow","R elbow","L wrist","R wrist","L pinky","R pinky","L index","R index",
    "L thumb","R thumb","L hip","R hip","L knee","R knee","L ankle","R ankle","L heel","R heel","L foot","R foot"];
  var POSES = [
    { top: ["R wrist","R elbow","R pinky","L wrist","L pinky"], note: "Extended Side Angle: the model focuses on the wrists, elbows and hands, i.e. the extended arm." },
    { top: ["L heel","R ankle","R heel","L foot","L ankle"], note: "High Lunge: attention concentrates on the heels, ankles and feet, i.e. the stance." },
    { top: ["R heel","L heel","L foot","R foot","R ankle"], note: "Low Lunge: attention concentrates on the heels, ankles and feet, i.e. the stance." },
    { top: ["R heel","L heel","L foot","R ankle","R foot"], note: "Pyramid: attention concentrates on the heels, ankles and feet, i.e. the stance." }
  ];
  var svg = document.getElementById("attnSvg");
  var NS = "http://www.w3.org/2000/svg";
  var circles = [];
  if (svg) {
    EDGES.forEach(function (e) {
      var l = document.createElementNS(NS, "line");
      l.setAttribute("x1", PTS[e[0]][0]); l.setAttribute("y1", PTS[e[0]][1]);
      l.setAttribute("x2", PTS[e[1]][0]); l.setAttribute("y2", PTS[e[1]][1]);
      l.setAttribute("class", "sk-line");
      svg.appendChild(l);
    });
    var labels = document.createElementNS(NS, "g");
    PTS.forEach(function (p, i) {
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); c.setAttribute("r", i <= 10 ? 1.6 : 2.6);
      c.setAttribute("class", "sk-pt");
      var t = document.createElementNS(NS, "title"); t.textContent = i + " " + NAMES[i]; c.appendChild(t);
      svg.appendChild(c); circles.push(c);
    });
    svg.appendChild(labels);
    svg._labels = labels;
  }
  var tabs = document.querySelectorAll(".pose-tabs .tab");
  var topList = document.getElementById("topJoints");
  var note = document.getElementById("attnNote");
  function showPose(k) {
    var P = POSES[k];
    tabs.forEach(function (t, j) { t.setAttribute("aria-selected", String(j === k)); });
    if (topList) {
      topList.textContent = "";
      P.top.forEach(function (n, r) { var li = document.createElement("li"); li.textContent = n; li.style.setProperty("--k", r); topList.appendChild(li); });
    }
    if (note) note.textContent = P.note;
    if (svg) {
      circles.forEach(function (c, i) { c.classList.remove("hot"); c.setAttribute("r", i <= 10 ? 1.6 : 2.6); });
      var g = svg._labels; while (g.firstChild) g.removeChild(g.firstChild);
      P.top.forEach(function (n, r) {
        var i = NAMES.indexOf(n); if (i < 0) return;
        var c = circles[i]; c.classList.add("hot"); c.setAttribute("r", 6.5 - r * 0.8);
        var t = document.createElementNS(NS, "text");
        var left = PTS[i][0] < 100;
        t.setAttribute("x", PTS[i][0] + (left ? -9 : 9)); t.setAttribute("y", PTS[i][1] + 2.5);
        t.setAttribute("text-anchor", left ? "end" : "start");
        t.setAttribute("class", "sk-lbl"); t.textContent = "#" + (r + 1);
        g.appendChild(t);
      });
    }
  }
  tabs.forEach(function (t, j) {
    t.addEventListener("click", function () { showPose(j); });
    t.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var n = (j + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
        tabs[n].focus(); showPose(n);
      }
    });
  });
  if (tabs.length) showPose(0);

  /* ---------------------------------------------------------- copy BibTeX */
  var copyBtn = document.getElementById("copyBib");
  var bib = document.getElementById("bibtex");
  function flash(msg) { copyBtn.textContent = msg; setTimeout(function () { copyBtn.textContent = "Copy"; }, 1600); }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    flash(ok ? "Copied" : "Select and copy");
  }
  if (copyBtn && bib) {
    copyBtn.addEventListener("click", function () {
      var text = bib.textContent;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { flash("Copied"); }, function () { fallbackCopy(text); });
      } else { fallbackCopy(text); }
    });
  }

  /* ---------------------------------------------------------- benchmark rendering */
  renderBenchmark(window.BENCHMARK, document.getElementById("bench"));

  function num(v) { return typeof v === "number" && isFinite(v); }
  function fmtMs(v) {
    if (!num(v)) return "n/a";
    if (v < 1) return v.toFixed(3);
    if (v < 10) return v.toFixed(2);
    return v.toFixed(1);
  }
  function fmtInt(v) { return num(v) ? Math.round(v).toLocaleString("en-US") : (v == null ? "n/a" : String(v)); }
  function fmtRate(v) { return !num(v) ? "n/a" : v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1); }
  function fmtAcc(v) {
    if (num(v)) return v <= 1 ? (v * 100).toFixed(1) + "%" : v.toFixed(1) + "%";
    return v == null || v === "" ? "n/a" : String(v);
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function table(headers, rows, numericFrom) {
    var wrap = el("div", "table-wrap");
    var t = el("table", "data compact");
    var thead = el("thead"), tr = el("tr");
    headers.forEach(function (h) { var th = el("th", null, h); th.scope = "col"; tr.appendChild(th); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = el("tbody");
    rows.forEach(function (r) {
      var row = el("tr");
      r.forEach(function (c, i) {
        var cell = el(i === 0 ? "th" : "td", null, c);
        if (i === 0) cell.scope = "row";
        if (numericFrom != null && i >= numericFrom) cell.style.textAlign = "right";
        row.appendChild(cell);
      });
      tb.appendChild(row);
    });
    t.appendChild(tb); wrap.appendChild(t);
    return wrap;
  }

  function renderBenchmark(B, host) {
    if (!host || !B || typeof B !== "object") return; // keep the static placeholder
    host.textContent = "";
    var stages = Array.isArray(B.stages) ? B.stages : [];
    var thr = Array.isArray(B.throughput) ? B.throughput : [];
    var models = Array.isArray(B.models) ? B.models : [];

    /* KPI tiles: headline numbers for the main model (BiLSTM-Attention), using medians because laptop timings are noisy */
    function stage(re, re2) {
      return stages.filter(function (s) { return re.test(s.name || "") && (!re2 || re2.test(s.name || "")) && num(s.median_ms); })[0] || null;
    }
    var bil = stage(/bilstm/i, /tf\.function/i);
    var pose = stage(/mediapipe pose/i), pre = stage(/preprocess/i), feat = stage(/feature/i);
    var bilMs = bil ? bil.median_ms : null;
    var estMs = (bil && pose) ? bil.median_ms + pose.median_ms + (pre ? pre.median_ms : 0) + (feat ? feat.median_ms : 0) : null;
    var kpis = el("div", "kpis");
    [
      { label: "BiLSTM-Attention per frame", val: fmtMs(bilMs), unit: "ms", sub: "median, compiled tf.function incl. torso normalisation" },
      { label: "End-to-end with BiLSTM-Attention", val: fmtMs(estMs), unit: "ms",
        sub: estMs ? "≈ " + (1000 / estMs).toFixed(1) + " FPS; sum of stage medians (preprocess + Pose + features + BiLSTM)" : "needs Pose and BiLSTM stages" },
      { label: "MediaPipe Pose", val: fmtMs(pose ? pose.median_ms : null), unit: "ms", sub: "median; the slowest stage once the classifier is compiled" }
    ].forEach(function (k) {
      var d = el("div", "kpi");
      d.appendChild(el("div", "k-label", k.label));
      var v = el("div", "k-val", k.val);
      if (k.val !== "n/a") v.appendChild(el("small", null, k.unit));
      d.appendChild(v);
      d.appendChild(el("div", "k-sub", k.sub));
      kpis.appendChild(d);
    });
    host.appendChild(kpis);

    /* per-stage bar chart */
    if (stages.length) {
      var GROUP = { vision: "var(--c-vision)", model: "var(--c-model)", total: "var(--c-out)" };
      var max = 0;
      stages.forEach(function (s) { [s.mean_ms, s.p95_ms].forEach(function (v) { if (num(v) && v > max) max = v; }); });
      if (max <= 0) max = 1;
      var chart = el("div", "chart");
      var head = el("div", "chart-head");
      head.appendChild(el("h3", null, "Per-stage latency"));
      var lg = el("div", "chart-legend");
      [["vision", "MediaPipe / vision"], ["model", "classifier"], ["total", "total"]].forEach(function (g) {
        if (!stages.some(function (s) { return s.group === g[0]; })) return;
        var s = el("span"); var i = el("i"); i.style.background = GROUP[g[0]]; s.appendChild(i); s.appendChild(document.createTextNode(g[1])); lg.appendChild(s);
      });
      var ps = el("span"); ps.appendChild(el("i", "p95")); ps.appendChild(document.createTextNode("p95")); lg.appendChild(ps);
      var ms = el("span", null, "bar = mean (ms)"); lg.appendChild(ms);
      head.appendChild(lg);
      chart.appendChild(head);
      var bars = el("div", "bars");
      stages.forEach(function (s) {
        var row = el("div", "brow" + (s.group === "total" ? " total" : ""));
        var name = el("div", "b-name", s.name || "stage");
        name.title = s.name || "";
        row.appendChild(name);
        var track = el("div", "b-track");
        track.setAttribute("role", "img");
        track.setAttribute("aria-label", (s.name || "stage") + ": mean " + fmtMs(s.mean_ms) + " ms, p95 " + fmtMs(s.p95_ms) + " ms");
        var fill = el("div", "b-fill");
        fill.style.setProperty("--w", (num(s.mean_ms) ? Math.max(0.4, s.mean_ms / max * 100) : 0) + "%");
        fill.style.setProperty("--g", GROUP[s.group] || "var(--accent)");
        track.appendChild(fill);
        if (num(s.p95_ms)) {
          var p = el("div", "b-p95"); p.style.setProperty("--p", "calc(" + Math.min(100, s.p95_ms / max * 100) + "% - 1px)");
          track.appendChild(p);
        }
        row.appendChild(track);
        var val = el("div", "b-val", fmtMs(s.mean_ms) + " ms ");
        val.appendChild(el("span", null, "p95 " + fmtMs(s.p95_ms)));
        row.appendChild(val);
        row.title = (s.name || "") + "\nmean " + fmtMs(s.mean_ms) + " ms | median " + fmtMs(s.median_ms) + " | p95 " + fmtMs(s.p95_ms) +
          "\nmin " + fmtMs(s.min_ms) + " | max " + fmtMs(s.max_ms) + " | std " + fmtMs(s.std_ms);
        bars.appendChild(row);
      });
      chart.appendChild(bars);
      host.appendChild(chart);

      var det = el("details", "card more");
      det.appendChild(el("summary", null, "Full stage statistics (ms)"));
      det.appendChild(table(["Stage", "Group", "Mean", "Median", "p95", "Min", "Max", "Std"],
        stages.map(function (s) { return [s.name || "", s.group || "", fmtMs(s.mean_ms), fmtMs(s.median_ms), fmtMs(s.p95_ms), fmtMs(s.min_ms), fmtMs(s.max_ms), fmtMs(s.std_ms)]; }), 2));
      host.appendChild(det);
    }

    /* throughput + models | machine + config */
    var grid = el("div", "bench-grid");
    var left = el("div", "card");
    left.appendChild(el("h4", null, "Classifier throughput"));
    if (thr.length) {
      left.appendChild(table(["Model", "Batch", "Samples / s", "ms / sample"],
        thr.map(function (t) { return [t.model || "", fmtInt(t.batch), fmtRate(t.samples_per_s), fmtMs(t.ms_per_sample)]; }), 1));
    } else left.appendChild(el("p", "small muted", "No throughput data in this run."));
    if (models.length) {
      left.appendChild(el("h4", null, "Models"));
      left.appendChild(table(["Model", "Parameters", "Accuracy (all 324 frames, incl. training; sanity check)"],
        models.map(function (m) { return [m.name || "", fmtInt(m.params), fmtAcc(m.accuracy)]; }), 1));
    }
    grid.appendChild(left);

    var right = el("div", "card");
    right.appendChild(el("h4", null, "Machine"));
    var mach = B.machine || {};
    var dl = el("dl", "meta");
    [["CPU", "cpu"], ["OS", "os"], ["GPU", "gpu"], ["Python", "python"], ["TensorFlow", "tensorflow"], ["MediaPipe", "mediapipe"], ["OpenCV", "opencv"]].forEach(function (k) {
      var v = mach[k[1]];
      if (k[1] === "gpu" && (v === false || v == null || v === "")) v = "none (CPU only)";
      if (k[1] === "os" && typeof v === "string") {  // Python reports Windows 11 as "Windows 10"; builds >= 22000 are Windows 11
        var w = /^Windows 10 \(10\.0\.(\d+)\)$/.exec(v);
        if (w && +w[1] >= 22000) v = "Windows 11 (build " + w[1] + ")";
      }
      dl.appendChild(el("dt", null, k[0])); dl.appendChild(el("dd", null, v == null || v === "" ? "n/a" : String(v)));
    });
    right.appendChild(dl);
    right.appendChild(el("h4", null, "Run"));
    var cfg = B.config || {};
    var dl2 = el("dl", "meta");
    [["Source", cfg.source], ["Warm-up", cfg.warmup], ["Iterations", cfg.iterations], ["Generated", B.generated]].forEach(function (k) {
      dl2.appendChild(el("dt", null, k[0])); dl2.appendChild(el("dd", null, k[1] == null || k[1] === "" ? "n/a" : String(k[1])));
    });
    right.appendChild(dl2);
    grid.appendChild(right);
    host.appendChild(grid);
  }
})();
