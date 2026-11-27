/* Mission 02 story page. Screens 2-5 and 7 are fitted in the browser from data/concrete.csv;
   the held-out comparison (screen 6) and the model-selection table come from the Python analysis
   (outputs/results/concrete_results.json). The technical page recomputes those live too. */
"use strict";
initPage();
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ING = ["cement", "slag", "ash", "water", "sp", "coarse", "fine"];
const ING_L = { cement: "cement", slag: "slag", ash: "fly ash", water: "water", sp: "superplast.", coarse: "coarse agg.", fine: "fine agg." };
const AGES = [3, 7, 28, 90, 365], AGE_L = { 3: "3 days", 7: "1 week", 28: "4 weeks", 90: "3 months", 365: "1 year" };
const ageCol = age => AGE_RAMP[age <= 3 ? 0 : age <= 7 ? 1 : age <= 14 ? 2 : age <= 28 ? 3 : age <= 100 ? 4 : 5];
const pct = x => (x >= 0 ? "+" : "−") + fmt(Math.abs(100 * x), 0) + "%";

/* ---------- slide navigator: buttons and arrow keys ---------- */
{ const slides = $$("section[id^=s]"), lab = $("#slideLab"); let cur = 0;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { cur = slides.indexOf(e.target); lab.textContent = `${cur + 1} / ${slides.length} · ${e.target.dataset.title}`; } }), { threshold: 0.45 });
  slides.forEach(s => io.observe(s));
  const go = d => { const i = clamp(cur + d, 0, slides.length - 1); slides[i].scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); };
  $("#prevS").onclick = () => go(-1); $("#nextS").onclick = () => go(1);
  addEventListener("keydown", e => { if (document.documentElement.classList.contains("present") || e.target.closest("input,textarea,select,button,summary")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(1); } if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); } }); }

(async () => {
  const [txt, R] = await Promise.all([fetch("data/concrete.csv").then(r => r.text()), fetch("outputs/results/concrete_results.json").then(r => r.json())]);
  const mixKey = new Map();
  const D = txt.trim().split("\n").slice(1).map(l => { const v = l.split(",").map(Number), o = {};
    ING.forEach((k, i) => o[k] = v[i]); o.age = v[7]; o.f = v[8]; o.binder = o.cement + o.slag + o.ash;
    o.wb = o.water / o.binder; o.wc = o.water / o.cement; o.a = Math.log(o.age / 28); o.y = Math.log(o.f);
    const key = ING.map(k => o[k]).join("|"); if (!mixKey.has(key)) mixKey.set(key, mixKey.size); o.mix = mixKey.get(key); return o; });
  const N = D.length, nMix = mixKey.size;
  const recipe = o => `<b>${fmt(o.f, 1)} MPa</b> after ${o.age} day${o.age > 1 ? "s" : ""}<br>water / binder ${fmt(o.wb)}<br>cement ${o.cement} · slag ${o.slag} · fly ash ${o.ash}<br>water ${o.water} (kg/m³)`;

  /* the law: log f = b0 + b1 w/b + b2 a + b3 a^2, on all data */
  const lawX = (rows, r = "wb") => rows.map(o => [1, o[r], o.a, o.a * o.a]);
  const law = ols(lawX(D), D.map(o => o.y)), lawWC = ols(lawX(D, "wc"), D.map(o => o.y));
  const predF = (wb, age) => { const a = Math.log(age / 28); return Math.exp(law.beta[0] + law.beta[1] * wb + law.beta[2] * a + law.beta[3] * a * a); };
  const sig = Math.sqrt(law.sigma2);

  /* ---------- 1 · hero: every cylinder + the law drawn in ---------- */
  { const svg = $("#heroCurves"); let drawn = false;
    chart(svg, (W, H) => { const wide = W > 900, tt = $("#s1 .kicker").getBoundingClientRect().top - svg.getBoundingClientRect().top;
      const X = scale(.22, .92, wide ? W * .56 : 24, W - 40), Y = scale(0, 95, wide ? H - 90 : Math.max(200, tt - 34), wide ? 110 : 96); let s = "";
      for (const o of D) s += `<circle cx="${X(o.wb).toFixed(1)}" cy="${Y(o.f).toFixed(1)}" r="2.4" fill="${ageCol(o.age)}" opacity=".35"/>`;
      AGES.forEach((age, i) => { const pts = []; for (let w = .25; w <= .9 + 1e-9; w += .01) if (predF(w, age) <= 95) pts.push([X(w), Y(predF(w, age))]);
        s += `<path class="hc" d="${path(pts)}" fill="none" stroke="${AGE_RAMP[i + 1]}" stroke-width="3" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${drawn ? 0 : 1}" style="transition:stroke-dashoffset 2s ${i * .25}s ease-out"/>`;
        s += `<text x="${pts[pts.length - 1][0] + 6}" y="${pts[pts.length - 1][1] + 4}" font-size="13" font-weight="600">${AGE_L[age]}</text>`; });
      s += `<text x="${X(.22)}" y="${Y(95) - 12}" font-size="13" fill="${COL.ink2}">STRENGTH ↑ · MORE WATER PER KILO OF BINDER →</text>`;
      svg.innerHTML = s; });
    setTimeout(() => { drawn = true; $$(".hc", svg).forEach(p => p.setAttribute("stroke-dashoffset", 0)); }, 300); }

  /* ---------- 2 · the data ---------- */
  $("#nObs").textContent = N.toLocaleString(); $("#nMix").textContent = nMix;
  { const ages = new Map(); D.forEach(o => { if (!ages.has(o.mix)) ages.set(o.mix, new Set()); ages.get(o.mix).add(o.age); });
    $("#nMulti").textContent = [...ages.values()].filter(s => s.size > 1).length;
    const seen = new Set(); let dup = 0; D.forEach(o => { const k = ING.map(c => o[c]).join("|") + "|" + o.age + "|" + o.f; if (seen.has(k)) dup++; seen.add(k); }); $("#nDup").textContent = dup; }
  chart($("#scatter"), (W, H) => { const F = frame(W, H, [.2, .94], [0, 88], { xlab: "Water / binder ratio (kg water per kg binder)", ylab: "Strength (MPa)" });
    let s = F.svg; D.forEach(o => s += `<circle cx="${F.X(o.wb).toFixed(1)}" cy="${F.Y(o.f).toFixed(1)}" r="3.3" fill="${ageCol(o.age)}" opacity=".7"/>`);
    [["3 days or less", 0], ["1 week", 1], ["4 weeks", 3], ["2–3 months", 4], ["4 months +", 5]].forEach(([l, c], j) => s += `<circle cx="${W - 120}" cy="${F.m.t + 10 + j * 18}" r="5" fill="${AGE_RAMP[c]}"/><text x="${W - 110}" y="${F.m.t + 14 + j * 18}" font-size="12.5">${l}</text>`);
    s += `<circle id="hp" r="7" fill="none" stroke="${COL.ink}" stroke-width="2" opacity="0"/><rect id="hr" x="${F.m.l}" y="${F.m.t}" width="${W - F.m.l - F.m.r}" height="${H - F.m.t - F.m.b}" fill="transparent"/>`;
    const svg = $("#scatter"); svg.innerHTML = s; const hr = $("#hr", svg), hp = $("#hp", svg);
    hr.onmousemove = e => { const b = svg.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top; let best = 0, bd = Infinity;
      D.forEach((o, i) => { const d2 = (F.X(o.wb) - mx) ** 2 + (F.Y(o.f) - my) ** 2; if (d2 < bd) { bd = d2; best = i; } });
      if (bd > 900) { hp.setAttribute("opacity", 0); return untip(); } hp.setAttribute("cx", F.X(D[best].wb)); hp.setAttribute("cy", F.Y(D[best].f)); hp.setAttribute("opacity", 1); tip(e, recipe(D[best])); };
    hr.onmouseleave = () => { hp.setAttribute("opacity", 0); untip(); }; });

  /* ---------- 3 · the law, with a predictor ---------- */
  $("#r2").textContent = fmt(100 * law.r2, 0) + "%"; $("#r2wc").textContent = fmt(lawWC.r2, 2);
  $("#per01").textContent = fmt(100 * (1 - Math.exp(.1 * law.beta[1])), 0) + "%";
  $("#tWB").textContent = fmt(Math.abs(law.beta[1] / law.se[1]), 0); $("#slope28").textContent = fmt(R.law28.beta[1], 2); $("#slopeAll").textContent = fmt(law.beta[1], 2);
  $("#coefTab").innerHTML = `<div class="scroll"><table><tr><th>Term</th><th>β̂</th><th>SE</th><th>t</th></tr>` + ["intercept", "w/b", "a = log(age/28)", "a²"].map((nm, i) => `<tr><td>${nm}</td><td>${fmt(law.beta[i], 3)}</td><td>${fmt(law.se[i], 3)}</td><td>${fmt(law.beta[i] / law.se[i], 1)}</td></tr>`).join("") + `</table></div><p>Fitted here on all ${N} tests: R² = ${fmt(law.r2, 3)}, σ̂ = ${fmt(sig, 3)} on the log scale. The written report fits the same model on the ${R.summary.n_train} training tests only (t for w/b = ${fmt(R.law.t_wb, 1)}); the conclusion is identical.</p>`;
  const sA = seg($("#segAge"), AGES.map(a => [String(a), AGE_L[a]]), "28", drawLaw), wbEl = $("#wb"); wbEl.addEventListener("input", drawLaw);
  function drawLaw() { const wb = +wbEl.value / 100, age = +sA.get(), f = predF(wb, age); $("#wbLab").textContent = fmt(wb, 2);
    $("#pred").textContent = fmt(f, 0) + " MPa"; $("#predCI").textContent = `Half of real cylinders like this land between ${fmt(f * Math.exp(-.674 * sig), 0)} and ${fmt(f * Math.exp(.674 * sig), 0)} MPa`;
    chart($("#curves"), (W, H) => { const F = frame(W, H, [.22, .92], [0, 95], { xlab: "Water / binder ratio", ylab: "Strength (MPa)" }); let s = F.svg;
      D.filter(o => o.age === age || (age === 90 && o.age === 91)).forEach(o => s += `<circle cx="${F.X(o.wb).toFixed(1)}" cy="${F.Y(o.f).toFixed(1)}" r="3" fill="${AGE_RAMP[AGES.indexOf(age) + 1]}" opacity=".35"/>`);
      AGES.forEach((g, i) => { const pts = []; for (let w = .25; w <= .9 + 1e-9; w += .01) pts.push([F.X(w), F.Y(Math.min(95, predF(w, g)))]);
        s += `<path d="${path(pts)}" fill="none" stroke="${AGE_RAMP[i + 1]}" stroke-width="${g === age ? 4 : 1.6}" opacity="${g === age ? 1 : .5}"/>`; });
      s += `<line x1="${F.X(wb)}" x2="${F.X(wb)}" y1="${F.Y(0)}" y2="${F.Y(f)}" stroke="${COL.ink}" stroke-dasharray="4 3"/><circle cx="${F.X(wb)}" cy="${F.Y(Math.min(95, f))}" r="8" fill="${COL.women}" stroke="#fff" stroke-width="2"/>`;
      $("#curves").innerHTML = s; }); }
  drawLaw();

  /* ---------- 4 · diagnostics ---------- */
  const sS = seg($("#segScale"), [["raw", "Raw MPa"], ["log", "log MPa"]], "raw", drawDiag);
  const negRaw = ols(lawX(D), D.map(o => o.f)).fitted.filter(v => v < 0).length; $("#nNeg").textContent = negRaw;
  function drawDiag() { const raw = sS.get() === "raw", X = lawX(D), fit = ols(X, D.map(o => raw ? o.f : o.y)), h = hatDiag(X, fit.Ginv), q = fit.q;
    const cook = fit.resid.map((e, i) => e * e * h[i] / (q * fit.sigma2 * (1 - h[i]) ** 2)), big = cook.map(c => c > 4 / N);
    const xs = fit.fitted, ys = fit.resid, xd = [Math.min(...xs), Math.max(...xs)], lim = Math.max(...ys.map(Math.abs)) * 1.05, px = (xd[1] - xd[0]) * .04;
    // running median of residuals: shows the bend
    const ord = xs.map((x, i) => [x, ys[i]]).sort((a, b) => a[0] - b[0]), k = 60, trend = [];
    for (let i = k; i < ord.length - k; i += 10) { const w = ord.slice(i - k, i + k).map(p => p[1]).sort((a, b) => a - b); trend.push([ord[i][0], w[w.length >> 1]]); }
    chart($("#rvf"), (W, H) => { const F = frame(W, H, [xd[0] - px, xd[1] + px], [-lim, lim], { xlab: raw ? "Predicted strength (MPa)" : "Predicted log strength", ylab: "Error (actual − predicted)", m: { l: 56 } }); let s = F.svg;
      if (raw) s += `<rect x="${F.X(xd[0] - px)}" y="${F.m.t}" width="${Math.max(0, F.X(0) - F.X(xd[0] - px))}" height="${F.Y(-lim) - F.m.t}" fill="${COL.women}" opacity=".1"/><text x="${F.X(xd[0] - px) + 6}" y="${F.m.t + 16}" font-size="12.5" fill="${COL.women}" font-weight="600">predicted below 0 MPa</text>`;
      s += `<line x1="${F.m.l}" x2="${W - F.m.r}" y1="${F.Y(0)}" y2="${F.Y(0)}" stroke="${COL.ink}"/>`;
      xs.forEach((x, i) => s += `<circle cx="${F.X(x).toFixed(1)}" cy="${F.Y(ys[i]).toFixed(1)}" r="${big[i] ? 3.2 : 2.4}" fill="${big[i] ? COL.women : raw ? COL.ctrl : COL.men}" opacity="${big[i] ? .85 : .45}"/>`);
      s += `<path d="${path(trend.map(([x, y]) => [F.X(x), F.Y(y)]))}" fill="none" stroke="${COL.ink}" stroke-width="3"/>`;
      $("#rvf").innerHTML = s; });
    $("#rvfNote").textContent = raw ? "Each dot is one cylinder. Black line: the typical error at each predicted value. It bends, so the straight-line model is systematically wrong at both ends." : "Each dot is one cylinder. Black line: the typical error at each predicted value. It stays flat at zero: no systematic mistake. Orange dots: the most influential cylinders, none dominant."; }
  drawDiag();
  { const X = lawX(D), h = hatDiag(X, law.Ginv); $("#maxCook").textContent = fmt(Math.max(...law.resid.map((e, i) => e * e * h[i] / (law.q * law.sigma2 * (1 - h[i]) ** 2))), 2); }

  /* ---------- 5 · the exam: recipes split by mixture ---------- */
  let seed = 553413, hold = new Set();
  const mixes = [...new Set(D.map(o => o.mix))], perMix = new Map(); D.forEach(o => perMix.set(o.mix, (perMix.get(o.mix) || 0) + 1));
  function split() { const sh = shuffle([...mixes], rngFrom(seed)); hold = new Set(sh.slice(0, Math.round(sh.length * .2))); drawGrid(); }
  function drawGrid() { const cv = $("#mixGrid"), ctx = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = W < 500 ? 19 : 25, rows = Math.ceil(mixes.length / cols), cell = Math.min(W / cols, (H - 30) / rows);
    ctx.fillStyle = COL.ink; ctx.font = "600 14px Barlow Condensed, Arial Narrow, sans-serif";
    ctx.fillText(`${nMix - hold.size} RECIPES TO LEARN FROM  ·  ${hold.size} LOCKED AWAY FOR THE EXAM`, 0, 16);
    mixes.forEach((m, i) => { const x = (i % cols) * cell, y = 28 + Math.floor(i / cols) * cell, held = hold.has(m), s = cell * .82;
      ctx.fillStyle = held ? COL.women : "#c9ced6"; ctx.fillRect(x, y, s, s);
      const k = perMix.get(m); if (k > 1 && cell > 12) { ctx.fillStyle = held ? "#fff" : COL.ink2; ctx.font = `600 ${Math.round(cell * .42)}px Barlow, sans-serif`; ctx.textAlign = "center"; ctx.fillText(k, x + s / 2, y + s * .68); ctx.textAlign = "left"; } });
    const nt = D.filter(o => hold.has(o.mix)).length;
    $("#mixNote").textContent = `Each square is one recipe; the number is how many cylinders of it were crushed (at different ages). Exam: ${nt} cylinders from ${hold.size} recipes, never seen while fitting.`; }
  new ResizeObserver(drawGrid).observe($("#mixGrid")); split();
  $("#reshuf").onclick = () => { seed += 1; split(); };
  { const rows = R.degree_rows, amin = Math.min(...rows.map(r => r.aic)), bmin = Math.min(...rows.map(r => r.bic));
    $("#degTab").innerHTML = `<div class="scroll"><table><tr><th>Age-curve degree</th><th>AIC − min</th><th>BIC − min</th><th>CV MSE ± SE</th></tr>` + rows.map(r => `<tr><td>${r.degree}</td><td>${fmt(r.aic - amin, 1)}</td><td>${fmt(r.bic - bmin, 1)}</td><td>${fmt(r.cv_mse, 4)} ± ${fmt(r.cv_se, 4)}</td></tr>`).join("") + `</table></div>`;
    $("#dA").textContent = R.d_aic; $("#dB").textContent = R.d_bic; $("#d1").textContent = R.d_cv1se; }

  /* ---------- 6 · held-out comparison (from the Python analysis) ---------- */
  { const LAB = ["Abrams 1918: water / cement + age", "Water / binder + age (our rule)", "Rule + binder recipe (10 terms)", "All 7 ingredients, no physics", "44-term black box", "44 terms + ridge", "44 terms + lasso"];
    const C = R.comparison.slice(0, 7).map((c, i) => ({ ...c, lab: LAB[i] })), byKind = Object.fromEntries(C.map(c => [c.label, c]));
    const order = [0, 1, 3, 2, 4, 5, 6].map(i => C[i]), m = c => fmt(100 * c.test_mape, 0) + "%";
    $("#e_wc").textContent = m(C[0]); $("#e_wb").textContent = m(C[1]); $("#e_ing").textContent = m(C[3]); $("#e_plus").textContent = m(C[2]); $("#e_quad").textContent = m(C[4]);
    const colr = c => c === C[1] || c === C[2] ? COL.men : c === C[0] ? COL.ctrl : "#b9bec6";
    chart($("#cmpBars"), (W, H) => { const lw = Math.min(250, W * .45), X = scale(0, .32, lw + 12, W - 50), rh = (H - 40) / order.length; let s = "";
      order.forEach((c, k) => { const y = 8 + k * rh; s += `<text x="${lw}" y="${y + rh * .55}" text-anchor="end" font-size="${W < 520 ? 11.5 : 13.5}" font-weight="${c === C[1] || c === C[2] ? 600 : 400}">${esc(c.lab)}</text>`;
        s += `<rect x="${X(0)}" y="${y + rh * .18}" width="${X(c.test_mape) - X(0)}" height="${rh * .62}" rx="4" fill="${colr(c)}"><title>${esc(c.lab)}: typical miss ${m(c)}, RMSE(log f) ${fmt(c.test_rmse, 3)}</title></rect>`;
        s += `<text x="${X(c.test_mape) + 6}" y="${y + rh * .58}" font-size="15" font-weight="600">${m(c)}</text>`; });
      [0, .1, .2, .3].forEach(t => s += `<text x="${X(t)}" y="${H - 8}" text-anchor="middle" font-size="12" fill="${COL.ink2}">${t * 100}%</text>`);
      s += `<text x="${X(.32)}" y="${H - 24}" text-anchor="end" font-size="12" fill="${COL.ink2}">typical miss on unseen recipes</text>`; $("#cmpBars").innerHTML = s; });
    $("#cmpTab").innerHTML = `<div class="scroll"><table><tr><th>Model</th><th>Grouped CV MSE</th><th>Test RMSE</th><th>Test MAPE</th></tr>` + C.map(c => `<tr><td>${c.lab}</td><td>${fmt(c.cv_mse, 4)}</td><td>${fmt(c.test_rmse, 3)}</td><td>${m(c)}</td></tr>`).join("") + `</table></div>`; void byKind; }

  /* ---------- 7 · lasso on 11 candidates, live ---------- */
  { const names = ["water / binder", "water / cement", ...ING.map(k => ING_L[k]), "age (log)", "age² (log)"];
    const Xr = D.map(o => [o.wb, o.wc, ...ING.map(k => o[k]), o.a, o.a * o.a]), st = standardize(Xr), prep = lassoPrep(st.Ztr, D.map(o => o.y));
    const hl = { "water / binder": COL.men, "water / cement": COL.women, "age (log)": COL.aqua, "age² (log)": COL.aqua }, lamEl = $("#lam");
    const lamOf = v => 10 ** (3.2 - 4.4 * v / 100);
    const drawL = () => { const lam = lamOf(+lamEl.value), b = lassoCD(prep, lam, null).b, nz = b.filter(v => Math.abs(v) > 1e-9).length;
      chart($("#coefBars"), (W, H) => { const lim = .5, lw = Math.min(130, W * .3), X = scale(-lim, lim, lw + 10, W - 14), rh = (H - 34) / names.length; let s = `<line x1="${X(0)}" x2="${X(0)}" y1="6" y2="${H - 26}" stroke="${COL.ink}"/>`;
        names.forEach((nm, i) => { const y = 8 + i * rh, v = clamp(b[i], -lim, lim), on = Math.abs(b[i]) > 1e-9;
          s += `<text x="${lw}" y="${y + rh * .62}" text-anchor="end" font-size="13" font-weight="${hl[nm] ? 600 : 400}" fill="${on ? COL.ink : COL.ink2}">${nm}</text>`;
          if (on) s += `<rect x="${Math.min(X(0), X(v))}" y="${y + rh * .18}" width="${Math.abs(X(v) - X(0))}" height="${rh * .64}" rx="3" fill="${hl[nm] || COL.ctrl}"><title>${nm}: ${fmt(b[i], 3)}</title></rect>`;
          else s += `<text x="${X(0) + 8}" y="${y + rh * .62}" font-size="12" fill="${COL.ink3 || COL.ink2}">dropped</text>`; });
        s += `<text x="${X(-lim)}" y="${H - 8}" font-size="12" fill="${COL.ink2}">← lowers strength</text><text x="${X(lim)}" y="${H - 8}" text-anchor="end" font-size="12" fill="${COL.ink2}">raises strength →</text>`;
        $("#coefBars").innerHTML = s; });
      $("#lamNote").textContent = `${nz} of 11 ingredients kept at this budget (λ = ${lam >= 10 ? fmt(lam, 0) : fmt(lam, 2)}). Bar length = effect of a one-standard-deviation change, on log strength.`; };
    lamEl.addEventListener("input", drawL); drawL();
    const nmMap = { "w/b": "water / binder", "w/c": "water / cement", "log age": "age", "(log age)^2": "age²", "cement": "cement", "fly ash": "fly ash", "slag": "slag", "fine agg.": "fine agg.", "water": "water", "coarse agg.": "coarse agg.", "superplast.": "superplast." };
    $("#entry").innerHTML = "Order in which variables enter as λ falls: " + R.lasso_entry_order.map(([l, n]) => `${nmMap[n] || n} (λ ≈ ${fmt(l, 0)})`).join(" → ") + "."; }

  /* ---------- 8 · slag and fly ash ---------- */
  { const c = R.plus.coef, ef = (sh, age) => Math.exp(.3 * (c[sh].beta + c[sh + " x log age"].beta * Math.log(age / 28))) - 1;
    const sl = AGES.map(a => ef("slag share", a)), as = AGES.map(a => ef("ash share", a));
    $("#r7").textContent = `${fmt(-100 * ef("slag share", 7), 0)}% (slag) and ${fmt(-100 * ef("ash share", 7), 0)}% (fly ash)`.replace(/^/, "−").replace("and ", "and −");
    $("#slag365").textContent = fmt(100 * ef("slag share", 365), 0) + "% stronger"; $("#ash365").textContent = fmt(-100 * ef("ash share", 365), 0) + "% weaker";
    chart($("#swap"), (W, H) => { const F = frame(W, H, [-.5, AGES.length - .5], [-.32, .22], { xticks: [], yfmt: v => (v > 0 ? "+" : "") + Math.round(v * 100) + "%", m: { l: 52, b: 52 } }); let s = F.svg, gw = (F.X(1) - F.X(0)) * .36;
      s += `<line x1="${F.m.l}" x2="${W - F.m.r}" y1="${F.Y(0)}" y2="${F.Y(0)}" stroke="${COL.ink}" stroke-width="1.5"/>`;
      AGES.forEach((a, i) => { const cx = F.X(i);
        [[sl[i], COL.men, -1], [as[i], COL.women, 1]].forEach(([v, col, side]) => { const x = side < 0 ? cx - gw - 2 : cx + 2;
          s += `<rect x="${x}" y="${Math.min(F.Y(0), F.Y(v))}" width="${gw}" height="${Math.abs(F.Y(v) - F.Y(0))}" rx="3" fill="${col}"><title>${side < 0 ? "slag" : "fly ash"} at ${AGE_L[a]}: ${pct(v)}</title></rect>`;
          s += `<text x="${x + gw / 2}" y="${v >= 0 ? F.Y(v) - 6 : F.Y(v) + 16}" text-anchor="middle" font-size="${W < 500 ? 10.5 : 13}" font-weight="600">${pct(v)}</text>`; });
        s += `<text x="${cx}" y="${H - F.m.b + 22}" text-anchor="middle" font-size="14" font-weight="600">${AGE_L[a]}</text>`; });
      s += `<text x="${F.m.l + 6}" y="${F.m.t + 14}" font-size="13"><tspan fill="${COL.men}" font-weight="700">■ 30% slag</tspan>   <tspan fill="${COL.women}" font-weight="700">■ 30% fly ash</tspan></text>`;
      $("#swap").innerHTML = s; });
    $("#plusTab").innerHTML = `<div class="scroll"><table><tr><th>Term</th><th>β̂</th><th>SE</th></tr>` + Object.entries(c).map(([k, v]) => `<tr><td>${k.replace(" x ", " × ")}</td><td>${fmt(v.beta, 3)}</td><td>${fmt(v.se, 3)}</td></tr>`).join("") + `</table></div><p>R² = ${fmt(R.plus.r2, 3)}.</p>`; }
})();
