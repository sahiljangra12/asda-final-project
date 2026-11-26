/* Home page visuals: 64,000 customers as points; animated posteriors; Abrams curves drawn from a live fit. */
"use strict";
initPage();
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

(async () => {
  const D = await (await fetch("assets/data/hillstrom_compact.json")).json();
  const ARMS = ["No E-Mail", "Mens E-Mail", "Womens E-Mail"], AC = [COL.ctrl, COL.men, COL.women], NAME = ["No email", "Men's email", "Women's email"];

  /* ---------- hero: every customer is a point; buyers glow in their arm's colour ---------- */
  const cv = $("#heroCanvas"), ctx = cv.getContext("2d");
  let layout = null;
  function build() {
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const txt = $(".hero .wrap > .label"), tt = txt ? txt.getBoundingClientRect().top - cv.getBoundingClientRect().top : H * 0.5;
    const top = W < 700 ? 100 : 108, bottom = Math.max(top + 90, tt - 34), gap = W < 700 ? 10 : 26, side = Math.max(18, W * 0.04);
    const bw = (W - 2 * side - 2 * gap) / 3, bh = Math.max(80, bottom - top);
    const n = D.arms[ARMS[0]].n, cell = Math.sqrt(bw * bh / n), cols = Math.floor(bw / cell);
    const r = rngFrom(7), buyers = ARMS.map(a => { const N = D.arms[a].n, h = D.arms[a].h, s = new Set(); while (s.size < h) s.add(Math.floor(r() * N)); return [...s]; });
    layout = { W, H, top, bw, gap, side, cell, cols, buyers };
    const base = document.createElement("canvas"); base.width = cv.width; base.height = cv.height; const b = base.getContext("2d"); b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.fillStyle = "#c3c9d2";
    ARMS.forEach((a, k) => { const N = D.arms[a].n, x0 = side + k * (bw + gap);
      for (let i = 0; i < N; i++) { const x = x0 + (i % cols) * cell, y = top + Math.floor(i / cols) * cell; b.fillRect(x, y, Math.max(0.8, cell * 0.55), Math.max(0.8, cell * 0.55)); }
      b.fillStyle = "#0b0c0e"; b.font = "600 13px Barlow Condensed, Arial Narrow, sans-serif"; b.letterSpacing = "2px";
      b.fillText(W < 700 ? `${["NONE", "MEN'S", "WOMEN'S"][k]} ${fmt(100 * D.arms[a].h / N)}%` : `${NAME[k].toUpperCase()} · ${fmt(100 * D.arms[a].h / N)}% BOUGHT`, x0, top - 12); b.fillStyle = "#c3c9d2"; });
    layout.base = base;
  }
  function frameHero(t) {
    if (!layout) return; const { W, H, top, bw, gap, side, cell, cols, buyers, base } = layout;
    ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0, W, H);
    ARMS.forEach((a, k) => { const x0 = side + k * (bw + gap); ctx.fillStyle = AC[k];
      buyers[k].forEach((i, j) => { const x = x0 + (i % cols) * cell, y = top + Math.floor(i / cols) * cell;
        const pulse = reduce ? 1 : 0.75 + 0.45 * Math.sin(t / 650 + j * 1.7); const s = Math.max(2.4, cell * 1.6) * pulse;
        ctx.beginPath(); ctx.arc(x + cell / 3, y + cell / 3, s, 0, 7); ctx.fill(); }); });
    if (!reduce) requestAnimationFrame(frameHero);
  }
  build(); new ResizeObserver(() => build()).observe(cv); requestAnimationFrame(frameHero);

  /* ---------- mission 1: posteriors grow sharper as customers arrive ---------- */
  const m1 = $("#m1svg"); let k1 = reduce ? 1 : 0, playing = false;
  const draw1 = () => chart(m1, (W, H) => {
    const x0 = W < 800 ? 0 : W * 0.54, lo = 0.002, hi = 0.017, N = 220;
    const post = ARMS.map(a => { const n = Math.max(1, Math.round(D.arms[a].n * k1)), h = Math.round(D.arms[a].h * k1); return [1 + h, 1 + n - h]; });
    const xs = Array.from({ length: N }, (_, i) => lo + (hi - lo) * i / (N - 1));
    const ys = post.map(p => xs.map(x => betaPdf(x, ...p)));
    const ymax = Math.max(800, ...ys.flat()) * 1.1, X = scale(lo, hi, x0 + 30, W - 30), Y = scale(0, ymax, H - 70, H * 0.2);
    let s = "";
    ys.forEach((y, a) => { const pts = xs.map((x, i) => [X(x), Y(y[i])]);
      s += `<path d="${path([[X(lo), Y(0)], ...pts, [X(hi), Y(0)]])}Z" fill="${AC[a]}" opacity=".13"/><path d="${path(pts)}" fill="none" stroke="${AC[a]}" stroke-width="3"/>`; });
    s += `<line x1="${X(lo)}" x2="${X(hi)}" y1="${Y(0)}" y2="${Y(0)}" stroke="${COL.ink}"/>`;
    [0.5, 1, 1.5].forEach(p => s += `<text x="${X(p / 100)}" y="${Y(0) + 22}" text-anchor="middle" font-size="13" fill="${COL.ink2}">${p}%</text>`);
    s += `<text x="${X(hi)}" y="${H * 0.2 - 16}" text-anchor="end" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="600" letter-spacing="2" font-size="14" fill="${COL.ink2}">POSTERIOR CONVERSION RATE · ${Math.round(k1 * 21300).toLocaleString()} CUSTOMERS PER ARM</text>`;
    m1.innerHTML = s;
  });
  const redraw1 = draw1();
  new IntersectionObserver(es => { if (es[0].isIntersecting && !playing && !reduce) { playing = true; k1 = 0.002; const t0 = performance.now();
    const step = t => { k1 = Math.min(1, 0.002 + ((t - t0) / 5000) ** 2); redraw1(); if (k1 < 1) requestAnimationFrame(step); else playing = false; }; requestAnimationFrame(step); } }, { threshold: 0.4 }).observe(m1);

  /* ---------- mission 2: Abrams curves fitted live, then drawn in ---------- */
  const txt = await (await fetch("data/concrete.csv")).text();
  const rows = txt.trim().split("\n").slice(1).map(l => l.split(",").map(Number));
  const d = rows.map(r => ({ wb: r[3] / (r[0] + r[1] + r[2]), la: Math.log(r[7] / 28), age: r[7], f: r[8] }));
  const fit = ols(d.map(o => [1, o.wb, o.la, o.la * o.la]), d.map(o => Math.log(o.f)));
  const m2 = $("#m2svg"); let drawn = reduce;
  const ages = [3, 7, 28, 90, 365];
  chart(m2, (W, H) => {
    const x0 = W < 800 ? 0 : W * 0.54, X = scale(0.2, 0.92, x0 + 40, W - 40), Y = scale(0, 95, H - 70, 90);
    let s = "";
    for (const o of d) { const i = ages.indexOf(o.age === 91 ? 90 : o.age); s += `<circle cx="${X(o.wb).toFixed(1)}" cy="${Y(o.f).toFixed(1)}" r="2.6" fill="${i >= 0 ? AGE_RAMP[i + 1] : "#c3c9d2"}" opacity="${i >= 0 ? .55 : .35}"/>`; }
    ages.forEach((a, i) => { const pts = [], ws = d.filter(o => o.age === a).map(o => o.wb); for (let w = Math.min(...ws); w <= Math.max(...ws) + 1e-9; w += 0.01) { const la = Math.log(a / 28); pts.push([X(w), Y(Math.exp(dot(fit.beta, [1, w, la, la * la])))]); }
      s += `<path class="ab" d="${path(pts)}" fill="none" stroke="${AGE_RAMP[i + 1]}" stroke-width="3" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${drawn ? 0 : 1}" style="transition:stroke-dashoffset 1.8s ${i * 0.25}s ease-out"/>`;
      s += `<text x="${pts[0][0] - 8}" y="${pts[0][1] + 4}" text-anchor="end" font-size="13" font-weight="600" fill="${COL.ink}">${a} d</text>`; });
    s += `<line x1="${X(0.2)}" x2="${X(0.92)}" y1="${Y(0)}" y2="${Y(0)}" stroke="${COL.ink}"/>`;
    [0.3, 0.5, 0.7, 0.9].forEach(v => s += `<text x="${X(v)}" y="${Y(0) + 22}" text-anchor="middle" font-size="13" fill="${COL.ink2}">${v}</text>`);
    s += `<text x="${X(0.92)}" y="${Y(0) + 46}" text-anchor="end" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="600" letter-spacing="2" font-size="14" fill="${COL.ink2}">WATER / BINDER RATIO → STRENGTH (MPA), BY CURING AGE</text>`;
    m2.innerHTML = s;
  });
  new IntersectionObserver(es => { if (es[0].isIntersecting && !drawn) { drawn = true; requestAnimationFrame(() => $$(".ab", m2).forEach(p => p.setAttribute("stroke-dashoffset", 0))); } }, { threshold: 0.35 }).observe(m2);
})();
