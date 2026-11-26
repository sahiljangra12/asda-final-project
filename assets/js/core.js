/* Shared helpers for every page: maths, random numbers, statistics, SVG charts, tooltip, nav, present mode.
   Everything the pages show is computed here in the browser from the course datasets. */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (x, d = 2) => Number.isFinite(x) ? x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sum = a => { let s = 0; for (const v of a) s += v; return s; };
const mean = a => sum(a) / a.length;
const variance = a => { const m = mean(a); let s = 0; for (const v of a) s += (v - m) ** 2; return s / (a.length - 1); };
const quant = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const COL = { men: "#257de0", women: "#f47230", ctrl: "#8c8c8c", aqua: "#00a884", violet: "#6a4ce2", ink: "#0b0c0e", ink2: "#5b6068", line: "#dde1e7" };
const AGE_RAMP = ["#9dc8f7", "#6aabf1", "#338ced", "#2370cd", "#1757ac", "#0e3d7e"];

/* ---------------- random numbers (seeded) ---------------- */
function rngFrom(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function normal(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
function gammaDraw(r, k) {   // Marsaglia–Tsang
  if (k < 1) return gammaDraw(r, k + 1) * Math.pow(r(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = normal(r); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = r();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v; }
}
const betaDraw = (r, a, b) => { const x = gammaDraw(r, a); return x / (x + gammaDraw(r, b)); };
function binomialDraw(r, n, p) {   // geometric jumps: exact, fast for small p
  if (p <= 0) return 0; if (p >= 1) return n;
  const lq = Math.log(1 - p); let k = 0, pos = Math.floor(Math.log(1 - r()) / lq);
  while (pos < n) { k++; pos += 1 + Math.floor(Math.log(1 - r()) / lq); }
  return k;
}
function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

/* ---------------- special functions ---------------- */
function lgamma(x) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); }
const betaPdf = (x, a, b) => Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - (lgamma(a) + lgamma(b) - lgamma(a + b)));
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
  return h; }
function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
const tSf2 = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);          // two-sided P(|T| > |t|)
const tPdf = (t, df) => Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log(1 + t * t / df));
const normPdf = (x, m = 0, s = 1) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
function normInv(p) {  // Acklam
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425; let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }

/* ---------------- Lecture 8: Welch ---------------- */
function welchFromStats(m1, v1, n1, m2, v2, n2) {
  const a = v1 / n1, b = v2 / n2, se = Math.sqrt(a + b), t = (m1 - m2) / se;
  const df = (a + b) ** 2 / (a * a / (n1 - 1) + b * b / (n2 - 1));
  return { diff: m1 - m2, se, t, df, p: tSf2(t, df) };
}
const welch = (x, y) => welchFromStats(mean(x), variance(x), x.length, mean(y), variance(y), y.length);

/* ---------------- linear algebra for regression (Lectures 12-16) ---------------- */
function solveSym(A, b) {   // Gaussian elimination with partial pivoting; A is p x p (array of rows)
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) {
    let piv = k; for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
    [M[k], M[piv]] = [M[piv], M[k]];
    for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; if (f) for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}
function invSym(A) { const n = A.length; return A.map((_, j) => solveSym(A, A.map((_, i) => +(i === j)))).map((col, j, all) => all.map(c => c[j])); }
function gram(X) { const n = X.length, p = X[0].length, G = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let r = 0; r < n; r++) { const x = X[r]; for (let i = 0; i < p; i++) { const xi = x[i]; if (xi) for (let j = i; j < p; j++) G[i][j] += xi * x[j]; } }
  for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) G[i][j] = G[j][i]; return G; }
function xty(X, y) { const p = X[0].length, v = new Array(p).fill(0); for (let r = 0; r < X.length; r++) for (let i = 0; i < p; i++) v[i] += X[r][i] * y[r]; return v; }
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
/* OLS: beta = (X^T X)^{-1} X^T y; X includes the 1s column */
function ols(X, y) {
  const G = gram(X), beta = solveSym(G, xty(X, y)), n = X.length, q = X[0].length;
  const fitted = X.map(r => dot(r, beta)), resid = y.map((v, i) => v - fitted[i]);
  const rss = sum(resid.map(e => e * e)), sigma2 = rss / (n - q), ybar = mean(y), tss = sum(y.map(v => (v - ybar) ** 2));
  const Ginv = invSym(G), se = Ginv.map((r, i) => Math.sqrt(sigma2 * r[i]));
  return { beta, se, fitted, resid, rss, sigma2, n, q, r2: 1 - rss / tss, Ginv };
}
function hatDiag(X, Ginv) { return X.map(x => { let s = 0; for (let i = 0; i < x.length; i++) { let t = 0; for (let j = 0; j < x.length; j++) t += Ginv[i][j] * x[j]; s += x[i] * t; } return s; }); }
function gaussianIC(rss, n, k) { const m2ll = n * Math.log(rss / n) + n * Math.log(2 * Math.PI) + n; return { aic: m2ll + 2 * k, bic: m2ll + k * Math.log(n) }; }
function eigSymMinMax(A) {   // Jacobi rotations; fine for p <= 50
  const n = A.length, M = A.map(r => [...r]);
  for (let sweep = 0; sweep < 60; sweep++) { let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += M[p][q] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) { if (Math.abs(M[p][q]) < 1e-300) continue;
      const th = (M[q][q] - M[p][p]) / (2 * M[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const mkp = M[k][p], mkq = M[k][q]; M[k][p] = c * mkp - s * mkq; M[k][q] = s * mkp + c * mkq; }
      for (let k = 0; k < n; k++) { const mpk = M[p][k], mqk = M[q][k]; M[p][k] = c * mpk - s * mqk; M[q][k] = s * mpk + c * mqk; } } }
  const ev = M.map((r, i) => r[i]); return { min: Math.min(...ev), max: Math.max(...ev) }; }
function standardize(Xtr, Xte) {
  const p = Xtr[0].length, mu = new Array(p).fill(0), sd = new Array(p).fill(0);
  for (const r of Xtr) for (let j = 0; j < p; j++) mu[j] += r[j] / Xtr.length;
  for (const r of Xtr) for (let j = 0; j < p; j++) sd[j] += (r[j] - mu[j]) ** 2 / Xtr.length;
  for (let j = 0; j < p; j++) sd[j] = Math.sqrt(sd[j]) || 1;
  const f = X => X.map(r => r.map((v, j) => (v - mu[j]) / sd[j]));
  return { Ztr: f(Xtr), Zte: Xte ? f(Xte) : null, mu, sd };
}
/* ridge: argmin ||y - b0 - Z b||^2 + lam ||b||^2  (closed form on centred data) */
function ridge(Z, y, lam) {
  const p = Z[0].length, zbar = new Array(p).fill(0), ybar = mean(y);
  for (const r of Z) for (let j = 0; j < p; j++) zbar[j] += r[j] / Z.length;
  const Zc = Z.map(r => r.map((v, j) => v - zbar[j])), yc = y.map(v => v - ybar), G = gram(Zc);
  for (let j = 0; j < p; j++) G[j][j] += lam;
  const b = solveSym(G, xty(Zc, yc)); return { b0: ybar - dot(zbar, b), b };
}
/* lasso: argmin ||y - b0 - Z b||^2 + lam ||b||_1, coordinate descent with soft-thresholding (Gram form) */
function lassoPrep(Z, y) {
  const p = Z[0].length, zbar = new Array(p).fill(0), ybar = mean(y);
  for (const r of Z) for (let j = 0; j < p; j++) zbar[j] += r[j] / Z.length;
  const Zc = Z.map(r => r.map((v, j) => v - zbar[j])), yc = y.map(v => v - ybar);
  return { G: gram(Zc), c: xty(Zc, yc), zbar, ybar, p };
}
function lassoCD(prep, lam, init, tol = 1e-7, maxIter = 3000) {
  const { G, c, p } = prep, b = init ? [...init] : new Array(p).fill(0), Gb = new Array(p).fill(0);
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) Gb[i] += G[i][j] * b[j];
  const h = lam / 2;
  for (let it = 0; it < maxIter; it++) { let mx = 0;
    for (let j = 0; j < p; j++) { const old = b[j], rho = c[j] - Gb[j] + G[j][j] * old;
      const nw = (rho > h ? rho - h : rho < -h ? rho + h : 0) / G[j][j];
      if (nw !== old) { const d = nw - old; for (let i = 0; i < p; i++) Gb[i] += G[i][j] * d; b[j] = nw; mx = Math.max(mx, Math.abs(d)); } }
    if (mx < tol) break; }
  return { b0: prep.ybar - dot(prep.zbar, b), b };
}
/* grouped K-fold: whole groups go to one fold */
function groupFolds(groups, K, seed) { const r = rngFrom(seed), u = shuffle([...new Set(groups)], r), f = new Map(); u.forEach((g, i) => f.set(g, i % K));
  return Array.from({ length: K }, (_, k) => groups.map((g, i) => f.get(g) === k ? i : -1).filter(i => i >= 0)); }

/* ---------------- SVG chart helpers ---------------- */
function niceTicks(a, b, n = 6) { if (!(b > a)) return [a]; const s0 = (b - a) / n, p = 10 ** Math.floor(Math.log10(s0)), e = s0 / p;
  const st = (e >= 5 ? 10 : e >= 2 ? 5 : e >= 1 ? 2 : 1) * p, out = []; for (let t = Math.ceil(a / st) * st; t <= b + st * 1e-9; t += st) out.push(+t.toFixed(10)); return out; }
const scale = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
/* draw axes; returns {X, Y, inner} */
function frame(W, H, xd, yd, o = {}) {
  const m = Object.assign({ l: 52, r: 16, t: 16, b: 44 }, o.m || {}), X = scale(xd[0], xd[1], m.l, W - m.r), Y = scale(yd[0], yd[1], H - m.b, m.t);
  const xt = o.xticks || niceTicks(xd[0], xd[1], W < 480 ? 4 : 7), yt = o.yticks || niceTicks(yd[0], yd[1], H < 260 ? 3 : 5);
  const xf = o.xfmt || (v => v), yf = o.yfmt || (v => v);
  let s = `<g class="axis">`;
  for (const t of yt) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${yf(t)}</text>`;
  for (const t of xt) s += `<text x="${X(t)}" y="${H - m.b + 18}" text-anchor="middle">${xf(t)}</text>`;
  s += `<line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}" class="zero"/></g>`;
  if (o.xlab) s += `<text class="axis-title" x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle">${o.xlab}</text>`;
  if (o.ylab) s += `<text class="axis-title" transform="translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">${o.ylab}</text>`;
  return { X, Y, m, svg: s };
}
/* attach a redraw function to an svg inside .fig, re-run on resize */
const figs = [];
function chart(svg, draw) { const f = () => { const W = svg.clientWidth, H = svg.clientHeight; if (W && H) draw(W, H); }; const ro = new ResizeObserver(f); ro.observe(svg); figs.push(f); f(); return f; }
const path = pts => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");

/* ---------------- tooltip ---------------- */
const tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.setAttribute("role", "tooltip"); document.body.appendChild(tipEl);
function tip(e, html) { tipEl.innerHTML = html; tipEl.style.opacity = 1; const x = Math.min(e.clientX + 16, innerWidth - tipEl.offsetWidth - 10), y = Math.min(e.clientY + 16, innerHeight - tipEl.offsetHeight - 10); tipEl.style.left = x + "px"; tipEl.style.top = y + "px"; }
const untip = () => tipEl.style.opacity = 0;

/* ---------------- segmented control ---------------- */
function seg(el, options, init, onChange) { let cur = init;
  el.innerHTML = options.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === init}">${esc(l)}</button>`).join("");
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; cur = b.dataset.v; el.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); onChange(cur); });
  return { get: () => cur, set: v => { cur = v; el.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === v)); } };
}

/* ---------------- nav, chapter dots, present mode ---------------- */
function initPage() {
  const nav = $(".nav"); const onScroll = () => nav && nav.classList.toggle("scrolled", scrollY > 10); addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const chapters = $$(".chapter, .hero");
  if (chapters.length > 2) {
    const dots = document.createElement("nav"); dots.className = "dots"; dots.setAttribute("aria-label", "Chapters");
    dots.innerHTML = chapters.map((c, i) => `<a href="#${c.id}" title="${esc(c.dataset.title || c.id)}" aria-label="${esc(c.dataset.title || c.id)}"></a>`).join("");
    document.body.appendChild(dots);
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { const i = chapters.indexOf(en.target); $$("a", dots).forEach((a, j) => a.classList.toggle("on", i === j)); } }), { threshold: 0.5 });
    chapters.forEach(c => io.observe(c));
  }
  const hint = document.createElement("div"); hint.className = "present-hint"; hint.textContent = "Present mode · ← → or space to move · Esc to exit"; document.body.appendChild(hint);
  const pb = $(".present-btn");
  const go = d => { const ys = chapters.map(c => c.getBoundingClientRect().top); let i = ys.findIndex(y => y > 5); if (i < 0) i = chapters.length; const target = d > 0 ? i : Math.max(0, i - 2); if (chapters[target]) chapters[target].scrollIntoView({ behavior: "smooth" }); };
  const setPresent = on => { document.documentElement.classList.toggle("present", on); if (pb) pb.textContent = on ? "Exit" : "Present"; hint.classList.toggle("show", on); if (on) setTimeout(() => hint.classList.remove("show"), 3500);
    if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  if (pb) pb.addEventListener("click", () => setPresent(!document.documentElement.classList.contains("present")));
  addEventListener("keydown", e => { if (!document.documentElement.classList.contains("present")) return; if (e.target.closest("input,textarea,select,.CodeMirror")) return;
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    if (e.key === "Escape") setPresent(false); });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && document.documentElement.classList.contains("present")) setPresent(false); });
  // count-up for .countup elements
  const cio = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; const el = en.target, to = +el.dataset.to, d = +(el.dataset.d || 0), suf = el.dataset.suf || "", pre = el.dataset.pre || ""; cio.unobserve(el);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = pre + fmt(to, d) + suf; return; }
    const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 1100), e2 = 1 - (1 - k) ** 3; el.textContent = pre + fmt(to * e2, d) + suf; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }), { threshold: 0.6 });
  $$(".countup").forEach(el => cio.observe(el));
}
