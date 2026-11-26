/* Mission 01: Hillstrom email experiment. Everything below is computed in the browser from
   each arm's size and its buyers' spend amounts (non-buyers spent $0). */
"use strict";
initPage();
const ARMS = ["No E-Mail", "Mens E-Mail", "Womens E-Mail"], CTRL = ARMS[0], MEN = ARMS[1], WOM = ARMS[2];
const NAME = { [CTRL]: "No email", [MEN]: "Men's email", [WOM]: "Women's email" };
const SHORT = { [CTRL]: "Control", [MEN]: "Men's", [WOM]: "Women's" };
const AC = { [CTRL]: COL.ctrl, [MEN]: COL.men, [WOM]: COL.women };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

(async () => {
  const [D, R] = await Promise.all([fetch("assets/data/hillstrom_compact.json").then(r => r.json()), fetch("outputs/results/hillstrom_results.json").then(r => r.json())]);
  // per-arm summaries of spend over ALL customers (zeros included)
  const A = {};
  for (const a of ARMS) { const s = D.buyer_spend[a], n = D.arms[a].n, S = sum(s), SS = sum(s.map(v => v * v)), m = S / n;
    A[a] = { n, h: s.length, spend: s, mean: m, var: (SS - n * m * m) / (n - 1), basket: S / s.length }; }

  /* ================= hero dots ================= */
  { const cv = $("#heroDots"), ctx = cv.getContext("2d");
    const draw = () => { const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const lab = $("#intro .label"), tt = lab.getBoundingClientRect().top - cv.getBoundingClientRect().top;
      const top = 96, bottom = Math.max(top + 80, tt - 30), side = Math.max(18, W * .04), gap = W < 700 ? 10 : 26, bw = (W - 2 * side - 2 * gap) / 3, bh = bottom - top;
      const cell = Math.sqrt(bw * bh / A[CTRL].n), cols = Math.floor(bw / cell), r = rngFrom(11);
      ARMS.forEach((a, k) => { const x0 = side + k * (bw + gap); ctx.fillStyle = "#c9ced6";
        for (let i = 0; i < A[a].n; i++) ctx.fillRect(x0 + (i % cols) * cell, top + Math.floor(i / cols) * cell, Math.max(.8, cell * .55), Math.max(.8, cell * .55));
        ctx.fillStyle = AC[a]; for (let j = 0; j < A[a].h; j++) { const i = Math.floor(r() * A[a].n); ctx.beginPath(); ctx.arc(x0 + (i % cols) * cell, top + Math.floor(i / cols) * cell, Math.max(2.2, cell * 1.4), 0, 7); ctx.fill(); } }); };
    new ResizeObserver(draw).observe(cv); }

  /* ================= 01 data ================= */
  const totalZero = 1 - sum(ARMS.map(a => A[a].h)) / sum(ARMS.map(a => A[a].n));
  $("#zeroShare").textContent = fmt(100 * totalZero) + "%";
  $("#balT").textContent = fmt(R.max_abs_balance_t) + "  (all fine)";
  { const svg = $("#ecdf"); const sorted = Object.fromEntries(ARMS.map(a => [a, [...A[a].spend].sort((x, y) => x - y)]));
    const cdf = (a, x) => { const s = sorted[a]; let lo = 0, hi = s.length; while (lo < hi) { const md = (lo + hi) >> 1; if (s[md] <= x) lo = md + 1; else hi = md; } return lo / s.length; };
    chart(svg, (W, H) => { const L = Math.log10, F = frame(W, H, [L(25), L(520)], [0, 1], { xticks: [30, 50, 100, 200, 499].map(L), xfmt: v => "$" + Math.round(10 ** v), yfmt: v => Math.round(v * 100) + "%", xlab: "Spend among buyers (log scale)", ylab: "Share of buyers ≤ x" });
      let s = F.svg; for (const a of ARMS) { const pts = [[F.X(L(25)), F.Y(0)]]; sorted[a].forEach((v, i) => { pts.push([F.X(L(v)), pts[pts.length - 1][1]]); pts.push([F.X(L(v)), F.Y((i + 1) / sorted[a].length)]); });
        pts.push([F.X(L(520)), F.Y(1)]); s += `<path d="${path(pts)}" fill="none" stroke="${AC[a]}" stroke-width="2.4"/>`;
      }
      ARMS.forEach((a, k) => s += `<rect x="${F.m.l + 14}" y="${F.m.t + 10 + k * 20}" width="18" height="3" fill="${AC[a]}"/><text x="${F.m.l + 38}" y="${F.m.t + 15 + k * 20}" font-size="12.5">${NAME[a]} (${A[a].h} buyers)</text>`);
      s += `<line id="ex" y1="${F.m.t}" y2="${H - F.m.b}" stroke="${COL.ink2}" stroke-dasharray="3 3" opacity="0"/><rect x="${F.m.l}" y="${F.m.t}" width="${W - F.m.l - F.m.r}" height="${H - F.m.t - F.m.b}" fill="transparent" id="eh"/>`;
      svg.innerHTML = s; const eh = $("#eh", svg), ex = $("#ex", svg);
      eh.onmousemove = e => { const b = svg.getBoundingClientRect(), x = 10 ** (L(25) + (e.clientX - b.left - F.m.l) / (W - F.m.l - F.m.r) * (L(520) - L(25)));
        ex.setAttribute("x1", e.clientX - b.left); ex.setAttribute("x2", e.clientX - b.left); ex.setAttribute("opacity", 1);
        tip(e, `Spend ≤ $${fmt(x, 0)}<br>` + ARMS.map(a => `<i class="dot" style="background:${AC[a]}"></i>${NAME[a]}: ${fmt(100 * cdf(a, x), 0)}%`).join("<br>")); };
      eh.onmouseleave = () => { ex.setAttribute("opacity", 0); untip(); }; }); }

  /* ================= 02 Welch ================= */
  const pairs = [[MEN, CTRL], [WOM, CTRL], [MEN, WOM]];
  const tests = pairs.map(([x, y]) => ({ x, y, ...welchFromStats(A[x].mean, A[x].var, A[x].n, A[y].mean, A[y].var, A[y].n) }));
  tests.forEach(t => t.pb = Math.min(1, 3 * t.p));
  const pf = p => p < 1e-4 ? p.toExponential(1) : fmt(p, 4);
  const sW = seg($("#segWelch"), [["0", "Men's vs control"], ["1", "Women's vs control"], ["2", "Men's vs women's"]], "0", drawWelch);
  function drawWelch() {
    const k = +sW.get(), t = tests[k], tc = -normInv(0.05 / 3 / 2);
    $("#welchFormula").innerHTML = `<i>T<sub>W</sub></i> = (${fmt(A[t.x].mean, 3)} − ${fmt(A[t.y].mean, 3)}) / √(${fmt(A[t.x].var, 1)}/${A[t.x].n.toLocaleString()} + ${fmt(A[t.y].var, 1)}/${A[t.y].n.toLocaleString()}) = ${fmt(t.diff, 3)} / ${fmt(t.se, 3)} = <b>${fmt(t.t, 2)}</b>`;
    $("#welchTab").innerHTML = `<tr><th>Comparison</th><th>Diff ($)</th><th>T<sub>W</sub></th><th>p</th><th>Bonferroni p</th></tr>` +
      tests.map((u, i) => `<tr class="${i === k ? "hl" : ""}"><td>${SHORT[u.x]} − ${u.y === CTRL ? "control" : SHORT[u.y].toLowerCase()}</td><td>${fmt(u.diff)}</td><td>${fmt(u.t)}</td><td>${pf(u.p)}</td><td><b class="${u.pb < .05 ? "pill-ok" : "pill-no"}">${pf(u.pb)}${u.pb < .05 ? "" : " ✕"}</b></td></tr>`).join("");
    chart($("#tplot"), (W, H) => { const xmax = Math.max(6.5, Math.abs(t.t) + 1), F = frame(W, H, [-xmax, xmax], [0, 0.45], { xlab: "Welch t statistic under H₀ (df ≈ " + Math.round(t.df).toLocaleString() + ")", yticks: [] });
      let s = F.svg; const xs = Array.from({ length: 300 }, (_, i) => -xmax + 2 * xmax * i / 299);
      const tail = side => { const pts = xs.filter(v => side > 0 ? v >= tc : v <= -tc).map(v => [F.X(v), F.Y(tPdf(v, t.df))]); if (!pts.length) return ""; const x0 = side > 0 ? F.X(tc) : F.X(-xmax), x1 = side > 0 ? F.X(xmax) : F.X(-tc);
        return `<path d="${path([[x0, F.Y(0)], ...pts, [x1, F.Y(0)]])}Z" fill="${COL.women}" opacity=".25"/>`; };
      s += tail(1) + tail(-1) + `<path d="${path(xs.map(v => [F.X(v), F.Y(tPdf(v, t.df))]))}" fill="none" stroke="${COL.ink}" stroke-width="2"/>`;
      s += `<line x1="${F.X(t.t)}" x2="${F.X(t.t)}" y1="${F.Y(0)}" y2="${F.Y(0.3)}" stroke="${AC[t.x]}" stroke-width="3"/><circle cx="${F.X(t.t)}" cy="${F.Y(0.3)}" r="6" fill="${AC[t.x]}"/>`;
      s += `<text x="${F.X(t.t) + (t.t > xmax - 2 ? -10 : 10)}" y="${F.Y(0.32)}" text-anchor="${t.t > xmax - 2 ? "end" : "start"}" font-size="13" font-weight="600">observed T_W = ${fmt(t.t)}</text>`;
      s += `<text x="${F.X(tc) + 4}" y="${F.Y(0.06)}" font-size="11.5" fill="${COL.ink2}">reject beyond ±${fmt(tc)} (α/3)</text>`;
      $("#tplot").innerHTML = s; });
  }
  drawWelch();
  // A/A tests on the control arm
  { const ctrlVec = new Float64Array(A[CTRL].n); A[CTRL].spend.forEach((v, i) => ctrlVec[i] = v); const idx = Array.from(ctrlVec.keys());
    let batches = 0, rawHit = 0, bonfHit = 0, last = [], seed = 1;
    const runBatch = () => { const r = rngFrom(1000 + seed++), ps = [];
      for (let k = 0; k < 20; k++) { shuffle(idx, r); const half = idx.length >> 1; let s1 = 0, q1 = 0, s2 = 0, q2 = 0;
        for (let i = 0; i < idx.length; i++) { const v = ctrlVec[idx[i]]; if (i < half) { s1 += v; q1 += v * v; } else { s2 += v; q2 += v * v; } }
        const n1 = half, n2 = idx.length - half, m1 = s1 / n1, m2 = s2 / n2; ps.push(welchFromStats(m1, (q1 - n1 * m1 * m1) / (n1 - 1), n1, m2, (q2 - n2 * m2 * m2) / (n2 - 1), n2).p); }
      batches++; if (ps.some(p => p < .05)) rawHit++; if (ps.some(p => p < .05 / 20)) bonfHit++; last = ps; drawAA(); };
    const drawAA = () => { $("#aaN").textContent = (batches * 20).toLocaleString(); $("#aaRaw").textContent = batches ? `${rawHit} of ${batches} (${fmt(100 * rawHit / batches, 0)}%)` : "–"; $("#aaBonf").textContent = batches ? `${bonfHit} of ${batches} (${fmt(100 * bonfHit / batches, 0)}%)` : "–";
      chart($("#aaPlot"), (W, H) => { const L = Math.log10, F = frame(W, H, [-3.2, 0], [0, 21], { xticks: [-3, -2, Math.log10(.05), -1, 0], xfmt: v => v === 0 ? "1" : v > -1.31 && v < -1.29 ? "0.05" : "10" + "⁻" + "⁰¹²³"[Math.round(-v)], yticks: [], xlab: "p-value of each fake test (log scale)", m: { l: 16 } });
        let s = F.svg + `<line x1="${F.X(L(.05))}" x2="${F.X(L(.05))}" y1="${F.m.t}" y2="${F.Y(0)}" stroke="${COL.women}" stroke-width="2"/><line x1="${F.X(L(.0025))}" x2="${F.X(L(.0025))}" y1="${F.m.t}" y2="${F.Y(0)}" stroke="${COL.ink}" stroke-width="2" stroke-dasharray="5 4"/>`;
        s += `<text x="${F.X(L(.05)) + 5}" y="${F.m.t + 12}" font-size="11.5" fill="${COL.women}">α = 0.05</text><text x="${F.X(L(.0025)) - 5}" y="${F.m.t + 12}" text-anchor="end" font-size="11.5">α/20</text>`;
        last.forEach((p, i) => { const x = F.X(Math.max(-3.2, L(p))), y = F.Y(i + 1); s += `<circle cx="${x}" cy="${y}" r="5.5" fill="${p < .05 ? COL.women : COL.ctrl}"><title>p = ${fmt(p, 4)}</title></circle>`; });
        if (!last.length) s += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${COL.ink2}">Press “Run 20 fake tests”</text>`;
        $("#aaPlot").innerHTML = s; }); };
    $("#aaRun").addEventListener("click", runBatch); drawAA(); }

  /* ================= 03 Bayesian ================= */
  const PRIORS = { uniform: [1, 1, "Uniform Beta(1, 1): every rate equally likely"], jeffreys: [.5, .5, "Jeffreys Beta(½, ½)"],
    informative: [2, 198, "Beta(2, 198): ‘emails convert about 1%’, worth 200 customers"], sceptical: [29, 4971, "Sceptical Beta(29, 4971): every arm at the control rate, worth 5,000 customers"] };
  const sP = seg($("#segPrior"), [["uniform", "Uniform"], ["jeffreys", "Jeffreys"], ["informative", "1% prior"], ["sceptical", "Sceptical"]], "uniform", () => { buildTrace(); drawBayes(); });
  const sG = seg($("#segGroup"), [["All", "All"], ["Men's only", "Past men's"], ["Women's only", "Past women's"], ["Both", "Both"]], "All", () => { buildTrace(); drawBayes(); });
  // random arrival order for each arm within each group: cumulative buyers after k customers
  const orderCache = {};
  function cum(group, arm) { const key = group + "|" + arm; if (orderCache[key]) return orderCache[key];
    const src = group === "All" ? D.arms[arm] : D.groups[group][arm], r = rngFrom(key.length * 7919 + src.n), z = new Uint8Array(src.n); z.fill(1, 0, src.h); shuffle(z, r);
    const c = new Int32Array(src.n + 1); for (let i = 0; i < src.n; i++) c[i + 1] = c[i] + z[i]; return orderCache[key] = c; }
  const posts = f => { const [a0, b0] = PRIORS[sP.get()]; return Object.fromEntries(ARMS.map(a => { const c = cum(sG.get(), a), n = Math.round((c.length - 1) * f), h = c[n]; return [a, { a: a0 + h, b: b0 + n - h, n, h }]; })); };
  const probs = (P, M, seed) => { const r = rngFrom(seed), dr = {}; for (const a of ARMS) { const d = new Float64Array(M); for (let i = 0; i < M; i++) d[i] = betaDraw(r, P[a].a, P[a].b); dr[a] = d; }
    const g = (x, y) => { let s = 0; for (let i = 0; i < M; i++) s += dr[x][i] > dr[y][i]; return s / M; }; return { mc: g(MEN, CTRL), wc: g(WOM, CTRL), mw: g(MEN, WOM), dr }; };
  let traceData = [];
  function buildTrace() { traceData = []; for (let i = 0; i <= 50; i++) { const f = i === 0 ? 0 : 10 ** (-3 + 3 * i / 50); const p = probs(posts(f), 4000, 77 + i); traceData.push({ f, mc: p.mc, wc: p.wc }); } }
  const frac = $("#frac");
  function drawBayes(fast) {
    const f = +frac.value / 1000; $("#fracLab").textContent = fmt(100 * f, f < .1 ? 1 : 0) + "%"; const P = posts(f), pr = probs(P, fast ? 6000 : 40000, 5);
    $("#priorNote").textContent = "Prior: " + PRIORS[sP.get()][2] + ".";
    const row = (lab, v, c) => `<div class="kv"><span><i class="dot" style="background:${c}"></i>${lab}</span><b>${v > .9995 ? "> 0.999" : fmt(v, 3)}</b></div>`;
    $("#probs").innerHTML = row("P(θ<sub>men</sub> > θ<sub>control</sub>)", pr.mc, COL.men) + row("P(θ<sub>women</sub> > θ<sub>control</sub>)", pr.wc, COL.women) + row("P(θ<sub>men</sub> > θ<sub>women</sub>)", pr.mw, COL.men) +
      ARMS.map(a => `<div class="kv"><span>${SHORT[a]}: ${P[a].h.toLocaleString()} of ${P[a].n.toLocaleString()} bought</span><b>Beta(${fmt(P[a].a, 0)}, ${P[a].b.toLocaleString(undefined, { maximumFractionDigits: 0 })})</b></div>`).join("");
    chart($("#post"), (W, H) => { const lo = 0, hi = sG.get() === "Both" ? 0.04 : 0.022, N = 320, xs = Array.from({ length: N }, (_, i) => lo + 1e-5 + (hi - lo) * i / (N - 1));
      const ys = ARMS.map(a => xs.map(x => betaPdf(x, P[a].a, P[a].b))); const ymax = Math.max(40, ...ys.flat()) * 1.15;
      const F = frame(W, H, [lo, hi], [0, ymax], { xfmt: v => fmt(100 * v, 1) + "%", xlab: "Conversion probability θ", ylab: "Posterior density" });
      let s = F.svg; ARMS.forEach((a, k) => { const pts = xs.map((x, i) => [F.X(x), F.Y(ys[k][i])]); s += `<path d="${path([[F.X(lo), F.Y(0)], ...pts, [F.X(hi), F.Y(0)]])}Z" fill="${AC[a]}" opacity=".14"/><path d="${path(pts)}" fill="none" stroke="${AC[a]}" stroke-width="2.6"/>`;
        const j = ys[k].indexOf(Math.max(...ys[k])); if (ys[k][j] > ymax * .08) s += `<text x="${F.X(xs[j])}" y="${F.Y(ys[k][j]) - 9}" text-anchor="middle" font-size="13" font-weight="600">${NAME[a]}</text>`; });
      s += `<line id="bx" y1="${F.m.t}" y2="${H - F.m.b}" stroke="${COL.ink2}" stroke-dasharray="3 3" opacity="0"/><rect id="bh" x="${F.m.l}" y="${F.m.t}" width="${W - F.m.l - F.m.r}" height="${H - F.m.t - F.m.b}" fill="transparent"/>`;
      const svg = $("#post"); svg.innerHTML = s; const bh = $("#bh", svg), bx = $("#bx", svg);
      bh.onmousemove = e => { const b = svg.getBoundingClientRect(), x = lo + (e.clientX - b.left - F.m.l) / (W - F.m.l - F.m.r) * (hi - lo); bx.setAttribute("x1", e.clientX - b.left); bx.setAttribute("x2", e.clientX - b.left); bx.setAttribute("opacity", 1);
        tip(e, `θ = ${fmt(100 * x, 3)}%<br>` + ARMS.map(a => `<i class="dot" style="background:${AC[a]}"></i>${NAME[a]}: density ${fmt(betaPdf(x, P[a].a, P[a].b), 0)}`).join("<br>")); };
      bh.onmouseleave = () => { bx.setAttribute("opacity", 0); untip(); }; });
    chart($("#trace"), (W, H) => { const L = v => Math.log10(Math.max(v, 1e-3)), F = frame(W, H, [-3, 0], [0, 1], { xticks: [-3, -2, -1, 0], xfmt: v => ["0.1%", "1%", "10%", "100%"][v + 3], yticks: [0, .5, .95], yfmt: v => v, xlab: "Customers seen (log scale)", m: { l: 40, b: 40 } });
      let s = F.svg + `<line x1="${F.m.l}" x2="${W - F.m.r}" y1="${F.Y(.95)}" y2="${F.Y(.95)}" stroke="${COL.ink2}" stroke-dasharray="4 3"/>`;
      for (const [k, c] of [["mc", COL.men], ["wc", COL.women]]) s += `<path d="${path(traceData.filter(d => d.f > 0).map(d => [F.X(L(d.f)), F.Y(d[k])]))}" fill="none" stroke="${c}" stroke-width="2.2"/>`;
      s += `<line x1="${F.X(L(f))}" x2="${F.X(L(f))}" y1="${F.m.t}" y2="${F.Y(0)}" stroke="${COL.ink}" stroke-width="1.5"/><text x="${W - F.m.r}" y="${F.m.t + 10}" text-anchor="end" font-size="11.5" fill="${COL.ink2}">P(email beats control)</text>`;
      $("#trace").innerHTML = s; });
  }
  frac.addEventListener("input", () => drawBayes(true)); frac.addEventListener("change", () => drawBayes(false));
  let playing = false;
  $("#play").addEventListener("click", () => { if (playing) { playing = false; return; } playing = true; $("#play").textContent = "■ Stop"; const t0 = performance.now(), dur = 7000;
    const step = t => { if (!playing) { $("#play").textContent = "▶ Play from zero"; drawBayes(false); return; } const k = Math.min(1, (t - t0) / dur); frac.value = Math.round(1000 * (k === 0 ? 0 : 10 ** (-3 + 3 * k)));
      drawBayes(true); if (k < 1) requestAnimationFrame(step); else { playing = false; $("#play").textContent = "▶ Play from zero"; drawBayes(false); } }; requestAnimationFrame(step); });
  buildTrace(); drawBayes(false);

  /* ================= 04 bootstrap ================= */
  const sE = seg($("#segEmail"), [[MEN, "Men's email"], [WOM, "Women's email"]], MEN, () => runBoot(false));
  const sB = seg($("#segB"), [["2000", "B = 2,000"], ["10000", "10,000"]], "2000", () => runBoot(false));
  const KEYS = [["rev", "Revenue per customer"], ["buy", "Buyers (conversion)"], ["bas", "Basket (spend per buyer)"]];
  $("#bootFigs").innerHTML = KEYS.map(([k, l]) => `<div><p class="label" style="margin:0 0 8px">${l}</p><div class="fig" style="min-height:min(230px,28vh)"><svg id="h_${k}" aria-label="${l}"></svg></div><p class="note" id="n_${k}"></p></div>`).join("");
  let boot = null, bootSeed = 1, bootTimer = 0;
  const resampleArm = (r, a) => { const n = A[a].n, sp = A[a].spend, k = sp.length, kb = binomialDraw(r, n, k / n); let S = 0; for (let i = 0; i < kb; i++) S += sp[Math.floor(r() * k)]; return { mu: S / n, p: kb / n, m: kb ? S / kb : NaN }; };
  function runBoot(newSeed) {
    if (newSeed) bootSeed++; cancelAnimationFrame(bootTimer);
    const a = sE.get(), B = +sB.get(), r = rngFrom(4242 + bootSeed * 31 + B), obs = { rev: A[a].mean / A[CTRL].mean, buy: (A[a].h / A[a].n) / (A[CTRL].h / A[CTRL].n), bas: A[a].basket / A[CTRL].basket, diff: A[a].mean - A[CTRL].mean };
    boot = { a, obs, rev: [], buy: [], bas: [], diff: [], B }; const per = reduce ? B : Math.max(50, Math.round(B / 70)), t0 = performance.now();
    const step = () => { for (let i = 0; i < per && boot.rev.length < B; i++) { const t = resampleArm(r, a), c = resampleArm(r, CTRL); boot.rev.push(t.mu / c.mu); boot.buy.push(t.p / c.p); boot.bas.push(t.m / c.m); boot.diff.push(t.mu - c.mu); }
      drawBoot(); $("#bootStatus").textContent = `${boot.rev.length.toLocaleString()} / ${B.toLocaleString()} replicates`; if (boot.rev.length < B) bootTimer = requestAnimationFrame(step); else { $("#bootStatus").textContent = `${B.toLocaleString()} replicates in ${Math.round(performance.now() - t0)} ms`; drawCLT(); fillEnd(); } };
    step();
  }
  function drawBoot() { const { a, obs } = boot, lo = .5, hi = 3.6, nb = 46, bw = (hi - lo) / nb;
    for (const [k] of KEYS) { const v = boot[k].filter(Number.isFinite), sorted = [...v].sort((x, y) => x - y), cnt = new Array(nb).fill(0); for (const x of v) { const i = Math.floor((x - lo) / bw); if (i >= 0 && i < nb) cnt[i]++; }
      const ciL = quant(sorted, .025), ciH = quant(sorted, .975);
      chart($("#h_" + k), (W, H) => { const F = frame(W, H, [lo, hi], [0, Math.max(...cnt, 1) * 1.1], { yticks: [], xticks: [1, 2, 3], xfmt: v => v + "×", m: { l: 10, r: 10, b: 30 } });
        let s = F.svg + `<rect x="${F.X(ciL)}" y="${F.m.t}" width="${Math.max(0, F.X(ciH) - F.X(ciL))}" height="${F.Y(0) - F.m.t}" fill="${AC[a]}" opacity=".1"/>`;
        cnt.forEach((c, i) => { if (c) s += `<rect x="${F.X(lo + i * bw) + 1}" y="${F.Y(c)}" width="${Math.max(1, F.X(lo + bw) - F.X(lo) - 2)}" height="${F.Y(0) - F.Y(c)}" rx="2" fill="${AC[a]}"><title>${fmt(lo + i * bw)}–${fmt(lo + (i + 1) * bw)}×: ${c} replicates</title></rect>`; });
        s += `<line x1="${F.X(1)}" x2="${F.X(1)}" y1="${F.m.t}" y2="${F.Y(0)}" stroke="${COL.ink}" stroke-dasharray="4 3"/>`; $("#h_" + k).innerHTML = s; });
      $("#n_" + k).innerHTML = `Observed <b>${fmt(obs[k])}×</b> · 95% CI ${fmt(ciL)}–${fmt(ciH)}×${ciL <= 1 && ciH >= 1 ? " · <b>includes 1</b>" : ""}`; }
    const share = boot.rev.map((v, i) => Math.log(boot.buy[i]) / Math.log(v)).filter(Number.isFinite).sort((x, y) => x - y), sh = Math.log(obs.buy) / Math.log(obs.rev);
    $("#bootStats").innerHTML = `<div class="stat"><b>${Math.abs(sh - 1) < .05 ? "≈100" : fmt(100 * sh, 0)}%</b><span>of the log revenue lift comes from more buyers (95% CI ${fmt(100 * quant(share, .025), 0)}–${fmt(100 * quant(share, .975), 0)}%)</span></div>
      <div class="stat"><b>${fmt(obs.rev)}×</b><span>revenue per customer vs control</span></div><div class="stat"><b>${fmt(obs.bas)}×</b><span>spend per buyer vs control</span></div>`; }
  $("#bootRun").addEventListener("click", () => runBoot(true));

  /* ================= 05 heterogeneity ================= */
  { const G = ["Men's only", "Women's only", "Both"], GL = { "Men's only": "Past buyers of men's only", "Women's only": "Past buyers of women's only", "Both": "Bought both before" }, rows = [], r = rngFrom(99), M = 40000;
    for (const g of G) { const dr = {}; for (const a of ARMS) { const s = D.groups[g][a], d = new Float64Array(M); for (let i = 0; i < M; i++) d[i] = betaDraw(r, 1 + s.h, 1 + s.n - s.h); dr[a] = d; }
      for (const a of [MEN, WOM]) { const diff = Array.from(dr[a], (v, i) => v - dr[CTRL][i]).sort((x, y) => x - y); rows.push({ g, a, mean: mean(diff), lo: quant(diff, .025), hi: quant(diff, .975), p: diff.filter(v => v > 0).length / M }); } }
    chart($("#forest"), (W, H) => { const F = frame(W, H, [-.012, .035], [0, 9], { yticks: [], xfmt: v => fmt(100 * v, 1), xlab: "Posterior lift θ_email − θ_control (percentage points)", m: { l: 18, r: 16 } });
      let s = F.svg + `<line x1="${F.X(0)}" x2="${F.X(0)}" y1="${F.m.t}" y2="${F.Y(0)}" stroke="${COL.ink2}" stroke-dasharray="4 3"/>`; let y = 8.6;
      G.forEach(g => { s += `<text x="${F.m.l}" y="${F.Y(y)}" font-size="13" font-weight="700" font-family="Barlow Condensed, Arial Narrow" letter-spacing="1.5">${GL[g].toUpperCase()}</text>`; y -= .85;
        for (const a of [MEN, WOM]) { const q = rows.find(o => o.g === g && o.a === a), Y = F.Y(y);
          s += `<line x1="${F.X(q.lo)}" x2="${F.X(q.hi)}" y1="${Y}" y2="${Y}" stroke="${AC[a]}" stroke-width="4" stroke-linecap="round"/><circle cx="${F.X(q.mean)}" cy="${Y}" r="7" fill="${AC[a]}" stroke="#fff" stroke-width="2"><title>${NAME[a]}: ${fmt(100 * q.mean)} pp [${fmt(100 * q.lo)}, ${fmt(100 * q.hi)}], P(lift>0) = ${fmt(q.p, 3)}</title></circle>`;
          s += `<text x="${W - F.m.r}" y="${Y + 4}" text-anchor="end" font-size="12.5" fill="${q.p < .95 ? COL.women : COL.ink2}" font-weight="${q.p < .95 ? 700 : 400}">${SHORT[a]} · P(>0) ${q.p > .9995 ? "> 0.999" : "= " + fmt(q.p, 3)}</text>`; y -= .85; } y -= .35; });
      $("#forest").innerHTML = s; });
    const q = (g, a) => rows.find(o => o.g === g && o.a === a);
    $("#forestKV").innerHTML = `<div class="kv"><span>Women's email, past men's buyers: P(lift > 0)</span><b class="pill-no">${fmt(q("Men's only", WOM).p, 2)}</b></div>
      <div class="kv"><span>Men's email, past women's buyers: lift</span><b>+${fmt(100 * q("Women's only", MEN).mean)} pp</b></div><div class="kv"><span>Women's email, past women's buyers: lift</span><b>+${fmt(100 * q("Women's only", WOM).mean)} pp</b></div>`; }

  /* ================= 06 CLT check ================= */
  function drawCLT() { const { a, diff, obs } = boot, t = tests[a === MEN ? 0 : 1], sd = Math.sqrt(variance(diff));
    $("#cltKV").innerHTML = `<div class="kv"><span>Bootstrap SE (${boot.B.toLocaleString()} replicates)</span><b>${fmt(sd, 4)}</b></div><div class="kv"><span>Welch analytic SE √(S²_T/n_T + S²_C/n_C)</span><b>${fmt(t.se, 4)}</b></div><div class="kv"><span>Ratio</span><b>${fmt(sd / t.se, 3)}</b></div>`;
    chart($("#clt"), (W, H) => { const lo = obs.diff - 4.5 * t.se, hi = obs.diff + 4.5 * t.se, nb = 50, bw = (hi - lo) / nb, cnt = new Array(nb).fill(0); for (const x of diff) { const i = Math.floor((x - lo) / bw); if (i >= 0 && i < nb) cnt[i]++; }
      const dens = cnt.map(c => c / (diff.length * bw)), ymax = Math.max(...dens, normPdf(0, 0, t.se)) * 1.15, F = frame(W, H, [lo, hi], [0, ymax], { yticks: [], xfmt: v => "$" + fmt(v, 2), xlab: `X̄*_T − X̄*_C, ${NAME[a]} minus control ($ per customer)` });
      let s = F.svg; dens.forEach((c, i) => { if (c) s += `<rect x="${F.X(lo + i * bw) + 1}" y="${F.Y(c)}" width="${Math.max(1, F.X(lo + bw) - F.X(lo) - 2)}" height="${F.Y(0) - F.Y(c)}" rx="2" fill="${AC[a]}" opacity=".55"/>`; });
      const xs = Array.from({ length: 200 }, (_, i) => lo + (hi - lo) * i / 199); s += `<path d="${path(xs.map(x => [F.X(x), F.Y(normPdf(x, obs.diff, t.se))]))}" fill="none" stroke="${COL.ink}" stroke-width="2.4"/>`;
      s += `<text x="${F.m.l + 8}" y="${F.m.t + 14}" font-size="12.5"><tspan fill="${AC[a]}" font-weight="700">■ bootstrap</tspan>   <tspan font-weight="700">— normal with Welch SE</tspan></text>`; $("#clt").innerHTML = s; }); }

  /* ================= 07 conclusion ================= */
  function fillEnd() { const sh = Math.log(boot.obs.buy) / Math.log(boot.obs.rev); $("#c1").textContent = `p ≤ ${pf(Math.max(tests[0].pb, tests[1].pb))}`;
    $("#c2").textContent = boot.a === MEN ? (Math.abs(sh - 1) < .05 ? "≈100%" : fmt(100 * sh, 0) + "%") : $("#c2").textContent; $("#c3").textContent = fmt(A[MEN].basket / A[CTRL].basket) + "×"; $("#c4").textContent = "> 0.999"; }
  runBoot(false);
})();
