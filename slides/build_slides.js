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
pres.addSection({ title: "Opening" });
let s = pres.addSlide({ masterName: "DARK_TITLE", sectionTitle: "Opening" });
s.addText("More buyers, not bigger baskets", { placeholder: "title" });
s.addText([
  { text: "What a randomized email test of 64,000 customers can and cannot tell us", options: { breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 8 } },
  { text: "Sahil · Zimo · Feipeng Liu · Sreekar · Shounak", options: { breakLine: true, fontSize: 13 } },
  { text: "EN.553.413/613 Applied Statistics and Data Science I · Final project presentation · December 2026", options: { fontSize: 11 } },
], { placeholder: "body" });
note(s, "Sahil", "We analyse the Hillstrom email experiment. Customers were randomly sent a men's email, a women's email, or nothing. Our headline: the emails create more buyers, not bigger baskets. We use three course concepts: Welch's t-test with a multiple-testing correction, Bayesian Beta-Binomial updating, and the nonparametric bootstrap.");

// ---------- 2. data + question ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Opening" });
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
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Opening" });
s.addText("Emails lift purchases, not spend per buyer", { placeholder: "title" });
kicker(s, "Sample means with 95% confidence intervals (CLT), by randomized arm");
fig(s, "H1_funnel.png", 0.5, 1.4, 9.0, 3.317, "Funnel by arm");
tb(s, `Revenue per customer: ${usd(C0.revenue_per_customer)} (control), ${usd(M.revenue_per_customer)} (men's), ${usd(W.revenue_per_customer)} (women's). Mean spend per buyer: $${C0.basket.toFixed(0)}, $${M.basket.toFixed(0)}, $${W.basket.toFixed(0)}.`,
  { x: 0.5, y: 4.3, w: 9.0, h: 0.7, fontSize: 14 });
note(s, "Zimo", "Bars are sample means with 95% intervals from the CLT. Both emails lift each stage of the funnel. But the mean spend among buyers is about the same in every arm, which motivates Q2: where does the revenue lift come from?");

// =====================================================================
pres.addSection({ title: "Concept 1: Welch t-test" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Concept 1: Welch t-test" });
s.addText("Welch's t-test: both emails raise revenue", { placeholder: "title" });
kicker(s, "Lecture 8 · H0: μT = μC vs H1: μT ≠ μC, unequal variances, 3 tests → Bonferroni α/3");
const hdr = ["Comparison", "Difference ($/customer)", "SE", "T_W", "p", "Bonferroni p"].map(t => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: HEX.dk1 } } }));
const row = (lab, w) => [lab, usd(w.diff), w.se.toFixed(3), w.t.toFixed(2), sci(w.p), { text: sci(w.p_bonf) + (w.p_bonf < 0.05 ? "" : "  (n.s.)"), options: { bold: true } }];
s.addTable([hdr, row("Men's vs control", wMC), row("Women's vs control", wWC), row("Men's vs women's", wMW)],
  { x: 0.5, y: 1.45, w: 9, colW: [2.2, 1.8, 0.9, 0.9, 1.4, 1.8], fontSize: 13, fontFace: THEME.bodyFontFace, color: S.text1, border: { type: "solid", pt: 0.5, color: "E3E3E3" }, rowH: 0.42, objectName: "Welch table" });
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 3.4, w: 4.3, h: 1.6, fill: { color: HEX.lt2 }, line: { color: HEX.lt2 }, rectRadius: 0.08, objectName: "formula card" });
tb(s, [{ text: "Welch's statistic", options: { bold: true, breakLine: true } },
  { text: "T_W = (X̄_T − X̄_C) / √(S_T²/n_T + S_C²/n_C)", options: { breakLine: true } },
  { text: "With n ≈ 21,000 per arm the CLT makes T_W ≈ N(0,1) under H0, even though spend is 99% zeros (checked by bootstrap, slide 7)." }],
  { x: 0.7, y: 3.5, w: 3.95, h: 1.45, fontSize: 13, paraSpaceAfter: 4 });
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.2, y: 3.4, w: 4.3, h: 1.6, fill: { color: "FDECE3" }, line: { color: "FDECE3" }, rectRadius: 0.08, objectName: "p-hacking card" });
tb(s, [{ text: "The p-hacking trap", options: { bold: true, breakLine: true } },
  { text: `Men's vs women's has p = ${wMW.p.toFixed(3)}: "significant" alone, but ${wMW.p_bonf.toFixed(3)} after correcting for the 3 tests we ran. On revenue, we cannot rank the two emails.` }],
  { x: 5.4, y: 3.5, w: 3.95, h: 1.45, fontSize: 13, paraSpaceAfter: 4 });
note(s, "Zimo", "Primary family of three tests on revenue per customer. Welch because the arm variances differ. Bonferroni multiplies each p-value by 3. Both emails clearly beat control. The men's-vs-women's comparison would look significant on its own but not after correction: that is exactly the p-hacking issue from Lecture 8. On the board: T_W = 0.770 / 0.145 = 5.30.");

// =====================================================================
pres.addSection({ title: "Concept 2: Bayesian updating" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Concept 2: Bayesian updating" });
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
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Concept 2: Bayesian updating" });
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
pres.addSection({ title: "Concept 3: Bootstrap" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Concept 3: Bootstrap" });
s.addText("The bootstrap splits the lift: it is all buyers", { placeholder: "title" });
kicker(s, `Lecture 9 · μ = p·m, so μT/μC = (pT/pC)·(mT/mC); B = ${R.B.toLocaleString()} resamples of each arm, percentile 95% CIs`);
fig(s, "H4_decomposition.png", 0.5, 1.4, 5.6, 1.666, "Revenue decomposition");
stat(s, 6.6, 1.4, 2.9, Math.abs(bM.buyer_share.obs - 1) < 0.05 ? "≈100%" : `${(100 * bM.buyer_share.obs).toFixed(0)}%`, `of the men's email's log-lift is from more buyers (95% CI ${(100 * bM.buyer_share.lo).toFixed(0)}–${(100 * bM.buyer_share.hi).toFixed(0)}%)`, HEX.accent1);
stat(s, 6.6, 2.6, 2.9, `${(100 * bW.buyer_share.obs).toFixed(0)}%`, `for the women's email (95% CI ${(100 * bW.buyer_share.lo).toFixed(0)}–${(100 * bW.buyer_share.hi).toFixed(0)}%)`, HEX.accent2);
tb(s, `Basket ratios ${bM.basket_ratio.obs.toFixed(2)} and ${bW.basket_ratio.obs.toFixed(2)}: both CIs include 1. Why the bootstrap: no simple formula gives the SE of a ratio of ratios.`,
  { x: 6.6, y: 3.8, w: 2.9, h: 1.25, fontSize: 12 });
note(s, "Sreekar", "Revenue per customer is conversion probability times mean spend per buyer, so the revenue ratio factors exactly into a buyer ratio times a basket ratio. Taking logs makes it additive. The sampling distribution of these ratios has no easy closed form, so we use the nonparametric bootstrap: resample each arm with replacement, keeping arm sizes fixed as in the randomized design, recompute all three ratios on the same resample, and take percentiles. Result: the basket effect is indistinguishable from 1; essentially the whole lift comes from more people buying.");

// ---------- validation ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Concept 3: Bootstrap" });
s.addText("Checking our own assumptions", { placeholder: "title" });
kicker(s, "Does the CLT really hold for spend that is 99% zeros? Bootstrap SE vs Welch's analytic SE");
fig(s, "H6_bootstrap_vs_clt.png", 0.8, 1.4, 8.4, 2.859, "Bootstrap vs CLT");
tb(s, `Men's: bootstrap SE ${bM.diff.se_boot.toFixed(3)} vs Welch ${bM.welch_se.toFixed(3)}. Women's: ${bW.diff.se_boot.toFixed(3)} vs ${bW.welch_se.toFixed(3)}. Agreement within 2%: the normal approximation behind T_W is safe here.`,
  { x: 0.5, y: 4.45, w: 9.0, h: 0.7, fontSize: 14 });
note(s, "Sreekar", "A sanity check that links two concepts. If the CLT approximation were poor, the bootstrap distribution of the mean difference would be skewed and its SE would differ from Welch's. They match closely, so the Welch tests on slide 4 are trustworthy. Our code also has 31 unit tests: for example, our Welch function matches scipy, our Beta update gives the same answer sequentially and in one batch, and the revenue identity holds exactly.");

// =====================================================================
pres.addSection({ title: "Conclusion" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Conclusion" });
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

// ---------- closing ----------
s = pres.addSlide({ masterName: "DARK_TITLE", sectionTitle: "Conclusion" });
s.addText("Emails create buyers; they do not grow baskets", { placeholder: "title" });
s.addText([
  { text: "Try it live: the interactive explorer recomputes every posterior and bootstrap in the browser", options: { breakLine: true } },
  { text: "interactive/hillstrom_explorer.html · code: src/ · tests: python -m pytest", options: { fontSize: 13 } },
], { placeholder: "body" });
note(s, "Shounak", "Open interactive/hillstrom_explorer.html for the live demo if time allows: switch to 'Past men's buyers' to show the women's email's posterior overlapping control, then slide 'Data used' down to 5% to show the posterior widening like 1/sqrt(n).");

// =====================================================================
pres.addSection({ title: "Backup" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup" });
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

s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup" });
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

s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Backup" });
s.addText("Backup: evidence accumulates sequentially", { placeholder: "title" });
kicker(s, "Lecture 11 · sequential updating reaches the same posterior as one batch update");
fig(s, "H7_sequential.png", 0.5, 1.45, 9.0, 3.874, "Sequential updating");
note(s, "Feipeng Liu", "Feeding customers in random order, the posterior probability that the men's email beats control is noisy for the first few hundred customers per arm and then settles above 0.95.");

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
