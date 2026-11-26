/* Mission 02: Concrete compressive strength. Every regression, criterion, CV score and penalty path
   on this page is fitted in the browser from data/concrete.csv. */
"use strict";
initPage();
const tick = () => new Promise(r => setTimeout(r, 0));
const ING = ["cement", "slag", "ash", "water", "sp", "coarse", "fine"];
const ING_L = { cement: "cement", slag: "slag", ash: "fly ash", water: "water", sp: "superplast.", coarse: "coarse agg.", fine: "fine agg." };
const AGES = [3, 7, 28, 90, 365];
const ageCol = age => AGE_RAMP[age <= 3 ? 0 : age <= 7 ? 1 : age <= 14 ? 2 : age <= 28 ? 3 : age <= 100 ? 4 : 5];

(async () => {
  const txt = await (await fetch("data/concrete.csv")).text();
  const mixKey = new Map();
  const D = txt.trim().split("\n").slice(1).map(l => { const v = l.split(",").map(Number), o = {};
    ING.forEach((k, i) => o[k] = v[i]); o.age = v[7]; o.f = v[8]; o.binder = o.cement + o.slag + o.ash;
    o.wb = o.water / o.binder; o.wc = o.water / o.cement; o.slagS = o.slag / o.binder; o.ashS = o.ash / o.binder;
    o.a = Math.log(o.age / 28); o.y = Math.log(o.f); const key = ING.map(k => o[k]).join("|"); if (!mixKey.has(key)) mixKey.set(key, mixKey.size); o.mix = mixKey.get(key); return o; });
  const N = D.length;

  /* ---------- designs (first column = intercept) ---------- */
  const apow = (o, d) => Array.from({ length: d }, (_, k) => o.a ** (k + 1));
  const aname = d => Array.from({ length: d }, (_, k) => k ? `(log age)^${k + 1}` : "log age");
  const DES = {
    law: (rows, d, r = "wb") => ({ X: rows.map(o => [1, o[r], ...apow(o, d)]), names: ["intercept", r === "wb" ? "w/b" : "w/c", ...aname(d)] }),
    plus: (rows, d) => ({ X: rows.map(o => [1, o.wb, o.slagS, o.ashS, o.sp, ...apow(o, d), o.wb * o.a, o.slagS * o.a, o.ashS * o.a]), names: ["intercept", "w/b", "slag share", "ash share", "superplast.", ...aname(d), "w/b × log age", "slag share × log age", "ash share × log age"] }),
    ingr: (rows, d) => ({ X: rows.map(o => [1, ...ING.map(k => o[k]), ...apow(o, d)]), names: ["intercept", ...ING.map(k => ING_L[k]), ...aname(d)] }),
    quad: rows => { const bn = [...ING.map(k => ING_L[k]), "log age"], names = [...bn];
      for (let i = 0; i < 8; i++) for (let j = i; j < 8; j++) names.push(i === j ? `${bn[i]}²` : `${bn[i]} × ${bn[j]}`);
      return { X: rows.map(o => { const b = [...ING.map(k => o[k]), o.a], r = [1, ...b]; for (let i = 0; i < 8; i++) for (let j = i; j < 8; j++) r.push(b[i] * b[j]); return r; }), names: ["intercept", ...names] }; },
    mixed: rows => ({ X: rows.map(o => [1, o.wb, o.wc, ...ING.map(k => o[k]), o.a, o.a * o.a]), names: ["intercept", "w/b", "w/c", ...ING.map(k => ING_L[k]), "log age", "(log age)^2"] }),
  };
  /* OLS on standardized columns (better conditioning); predictions identical to raw OLS */
  function fitStd(X, y) { const Xs = X.map(r => r.slice(1)), st = standardize(Xs), Z = st.Ztr.map(r => [1, ...r]), fit = ols(Z, y);
    return { ...fit, predict: Xn => Xn.map(r => fit.beta[0] + r.slice(1).reduce((s, v, j) => s + fit.beta[j + 1] * (v - st.mu[j]) / st.sd[j], 0)) }; }
  const rmse = (y, p) => Math.sqrt(mean(y.map((v, i) => (v - p[i]) ** 2)));
  function cvOLS(rows, des, folds) { const y = rows.map(o => o.y), X = des(rows).X, sq = new Array(rows.length);
    for (const f of folds) { const inF = new Set(f), tr = rows.map((_, i) => i).filter(i => !inF.has(i)); const fit = fitStd(tr.map(i => X[i]), tr.map(i => y[i])), p = fit.predict(f.map(i => X[i])); f.forEach((i, k) => sq[i] = (y[i] - p[k]) ** 2); }
    return { mse: mean(sq), se: Math.sqrt(variance(sq) / sq.length) }; }

  /* ---------- train/test split by mixture ---------- */
  let splitSeed = 553413, train, test, folds;
  function makeSplit() { const r = rngFrom(splitSeed), mixes = shuffle([...new Set(D.map(o => o.mix))], r), hold = new Set(mixes.slice(0, Math.round(mixes.length * .2)));
    train = D.filter(o => !hold.has(o.mix)); test = D.filter(o => hold.has(o.mix)); folds = groupFolds(train.map(o => o.mix), 10, splitSeed + 1);
    $("#splitNote").textContent = `${train.length} training tests (${new Set(train.map(o => o.mix)).size} mixtures) · ${test.length} held-out tests (${hold.size} mixtures) · split #${splitSeed - 553412}`; }
  makeSplit();

  /* ---------- the law on all data (hero + chapter 02 + diagnostics) ---------- */
  const lawAll = fitLaw(2, "wb");
  function fitLaw(d, r) { const { X, names } = DES.law(D, d, r); const fit = ols(X, D.map(o => o.y)); return { ...fit, names, X, d, r }; }
  const pctPerTenth = b => 100 * (1 - Math.exp(b * 0.1));
  $("#heroStats").innerHTML = [[N.toLocaleString(), "Lab tests"], [mixKey.size, "Distinct mixtures"], [fmt(lawAll.r2, 2), "R² of the two-variable law"], ["−" + fmt(pctPerTenth(lawAll.beta[1]), 0) + "%", "Strength per +0.1 water/binder"]]
    .map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");

  /* hero: Abrams curves drawn in */
  { const svg = $("#heroCurves"); let drawn = false;
    chart(svg, (W, H) => { const lab = $("#intro .label"), tt = lab.getBoundingClientRect().top - svg.getBoundingClientRect().top, x0 = W < 800 ? 20 : W * .42;
      const X = scale(.22, .92, W < 800 ? x0 : W * .5, W - 40), Y = scale(0, 100, Math.max(200, tt - 34), 92); let s = "";
      for (const o of D) s += `<circle cx="${X(o.wb).toFixed(1)}" cy="${Y(o.f).toFixed(1)}" r="2.4" fill="${ageCol(o.age)}" opacity=".35"/>`;
      AGES.forEach((age, i) => { const ws = D.filter(o => o.age === age || (age === 90 && o.age === 91)).map(o => o.wb), lo = Math.min(...ws), hi = Math.max(...ws), pts = [];
        for (let w = lo; w <= hi + 1e-9; w += .01) { const a = Math.log(age / 28); pts.push([X(w), Y(Math.exp(lawAll.beta[0] + lawAll.beta[1] * w + lawAll.beta[2] * a + lawAll.beta[3] * a * a))]); }
        s += `<path class="hc" d="${path(pts)}" fill="none" stroke="${AGE_RAMP[i + 1]}" stroke-width="3" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${drawn ? 0 : 1}" style="transition:stroke-dashoffset 2s ${i * .25}s ease-out"/>`;
        s += `<text x="${pts[0][0] - 8}" y="${pts[0][1] + 4}" text-anchor="end" font-size="13" font-weight="600">${age} d</text>`; });
      svg.innerHTML = s; });
    setTimeout(() => { drawn = true; $$(".hc", svg).forEach(p => p.setAttribute("stroke-dashoffset", 0)); }, 300); }

  /* ---------- 01 data explorer ---------- */
  $("#nObs").textContent = N.toLocaleString(); $("#nMix").textContent = mixKey.size;
  { const ages = new Map(); D.forEach(o => { if (!ages.has(o.mix)) ages.set(o.mix, new Set()); ages.get(o.mix).add(o.age); });
    $("#nMulti").textContent = [...ages.values()].filter(s => s.size > 1).length;
    const seen = new Set(); let dup = 0; D.forEach(o => { const k = ING.map(c => o[c]).join("|") + "|" + o.age + "|" + o.f; if (seen.has(k)) dup++; seen.add(k); }); $("#nDup").textContent = dup;
    const mass = D.map(o => ING.reduce((s, k) => s + o[k], 0)); $("#mass").textContent = `${fmt(mean(mass), 0)} kg (${fmt(Math.sqrt(variance(mass)), 0)})`; }
  const XV = { wb: ["w/b", "Water / binder ratio"], wc: ["w/c", "Water / cement ratio"], cement: ["Cement", "Cement (kg/m³)"], water: ["Water", "Water (kg/m³)"], age: ["Age", "Age (days, log scale)"], slag: ["Slag", "Slag (kg/m³)"], ash: ["Fly ash", "Fly ash (kg/m³)"], sp: ["Superplast.", "Superplasticizer (kg/m³)"] };
  const sX = seg($("#segX"), Object.entries(XV).map(([k, v]) => [k, v[0]]), "wb", drawScatter), sY = seg($("#segLogY"), [["lin", "MPa"], ["log", "log MPa"]], "lin", drawScatter);
  const recipe = o => `<b>${fmt(o.f, 1)} MPa</b> at ${o.age} days<br>w/b ${fmt(o.wb)} · w/c ${fmt(o.wc)}<br>cement ${o.cement} · slag ${o.slag} · fly ash ${o.ash}<br>water ${o.water} · superplast. ${o.sp} (kg/m³)`;
  function drawScatter() { const k = sX.get(), lg = sY.get() === "log", gx = o => k === "age" ? Math.log10(o.age) : o[k], gy = o => lg ? Math.log(o.f) : o.f;
    const xs = D.map(gx), ys = D.map(gy), xd = [Math.min(...xs), Math.max(...xs)], yd = lg ? [Math.log(2), Math.log(90)] : [0, 85], pad = (xd[1] - xd[0]) * .03;
    chart($("#scatter"), (W, H) => { const F = frame(W, H, [xd[0] - pad, xd[1] + pad], yd, { xlab: XV[k][1], ylab: lg ? "log strength" : "Strength (MPa)", xfmt: k === "age" ? v => Math.round(10 ** v) : v => v, xticks: k === "age" ? [0, Math.log10(3), Math.log10(7), Math.log10(28), Math.log10(90), Math.log10(365)] : undefined, yfmt: lg ? v => fmt(v, 1) : v => v });
      let s = F.svg; D.forEach((o, i) => s += `<circle cx="${F.X(xs[i]).toFixed(1)}" cy="${F.Y(ys[i]).toFixed(1)}" r="3.2" fill="${ageCol(o.age)}" opacity=".7"/>`);
      [["≤3 d", 0], ["7 d", 1], ["28 d", 3], ["56–100 d", 4], ["≥120 d", 5]].forEach(([l, c], j) => s += `<circle cx="${W - 150}" cy="${F.m.t + 10 + j * 17}" r="5" fill="${AGE_RAMP[c]}"/><text x="${W - 140}" y="${F.m.t + 14 + j * 17}" font-size="12">${l}</text>`);
      s += `<circle id="hp" r="7" fill="none" stroke="${COL.ink}" stroke-width="2" opacity="0"/><rect id="hr" x="${F.m.l}" y="${F.m.t}" width="${W - F.m.l - F.m.r}" height="${H - F.m.t - F.m.b}" fill="transparent"/>`;
      const svg = $("#scatter"); svg.innerHTML = s; const hr = $("#hr", svg), hp = $("#hp", svg);
      hr.onmousemove = e => { const b = svg.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top; let best = 0, bd = Infinity;
        D.forEach((o, i) => { const d2 = (F.X(xs[i]) - mx) ** 2 + (F.Y(ys[i]) - my) ** 2; if (d2 < bd) { bd = d2; best = i; } });
        if (bd > 900) { hp.setAttribute("opacity", 0); return untip(); } hp.setAttribute("cx", F.X(xs[best])); hp.setAttribute("cy", F.Y(ys[best])); hp.setAttribute("opacity", 1); tip(e, recipe(D[best])); };
      hr.onmouseleave = () => { hp.setAttribute("opacity", 0); untip(); }; }); }
  drawScatter();

  /* ---------- 02 the law ---------- */
  const sR = seg($("#segRatio"), [["wb", "Water / binder"], ["wc", "Water / cement (Abrams 1918)"]], "wb", drawLaw), degEl = $("#deg");
  degEl.addEventListener("input", drawLaw);
  function drawLaw() { const d = +degEl.value, r = sR.get(); $("#degLab").textContent = d; const L = fitLaw(d, r), ic = gaussianIC(L.rss, N, L.q + 1);
    $("#coefTab").innerHTML = `<tr><th>Term</th><th>β̂</th><th>SE</th><th>t</th></tr>` + L.names.map((nm, i) => `<tr class="${i === 1 ? "hl" : ""}"><td>${nm}</td><td>${fmt(L.beta[i], 3)}</td><td>${fmt(L.se[i], 3)}</td><td>${fmt(L.beta[i] / L.se[i], 1)}</td></tr>`).join("");
    $("#lawStats").innerHTML = [[fmt(L.r2, 3), "R² (log scale)"], ["−" + fmt(pctPerTenth(L.beta[1]), 0) + "%", `per +0.1 ${r === "wb" ? "w/b" : "w/c"}`], [fmt(ic.bic, 0), "BIC"], [fmt(Math.exp(-L.beta[1]), 1), "Abrams' B = e^(−β₁)"]].map(([b, s]) => `<div class="stat"><b style="font-size:clamp(28px,3vw,40px)">${b}</b><span>${s}</span></div>`).join("");
    chart($("#curves"), (W, H) => { const xs = D.map(o => o[r]), xd = [Math.min(...xs) - .02, Math.max(...xs) + .02], F = frame(W, H, xd, [0, 90], { xlab: r === "wb" ? "Water / binder ratio" : "Water / cement ratio", ylab: "Strength (MPa)" });
      let s = F.svg; D.forEach(o => { const i = AGES.indexOf(o.age === 91 ? 90 : o.age); if (i >= 0) s += `<circle cx="${F.X(o[r]).toFixed(1)}" cy="${F.Y(o.f).toFixed(1)}" r="2.8" fill="${AGE_RAMP[i + 1]}" opacity=".45"/>`; });
      AGES.forEach((age, i) => { const ws = D.filter(o => o.age === age || (age === 90 && o.age === 91)).map(o => o[r]), lo = Math.min(...ws), hi = Math.max(...ws), pts = [];
        for (let w = lo; w <= hi + 1e-9; w += (hi - lo) / 60) { const g = { [r]: w, a: Math.log(age / 28) }; const x = [1, w, ...apow(g, d)]; pts.push([F.X(w), F.Y(Math.min(120, Math.exp(dot(L.beta, x))))]); }
        s += `<path d="${path(pts)}" fill="none" stroke="${AGE_RAMP[i + 1]}" stroke-width="3"/><text x="${pts[0][0] - 6}" y="${pts[0][1] + 4}" text-anchor="end" font-size="12.5" font-weight="600">${age} d</text>`; });
      $("#curves").innerHTML = s; }); }
  drawLaw();

  /* ---------- 03 diagnostics ---------- */
  const sS = seg($("#segScale"), [["log", "log MPa (our model)"], ["raw", "Raw MPa"]], "log", drawDiag);
  function drawDiag() { const raw = sS.get() === "raw", X = lawAll.X, y = D.map(o => raw ? o.f : o.y), fit = ols(X, y), h = hatDiag(X, fit.Ginv), q = fit.q;
    const sr = fit.resid.map((e, i) => e / Math.sqrt(fit.sigma2 * (1 - h[i]))), cook = fit.resid.map((e, i) => e * e * h[i] / (q * fit.sigma2 * (1 - h[i]) ** 2)), big = cook.map(c => c > 4 / N);
    const neg = ols(X, D.map(o => o.f)).fitted.filter(v => v < 0).length;
    $("#diagNote").textContent = raw ? `Raw scale: residuals curve, and ${neg} tests get a negative predicted strength.` : "log scale: Abrams' exponential law makes log f linear in w/b; the curvature disappears.";
    const pts = (svg, xs, ys, xl, yl, extra = "") => chart(svg, (W, H) => { const xd = [Math.min(...xs), Math.max(...xs)], yd = [Math.min(...ys), Math.max(...ys)], px = (xd[1] - xd[0]) * .04, py = (yd[1] - yd[0]) * .06;
      const F = frame(W, H, [xd[0] - px, xd[1] + px], [yd[0] - py, yd[1] + py], { xlab: xl, ylab: yl, m: { l: 44, b: 40 } }); let s = F.svg + (typeof extra === "function" ? extra(F) : "");
      xs.forEach((x, i) => s += `<circle cx="${F.X(x).toFixed(1)}" cy="${F.Y(ys[i]).toFixed(1)}" r="${big[i] ? 3.4 : 2.4}" fill="${big[i] ? COL.women : raw ? COL.ctrl : COL.men}" opacity="${big[i] ? .9 : .5}"/>`);
      s += `<rect class="hr" x="${F.m.l}" y="${F.m.t}" width="${W - F.m.l - F.m.r}" height="${H - F.m.t - F.m.b}" fill="transparent"/>`; svg.innerHTML = s;
      $(".hr", svg).onmousemove = e => { const b = svg.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top; let best = 0, bd = Infinity; xs.forEach((x, i) => { const d2 = (F.X(x) - mx) ** 2 + (F.Y(ys[i]) - my) ** 2; if (d2 < bd) { bd = d2; best = i; } });
        if (bd > 500) return untip(); tip(e, recipe(D[best]) + `<br>h<sub>ii</sub> = ${fmt(h[best], 4)} · Cook's D = ${fmt(cook[best], 4)}`); };
      $(".hr", svg).onmouseleave = untip; });
    pts($("#rvf"), fit.fitted, fit.resid, raw ? "Fitted (MPa)" : "Fitted log f", "Residual", F => `<line x1="${F.m.l}" x2="${F.X(F.X.length ? 0 : 0)}" y1="0" y2="0"/><line x1="${F.m.l}" x2="${F.m.l + 9999}" y1="${F.Y(0)}" y2="${F.Y(0)}" stroke="${COL.ink}" stroke-width="1"/>`);
    const order = sr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), theo = new Array(N), emp = new Array(N), bigQ = new Array(N);
    order.forEach(([v, i], k) => { theo[k] = normInv((k + .5) / N); emp[k] = v; bigQ[k] = big[i]; });
    chart($("#qq"), (W, H) => { const lim = [Math.min(theo[0], emp[0]) - .2, Math.max(theo[N - 1], emp[N - 1]) + .2], F = frame(W, H, lim, lim, { xlab: "Normal quantile", ylab: "Studentized residual", m: { l: 44, b: 40 } });
      let s = F.svg + `<line x1="${F.X(lim[0])}" y1="${F.Y(lim[0])}" x2="${F.X(lim[1])}" y2="${F.Y(lim[1])}" stroke="${COL.ink}"/>`; theo.forEach((t, k) => s += `<circle cx="${F.X(t).toFixed(1)}" cy="${F.Y(emp[k]).toFixed(1)}" r="2.3" fill="${raw ? COL.ctrl : COL.men}" opacity=".55"/>`); $("#qq").innerHTML = s; });
    pts($("#lev"), h, sr, "Leverage hᵢᵢ", "Studentized residual", F => `<line x1="${F.X(2 * mean(h))}" x2="${F.X(2 * mean(h))}" y1="${F.m.t}" y2="${F.Y(F.Y.length ? 0 : 0) + 9999}" stroke="${COL.ink2}" stroke-dasharray="4 3"/>`);
    const fitq = [...fit.fitted].map((v, i) => [v, fit.resid[i]]).sort((a, b) => a[0] - b[0]), t3 = Math.floor(N / 3), sdOf = a => Math.sqrt(variance(a.map(p => p[1])));
    $("#diagKV").innerHTML = `<div class="kv"><span>Residual SD, top third ÷ bottom third of fitted</span><b>${fmt(sdOf(fitq.slice(-t3)) / sdOf(fitq.slice(0, t3)), 2)}</b></div>
      <div class="kv"><span>Negative predicted strengths on the raw scale</span><b>${neg}</b></div><div class="kv"><span>Cook's D > 4/n (orange)</span><b>${big.filter(Boolean).length} · max ${fmt(Math.max(...cook), 3)}</b></div>
      <div class="kv"><span>R²</span><b>${fmt(fit.r2, 3)}</b></div><p class="note">Variance is not perfectly constant on either scale (young concrete is relatively more variable), so we judge models by out-of-sample error, which does not need it.</p>`; }
  drawDiag();
  setTimeout(() => { const kap = (X) => { const Z = standardize(X.map(r => r.slice(1))).Ztr.map(r => [1, ...r]), e = eigSymMinMax(gram(Z)); return e.max / e.min; };
    const ks = [["Law: w/b + age (d = 2)", kap(DES.law(D, 2).X)], ["7 raw ingredients + age", kap(DES.ingr(D, 2).X)], ["Quadratic expansion (44 terms)", kap(DES.quad(D).X)]];
    $("#kappa").innerHTML = ks.map(([l, k]) => `<div class="kv"><span>${l}</span><b>${k > 1e4 ? k.toExponential(1).replace("e+", " × 10^") : fmt(k, k < 10 ? 1 : 0)}</b></div>`).join("") + `<p class="note">Near-singular XᵀX inflates Var(β̂ | X) = σ²(XᵀX)⁻¹: unstable individual coefficients, even when predictions are fine.</p>`; }, 50);

  /* ---------- 04 model selection ---------- */
  let selRows = null;
  async function runSelection() { $("#cvRun").disabled = true; const rows = [];
    for (let d = 1; d <= 6; d++) { $("#cvNote").textContent = `Degree ${d}: fitting 10 folds…`; await tick();
      const { X } = DES.law(train, d), y = train.map(o => o.y), fit = fitStd(X, y), ic = gaussianIC(fit.rss, train.length, fit.q + 1), cv = cvOLS(train, rr => DES.law(rr, d), folds);
      rows.push({ d, aic: ic.aic, bic: ic.bic, cv: cv.mse, se: cv.se, r2a: 1 - (fit.rss / (train.length - fit.q)) / (variance(y)) }); selRows = rows; drawSel(); }
    $("#cvNote").textContent = "Folds are whole mixtures. Training mixtures only."; $("#cvRun").disabled = false; }
  function drawSel() { const rows = selRows; if (!rows) return; const amin = Math.min(...rows.map(r => r.aic)), bmin = Math.min(...rows.map(r => r.bic)), best = rows.reduce((a, b) => b.cv < a.cv ? b : a), dA = rows.find(r => r.aic === amin).d, dB = rows.find(r => r.bic === bmin).d;
    const d1 = rows.filter(r => r.cv <= best.cv + best.se).reduce((a, b) => b.d < a.d ? b : a).d;
    chart($("#icPlot"), (W, H) => { const ymax = Math.max(...rows.map(r => Math.max(r.aic - amin, r.bic - bmin)), 5) * 1.1, F = frame(W, H, [.7, 6.3], [0, ymax], { xticks: [1, 2, 3, 4, 5, 6], xlab: "degree d", m: { l: 40, b: 38 } }); let s = F.svg;
      for (const [k, c, m0] of [["aic", COL.men, amin], ["bic", COL.women, bmin]]) { s += `<path d="${path(rows.map(r => [F.X(r.d), F.Y(r[k] - m0)]))}" fill="none" stroke="${c}" stroke-width="2.4"/>`; rows.forEach(r => s += `<circle cx="${F.X(r.d)}" cy="${F.Y(r[k] - m0)}" r="5" fill="${c}"/>`); }
      s += `<text x="${W - 12}" y="${F.m.t + 12}" text-anchor="end" font-size="12"><tspan fill="${COL.men}" font-weight="700">AIC</tspan>  <tspan fill="${COL.women}" font-weight="700">BIC</tspan></text>`; $("#icPlot").innerHTML = s; });
    chart($("#cvPlot"), (W, H) => { const lo = Math.min(...rows.map(r => r.cv - r.se)) * .98, hi = Math.max(...rows.map(r => r.cv + r.se)) * 1.02, F = frame(W, H, [.7, 6.3], [lo, hi], { xticks: [1, 2, 3, 4, 5, 6], yfmt: v => fmt(v, 3), xlab: "degree d", m: { l: 50, b: 38 } }); let s = F.svg;
      s += `<line x1="${F.m.l}" x2="${W - F.m.r}" y1="${F.Y(best.cv + best.se)}" y2="${F.Y(best.cv + best.se)}" stroke="${COL.ink2}" stroke-dasharray="4 3"/>`;
      rows.forEach(r => s += `<line x1="${F.X(r.d)}" x2="${F.X(r.d)}" y1="${F.Y(r.cv - r.se)}" y2="${F.Y(r.cv + r.se)}" stroke="${COL.aqua}" stroke-width="2"/><circle cx="${F.X(r.d)}" cy="${F.Y(r.cv)}" r="5" fill="${COL.aqua}"/>`);
      s += `<path d="${path(rows.map(r => [F.X(r.d), F.Y(r.cv)]))}" fill="none" stroke="${COL.aqua}" stroke-width="2"/>`; $("#cvPlot").innerHTML = s; });
    $("#selTab").innerHTML = `<tr><th>d</th><th>AIC − min</th><th>BIC − min</th><th>CV MSE</th><th>± SE</th></tr>` + rows.map(r => `<tr><td>${r.d}</td><td>${fmt(r.aic - amin, 1)}${r.d === dA ? " ◀" : ""}</td><td>${fmt(r.bic - bmin, 1)}${r.d === dB ? " ◀" : ""}</td><td>${fmt(r.cv, 4)}${r.d === best.d ? " ◀" : ""}</td><td>${fmt(r.se, 4)}</td></tr>`).join("");
    $("#selNote").textContent = rows.length === 6 ? `AIC picks d = ${dA}, BIC picks d = ${dB}; every CV error lies within one SE of the best, and the one-SE rule picks d = ${d1}. Extra age terms do not help prediction, so we use d = 2.` : ""; }
  $("#cvRun").addEventListener("click", runSelection);
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); runSelection(); } }, { threshold: .3 }).observe($("#select"));

  /* ---------- 05 ridge and lasso ---------- */
  const sM = seg($("#segMethod"), [["lasso", "Lasso"], ["ridge", "Ridge"]], "lasso", rebuildReg), sF = seg($("#segFeat"), [["mixed", "Ratios + raw amounts (11)"], ["quad", "Quadratic (44)"]], "mixed", rebuildReg), lamEl = $("#lam");
  const LGRID = Array.from({ length: 41 }, (_, i) => -2 + 5 * i / 40);   // log10 lambda from -2 to 3
  let reg = null, regJob = 0;
  function regData(feat) { const des = feat === "mixed" ? DES.mixed : DES.quad, { X, names } = des(train), st = standardize(X.map(r => r.slice(1))); return { Z: st.Ztr, names: names.slice(1), y: train.map(o => o.y), des }; }
  function fitPen(method, prep, Z, y, lam, init) { return method === "ridge" ? ridge(Z, y, lam) : lassoCD(prep, lam, init); }
  async function rebuildReg() { const job = ++regJob, method = sM.get(), feat = sF.get(), R = regData(feat), prep = lassoPrep(R.Z, R.y);
    const pathB = []; let init = null; for (let i = LGRID.length - 1; i >= 0; i--) { const f = fitPen(method, prep, R.Z, R.y, 10 ** LGRID[i], init); init = f.b; pathB[i] = f.b; }
    reg = { method, feat, ...R, prep, pathB, cv: null }; drawReg();
    // grouped CV over the grid, in the background
    const errs = LGRID.map(() => new Array(train.length).fill(0)), { X } = R.des(train);
    for (const f of folds) { if (job !== regJob) return; await tick(); const inF = new Set(f), tr = train.map((_, i) => i).filter(i => !inF.has(i)), st = standardize(tr.map(i => X[i].slice(1)), f.map(i => X[i].slice(1))), ytr = tr.map(i => R.y[i]), pp = lassoPrep(st.Ztr, ytr);
      let b = null; for (let li = LGRID.length - 1; li >= 0; li--) { const fit = fitPen(method, pp, st.Ztr, ytr, 10 ** LGRID[li], b); b = fit.b; st.Zte.forEach((z, k) => errs[li][f[k]] = (R.y[f[k]] - (fit.b0 + dot(fit.b, z))) ** 2); } }
    if (job !== regJob) return; reg.cv = errs.map(e => ({ mse: mean(e), se: Math.sqrt(variance(e) / e.length) })); drawReg(); }
  function drawReg() { if (!reg) return; const ll = +lamEl.value / 100, lam = 10 ** ll; $("#lamLab").textContent = fmt(ll, 2);
    const fit = fitPen(reg.method, reg.prep, reg.Z, reg.y, lam, null), b = fit.b, nz = b.filter(v => Math.abs(v) > 1e-9).length;
    const hl = { "w/b": COL.men, "w/c": COL.women, "log age": COL.aqua, "(log age)^2": COL.violet };
    let idx = b.map((_, i) => i); if (reg.feat === "quad") idx = idx.sort((i, j) => Math.abs(b[j]) - Math.abs(b[i])).slice(0, 16);
    chart($("#coefBars"), (W, H) => { const mx = Math.max(.35, ...reg.pathB[0].map(Math.abs).slice(0, 1)), lim = reg.feat === "mixed" ? .45 : Math.max(.3, ...idx.map(i => Math.abs(b[i]))) * 1.1, lw = Math.min(150, W * .32);
      const X = scale(-lim, lim, lw + 10, W - 14), rh = (H - 40) / idx.length; let s = `<line x1="${X(0)}" x2="${X(0)}" y1="10" y2="${H - 26}" stroke="${COL.ink}"/>`;
      idx.forEach((i, k) => { const y = 14 + k * rh, v = clamp(b[i], -lim, lim), c = hl[reg.names[i]] || COL.ctrl;
        s += `<text x="${lw}" y="${y + rh * .6}" text-anchor="end" font-size="${rh < 20 ? 11 : 12.5}">${esc(reg.names[i])}</text><rect x="${Math.min(X(0), X(v))}" y="${y + rh * .18}" width="${Math.abs(X(v) - X(0))}" height="${rh * .64}" rx="3" fill="${c}" opacity="${Math.abs(b[i]) > 1e-9 ? 1 : .2}"><title>${esc(reg.names[i])}: ${fmt(b[i], 4)}</title></rect>`;
        if (Math.abs(b[i]) < 1e-9 && reg.method === "lasso") s += `<text x="${X(0) + 6}" y="${y + rh * .6}" font-size="11" fill="${COL.ink2}">0 (dropped)</text>`; });
      niceTicks(-lim, lim, 4).forEach(t => s += `<text x="${X(t)}" y="${H - 8}" text-anchor="middle" font-size="11.5" fill="${COL.ink2}">${t}</text>`);
      $("#coefBars").innerHTML = s; });
    chart($("#pathPlot"), (W, H) => { const all = reg.pathB.flat(), lim = Math.max(...all.map(Math.abs)) * 1.05, F = frame(W, H, [-2, 3], [-lim, lim], { xlab: "log₁₀ λ", yfmt: v => fmt(v, 2), m: { l: 44, b: 38 } }); let s = F.svg;
      reg.names.forEach((nm, j) => { const c = hl[nm]; s += `<path d="${path(LGRID.map((g, i) => [F.X(g), F.Y(reg.pathB[i][j])]))}" fill="none" stroke="${c || "#b9bec6"}" stroke-width="${c ? 2.4 : 1}"/>`; });
      s += `<line x1="${F.X(ll)}" x2="${F.X(ll)}" y1="${F.m.t}" y2="${F.Y(-lim)}" stroke="${COL.ink}" stroke-width="2"/>`; $("#pathPlot").innerHTML = s; });
    chart($("#lamCV"), (W, H) => { if (!reg.cv) { $("#lamCV").innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${COL.ink2}" font-size="13">Running grouped 10-fold CV…</text>`; return; }
      const ms = reg.cv.map(c => c.mse), F = frame(W, H, [-2, 3], [Math.min(...ms) * .95, Math.max(...ms) * 1.03], { xlab: "log₁₀ λ", yfmt: v => fmt(v, 3), m: { l: 50, b: 38 } }), im = ms.indexOf(Math.min(...ms));
      let s = F.svg + `<path d="${path(LGRID.map((g, i) => [F.X(g), F.Y(ms[i])]))}" fill="none" stroke="${reg.method === "lasso" ? COL.men : COL.women}" stroke-width="2.4"/><circle cx="${F.X(LGRID[im])}" cy="${F.Y(ms[im])}" r="5" fill="${COL.ink}"/>`;
      s += `<line x1="${F.X(ll)}" x2="${F.X(ll)}" y1="${F.m.t}" y2="${H - F.m.b}" stroke="${COL.ink}" stroke-dasharray="3 3"/>`; $("#lamCV").innerHTML = s; });
    const cvNow = reg.cv ? reg.cv[Math.round((ll + 2) / 5 * 40)] : null, im = reg.cv ? reg.cv.reduce((a, c, i, arr) => c.mse < arr[a].mse ? i : a, 0) : null;
    $("#regNote").textContent = `${reg.method === "lasso" ? "Lasso" : "Ridge"} at λ = ${lam < 1 ? fmt(lam, 3) : fmt(lam, 1)}: ${nz} of ${b.length} coefficients non-zero` + (cvNow ? ` · CV MSE ${fmt(cvNow.mse, 4)}` : "") + (im !== null ? ` · CV minimum at log₁₀ λ = ${fmt(LGRID[im], 2)}` : ""); }
  lamEl.addEventListener("input", drawReg);
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); rebuildReg(); } }, { threshold: .2 }).observe($("#reg"));

  /* ---------- 06 held-out comparison ---------- */
  let cmpJob = 0, cmpRows = null;
  async function runCompare() { const job = ++cmpJob; $("#reshuffle").disabled = true; const y = test.map(o => o.y), out = [];
    const olsSpecs = [["Abrams w/c + age", r => DES.law(r, 2, "wc")], ["Abrams w/b + age", r => DES.law(r, 2, "wb")], ["w/b + binder composition", r => DES.plus(r, 2)], ["7 raw amounts + age", r => DES.ingr(r, 2)], ["Quadratic (44), OLS", r => DES.quad(r)]];
    for (const [lab, des] of olsSpecs) { await tick(); if (job !== cmpJob) return; const fit = fitStd(des(train).X, train.map(o => o.y)), p = fit.predict(des(test).X), cv = cvOLS(train, des, folds);
      out.push({ lab, cv: Math.sqrt(cv.mse), test: rmse(y, p), k: fit.q }); cmpRows = [...out]; drawCompare(); }
    // ridge and lasso on the quadratic expansion, lambda by grouped CV on a coarse grid
    const grid = [-2, -1.5, -1, -.5, 0, .5, 1, 1.5, 2], { X } = DES.quad(train), Xte = DES.quad(test).X, ytr = train.map(o => o.y);
    for (const method of ["ridge", "lasso"]) { const errs = grid.map(() => []);
      for (const f of folds) { await tick(); if (job !== cmpJob) return; const inF = new Set(f), tr = train.map((_, i) => i).filter(i => !inF.has(i)), st = standardize(tr.map(i => X[i].slice(1)), f.map(i => X[i].slice(1))), yy = tr.map(i => ytr[i]), pp = lassoPrep(st.Ztr, yy); let b = null;
        for (let g = grid.length - 1; g >= 0; g--) { const fit = fitPen(method, pp, st.Ztr, yy, 10 ** grid[g], b); b = fit.b; st.Zte.forEach((z, k) => errs[g].push((ytr[f[k]] - fit.b0 - dot(fit.b, z)) ** 2)); } }
      const ms = errs.map(mean), gi = ms.indexOf(Math.min(...ms)), st = standardize(X.map(r => r.slice(1)), Xte.map(r => r.slice(1))), fit = fitPen(method, lassoPrep(st.Ztr, ytr), st.Ztr, ytr, 10 ** grid[gi], null);
      out.push({ lab: `Quadratic, ${method} (λ by CV)`, cv: Math.sqrt(ms[gi]), test: rmse(y, st.Zte.map(z => fit.b0 + dot(fit.b, z))), k: null }); cmpRows = [...out]; drawCompare(); }
    $("#reshuffle").disabled = false; fillEnd(); }
  function drawCompare() { const rows = cmpRows; if (!rows) return;
    chart($("#cmpPlot"), (W, H) => { const lw = Math.min(210, W * .38), X = scale(0, .4, lw + 12, W - 70), rh = (H - 50) / 7; let s = "";
      rows.forEach((r, k) => { const y = 10 + k * rh; s += `<text x="${lw}" y="${y + rh * .5}" text-anchor="end" font-size="12.5">${esc(r.lab)}</text>`;
        s += `<rect x="${X(0)}" y="${y + rh * .1}" width="${X(r.cv) - X(0)}" height="${rh * .36}" rx="3" fill="${COL.men}"><title>CV RMSE ${fmt(r.cv, 3)}</title></rect><rect x="${X(0)}" y="${y + rh * .5}" width="${X(r.test) - X(0)}" height="${rh * .36}" rx="3" fill="${COL.women}"><title>Test RMSE ${fmt(r.test, 3)}</title></rect>`;
        s += `<text x="${X(Math.max(r.cv, r.test)) + 6}" y="${y + rh * .58}" font-size="12" font-weight="600">${fmt(r.test, 3)}</text>`; });
      [0, .1, .2, .3, .4].forEach(t => s += `<line x1="${X(t)}" x2="${X(t)}" y1="6" y2="${H - 34}" stroke="${COL.line}"/><text x="${X(t)}" y="${H - 18}" text-anchor="middle" font-size="11.5" fill="${COL.ink2}">${t}</text>`);
      s += `<text x="${lw + 12}" y="${H - 2}" font-size="12"><tspan fill="${COL.men}" font-weight="700">■ grouped CV</tspan>   <tspan fill="${COL.women}" font-weight="700">■ held-out mixtures</tspan>   RMSE of log strength</text>`; $("#cmpPlot").innerHTML = s; });
    const g = l => rows.find(r => r.lab === l); if (g("7 raw amounts + age") && g("w/b + binder composition")) {
      const wb = g("Abrams w/b + age").test, pl = g("w/b + binder composition").test, ig = g("7 raw amounts + age").test, best = Math.min(...rows.map(r => r.test));
      $("#cmpKV").innerHTML = `<div class="kv"><span>The law (w/b + age, 4 coefficients)</span><b>${fmt(wb, 3)}</b></div><div class="kv"><span>+ binder composition (10 coefficients)</span><b>${fmt(pl, 3)}</b></div><div class="kv"><span>7 raw amounts instead (10 coefficients)</span><b>${fmt(ig, 3)}</b></div>
        <div class="kv"><span>Share of the gap to the best model closed by the composition model</span><b>${fmt(100 * (wb - pl) / (wb - best), 0)}%</b></div>`; } }
  $("#reshuffle").addEventListener("click", () => { splitSeed++; makeSplit(); runCompare(); if (reg) rebuildReg(); if (selRows) runSelection(); });
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); runCompare(); } }, { threshold: .2 }).observe($("#compare"));

  /* ---------- 07 binder composition ---------- */
  const plusFit = (() => { const { X, names } = DES.plus(D, 2); return { ...ols(X, D.map(o => o.y)), names }; })();
  const sC = seg($("#segSCM"), [["slag", "Blast-furnace slag"], ["ash", "Fly ash"]], "slag", drawGain), shareEl = $("#share"), wbEl = $("#wbIn");
  const predF = (wb, slagS, ashS, age) => { const a = Math.log(age / 28); return Math.exp(dot(plusFit.beta, [1, wb, slagS, ashS, 6.2, a, a * a, wb * a, slagS * a, ashS * a])); };
  function drawGain() { const sh = +shareEl.value / 100, wb = +wbEl.value / 100, isSlag = sC.get() === "slag"; $("#shareLab").textContent = Math.round(sh * 100) + "%"; $("#wbLab").textContent = fmt(wb);
    const base = age => predF(wb, 0, 0, age), rep = age => predF(wb, isSlag ? sh : 0, isSlag ? 0 : sh, age), c = isSlag ? COL.aqua : COL.violet;
    chart($("#gain"), (W, H) => { const L = Math.log10, ages = Array.from({ length: 80 }, (_, i) => 10 ** (i / 79 * L(365))), ymax = Math.max(...ages.map(base), ...ages.map(rep)) * 1.12;
      const F = frame(W, H, [0, L(365)], [0, ymax], { xticks: [0, L(3), L(7), L(28), L(90), L(365)], xfmt: v => Math.round(10 ** v) + " d", xlab: "Curing age (log scale)", ylab: "Predicted strength (MPa)" });
      let s = F.svg + `<path d="${path(ages.map(a => [F.X(L(a)), F.Y(base(a))]))}" fill="none" stroke="${COL.ink}" stroke-width="2.6"/><path d="${path(ages.map(a => [F.X(L(a)), F.Y(rep(a))]))}" fill="none" stroke="${c}" stroke-width="3"/>`;
      s += `<text x="${F.X(L(365)) - 4}" y="${F.Y(base(365)) + (rep(365) > base(365) ? 16 : -8)}" text-anchor="end" font-size="12.5" font-weight="600">All cement</text><text x="${F.X(L(365)) - 4}" y="${F.Y(rep(365)) + (rep(365) > base(365) ? -8 : 16)}" text-anchor="end" font-size="12.5" font-weight="600" fill="${c}">${Math.round(sh * 100)}% ${isSlag ? "slag" : "fly ash"}</text>`;
      $("#gain").innerHTML = s; });
    $("#gainKV").innerHTML = [7, 28, 90, 365].map(a => { const d = 100 * (rep(a) / base(a) - 1); return `<div class="kv"><span>At ${a} days</span><b class="${d >= 0 ? "pill-ok" : "pill-no"}">${d >= 0 ? "+" : ""}${fmt(d, 0)}%</b></div>`; }).join(""); }
  [shareEl, wbEl].forEach(el => el.addEventListener("input", drawGain)); drawGain();

  /* ---------- 08 conclusion ---------- */
  function fillEnd() { const g = l => cmpRows && cmpRows.find(r => r.lab === l); const wc = fitLaw(2, "wc");
    $("#endKV").innerHTML = `<div class="kv"><span>Variance of log strength explained by w/b + age</span><b>${fmt(100 * lawAll.r2, 0)}%</b></div>
      <div class="kv"><span>…by Abrams' original w/c + age</span><b>${fmt(100 * wc.r2, 0)}%</b></div><div class="kv"><span>Strength per +0.1 water/binder</span><b>−${fmt(pctPerTenth(lawAll.beta[1]), 0)}%</b></div>
      ${g("w/b + binder composition") ? `<div class="kv"><span>Held-out error: law → + composition → best</span><b>${fmt(g("Abrams w/b + age").test, 3)} → ${fmt(g("w/b + binder composition").test, 3)} → ${fmt(Math.min(...cmpRows.map(r => r.test)), 3)}</b></div>` : ""}
      <div class="kv"><span>First variables the lasso selects</span><b>w/b and log age</b></div>`; }
  fillEnd();
})();
