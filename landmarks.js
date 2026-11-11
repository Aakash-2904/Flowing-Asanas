/* Interactive map of the 33 MediaPipe Pose landmarks (drawn here, not a copied image).
   Hover, tap or use the keyboard on a point or a list row to see its index, name,
   where it sits in the 66-value feature vector, and how the app uses it. */
(function () {
  var root = document.getElementById("lm-viz");
  if (!root) return;

  var NAMES = ["nose", "left eye (inner)", "left eye", "left eye (outer)", "right eye (inner)", "right eye",
    "right eye (outer)", "left ear", "right ear", "mouth (left)", "mouth (right)", "left shoulder",
    "right shoulder", "left elbow", "right elbow", "left wrist", "right wrist", "left pinky", "right pinky",
    "left index", "right index", "left thumb", "right thumb", "left hip", "right hip", "left knee",
    "right knee", "left ankle", "right ankle", "left heel", "right heel", "left foot index", "right foot index"];

  // Front-facing figure, as the camera sees it: the person's right side is on the image's left.
  var XY = [[150, 66], [157, 54], [164, 54], [171, 54], [143, 54], [136, 54], [129, 54], [184, 62], [116, 62],
    [158, 82], [142, 82], [195, 120], [105, 120], [222, 180], [78, 180], [240, 238], [60, 238], [258, 258],
    [42, 258], [246, 274], [54, 274], [226, 258], [74, 258], [176, 248], [124, 248], [182, 328], [118, 328],
    [186, 398], [114, 398], [176, 414], [124, 414], [210, 422], [90, 422]];
  // label offsets [dx, dy, anchor] for the crowded face, hand and foot points
  var LBL = { 1: [0, -7, "middle"], 2: [0, -7, "middle"], 3: [0, -7, "middle"], 4: [0, -7, "middle"],
    5: [0, -7, "middle"], 6: [0, -7, "middle"], 9: [0, 11, "middle"], 10: [0, 11, "middle"],
    17: [7, 3, "start"], 18: [-7, 3, "end"], 19: [0, 12, "middle"], 20: [0, 12, "middle"],
    21: [-6, -5, "end"], 22: [6, -5, "start"], 29: [-4, 11, "end"], 30: [4, 11, "start"],
    31: [7, 3, "start"], 32: [-7, 3, "end"] };

  // mp.solutions.pose.POSE_CONNECTIONS
  var BONES = [[0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10], [11, 12], [11, 13],
    [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
    [27, 31], [28, 32]];

  function group(i) {
    if (i <= 10) return "face";
    if (i <= 22) return "arms";
    if (i <= 24) return "torso";
    return "legs";
  }
  function side(i) {
    if (i === 0) return "C";
    return /^left/.test(NAMES[i]) || i === 9 ? "L" : "R";
  }
  var GATE = [15, 16, 27, 28], TORSO = [11, 12, 23, 24];
  function roles(i) {
    var r = [];
    if (i === 0) r.push("Origin: its (x, y) is subtracted from every landmark, so where you stand doesn't matter.");
    if (GATE.indexOf(i) >= 0) r.push("Frame gate: inFrame() needs visibility > 0.6 here, or the frame is skipped and the timer stops.");
    if (TORSO.indexOf(i) >= 0) r.push("Torso length: the notebook divides by the shoulder-to-hip distance, so body size and camera distance drop out.");
    if (!r.length) r.push("Input to the classifier like every other landmark.");
    return r;
  }

  var FILTERS = [["all", "All 33"], ["used", "Used by the app"], ["face", "Face 0–10"], ["arms", "Arms & hands 11–22"],
    ["torso", "Hips 23–24"], ["legs", "Legs & feet 25–32"], ["tlen", "Torso length"]];
  function inFilter(i, f) {
    if (f === "all") return true;
    if (f === "used") return i === 0 || GATE.indexOf(i) >= 0 || TORSO.indexOf(i) >= 0;
    if (f === "torso" || f === "tlen") return TORSO.indexOf(i) >= 0;
    return group(i) === f;
  }

  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---- controls
  var bar = document.createElement("div");
  bar.className = "lm-filters";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Highlight landmarks");
  FILTERS.forEach(function (f) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = f[1];
    b.dataset.f = f[0];
    b.setAttribute("aria-pressed", String(f[0] === "all"));
    bar.appendChild(b);
  });
  var numToggle = document.createElement("label");
  numToggle.className = "lm-toggle";
  numToggle.innerHTML = '<input type="checkbox" checked> Show numbers';
  bar.appendChild(numToggle);

  // ---- figure
  var fig = document.createElement("div");
  fig.className = "lm-fig";
  var svg = el("svg", { viewBox: "18 36 264 400", role: "img", "aria-label": "Stick figure with the 33 MediaPipe Pose landmarks numbered 0 to 32" });
  fig.appendChild(svg);
  var bonesG = el("g", { class: "lm-bones" }, svg);
  var bones = BONES.map(function (b) {
    return el("line", { x1: XY[b[0]][0], y1: XY[b[0]][1], x2: XY[b[1]][0], y2: XY[b[1]][1], "data-a": b[0], "data-b": b[1] }, bonesG);
  });
  // origin vector arrows (nose -> point) shown on hover
  var vec = el("line", { class: "lm-vec", x1: XY[0][0], y1: XY[0][1], x2: XY[0][0], y2: XY[0][1] }, svg);
  var ptsG = el("g", { class: "lm-pts" }, svg);
  var pts = XY.map(function (p, i) {
    var g = el("g", { class: "lm-pt s-" + side(i), tabindex: "0", role: "button", "data-i": i,
      "aria-label": i + ": " + NAMES[i] }, ptsG);
    if (GATE.indexOf(i) >= 0) el("circle", { class: "lm-ring", cx: p[0], cy: p[1], r: 9 }, g);
    el("circle", { class: "lm-hit", cx: p[0], cy: p[1], r: i <= 10 || (i >= 17 && i <= 22) ? 5 : 9 }, g);
    el("circle", { class: "lm-dot", cx: p[0], cy: p[1], r: i <= 10 ? 2.6 : 4.2 }, g);
    var small = i <= 10 || (i >= 17 && i <= 22) || i >= 29;
    var o = LBL[i] || (i === 0 ? [0, 15, "middle"] : p[0] < 150 ? [-8, 3.5, "end"] : [8, 3.5, "start"]);
    var t = el("text", { class: "lm-num" + (small ? " sm" : ""), x: p[0] + o[0], y: p[1] + o[1], "text-anchor": o[2] }, g);
    t.textContent = i;
    return g;
  });
  // torso-length overlay: shoulder midpoint S, hip midpoint H and the line between them
  function mid(a, b) { return [(XY[a][0] + XY[b][0]) / 2, (XY[a][1] + XY[b][1]) / 2]; }
  var S = mid(11, 12), H = mid(23, 24);
  var tl = el("g", { class: "lm-torso", "aria-hidden": "true" }, svg);
  el("line", { class: "pair", x1: XY[12][0], y1: XY[12][1], x2: XY[11][0], y2: XY[11][1] }, tl);
  el("line", { class: "pair", x1: XY[24][0], y1: XY[24][1], x2: XY[23][0], y2: XY[23][1] }, tl);
  el("line", { class: "len", x1: S[0], y1: S[1], x2: H[0], y2: H[1] }, tl);
  el("circle", { class: "mid", cx: S[0], cy: S[1], r: 5 }, tl);
  el("circle", { class: "mid", cx: H[0], cy: H[1], r: 5 }, tl);
  [["S", S, -14], ["H", H, 18]].forEach(function (m) {
    var t = el("text", { class: "tag", x: m[1][0], y: m[1][1] + m[2], "text-anchor": "middle" }, tl);
    t.textContent = m[0];
  });
  var tt = el("text", { class: "tag len-t", x: S[0] + 8, y: (S[1] + H[1]) / 2, "text-anchor": "start" }, tl);
  tt.textContent = "torso";

  var cap = document.createElement("p");
  cap.className = "lm-cap";
  cap.innerHTML = '<span class="k s-R"></span>right side <span class="k s-L"></span>left side <span class="k ring"></span>frame-gate joint';
  fig.appendChild(cap);

  // ---- info + list
  var side_ = document.createElement("div");
  side_.className = "lm-side";
  var info = document.createElement("div");
  info.className = "lm-info";
  info.setAttribute("aria-live", "polite");
  var list = document.createElement("ol");
  list.className = "lm-list";
  list.start = 0;
  NAMES.forEach(function (n, i) {
    var li = document.createElement("li");
    li.dataset.i = i;
    li.tabIndex = -1;
    li.innerHTML = '<span class="no s-' + side(i) + '">' + i + "</span>" + n;
    list.appendChild(li);
  });
  side_.appendChild(info);
  side_.appendChild(list);

  root.appendChild(bar);
  var body = document.createElement("div");
  body.className = "lm-body";
  body.appendChild(fig);
  body.appendChild(side_);
  root.appendChild(body);

  // ---- behaviour
  var filter = "all", pinned = 0;
  function show(i) {
    pts.forEach(function (g, j) { g.classList.toggle("on", j === i); });
    [].forEach.call(list.children, function (li, j) { li.classList.toggle("on", j === i); });
    bones.forEach(function (l) {
      var a = +l.dataset.a, b = +l.dataset.b;
      l.classList.toggle("on", a === i || b === i);
    });
    vec.setAttribute("x2", XY[i][0]);
    vec.setAttribute("y2", XY[i][1]);
    vec.classList.toggle("show", i !== 0);
    var tag = { face: "Face", arms: "Arm / hand", torso: "Hip", legs: "Leg / foot" }[group(i)];
    if (i === 11 || i === 12) tag = "Shoulder";
    info.innerHTML =
      '<p class="lm-idx">Landmark <b>' + i + "</b> · " + tag + "</p>" +
      "<h4>" + NAMES[i].charAt(0).toUpperCase() + NAMES[i].slice(1) + "</h4>" +
      '<p class="lm-vecpos">Feature vector: <code>v[' + 2 * i + "] = x" + i + " − x0</code>, <code>v[" + (2 * i + 1) + "] = y" + i + " − y0</code></p>" +
      "<ul>" + roles(i).map(function (r) { return "<li>" + r + "</li>"; }).join("") + "</ul>";
  }
  function showTorso() {
    pts.forEach(function (g, j) { g.classList.toggle("on", TORSO.indexOf(j) >= 0); });
    [].forEach.call(list.children, function (li, j) { li.classList.toggle("on", TORSO.indexOf(j) >= 0); });
    bones.forEach(function (l) { l.classList.remove("on"); });
    vec.classList.remove("show");
    info.innerHTML =
      '<p class="lm-idx">Normalisation · notebook <code>to_sequence()</code></p>' +
      "<h4>Torso length</h4>" +
      '<ol class="lm-steps">' +
      "<li><b>S</b>, the shoulder midpoint, is the mean of landmarks 11 and 12.</li>" +
      "<li><b>H</b>, the hip midpoint, is the mean of landmarks 23 and 24.</li>" +
      "<li><b>torso</b> = ‖S − H‖, the straight-line distance between them.</li>" +
      "<li>Every (x, y) is divided by <code>max(torso, 1e-6)</code>, so a near-camera or tall person gives the same numbers as a far or short one.</li>" +
      "</ol>" +
      '<details class="lm-ex"><summary>Worked example: frame 0 of <code>02_high lunge.npy</code></summary>' +
      "<table><tbody>" +
      "<tr><td>11 left shoulder</td><td>(0.0080, 0.0690)</td></tr>" +
      "<tr><td>12 right shoulder</td><td>(−0.0907, 0.0184)</td></tr>" +
      "<tr><td>23 left hip</td><td>(−0.0206, 0.3554)</td></tr>" +
      "<tr><td>24 right hip</td><td>(−0.0966, 0.3678)</td></tr>" +
      "<tr><th>S</th><td>(−0.0414, 0.0437)</td></tr>" +
      "<tr><th>H</th><td>(−0.0586, 0.3616)</td></tr>" +
      "<tr><th>torso</th><td>√(0.0172² + 0.3179²) = <b>0.3184</b></td></tr>" +
      "<tr><td>15 left wrist</td><td>(0.1129, −0.1814) ÷ 0.3184 = <b>(0.3547, −0.5697)</b></td></tr>" +
      "</tbody></table><p>Values are offsets from the nose, in image units (fractions of frame width and height).</p></details>" +
      '<pre class="lm-code">' + [
        "shoulder_mid = seq[:, [11, 12]].mean(axis=1)",
        "hip_mid      = seq[:, [23, 24]].mean(axis=1)",
        "torso        = np.linalg.norm(shoulder_mid - hip_mid, axis=1)",
        "seq          = seq / np.maximum(torso, 1e-6)"].join("\n") + "</pre>" +
      '<p class="lm-note">Only the BiLSTM-Attention notebook applies this step. The live Dense scripts use the raw nose-relative offsets.</p>';
  }
  function rest() { if (filter === "tlen") showTorso(); else show(pinned); }

  function applyFilter(f) {
    filter = f;
    root.classList.toggle("tlen", f === "tlen");
    if (f === "tlen") showTorso(); else show(pinned);
    [].forEach.call(bar.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.f === f)); });
    pts.forEach(function (g, i) { g.classList.toggle("dim", !inFilter(i, f)); });
    [].forEach.call(list.children, function (li, i) { li.classList.toggle("dim", !inFilter(i, f)); });
    bones.forEach(function (l) { l.classList.toggle("dim", !(inFilter(+l.dataset.a, f) && inFilter(+l.dataset.b, f))); });
  }

  pts.forEach(function (g, i) {
    g.addEventListener("mouseenter", function () { show(i); });
    g.addEventListener("focus", function () { show(i); });
    g.addEventListener("click", function () { pinned = i; show(i); });
    g.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (d) { e.preventDefault(); pts[(i + d + 33) % 33].focus(); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pinned = i; show(i); }
    });
  });
  svg.addEventListener("mouseleave", rest);
  [].forEach.call(list.children, function (li, i) {
    li.addEventListener("mouseenter", function () { show(i); });
    li.addEventListener("click", function () { pinned = i; show(i); });
  });
  list.addEventListener("mouseleave", rest);
  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) applyFilter(b.dataset.f);
  });
  numToggle.querySelector("input").addEventListener("change", function (e) {
    root.classList.toggle("no-nums", !e.target.checked);
  });

  show(0);
  applyFilter("all");
})();
