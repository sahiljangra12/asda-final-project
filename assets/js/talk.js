/* Presentation-day layer, shared by email.html, concrete.html and index.html.
   - adds an "In simple words" box, key-word chips with plain definitions, and the speaker to every screen
   - Present mode: one screen at a time, full screen, speaker + talk timer in the corner
   - ?talk=1 in the URL shows a "Start presentation" button (full screen needs a click) */
"use strict";
const TEAM = ["Sahil", "Zimo", "Feipeng Liu", "Sreekar", "Shounak"];
const TALK_LIMIT = 12 * 60, TALK_TARGET = 8 * 60;   // 12 min slot incl. Q&A; aim to finish talking by 8:00

/* Plain-English definitions, shown when a word chip is hovered or tapped */
const GLOSS = {
  "randomized": "A coin flip decided who got which email. So the groups are alike, and any later difference is caused by the email.",
  "control group": "The customers who got no email. We compare everyone else against them.",
  "average": "Add up everyone's spending and divide by the number of people.",
  "p-value": "If the email truly did nothing, how often would we see a gap this big by pure luck? Tiny p-value = very unlikely to be luck.",
  "Welch's t-test": "A standard test for whether two group averages really differ, allowing the two groups to be spread out differently.",
  "confidence interval": "A range that very likely contains the true value. Narrow range = we know it precisely.",
  "false alarm": "A result that looks real but is only luck.",
  "Bonferroni": "When you run several tests, make the pass mark stricter (divide 0.05 by the number of tests), so luck is less likely to fool you.",
  "bootstrap": "Re-create the experiment thousands of times by re-drawing customers from our own data, to see how much the answer wobbles.",
  "ratio": "How many times bigger: 2× means double, 1× means no change.",
  "prior": "What we believe before seeing the data. We tried a neutral one and a sceptical one.",
  "posterior": "What we believe after seeing the data: the prior updated by the evidence.",
  "Bayesian": "A way of doing statistics that updates beliefs with evidence and gives answers as probabilities, like '99.99% sure'.",
  "probability": "How sure we are, from 0% (impossible) to 100% (certain).",
  "subgroup": "A slice of customers, here by what they bought last year.",
  "exploratory": "Interesting, but not planned in advance, so treat it as a lead, not proof.",
  "causal": "The email caused the change, not just appeared alongside it.",
  "unit test": "A small automatic check that a function gives the right answer.",
  "binder": "The glue powder: cement plus slag plus fly ash.",
  "water / binder ratio": "Kilos of water per kilo of binder. Higher = runnier paste = weaker concrete.",
  "MPa": "Megapascals, the unit of strength: how much pressure the cylinder takes before it crushes.",
  "regression": "Fit the best line (or curve) through the data to predict one thing from others.",
  "R²": "Share of the differences in strength that the model explains. 78% means most of it.",
  "standard error": "How much an estimate would wobble if we repeated the study. Effect ÷ standard error = how many 'wobbles' away from zero.",
  "log scale": "Measuring in multiples instead of plus/minus: 10 → 20 is the same step as 20 → 40.",
  "residual": "The model's mistake for one cylinder: actual minus predicted.",
  "Cook's distance": "How much the whole fit would change if we removed one cylinder. Small for all = no single point controls the result.",
  "training set": "The recipes the model is allowed to learn from.",
  "test set": "Recipes hidden away and used only once, at the end, to grade the model honestly.",
  "cross-validation": "Practice exams: hide one tenth of the training recipes, fit on the rest, check, and repeat ten times.",
  "AIC / BIC": "Scores that reward a good fit but charge a penalty for every extra term, so complicated models must earn their place.",
  "overfitting": "Memorising the data you saw instead of learning the pattern, so new data is predicted badly.",
  "typical miss": "On average, how far off the prediction is, in percent.",
  "lasso": "A regression with a budget: it shrinks weak inputs and drops useless ones to exactly zero.",
  "ridge": "A regression that shrinks all inputs a bit to keep them stable; it never drops any.",
  "slag / fly ash": "Leftovers from steel making and coal power stations, used to replace part of the cement.",
  "association": "Two things move together in the data, which is not the same as one causing the other.",
};

/* One entry per screen: who speaks, minutes to spend, one plain sentence, words to define */
const SCREENS = {
  email: {
    s1: ["Sahil", .75, "A shop emailed its old customers. We check three things: did the email bring in money, how, and for whom.", ["randomized", "control group"]],
    s2: ["Sahil", .75, "A coin flip picked who got which email, so the three groups were the same kind of people. Any difference afterwards is because of the email.", ["randomized", "causal", "average"]],
    s3: ["Zimo", 1, "Customers who got an email spent more on average. The gap is far too big to be luck.", ["average", "p-value", "Welch's t-test", "confidence interval"]],
    s4: ["Zimo", .75, "Run enough tests and a few look 'significant' by pure luck. So we use a stricter pass mark, and drop the one claim that fails it.", ["false alarm", "p-value", "Bonferroni"]],
    s5: ["Sreekar", 1.5, "The email makes more people buy. The people who buy spend the same as before. So the extra money comes from extra buyers.", ["ratio", "bootstrap", "confidence interval"]],
    s6: ["Feipeng Liu", 1, "We start with no opinion and update it as each customer's choice comes in. The men's email ends up ahead, almost certainly.", ["Bayesian", "prior", "posterior", "probability"]],
    s7: ["Feipeng Liu", .75, "The men's email helped every type of customer. The women's email did nothing for people who usually buy men's clothes.", ["subgroup", "probability", "exploratory"]],
    s8: ["Shounak", 1, "Three different methods agree and our starting belief does not change the answer, so we trust it. Advice: send the men's email.", ["causal", "bootstrap", "prior"]],
    s9: ["Shounak", .5, "Every number on these screens comes from our code, which runs live, with 31 automatic checks.", ["unit test"]],
  },
  concrete: {
    s1: [null, 0, "We test whether a 100-year-old rule, 'less water makes stronger concrete', still predicts strength today.", ["binder", "water / binder ratio"]],
    s2: [null, 0, "Each dot is one concrete cylinder crushed in a lab. Runnier mixes (to the right) are weaker.", ["MPa", "binder", "water / binder ratio"]],
    s3: [null, 0, "Just two facts, the water ratio and the age, predict most of the strength. Each extra 0.1 of water costs about a quarter of it.", ["regression", "R²", "standard error"]],
    s4: [null, 0, "We check the model's mistakes. Measured in multiples (log scale) they look like random noise, which is what a good model leaves.", ["residual", "log scale", "Cook's distance"]],
    s5: [null, 0, "Like a fair exam: we hide some recipes, learn from the rest, and grade the model only on the hidden ones.", ["training set", "test set", "cross-validation", "AIC / BIC"]],
    s6: [null, 0, "The simple rule is nearly as accurate as a huge 44-term model, and a person can understand it.", ["typical miss", "overfitting", "test set"]],
    s7: [null, 0, "A method that throws away useless inputs keeps the water ratio first: the data finds the old rule by itself.", ["lasso", "ridge"]],
    s8: [null, 0, "Swapping some cement for slag makes concrete weaker at first but stronger after a year. Fly ash stays a bit weaker.", ["slag / fly ash", "association"]],
    s9: [null, 0, "Why you can believe this, and what it cannot tell us.", ["test set", "association"]],
    s10: [null, 0, "Everything can be checked: the code runs live in the browser.", ["unit test"]],
  },
};

const PAGE = /concrete/.test(location.pathname) ? "concrete" : /email/.test(location.pathname) ? "email" : "home";

/* ---------- word chips with tap/hover definitions ---------- */
function chip(w) { return `<button type="button" class="gw" data-w="${esc(w)}">${esc(w)}</button>`; }
const defBox = document.createElement("div"); defBox.className = "gdef"; document.body.appendChild(defBox);
let openChip = null;
function showDef(b) { if (openChip && openChip !== b) openChip.classList.remove("open"); openChip = b;
  if (!b) { defBox.classList.remove("show"); return; } b.classList.add("open");
  defBox.innerHTML = `<b>${esc(b.dataset.w)}</b>${esc(GLOSS[b.dataset.w] || "")}`; defBox.classList.add("show");
  const r = b.getBoundingClientRect(), w = defBox.offsetWidth, h = defBox.offsetHeight;
  defBox.style.left = clamp(r.left, 10, innerWidth - w - 10) + "px"; defBox.style.top = (r.top - h - 10 > 10 ? r.top - h - 10 : r.bottom + 10) + "px"; }
const hoverable = matchMedia("(hover: hover)").matches;
document.addEventListener("click", e => { const b = e.target.closest(".gw"); showDef(b && b !== openChip ? b : null); });
if (hoverable) { document.addEventListener("mouseover", e => { const b = e.target.closest(".gw"); if (b && b !== openChip) showDef(b); });
  document.addEventListener("mouseout", e => { const b = e.target.closest(".gw"); if (b && !b.contains(e.relatedTarget)) showDef(null); }); }
addEventListener("scroll", () => openChip && showDef(null), { passive: true });

/* ---------- inject the simple-words box and speaker on each screen ---------- */
if (SCREENS[PAGE]) for (const [id, [who, , simple, words]] of Object.entries(SCREENS[PAGE])) {
  const sec = document.getElementById(id); if (!sec) continue;
  if (who) { sec.dataset.speaker = who; const k = $(".kicker", sec); if (k) k.insertAdjacentHTML("afterbegin", `<span class="spk">${esc(who)}</span>`); }
  const box = document.createElement("div"); box.className = "simple";
  box.innerHTML = `<p><b>In simple words</b>${esc(simple)}</p><div class="gws"><span>Words on this screen</span>${words.map(chip).join("")}</div>`;
  const det = $("details.math", sec), claim = $(".claim", sec) || $("h1", sec);
  const says = $$(".say", sec), lastSay = says[says.length - 1];
  if (det) det.before(box); else if (sec.id === "s1") { const pr = $(".proofs", sec); (pr || claim).after(box); } else (lastSay || claim).after(box);
}

/* ---------- talk timer + speaker in present mode ---------- */
if (PAGE !== "home") {
  const hud = document.createElement("div"); hud.className = "hud"; hud.innerHTML = `<span class="who"></span><span class="clock">0:00</span><button type="button" class="reset" title="Restart timer">↺</button>`; document.body.appendChild(hud);
  let t0 = null; const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const tickHud = () => { const on = document.documentElement.classList.contains("present"); hud.classList.toggle("show", on);
    if (on && t0 === null) t0 = performance.now(); if (t0 !== null) { const s = (performance.now() - t0) / 1000; $(".clock", hud).textContent = `${mmss(s)} / ${mmss(TALK_LIMIT)}`; hud.dataset.state = s > TALK_LIMIT - 60 ? "over" : s > TALK_TARGET ? "qa" : ""; }
    const cur = $$("section[id^=s]").find(sct => { const r = sct.getBoundingClientRect(); return r.top < innerHeight * .5 && r.bottom > innerHeight * .5; });
    const cfg = cur && SCREENS[PAGE][cur.id]; $(".who", hud).textContent = cfg && cfg[0] ? `${cfg[0]} · ~${mmss(cfg[1] * 60)}` : (cur ? cur.dataset.title : ""); };
  setInterval(tickHud, 500); $(".reset", hud).onclick = () => { t0 = performance.now(); };
  if (new URLSearchParams(location.search).has("talk")) {
    const ov = document.createElement("div"); ov.className = "startov";
    ov.innerHTML = `<div><p class="kicker">Presentation day</p><h2 class="claim" style="font-size:clamp(30px,4vw,52px)">${PAGE === "email" ? "Do marketing emails make money?" : "What makes concrete strong?"}</h2><p class="say" style="margin:14px auto 0">${TEAM.join(" · ")}</p><button class="btn solid" type="button" style="margin-top:26px">Start · full screen</button><p class="note" style="margin-top:14px">→ / space: next screen · ←: back · Esc: leave full screen</p></div>`;
    document.body.appendChild(ov); $("button", ov).onclick = () => { ov.remove(); $(".present-btn").click(); t0 = performance.now(); scrollTo(0, 0); };
  }
}

/* ---------- home: run of show ---------- */
if (PAGE === "home") { const el = document.getElementById("runshow"); if (el) {
  const mm = m => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, "0")}`; let acc = 0;
  el.innerHTML = `<tr><th>#</th><th>Screen</th><th>Speaker</th><th>Time</th><th>In simple words</th></tr>` + Object.entries(SCREENS.email).map(([id, [who, m, simple]], i) => { acc += m;
    const title = { s1: "The question", s2: "A fair test", s3: "Both emails made money", s4: "No false alarms", s5: "More buyers, not bigger baskets", s6: "Men's email wins more buyers", s7: "Who responds", s8: "Why trust it", s9: "Under the hood" }[id];
    return `<tr><td>${i + 1}</td><td><a href="email.html#${id}">${title}</a></td><td><b>${who}</b></td><td>${mm(m)} <span class="note">(by ${mm(acc)})</span></td><td>${esc(simple)}</td></tr>`; }).join("") +
    `<tr><td></td><td colspan="2"><b>Questions</b></td><td>~4:00</td><td>Concrete page, technical pages and the Code Lab are ready as backup.</td></tr>`; } }
