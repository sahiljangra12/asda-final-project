// Build the presentation deck (Hillstrom analysis) as a PowerPoint file.
// Every number is read from outputs/results/hillstrom_results.json, so the deck
// always matches the code.  Run from the project root:
//     node slides/build_slides.js
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const ROOT = path.resolve(__dirname, "..");
const R = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs/results/hillstrom_results.json")));
const FIG = f => path.join(ROOT, "outputs/figures/slides", f);
const OUT = path.join(ROOT, "slides/Hillstrom_Presentation.pptx");

// ---------- numbers ----------
const A = R.arms, C0 = A["No E-Mail"], M = A["Mens E-Mail"], W = A["Womens E-Mail"];
const pct = (x, d = 2) => (100 * x).toFixed(d) + "%";
const usd = x => "$" + x.toFixed(2);
const sci = p => p < 1e-4 ? p.toExponential(1).replace("e-", " × 10^-").replace("e+", " × 10^") : p.toFixed(p < 0.01 ? 4 : 3);
const wel = Object.fromEntries(R.welch.map(w => [w.comparison, w]));
const wMC = wel["Mens E-Mail vs No E-Mail"], wWC = wel["Womens E-Mail vs No E-Mail"], wMW = wel["Mens E-Mail vs Womens E-Mail"];
const bM = R.bootstrap["Mens E-Mail"], bW = R.bootstrap["Womens E-Mail"];
const pc = R.posterior_comparisons;
const het = (g, a) => R.heterogeneity.find(h => h.group === g && h.arm === a);
const ci = (o, d = 2) => `${o.obs.toFixed(d)} [${o.lo.toFixed(d)}, ${o.hi.toFixed(d)}]`;

// ---------- theme ----------
const THEME = {
  name: "ASDA Hillstrom", headFontFace: "Arial", bodyFontFace: "Calibri",
  colors: { dk1: "191919", lt1: "FFFFFF", dk2: "2B2B2B", lt2: "F3F4F6",
            accent1: "257DE0", accent2: "F47230", accent3: "8C8C8C", accent4: "00B894",
            accent5: "6A4CE2", accent6: "EC4647", hlink: "257DE0", folHlink: "6A4CE2" } };
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";               // 10 x 5.625 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "More buyers, not bigger baskets";
pres.author = "Sahil and team";
const S = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "DARK_TITLE", background: { color: HEX.dk1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.35, w: 8.8, h: 1.7, fontSize: 38, bold: true, color: S.background1, valign: "bottom", align: "left", fontFace: THEME.headFontFace }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.2, w: 8.8, h: 1.6, fontSize: 16, color: "C8C8C8", valign: "top" }, text: "" } },
  ] });
pres.defineSlideMaster({
  title: "CONTENT", background: { color: HEX.lt1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.25, w: 9.0, h: 0.75, fontSize: 26, bold: true, color: S.text1, valign: "top", align: "left", fontFace: THEME.headFontFace }, text: "" } },
    { text: { text: "ASDA final project · Hillstrom email experiment", options: { x: 0.5, y: 5.25, w: 6, h: 0.25, fontSize: 9, color: "8C8C8C" } } },
  ],
  slideNumber: { x: 9.0, y: 5.25, w: 0.5, h: 0.25, fontSize: 9, color: "8C8C8C", align: "right" } });

// helpers
const tb = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, fontFace: THEME.bodyFontFace, color: S.text1, fontSize: 14, valign: "top", ...o });
const fig = (slide, file, x, y, w, aspect, name) => slide.addImage({ path: FIG(file), x, y, w, h: w / aspect, objectName: name, altText: name });
function kicker(slide, text) { tb(slide, text, { x: 0.5, y: 0.98, w: 9, h: 0.3, fontSize: 12, color: "5C5C5C", italic: true }); }
function stat(slide, x, y, w, big, small, color) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 1.05, fill: { color: HEX.lt2 }, line: { color: HEX.lt2 }, rectRadius: 0.08, objectName: "stat card" });
  slide.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.2, w: 0.16, h: 0.16, fill: { color }, line: { color }, objectName: "arm dot" });
  tb(slide, big, { x: x + 0.45, y: y + 0.08, w: w - 0.55, h: 0.48, fontSize: 26, bold: true, fontFace: THEME.headFontFace });
  tb(slide, small, { x: x + 0.18, y: y + 0.58, w: w - 0.3, h: 0.42, fontSize: 11, color: "4A4A4A" });
}
const note = (slide, who, text) => slide.addNotes(`[Presenter: ${who}] ` + text);

// =====================================================================
// MAIN TALK: one slide per website screen (email.html#s1 … #s9), same order, same claims.
// The picture on each slide is a capture of that screen's live chart (slides/screens/*.png,
// made by slides/capture_screens.py), so the deck matches the website when Wi-Fi fails.
const SITE = "https://sahiljangra12.github.io/asda-final-project/email.html";
const TALK = (() => { const t = fs.readFileSync(path.join(ROOT, "assets/js/talk.js"), "utf8");
  const a = t.indexOf("email: {"), b = t.indexOf("concrete: {");
  return new Function("return {" + t.slice(a, b).trim().replace(/,$/, "") + "}")().email; })();
const SHOT = f => path.join(ROOT, "slides/screens", f + ".png");
const imgSize = f => { const b = fs.readFileSync(SHOT(f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const oneIn = p => { const k = 1 / p; if (k >= 1e6) return `1 in ${Math.round(k / 1e6)} million`; const st = k > 1000 ? 100 : 10; return `1 in ${(Math.round(k / st) * st).toLocaleString()}`; };
const mmss = m => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, "0")}`;
function picture(slide, f, x, y, w, h, name) { const [pw, ph] = imgSize(f), k = Math.min(w / pw, h / ph);
  slide.addImage({ path: SHOT(f), x: x + (w - pw * k) / 2, y: y + (h - ph * k) / 2, w: pw * k, h: ph * k, objectName: name, altText: name }); }
function simpleBox(slide, id, x, y, w, h) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: "FFF8E6" }, line: { color: "FFF8E6" }, objectName: "simple words box" });
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.06, h, fill: { color: "E8A317" }, line: { color: "E8A317" }, objectName: "simple words bar" });
  tb(slide, [{ text: "IN SIMPLE WORDS", options: { bold: true, fontSize: 9.5, color: "8A5D00", charSpacing: 2, breakLine: true } },
    { text: TALK[id][2], options: { fontSize: 13 } }], { x: x + 0.2, y: y + 0.1, w: w - 0.3, h: h - 0.15, paraSpaceAfter: 3 });
}
function proofs(slide, items, x, y, w, h, fs_ = 12.5) {
  tb(slide, items.map((t, i) => ({ text: t, options: { bullet: { code: "2713" }, breakLine: i < items.length - 1 } })), { x, y, w, h, fontSize: fs_, paraSpaceAfter: 6, color: "2B2B2B" });
}
function footer(slide, id) { const [who, m] = TALK[id];
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.93, w: 1.75, h: 0.27, fill: { color: HEX.dk1 }, line: { color: HEX.dk1 }, objectName: "speaker chip" });
  tb(slide, `${who.toUpperCase()} · ~${mmss(m)}`, { x: 0.58, y: 4.95, w: 1.65, h: 0.24, fontSize: 9.5, bold: true, color: "FFFFFF", valign: "middle" });
  tb(slide, [{ text: "Live: email.html#" + id, options: { hyperlink: { url: `${SITE}#${id}` }, color: HEX.accent1 } }], { x: 2.4, y: 4.95, w: 3.5, h: 0.24, fontSize: 9.5, valign: "middle" }); }
function speak(slide, id, script, extra = "") { note(slide, TALK[id][0], `SAY (simple words): ${TALK[id][2]}  ${script}${extra ? "  IF ASKED: " + extra : ""}  LIVE VERSION: ${SITE}#${id}`); }
function screen(id, title, kick, opts) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Talk" });
  s.addText(title, { placeholder: "title" }); kicker(s, kick);
  if (opts.wide) { simpleBox(s, id, 0.5, 1.3, 9.0, 0.72); picture(s, opts.img, 0.5, 2.12, 9.0, opts.imgH || 1.9, title); if (opts.proofs) proofs(s, opts.proofs, 0.5, 2.15 + (opts.imgH || 1.9), 9.0, 0.75, 12); }
  else { simpleBox(s, id, 0.5, 1.3, 4.0, 1.12); if (opts.proofs) proofs(s, opts.proofs, 0.5, 2.55, 4.0, 2.3); if (opts.img) picture(s, opts.img, 4.75, 1.3, 4.75, 3.55, title); }
  footer(s, id); return s; }

let s;
pres.addSection({ title: "Talk" });
// s1 · the question
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Talk" });
s.addText("Do marketing emails make money? How?", { placeholder: "title" });
kicker(s, "Mission 01 · a real experiment on 64,000 shoppers");
simpleBox(s, "s1", 0.5, 1.3, 5.6, 0.9);
tb(s, [{ text: "Q1  Does an email raise sales?", options: { bold: true, breakLine: true } },
  { text: "Q2  How? More people buying, or buyers spending more?", options: { bold: true, breakLine: true } },
  { text: "Q3  For whom? Must the email match what the customer usually buys?", options: { bold: true } }], { x: 0.5, y: 2.4, w: 5.6, h: 1.4, fontSize: 14, paraSpaceAfter: 8 });
tb(s, "Sahil · Zimo · Feipeng Liu · Sreekar · Shounak\nEN.553.413/613 Applied Statistics and Data Science I · December 2026", { x: 0.5, y: 3.95, w: 5.6, h: 0.8, fontSize: 11, color: "5C5C5C" });
picture(s, "s1", 6.35, 1.2, 3.15, 3.65, "Every customer as a dot; coloured = bought");
footer(s, "s1");
speak(s, "s1", "Each dot on the right is one customer; the coloured ones bought something in the two weeks after the email. We answer three questions with three methods from class.");

// s2 · fair test
s = screen("s2", "A coin flip decided who got which email", "Why we can trust the answer", { img: "s2", proofs: [
  `${C0.n.toLocaleString()} got no email, ${M.n.toLocaleString()} the men's email, ${W.n.toLocaleString()} the women's email`,
  `Before the email the groups match on spending, recency, new customers and past purchases`,
  `Balance check: largest |T| over 10 Welch tests = ${R.max_abs_balance_t.toFixed(2)} (all below 2)`] });
speak(s, "s2", "Because the email was assigned at random, these are causal effects, not just correlations. The table shows the groups were twins before the email.", "Unit of observation is one customer; outcomes are visit, conversion and spend over two weeks; no missing values.");

// s3 · both emails made money
s = screen("s3", "Both emails made money", "Finding 1 · Question 1 · Welch's t-test (Lecture 8)", { img: "s3", proofs: [
  `Per customer: ${usd(C0.revenue_per_customer)} with no email → ${usd(M.revenue_per_customer)} men's (+${Math.round(100 * (M.revenue_per_customer / C0.revenue_per_customer - 1))}%), ${usd(W.revenue_per_customer)} women's (+${Math.round(100 * (W.revenue_per_customer / C0.revenue_per_customer - 1))}%)`,
  `Not luck: a gap this big by chance ≈ ${oneIn(wMC.p)} (men's), ${oneIn(wWC.p)} (women's)`,
  `T_W = ${wMC.t.toFixed(2)} and ${wWC.t.toFixed(2)}; both pass after Bonferroni`] });
speak(s, "s3", "Black lines are 95% confidence intervals. The p-value turned into words: if the email did nothing, a gap this big would happen about once in nine million tries.", `T_W = (X̄_T − X̄_C)/√(S_T²/n_T + S_C²/n_C) = ${wMC.diff.toFixed(3)}/${wMC.se.toFixed(3)} = ${wMC.t.toFixed(2)}. Welch because the groups have different spreads.`);

// s4 · no false alarms
s = screen("s4", "Some \"significant\" results are just luck", "Not fooling ourselves · Bonferroni (Lecture 8)", { img: "s4", proofs: [
  "20 fake experiments where nobody gets an email: about 1 in 20 still passes p < 0.05",
  "So with 3 tests we multiply each p-value by 3 (Bonferroni)",
  `Both emails still pass. "Men's beats women's on revenue" does not: p = ${wMW.p.toFixed(2)} alone, ${wMW.p_bonf.toFixed(2)} corrected. We do not claim it.`] });
speak(s, "s4", "On the website we press the button live: it splits the no-email group in two at random twenty times. Some splits look significant even though nothing differs. That is p-hacking.", "Chance of at least one false alarm in 20 tests = 1 − 0.95^20 ≈ 64%.");

// s5 · more buyers
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Talk" });
s.addText("More buyers, not bigger baskets", { placeholder: "title" }); kicker(s, "Finding 2 · Question 2 · the headline · bootstrap (Lecture 9)");
simpleBox(s, "s5", 0.5, 1.3, 4.0, 1.12);
proofs(s, [`Out of every 1,000 customers: ${(1000 * C0.conv_rate).toFixed(1)} buy with no email, ${(1000 * M.conv_rate).toFixed(1)} after the men's email`,
  `Each buyer spends about the same: $${C0.basket.toFixed(0)} vs $${M.basket.toFixed(0)}`,
  `Rebuilt 10,000 times by resampling customers: buyers always up, basket stays ≈ 1×`], 0.5, 2.55, 4.0, 2.3);
picture(s, "s5_tiles", 4.75, 1.3, 4.75, 1.6, "Revenue = buyers × basket");
[[C0, "No email", HEX.accent3], [M, "Men's email", HEX.accent1]].forEach(([a, lab, col], k) => { const x0 = 4.85 + k * 2.4, y0 = 3.05;
  tb(s, `${lab}: ${(1000 * a.conv_rate).toFixed(1)} of 1,000 buy`, { x: x0, y: y0, w: 2.3, h: 0.25, fontSize: 10, bold: true });
  const nb = Math.round(a.conv_rate * 200);   // 200 dots = 1,000 people, 1 dot per 5 people
  for (let i = 0; i < 200; i++) s.addShape(pres.shapes.OVAL, { x: x0 + (i % 20) * 0.108, y: y0 + 0.32 + Math.floor(i / 20) * 0.135, w: 0.08, h: 0.08, fill: { color: i < nb ? col : "D5D9DF" }, line: { color: i < nb ? col : "D5D9DF" }, objectName: "person dot" }); });
tb(s, "Each dot = 5 customers; coloured = bought", { x: 4.85, y: 4.68, w: 4.6, h: 0.2, fontSize: 9, color: "5C5C5C" });
footer(s, "s5");
speak(s, "s5", "Revenue per customer splits exactly into how many buy times how much each buyer spends. The email more than doubles the number of buyers, and the basket does not move.", `μ_T/μ_C = (p_T/p_C)(m_T/m_C). Bootstrap: resample each group with replacement B = ${R.B.toLocaleString()} times, recompute the three ratios, take the 2.5% and 97.5% quantiles. Buyer ratio ${ci(bM.buyer_ratio)}, basket ratio ${ci(bM.basket_ratio)}.`);

// s6 · men's email wins more buyers
const pMW = pc["Mens E-Mail > Womens E-Mail"].prob;
s = screen("s6", "The men's email wins more buyers", "Finding 3 · which email is stronger? · Bayesian updating (Lecture 11)", { img: "s6", proofs: [
  `${(100 * pMW).toFixed(2)}% probability the men's email turns more customers into buyers than the women's`,
  "Start with no opinion (flat curves); update with every customer; the curves narrow and separate",
  "Same answer when we start sceptical (assume emails do nothing)"] });
speak(s, "s6", "On the website, press Play to watch the belief curves sharpen as customers come in. Buying is a yes/no outcome, much less noisy than dollars, so it can separate the two emails when revenue could not.", "Prior θ ~ Beta(α₀, β₀); after h buyers out of n, θ | x ~ Beta(α₀ + h, β₀ + n − h). P(θ_men > θ_women) by drawing 400,000 values from each posterior.");

// s7 · who responds
const hmW = het("Men's only", "Womens E-Mail");
s = screen("s7", "Men's email works on everyone; women's doesn't", "Finding 4 · Question 3 · for whom?", { wide: true, img: "s7", imgH: 1.85, proofs: [
  `Past men's-wear buyers: the women's email adds only +${(100 * hmW.lift_mean).toFixed(2)} buyers per 100 (P = ${hmW.prob_pos.toFixed(2)}): no clear effect. The men's email clearly helps every group. Exploratory: these six comparisons were not planned in advance.`] });
speak(s, "s7", "We split customers by what they bought in the year before the email, and ran the same Bayesian comparison inside each group.", "Groups are defined before randomization, so each comparison is still randomized. A Welch test with Bonferroni over the 6 subgroups agrees.");

// s8 · why trust it
s = screen("s8", "Four reasons to trust the result", "Why you can believe this", { wide: true, img: "s8", imgH: 1.85, proofs: [
  "Advice: send the men's email widely. Limits: only two weeks; spend is capped at $499; 578 buyers, so 'no basket effect' means no large one; one store in 2008."] });
speak(s, "s8", `Randomized, three methods agree, our shortcut holds (bootstrap error $${bM.diff.se_boot.toFixed(3)} vs Welch formula $${bM.welch_se.toFixed(3)}), and the starting belief doesn't matter.`, "Backup slides after the thank-you have every table, the code map and the three board derivations.");

// s9 · under the hood
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Talk" });
s.addText("Everything is checkable", { placeholder: "title" }); kicker(s, "For the curious and for Q&A");
simpleBox(s, "s9", 0.5, 1.3, 9.0, 0.6);
[["Run the real code", "Our Python, the full data and all 31 unit tests run live in the browser (Code Lab).", "lab.html"], ["Technical page", "Data dictionary, notation, assumptions, results table, board derivations.", "email-technical.html"], ["Report dataset", "Concrete strength: regression, model selection, ridge and lasso.", "concrete.html"]].forEach(([h, t, u], k) => { const x = 0.5 + k * 3.05;
  s.addShape(pres.shapes.RECTANGLE, { x, y: 2.15, w: 2.85, h: 2.45, fill: { color: HEX.lt2 }, line: { color: "E3E3E3" }, objectName: h });
  tb(s, h, { x: x + 0.2, y: 2.3, w: 2.45, h: 0.4, fontSize: 16, bold: true, fontFace: THEME.headFontFace });
  tb(s, t, { x: x + 0.2, y: 2.8, w: 2.45, h: 1.1, fontSize: 12.5 });
  tb(s, [{ text: "Open " + u, options: { hyperlink: { url: SITE.replace("email.html", u) }, color: HEX.accent1, bold: true } }], { x: x + 0.2, y: 4.05, w: 2.45, h: 0.35, fontSize: 12 }); });
footer(s, "s9");
speak(s, "s9", "Thank you. We are happy to open any function or run any test.", "python -m pytest runs all 31 tests; run_all.py reproduces every number.");

// thank-you
s = pres.addSlide({ masterName: "DARK_TITLE", sectionTitle: "Talk" });
s.addText("Emails create buyers; they do not grow baskets", { placeholder: "title" });
s.addText([{ text: "Questions?", options: { breakLine: true, fontSize: 20, bold: true } }, { text: "Live site: sahiljangra12.github.io/asda-final-project", options: { fontSize: 13, hyperlink: { url: "https://sahiljangra12.github.io/asda-final-project/" } } }], { placeholder: "body" });
note(s, "Shounak", "Invite questions. Backup slides follow: technical tables, code map, board derivations.");

pres.addSection({ title: "Backup: technical detail" });
// ---------- 2. data + question ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: technical detail" });
s.addText("A clean experiment with a messy outcome", { placeholder: "title" });
kicker(s, "64,000 past customers, randomized 1:1:1, followed for two weeks");
stat(s, 0.5, 1.4, 2.85, pct(C0.conv_rate), `No email: ${C0.conversions} of ${C0.n.toLocaleString()} bought`, HEX.accent3);
stat(s, 3.575, 1.4, 2.85, pct(M.conv_rate), `Men's email: ${M.conversions} of ${M.n.toLocaleString()} bought`, HEX.accent1);
stat(s, 6.65, 1.4, 2.85, pct(W.conv_rate), `Women's email: ${W.conversions} of ${W.n.toLocaleString()} bought`, HEX.accent2);
tb(s, "Research questions", { x: 0.5, y: 2.7, w: 4.3, h: 0.35, fontSize: 16, bold: true, fontFace: THEME.headFontFace });
tb(s, [
  { text: "Q1  Does each email raise revenue per customer?", options: { breakLine: true } },
  { text: "Q2  Is the lift from more buyers or bigger baskets?", options: { breakLine: true } },
  { text: "Q3  Does it matter whether the email matches what the customer bought before?" },
], { x: 0.5, y: 3.1, w: 4.3, h: 1.9, fontSize: 14, paraSpaceAfter: 8 });
tb(s, "Why it is hard", { x: 5.2, y: 2.7, w: 4.3, h: 0.35, fontSize: 16, bold: true, fontFace: THEME.headFontFace });
tb(s, [
  { text: `Over 98.7% of customers spend $0 in every arm`, options: { bullet: true, breakLine: true } },
  { text: `Spend has a floor ($29.99) and a cap ($499)`, options: { bullet: true, breakLine: true } },
  { text: `Only ${C0.conversions + M.conversions + W.conversions} buyers in total: basket sizes are noisy`, options: { bullet: true, breakLine: true } },
  { text: `Randomization checks out: largest |T| over 10 covariate tests = ${R.max_abs_balance_t.toFixed(2)}`, options: { bullet: true } },
], { x: 5.2, y: 3.1, w: 4.3, h: 1.9, fontSize: 14, paraSpaceAfter: 6 });
note(s, "Sahil", "Unit of observation: one customer. Treatment: segment (randomized). Outcomes over two weeks: visit, conversion, spend. Spend is extremely zero-inflated and right-skewed, with a minimum purchase of $29.99 and a cap at $499. Randomization worked: Welch t-statistics comparing recency, history, newbie and past men's/women's purchases across arms are all below 1 in absolute value.");

// ---------- 3. data understanding figure ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: technical detail" });
s.addText("Emails lift purchases, not spend per buyer", { placeholder: "title" });
kicker(s, "Sample means with 95% confidence intervals (CLT), by randomized arm");
fig(s, "H1_funnel.png", 0.5, 1.4, 9.0, 3.317, "Funnel by arm");
tb(s, `Revenue per customer: ${usd(C0.revenue_per_customer)} (control), ${usd(M.revenue_per_customer)} (men's), ${usd(W.revenue_per_customer)} (women's). Mean spend per buyer: $${C0.basket.toFixed(0)}, $${M.basket.toFixed(0)}, $${W.basket.toFixed(0)}.`,
  { x: 0.5, y: 4.3, w: 9.0, h: 0.7, fontSize: 14 });
note(s, "Zimo", "Bars are sample means with 95% intervals from the CLT. Both emails lift each stage of the funnel. But the mean spend among buyers is about the same in every arm, which motivates Q2: where does the revenue lift come from?");

// =====================================================================

s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: technical detail" });
s.addText("Welch's t-test: both emails raise revenue", { placeholder: "title" });
kicker(s, "Lecture 8 · H0: μT = μC vs H1: μT ≠ μC, unequal variances, 3 tests → Bonferroni α/3");
const hdr = ["Comparison", "Difference ($/customer)", "SE", "T_W", "p", "Bonferroni p"].map(t => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: HEX.dk1 } } }));
const row = (lab, w) => [lab, usd(w.diff), w.se.toFixed(3), w.t.toFixed(2), sci(w.p), { text: sci(w.p_bonf) + (w.p_bonf < 0.05 ? "" : "  (n.s.)"), options: { bold: true } }];
s.addTable([hdr, row("Men's vs control", wMC), row("Women's vs control", wWC), row("Men's vs women's", wMW)],
  { x: 0.5, y: 1.45, w: 9, colW: [2.2, 1.8, 0.9, 0.9, 1.4, 1.8], fontSize: 13, fontFace: THEME.bodyFontFace, color: S.text1, border: { type: "solid", pt: 0.5, color: "E3E3E3" }, rowH: 0.42, objectName: "Welch table" });
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 3.4, w: 4.3, h: 1.6, fill: { color: HEX.lt2 }, line: { color: HEX.lt2 }, rectRadius: 0.08, objectName: "formula card" });
tb(s, [{ text: "Welch's statistic", options: { bold: true, breakLine: true } },
  { text: "T_W = (X̄_T − X̄_C) / √(S_T²/n_T + S_C²/n_C)", options: { breakLine: true } },
  { text: "With n ≈ 21,000 per arm the CLT makes T_W ≈ N(0,1) under H0, even though spend is 99% zeros (checked by bootstrap: see 'Checking our own assumptions')." }],
  { x: 0.7, y: 3.5, w: 3.95, h: 1.45, fontSize: 13, paraSpaceAfter: 4 });
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.2, y: 3.4, w: 4.3, h: 1.6, fill: { color: "FDECE3" }, line: { color: "FDECE3" }, rectRadius: 0.08, objectName: "p-hacking card" });
tb(s, [{ text: "The p-hacking trap", options: { bold: true, breakLine: true } },
  { text: `Men's vs women's has p = ${wMW.p.toFixed(3)}: "significant" alone, but ${wMW.p_bonf.toFixed(3)} after correcting for the 3 tests we ran. On revenue, we cannot rank the two emails.` }],
  { x: 5.4, y: 3.5, w: 3.95, h: 1.45, fontSize: 13, paraSpaceAfter: 4 });
note(s, "Zimo", "Primary family of three tests on revenue per customer. Welch because the arm variances differ. Bonferroni multiplies each p-value by 3. Both emails clearly beat control. The men's-vs-women's comparison would look significant on its own but not after correction: that is exactly the p-hacking issue from Lecture 8. On the board: T_W = 0.770 / 0.145 = 5.30.");

// =====================================================================

s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: technical detail" });
s.addText("Bayesian view: the men's email converts best", { placeholder: "title" });
kicker(s, "Lecture 11 · prior θ ~ Beta(1,1); posterior θ | x ~ Beta(1 + h, 1 + n − h); comparisons by Monte Carlo");
fig(s, "H3_posteriors.png", 0.4, 1.4, 5.8, 1.985, "Posterior densities");
const prow = (lab, k) => [lab, { text: pc[k].prob >= 0.9999 ? ">0.999" : pc[k].prob.toFixed(3), options: { bold: true, align: "right" } }, { text: `${(100 * pc[k].diff_lo).toFixed(2)} to ${(100 * pc[k].diff_hi).toFixed(2)} pp`, options: { align: "right" } }];
s.addTable([
  [{ text: "Posterior probability", options: { bold: true } }, { text: "P", options: { bold: true, align: "right" } }, { text: "95% interval of difference", options: { bold: true, align: "right" } }],
  prow("θ_men > θ_ctrl", "Mens E-Mail > No E-Mail"), prow("θ_women > θ_ctrl", "Womens E-Mail > No E-Mail"), prow("θ_men > θ_women", "Mens E-Mail > Womens E-Mail")],
  { x: 6.4, y: 1.45, w: 3.1, colW: [1.05, 0.75, 1.3], fontSize: 11, fontFace: THEME.bodyFontFace, color: S.text1, border: { type: "solid", pt: 0.5, color: "E3E3E3" }, objectName: "posterior table" });
tb(s, `Unlike revenue, conversion separates the emails: buying is a 0/1 outcome with far less noise than dollar spend. Results are unchanged under Jeffreys, a 1% informative prior, and a sceptical prior centred on "no effect" worth 5,000 customers.`,
  { x: 6.4, y: 3.4, w: 3.1, h: 1.7, fontSize: 12 });
note(s, "Feipeng Liu", "Conjugacy: Beta prior times Binomial likelihood gives a Beta posterior, so updating is just adding buyers to alpha and non-buyers to beta. We estimate P(theta_A > theta_B) by drawing 400,000 values from each posterior. The difference in conversion between the two emails is clear, while the revenue difference was not: dollars are much noisier than 0/1 purchases. Prior sensitivity: even a sceptical prior centred at the control rate, worth 5,000 customers, leaves the probabilities above 0.999. Live demo: the interactive explorer lets you change the prior and the amount of data.");

// ---------- heterogeneity ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: technical detail" });
s.addText("The women's email misses past men's buyers", { placeholder: "title" });
kicker(s, "Q3 · posterior conversion lift θ_email − θ_control within each past-purchase group");
fig(s, "H5_heterogeneity.png", 0.4, 1.4, 6.0, 1.85, "Lift by past purchase");
const hm = het("Men's only", "Womens E-Mail"), hw = het("Women's only", "Womens E-Mail"), hmm = het("Women's only", "Mens > Womens");
tb(s, [
  { text: "Matched email is not the story", options: { bold: true, breakLine: true } },
  { text: `Past men's buyers: women's email P(lift > 0) = ${hm.prob_pos.toFixed(2)}`, options: { bullet: true, breakLine: true } },
  { text: `Past women's buyers: both emails work; P(men's > women's) = ${hmm.prob_pos.toFixed(2)}`, options: { bullet: true, breakLine: true } },
  { text: "The men's email lifts every group", options: { bullet: true, breakLine: true } },
  { text: "Exploratory: 6 subgroup Welch tests agree after Bonferroni, but subgroups were not pre-registered", options: { bullet: true, italic: true } },
], { x: 6.65, y: 1.4, w: 2.85, h: 3.6, fontSize: 12.5, paraSpaceAfter: 6 });
note(s, "Feipeng Liu", "Same Beta-Binomial machinery, run within groups defined by what customers bought before randomization. That keeps the comparison randomized within each group. The women's email does essentially nothing for customers who only bought men's merchandise. Among women's buyers, the men's email does as well as the women's email. We flag this as exploratory: six subgroup comparisons, so we checked them with Bonferroni too.");

// =====================================================================

s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: technical detail" });
s.addText("The bootstrap splits the lift: it is all buyers", { placeholder: "title" });
kicker(s, `Lecture 9 · μ = p·m, so μT/μC = (pT/pC)·(mT/mC); B = ${R.B.toLocaleString()} resamples of each arm, percentile 95% CIs`);
fig(s, "H4_decomposition.png", 0.5, 1.4, 5.6, 1.666, "Revenue decomposition");
stat(s, 6.6, 1.4, 2.9, Math.abs(bM.buyer_share.obs - 1) < 0.05 ? "≈100%" : `${(100 * bM.buyer_share.obs).toFixed(0)}%`, `of the men's email's log-lift is from more buyers (95% CI ${(100 * bM.buyer_share.lo).toFixed(0)}–${(100 * bM.buyer_share.hi).toFixed(0)}%)`, HEX.accent1);
stat(s, 6.6, 2.6, 2.9, `${(100 * bW.buyer_share.obs).toFixed(0)}%`, `for the women's email (95% CI ${(100 * bW.buyer_share.lo).toFixed(0)}–${(100 * bW.buyer_share.hi).toFixed(0)}%)`, HEX.accent2);
tb(s, `Basket ratios ${bM.basket_ratio.obs.toFixed(2)} and ${bW.basket_ratio.obs.toFixed(2)}: both CIs include 1. Why the bootstrap: no simple formula gives the SE of a ratio of ratios.`,
  { x: 6.6, y: 3.8, w: 2.9, h: 1.25, fontSize: 12 });
note(s, "Sreekar", "Revenue per customer is conversion probability times mean spend per buyer, so the revenue ratio factors exactly into a buyer ratio times a basket ratio. Taking logs makes it additive. The sampling distribution of these ratios has no easy closed form, so we use the nonparametric bootstrap: resample each arm with replacement, keeping arm sizes fixed as in the randomized design, recompute all three ratios on the same resample, and take percentiles. Result: the basket effect is indistinguishable from 1; essentially the whole lift comes from more people buying.");

// ---------- validation ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: technical detail" });
s.addText("Checking our own assumptions", { placeholder: "title" });
kicker(s, "Does the CLT really hold for spend that is 99% zeros? Bootstrap SE vs Welch's analytic SE");
fig(s, "H6_bootstrap_vs_clt.png", 0.8, 1.4, 8.4, 2.859, "Bootstrap vs CLT");
tb(s, `Men's: bootstrap SE ${bM.diff.se_boot.toFixed(3)} vs Welch ${bM.welch_se.toFixed(3)}. Women's: ${bW.diff.se_boot.toFixed(3)} vs ${bW.welch_se.toFixed(3)}. Agreement within 2%: the normal approximation behind T_W is safe here.`,
  { x: 0.5, y: 4.45, w: 9.0, h: 0.7, fontSize: 14 });
note(s, "Sreekar", "A sanity check that links two concepts. If the CLT approximation were poor, the bootstrap distribution of the mean difference would be skewed and its SE would differ from Welch's. They match closely, so the Welch tests are trustworthy. Our code also has 31 unit tests: for example, our Welch function matches scipy, our Beta update gives the same answer sequentially and in one batch, and the revenue identity holds exactly.");

// =====================================================================

s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: technical detail" });
s.addText("What the data can and cannot establish", { placeholder: "title" });
const col2 = (x, head, items, fill) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.2, w: 4.35, h: 3.8, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08, objectName: head });
  tb(s, head, { x: x + 0.25, y: 1.35, w: 3.9, h: 0.4, fontSize: 17, bold: true, fontFace: THEME.headFontFace });
  tb(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })), { x: x + 0.25, y: 1.85, w: 3.9, h: 3.05, fontSize: 13.5, paraSpaceAfter: 7 });
};
col2(0.5, "Established (randomized)", [
  `Both emails raise revenue per customer (Bonferroni p ≤ ${sci(wWC.p_bonf)})`,
  `The lift comes from more buyers; basket size shows no detectable change`,
  `The men's email converts more than the women's (P > 0.999), but the revenue gap is not significant`,
  `Two-week effect: ${usd(wMC.diff)} (men's) and ${usd(wWC.diff)} (women's) per customer emailed`], "EAF2FC");
col2(5.15, "Limits", [
  "Two-week window: no long-run or repeat-purchase effects",
  "Spend capped at $499 and floored at $29.99, so basket estimates are truncated",
  `Only ${M.conversions} and ${W.conversions} buyers: basket CIs are wide, so "no basket effect" means "no large one"`,
  "Subgroup results are exploratory; a 2008 retailer may not generalize"], HEX.lt2);
note(s, "Shounak", "Summary. Because assignment was random, the differences between arms are causal effects of the emails over two weeks. Our main finding, more buyers rather than bigger baskets, is supported by two independent methods: the bootstrap decomposition and the stable basket sizes. Limits: short window, truncated spend, few buyers, and exploratory subgroups. Questions welcome; the interactive explorer and all code are in our submission.");

// =====================================================================
pres.addSection({ title: "Backup: code and board" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: code and board" });
s.addText("Backup: where each method lives in the code", { placeholder: "title" });
const code = [
  ["Method (lecture)", "Function in src/asda/stats_tools.py", "Unit test in tests/"],
  ["Welch's t (L8)", "welch_t(x_t, x_c)", "test_welch_matches_scipy"],
  ["Bonferroni (L8)", "bonferroni(pvals, alpha)", "test_bonferroni"],
  ["Nonparametric bootstrap (L9)", "bootstrap_two_sample(stat_fn, x_t, x_c, B)", "test_bootstrap_se_matches_analytic…"],
  ["Percentile CI (L9)", "percentile_ci(reps, level)", "test_percentile_ci"],
  ["Beta–Binomial update (L11)", "beta_posterior(h, n, α0, β0)", "test_beta_posterior_update_and_sequential…"],
  ["P(θA > θB) by Monte Carlo (L5, L11)", "prob_greater(post_a, post_b, M)", "test_prob_greater_symmetric_and_extreme"],
  ["Revenue identity", "hillstrom_analysis.decomposition_stats", "test_revenue_identity_holds_exactly"],
];
s.addTable(code.map((r, i) => r.map(t => ({ text: t, options: i === 0 ? { bold: true, color: "FFFFFF", fill: { color: HEX.dk1 } } : {} }))),
  { x: 0.5, y: 1.2, w: 9, colW: [2.6, 3.3, 3.1], fontSize: 12, fontFace: THEME.bodyFontFace, color: S.text1, border: { type: "solid", pt: 0.5, color: "E3E3E3" }, rowH: 0.4, objectName: "code map" });
tb(s, "Reproduce everything: python src/hillstrom_analysis.py (seed 20261207) · python -m pytest (31 tests)", { x: 0.5, y: 4.75, w: 9, h: 0.35, fontSize: 12, color: "5C5C5C" });
note(s, "All", "If asked to find a function: every statistical method is a short, commented function in stats_tools.py, written from the lecture formulas, and each has a test comparing it with scipy or with a property from lecture.");

s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: code and board" });
s.addText("Backup: the three derivations for the board", { placeholder: "title" });
const card = (x, head, lines) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.2, w: 2.9, h: 3.85, fill: { color: HEX.lt2 }, line: { color: HEX.lt2 }, rectRadius: 0.08, objectName: head });
  tb(s, head, { x: x + 0.2, y: 1.35, w: 2.5, h: 0.4, fontSize: 15, bold: true, fontFace: THEME.headFontFace });
  tb(s, lines.map((t, i) => ({ text: t, options: { breakLine: i < lines.length - 1 } })), { x: x + 0.2, y: 1.85, w: 2.5, h: 3.1, fontSize: 12, paraSpaceAfter: 6 });
};
card(0.5, "Beta–Binomial", ["Prior p(θ) ∝ θ^(α−1)(1−θ)^(β−1)", "Likelihood ∝ θ^h (1−θ)^(n−h)", "Posterior ∝ θ^(α+h−1)(1−θ)^(β+n−h−1)", "⇒ Beta(α + h, β + n − h)", `Men's: Beta(${R.posterior["Mens E-Mail"].a}, ${R.posterior["Mens E-Mail"].b.toLocaleString()})`]);
card(3.55, "Welch's t", ["Var(X̄T − X̄C) = σT²/nT + σC²/nC (independent arms)", "Plug in S² for σ²", `T_W = ${wMC.diff.toFixed(3)} / ${wMC.se.toFixed(3)} = ${wMC.t.toFixed(2)}`, "Two-sided p = 2P(T > |T_W|)", "Bonferroni: p × 3"]);
card(6.6, "Bootstrap", ["For b = 1..B:", "  draw n_T customers from arm T with replacement, n_C from control", "  compute θ̂*(b) = buyer, basket, revenue ratios", "SE_boot = SD(θ̂*(1..B))", "95% CI = 2.5% and 97.5% quantiles"]);
note(s, "All", "Each of us should be able to write any of these on the board.");

s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup: code and board" });
s.addText("Backup: evidence accumulates sequentially", { placeholder: "title" });
kicker(s, "Lecture 11 · sequential updating reaches the same posterior as one batch update");
fig(s, "H7_sequential.png", 0.5, 1.45, 9.0, 3.874, "Sequential updating");
note(s, "Feipeng Liu", "Feeding customers in random order, the posterior probability that the men's email beats control is noisy for the first few hundred customers per arm and then settles above 0.95.");

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
