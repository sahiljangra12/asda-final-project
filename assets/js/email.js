/* Mission 01 story page. Every chart is computed in the browser from each group's size and its
   buyers' spend amounts; the headline numbers come from the Python analysis (outputs/results). */
"use strict";
initPage();
const ARMS = ["No E-Mail", "Mens E-Mail", "Womens E-Mail"], CTRL = ARMS[0], MEN = ARMS[1], WOM = ARMS[2];
const NAME = { [CTRL]: "No email", [MEN]: "Men's email", [WOM]: "Women's email" };
const AC = { [CTRL]: COL.ctrl, [MEN]: COL.men, [WOM]: COL.women };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const usd = x => "$" + fmt(x, 2);
const oneIn = p => { const k = 1 / p; if (k >= 1e6) return `1 in ${fmt(k / 1e6, 0)} million`; const st = k > 1000 ? 100 : 10; return `1 in ${(Math.round(k / st) * st).toLocaleString()}`; };

/* ---------- slide navigator: works with buttons and arrow keys ---------- */
{ const slides = $$("section[id^=s]"), lab = $("#slideLab"); let cur = 0;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { cur = slides.indexOf(e.target); lab.textContent = `${cur + 1} / ${slides.length} · ${e.target.dataset.title}`; } }), { threshold: 0.45 });
  slides.forEach(s => io.observe(s));
  const go = d => { const i = clamp(cur + d, 0, slides.length - 1); slides[i].scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); };
  $("#prevS").onclick = () => go(-1); $("#nextS").onclick = () => go(1);
  addEventListener("keydown", e => { if (document.documentElement.classList.contains("present") || e.target.closest("input,textarea,select,button,summary")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(1); } if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); } }); }

(async () => {
  const [D, R, S] = await Promise.all(["assets/data/hillstrom_compact.json", "outputs/results/hillstrom_results.json", "assets/data/hillstrom_story.json"].map(u => fetch(u).then(r => r.json())));
  const A = {};
  for (const a of ARMS) { const s = D.buyer_spend[a], n = D.arms[a].n, T = sum(s), TT = sum(s.map(v => v * v)), m = T / n; A[a] = { n, h: s.length, spend: s, mean: m, var: (TT - n * m * m) / (n - 1), basket: T / s.length }; }

  /* ---------- 1 · every customer as a dot ---------- */
  { const cv = $("#heroDots"), ctx = cv.getContext("2d");
    const draw = () => { const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const wide = W > 900, tt = $("#s1 .kicker").getBoundingClientRect().top - cv.getBoundingClientRect().top, top = wide ? 110 : 100, bottom = wide ? H - 90 : Math.max(top + 80, tt - 34), gap = W < 700 ? 10 : 22, side = Math.max(18, W * .04), left = wide ? W * .56 : side, bw = ((wide ? W - side : W - side) - left - 2 * gap) / 3;
      const cell = Math.sqrt(bw * (bottom - top) / A[CTRL].n), cols = Math.floor(bw / cell), r = rngFrom(11);
      ARMS.forEach((a, k) => { const x0 = left + k * (bw + gap); ctx.fillStyle = "#c9ced6";
        for (let i = 0; i < A[a].n; i++) ctx.fillRect(x0 + (i % cols) * cell, top + Math.floor(i / cols) * cell, Math.max(.8, cell * .55), Math.max(.8, cell * .55));
        ctx.fillStyle = AC[a]; for (let j = 0; j < A[a].h; j++) { const i = Math.floor(r() * A[a].n); ctx.beginPath(); ctx.arc(x0 + (i % cols) * cell, top + Math.floor(i / cols) * cell, Math.max(2.2, cell * 1.4), 0, 7); ctx.fill(); }
        ctx.fillStyle = COL.ink; ctx.font = "600 13px Barlow Condensed, Arial Narrow, sans-serif"; ctx.fillText(bw < 230 ? `${["NO EMAIL", "MEN'S", "WOMEN'S"][k]} · ${A[a].h} BUYERS` : `${NAME[a].toUpperCase()} · ${A[a].h} OF ${A[a].n.toLocaleString()} BOUGHT`, x0, top - 12); }); };
    new ResizeObserver(draw).observe(cv); }

  /* ---------- 2 · a fair test ---------- */
  $("#nC").textContent = A[CTRL].n.toLocaleString(); $("#nM").textContent = A[MEN].n.toLocaleString(); $("#nW").textContent = A[WOM].n.toLocaleString();
  $("#balMax").textContent = fmt(R.max_abs_balance_t, 2);
  { const g = a => S.arms[a]; const rows = [["Spent in the past year", a => "$" + fmt(g(a).history, 0)], ["Months since last order", a => fmt(g(a).recency, 1)], ["New customers", a => fmt(100 * g(a).newbie, 0) + "%"], ["Bought men's items before", a => fmt(100 * g(a).mens, 0) + "%"], ["Bought women's items before", a => fmt(100 * g(a).womens, 0) + "%"]];
    $("#balance").innerHTML = `<div class="balrow h"><span></span><span>No email</span><span>Men's</span><span>Women's</span></div>` + rows.map(([l, f]) => `<div class="balrow"><span>${l}</span>${ARMS.map(a => `<span>${f(a)}</span>`).join("")}</div>`).join("") + `<p class="note" style="margin-top:10px">Nearly identical in every row: the coin flip did its job.</p>`; }

  /* ---------- 3 · both emails made money ---------- */
  const W_ = Object.fromEntries(R.welch.map(w => [w.comparison, w])), wm = W_[MEN + " vs " + CTRL], ww = W_[WOM + " vs " + CTRL], wmw = W_[MEN + " vs " + WOM];
  $("#r0").textContent = usd(S.arms[CTRL].revenue); $("#r1").textContent = `${usd(S.arms[MEN].revenue)} (+${fmt(100 * (S.arms[MEN].revenue / S.arms[CTRL].revenue - 1), 0)}%)`; $("#r2").textContent = `${usd(S.arms[WOM].revenue)} (+${fmt(100 * (S.arms[WOM].revenue / S.arms[CTRL].revenue - 1), 0)}%)`;
  $("#luck1").textContent = oneIn(wm.p) + " times"; $("#luck2").textContent = oneIn(ww.p) + " times";
  $("#welchMath").innerHTML = `<div class="scroll"><table><tr><th>Comparison</th><th>Gap</th><th>T<sub>W</sub></th><th>p</th><th>Bonferroni p</th></tr>` + [["Men's − control", wm], ["Women's − control", ww], ["Men's − women's", wmw]].map(([l, w]) => `<tr><td>${l}</td><td>${usd(w.diff)}</td><td>${fmt(w.t)}</td><td>${w.p < 1e-4 ? w.p.toExponential(1) : fmt(w.p, 4)}</td><td><b class="${w.p_bonf < .05 ? "pill-ok" : "pill-no"}">${w.p_bonf < 1e-4 ? w.p_bonf.toExponential(1) : fmt(w.p_bonf, 3)}</b></td></tr>`).join("") + `</table></div>`;
  chart($("#revBars"), (W, H) => { const m = { l: 20, r: 20, t: 40, b: 64 }, bw = (W - m.l - m.r) / 3, Y = scale(0, 1.9, H - m.b, m.t); let s = `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${COL.ink}"/>`;
    ARMS.forEach((a, k) => { const g = S.arms[a], x = m.l + k * bw + bw * .18, w = bw * .64, cx = x + w / 2;
      s += `<rect x="${x}" y="${Y(g.revenue)}" width="${w}" height="${Y(0) - Y(g.revenue)}" rx="4" fill="${AC[a]}"><title>${NAME[a]}: ${usd(g.revenue)} per customer (95% CI ${usd(g.revenue_lo)}–${usd(g.revenue_hi)})</title></rect>`;
      s += `<line x1="${cx}" x2="${cx}" y1="${Y(g.revenue_lo)}" y2="${Y(g.revenue_hi)}" stroke="${COL.ink}" stroke-width="2.5"/><line x1="${cx - 10}" x2="${cx + 10}" y1="${Y(g.revenue_lo)}" y2="${Y(g.revenue_lo)}" stroke="${COL.ink}" stroke-width="2.5"/><line x1="${cx - 10}" x2="${cx + 10}" y1="${Y(g.revenue_hi)}" y2="${Y(g.revenue_hi)}" stroke="${COL.ink}" stroke-width="2.5"/>`;
      s += `<text x="${cx}" y="${Y(g.revenue_hi) - 12}" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow" font-weight="600" font-size="${W < 500 ? 26 : 36}">${usd(g.revenue)}</text>`;
      s += `<text x="${cx}" y="${H - m.b + 24}" text-anchor="middle" font-size="15" font-weight="600">${NAME[a]}</text>`;
      if (a !== CTRL) s += `<text x="${cx}" y="${H - m.b + 44}" text-anchor="middle" font-size="14" fill="${AC[a]}" font-weight="600">+${fmt(100 * (g.revenue / S.arms[CTRL].revenue - 1), 0)}% vs no email</text>`; });
    s += `<text x="${m.l}" y="18" font-size="13" fill="${COL.ink2}">Dollars per customer in two weeks</text>`; $("#revBars").innerHTML = s; });

  /* ---------- 4 · fake experiments ---------- */
  { const v = new Float64Array(A[CTRL].n); A[CTRL].spend.forEach((x, i) => v[i] = x); const idx = Array.from(v.keys()); let last = [], seed = 1, batches = 0, hit = 0;
    const draw = () => chart($("#aaPlot"), (W, H) => { const L = Math.log10, F = frame(W, H, [-3.3, 0], [0, 21], { xticks: [-3, -2, L(.05), -1, 0], xfmt: v => v === 0 ? "1" : Math.abs(v - L(.05)) < .01 ? "0.05" : String(10 ** v), yticks: [], xlab: "p-value of each fake experiment (log scale)", m: { l: 16 } });
      let s = F.svg + `<rect x="${F.X(-3.3)}" y="${F.m.t}" width="${F.X(L(.05)) - F.X(-3.3)}" height="${F.Y(0) - F.m.t}" fill="${COL.women}" opacity=".07"/>`;
      s += `<line x1="${F.X(L(.05))}" x2="${F.X(L(.05))}" y1="${F.m.t}" y2="${F.Y(0)}" stroke="${COL.women}" stroke-width="2"/><text x="${F.X(L(.05)) - 6}" y="${F.m.t + 14}" text-anchor="end" font-size="12.5" fill="${COL.women}" font-weight="600">"significant" zone</text>`;
      s += `<line x1="${F.X(L(.0025))}" x2="${F.X(L(.0025))}" y1="${F.m.t}" y2="${F.Y(0)}" stroke="${COL.ink}" stroke-dasharray="5 4"/><text x="${F.X(L(.0025)) - 6}" y="${F.m.t + 30}" text-anchor="end" font-size="12">Bonferroni bar</text>`;
      last.forEach((p, i) => s += `<circle cx="${F.X(Math.max(-3.3, L(p)))}" cy="${F.Y(i + 1)}" r="7" fill="${p < .05 ? COL.women : "#b9bec6"}"><title>p = ${fmt(p, 4)}</title></circle>`);
      if (!last.length) s += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${COL.ink2}" font-size="15">Press “Run 20 fake experiments”</text>`;
      $("#aaPlot").innerHTML = s; });
    $("#aaRun").onclick = () => { const r = rngFrom(1000 + seed++); last = [];
      for (let k = 0; k < 20; k++) { shuffle(idx, r); const h2 = idx.length >> 1; let s1 = 0, q1 = 0, s2 = 0, q2 = 0;
        for (let i = 0; i < idx.length; i++) { const x = v[idx[i]]; if (i < h2) { s1 += x; q1 += x * x; } else { s2 += x; q2 += x * x; } }
        const n1 = h2, n2 = idx.length - h2, m1 = s1 / n1, m2 = s2 / n2; last.push(welchFromStats(m1, (q1 - n1 * m1 * m1) / (n1 - 1), n1, m2, (q2 - n2 * m2 * m2) / (n2 - 1), n2).p); }
      batches++; const k = last.filter(p => p < .05).length; if (k) hit++;
      $("#aaText").innerHTML = `This run: <b>${k} of 20</b> fake experiments looked "significant", with no email involved at all. So far, ${hit} of ${batches} runs contained at least one false alarm. In theory that happens 64% of the time: 1 − 0.95<sup>20</sup>.`; draw(); };
    draw(); }

  /* ---------- 5 · buyers × basket ---------- */
  const sE = seg($("#segEmail"), [[MEN, "Men's email"], [WOM, "Women's email"]], MEN, () => { fill5(); runBoot(); });
  function fill5() { const a = sE.get(), b = R.bootstrap[a], ci = o => `95% CI ${fmt(o.lo)}–${fmt(o.hi)}×`;
    $("#per0").textContent = fmt(1000 * A[CTRL].h / A[CTRL].n, 1); $("#per1").textContent = fmt(1000 * A[MEN].h / A[MEN].n, 1); $("#bask").textContent = "$" + fmt(A[CTRL].basket, 0);
    $("#tRev").textContent = fmt(b.revenue_ratio.obs) + "×"; $("#tRevCI").textContent = ci(b.revenue_ratio); $("#tBuy").textContent = fmt(b.buyer_ratio.obs) + "×"; $("#tBuyCI").textContent = ci(b.buyer_ratio); $("#tBas").textContent = fmt(b.basket_ratio.obs) + "×"; $("#tBasCI").textContent = ci(b.basket_ratio);
    $("#shareTxt").innerHTML = a === MEN ? `About <b>all</b> of the men's email's lift comes from extra buyers.` : `About <b>${fmt(100 * b.buyer_share.obs, 0)}%</b> of the women's email's lift comes from extra buyers.`;
    drawPeople(); }
  function drawPeople() { const cv = $("#ppl"), ctx = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a = sE.get(), panels = [[CTRL, 1000 * A[CTRL].h / A[CTRL].n], [a, 1000 * A[a].h / A[a].n]], pw = (W - 24) / 2, cols = 40, rows = 25, cell = Math.min(pw / cols, (H - 40) / rows);
    panels.forEach(([arm, k], p) => { const x0 = p * (pw + 24), nb = Math.round(k); ctx.fillStyle = COL.ink; ctx.font = "600 14px Barlow Condensed, Arial Narrow, sans-serif"; ctx.fillText(`${NAME[arm].toUpperCase()}: ${fmt(k, 1)} OF 1,000 BUY`, x0, 16);
      for (let i = 0; i < 1000; i++) { const x = x0 + (i % cols) * cell, y = 30 + Math.floor(i / cols) * cell; ctx.fillStyle = i < nb ? AC[arm] : "#d5d9df"; ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * (i < nb ? .46 : .3), 0, 7); ctx.fill(); } });
    $("#pplNote").textContent = `Each dot is one customer out of 1,000; coloured dots bought something. Buyers spent about $${fmt(A[CTRL].basket, 0)} without an email and $${fmt(A[a].basket, 0)} after the ${a === MEN ? "men's" : "women's"} email.`; }
  new ResizeObserver(drawPeople).observe($("#ppl"));
  const KEYS = [["rev", "Revenue"], ["buy", "Buyers"], ["bas", "Basket"]];
  $("#bootFigs").innerHTML = KEYS.map(([k, l]) => `<div><p class="label" style="margin:0 0 6px">${l}</p><div class="fig" style="min-height:120px"><svg id="h_${k}"></svg></div></div>`).join("");
  let bootSeed = 1, timer = 0;
  const resample = (r, a) => { const n = A[a].n, sp = A[a].spend, k = sp.length, kb = binomialDraw(r, n, k / n); let T = 0; for (let i = 0; i < kb; i++) T += sp[Math.floor(r() * k)]; return { mu: T / n, p: kb / n, m: kb ? T / kb : NaN }; };
  function runBoot() { cancelAnimationFrame(timer); const a = sE.get(), r = rngFrom(4242 + 31 * bootSeed++), B = 2000, reps = { rev: [], buy: [], bas: [] };
    const step = () => { for (let i = 0; i < 60 && reps.rev.length < B; i++) { const t = resample(r, a), c = resample(r, CTRL); reps.rev.push(t.mu / c.mu); reps.buy.push(t.p / c.p); reps.bas.push(t.m / c.m); }
      for (const [k] of KEYS) { const v = reps[k].filter(Number.isFinite), lo = .4, hi = 3.6, nb = 40, bw = (hi - lo) / nb, cnt = new Array(nb).fill(0); v.forEach(x => { const i = Math.floor((x - lo) / bw); if (i >= 0 && i < nb) cnt[i]++; });
        chart($("#h_" + k), (W, H) => { const X = scale(lo, hi, 6, W - 6), Y = scale(0, Math.max(...cnt, 1) * 1.08, H - 18, 4); let s = "";
          cnt.forEach((c, i) => { if (c) s += `<rect x="${X(lo + i * bw) + .5}" y="${Y(c)}" width="${Math.max(1, X(lo + bw) - X(lo) - 1)}" height="${Y(0) - Y(c)}" fill="${k === "bas" ? COL.ctrl : AC[a]}"/>`; });
          s += `<line x1="${X(1)}" x2="${X(1)}" y1="2" y2="${H - 18}" stroke="${COL.ink}" stroke-dasharray="3 3"/><text x="${X(1)}" y="${H - 4}" text-anchor="middle" font-size="11" fill="${COL.ink2}">1× = no change</text>`; $("#h_" + k).innerHTML = s; }); }
      $("#bootRun").textContent = reps.rev.length < B ? `Resampling… ${reps.rev.length.toLocaleString()}` : "Re-run 2,000 times, live"; if (reps.rev.length < B) timer = requestAnimationFrame(step); };
    step(); }
  $("#bootRun").onclick = runBoot; fill5();
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); runBoot(); } }, { threshold: .3 }).observe($("#s5"));

  /* ---------- 6 · posterior play ---------- */
  const pc = R.posterior_comparisons; $("#pMW").textContent = fmt(100 * pc[MEN + " > " + WOM].prob, 2) + "%";
  const sP = seg($("#segPrior"), [["u", "Start neutral"], ["s", "Start sceptical"]], "u", () => drawPost(frac));
  const orders = {}; for (const a of ARMS) { const z = new Uint8Array(A[a].n); z.fill(1, 0, A[a].h); shuffle(z, rngFrom(77 + a.length)); const c = new Int32Array(A[a].n + 1); for (let i = 0; i < A[a].n; i++) c[i + 1] = c[i] + z[i]; orders[a] = c; }
  let frac = 1, playing = false;
  function drawPost(f) { const [a0, b0] = sP.get() === "u" ? [1, 1] : [29, 4971]; const P = Object.fromEntries(ARMS.map(a => { const n = Math.round((orders[a].length - 1) * f), h = orders[a][n]; return [a, [a0 + h, b0 + n - h, n, h]]; }));
    $("#seen").textContent = `${P[MEN][2].toLocaleString()} customers seen per group`;
    chart($("#post"), (W, H) => { const lo = 0, hi = .022, xs = Array.from({ length: 300 }, (_, i) => 1e-5 + hi * i / 299), ys = ARMS.map(a => xs.map(x => betaPdf(x, P[a][0], P[a][1]))), ymax = Math.max(60, ...ys.flat()) * 1.15;
      const F = frame(W, H, [lo, hi], [0, ymax], { yticks: [], xfmt: v => fmt(100 * v, 1) + "%", xlab: "Share of customers who buy", m: { l: 16 } }); let s = F.svg;
      ARMS.forEach((a, k) => { const pts = xs.map((x, i) => [F.X(x), F.Y(ys[k][i])]); s += `<path d="${path([[F.X(lo), F.Y(0)], ...pts, [F.X(hi), F.Y(0)]])}Z" fill="${AC[a]}" opacity=".15"/><path d="${path(pts)}" fill="none" stroke="${AC[a]}" stroke-width="3"/>`;
        const j = ys[k].indexOf(Math.max(...ys[k])); if (ys[k][j] > ymax * .1) s += `<text x="${F.X(xs[j])}" y="${F.Y(ys[k][j]) - 10}" text-anchor="middle" font-size="14" font-weight="600">${NAME[a]}</text>`; });
      $("#post").innerHTML = s; }); }
  $("#play").onclick = () => { if (playing) { playing = false; return; } playing = true; $("#play").textContent = "■ Stop"; const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 7000); frac = k === 0 ? 0 : 10 ** (-3 + 3 * k); drawPost(frac); if (playing && k < 1) requestAnimationFrame(step); else { playing = false; $("#play").textContent = "▶ Play"; } }; requestAnimationFrame(step); };
  drawPost(1);

  /* ---------- 7 · who responds ---------- */
  { const G = [["Men's only", "Past buyers of men's items"], ["Women's only", "Past buyers of women's items"], ["Both", "Bought both before"]];
    $("#verdicts").innerHTML = G.map(([g, l]) => `<div class="vcard"><h3>${l}</h3>` + [MEN, WOM].map(a => { const q = R.heterogeneity.find(o => o.group === g && o.arm === a), ok = q.prob_pos > .95, mid = !ok && q.prob_pos > .9;
      return `<div class="vrow"><span class="mk" style="background:${ok ? "#08734f" : mid ? "#b98a12" : "#b4441a"}">${ok ? "✓" : mid ? "~" : "✕"}</span><span>${NAME[a]}<br><span class="note">${ok ? "clearly helped" : mid ? "probably helped" : "no clear effect"} · P${q.prob_pos > .9995 ? " > 0.999" : " = " + fmt(q.prob_pos, 2)}</span></span><b>${q.lift_mean >= 0 ? "+" : ""}${fmt(100 * q.lift_mean, 2)}<span class="note"> per 100</span></b></div>`; }).join("") + `</div>`).join(""); }

  /* ---------- 8 · trust ---------- */
  $("#seB").textContent = "$" + fmt(R.bootstrap[MEN].diff.se_boot, 3); $("#seW").textContent = "$" + fmt(R.bootstrap[MEN].welch_se, 3);
})();
