/* Code Lab: loads Pyodide (CPython compiled to WebAssembly), our project files and both datasets,
   then runs editable notebook-style cells. */
"use strict";
initPage();
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/";
const FILES = ["src/asda/__init__.py", "src/asda/stats_tools.py", "src/asda/plotstyle.py", "src/hillstrom_analysis.py", "src/concrete_analysis.py", "src/build_interactive.py",
  "tests/test_stats_tools.py", "tests/test_hillstrom.py", "tests/test_concrete.py", "pyproject.toml", "data/hillstrom.csv", "data/concrete.csv"];

const CELLS = [
  { id: "setup", title: "Setup: import our project", explain: "Imports the course method library (<code>stats_tools.py</code>) and both analysis modules, exactly as on a laptop.", code:
`import numpy as np, pandas as pd, matplotlib.pyplot as plt
from asda import stats_tools as st          # every method, written from the lecture formulas
import hillstrom_analysis as ha, concrete_analysis as ca
print("numpy", np.__version__, "| pandas", pd.__version__, "| functions:", [f for f in dir(st) if not f.startswith("_")][:8], "...")` },

  { id: "email", needs: ["setup"], title: "Mission 01 · Load the email experiment", explain: "<code>ha.load()</code> asserts 64,000 rows, no missing values and conversion = (spend > 0). Then a randomization check: Welch t-statistics of pre-treatment covariates should look like N(0,1) noise.", code:
`h = ha.load()
summary = h.groupby("segment").agg(customers=("spend", "size"), visited=("visit", "mean"),
                                   bought=("conversion", "mean"), revenue=("spend", "mean"))
print(summary.round(4))
print("\\nmax |T| over 10 covariate balance tests:", max(abs(v) for v in ha.randomization_check(h).values()))` },

  { id: "welch", needs: ["email"], title: "Lecture 8 · Welch's t-test + Bonferroni", explain: "T<sub>W</sub> = (X̄<sub>T</sub> − X̄<sub>C</sub>) / √(S²<sub>T</sub>/n<sub>T</sub> + S²<sub>C</sub>/n<sub>C</sub>); three tests, so Bonferroni multiplies each p by 3.", code:
`C, M, W = (h.loc[h.segment == s, "spend"].to_numpy() for s in ["No E-Mail", "Mens E-Mail", "Womens E-Mail"])
tests = {"men vs control": st.welch_t(M, C), "women vs control": st.welch_t(W, C), "men vs women": st.welch_t(M, W)}
p_adj, reject = st.bonferroni([t["p"] for t in tests.values()], alpha=0.05)
for (name, t), pa, r in zip(tests.items(), p_adj, reject):
    print(f"{name:17s} diff=\${t['diff']:.3f}  SE={t['se']:.3f}  T_W={t['t']:5.2f}  p={t['p']:.1e}  Bonferroni p={pa:.1e}  reject H0: {r}")` },

  { id: "bayes", needs: ["welch"], title: "Lecture 11 · Beta–Binomial posteriors", explain: "Change the prior (try <code>alpha0=29, beta0=4971</code>, a sceptical prior centred on the control rate) and rerun.", code:
`alpha0, beta0 = 1, 1
post = {}
for seg in ["No E-Mail", "Mens E-Mail", "Womens E-Mail"]:
    x = h.loc[h.segment == seg, "conversion"]
    post[seg] = st.beta_posterior(int(x.sum()), len(x), alpha0, beta0)
    s = st.beta_summary(*post[seg])
    print(f"{seg:14s} Beta{post[seg]}  mean {100*s['mean']:.3f}%  95% CrI [{100*s['lo']:.3f}, {100*s['hi']:.3f}]%")

p, diff = st.prob_greater(post["Mens E-Mail"], post["Womens E-Mail"], M=200_000, rng=1)
print("\\nP(theta_men > theta_women | data) =", round(p, 5))

from scipy import stats
grid = np.linspace(0.003, 0.016, 600)
fig, ax = plt.subplots(figsize=(8, 3))
for seg, c in [("No E-Mail", "#8c8c8c"), ("Mens E-Mail", "#257de0"), ("Womens E-Mail", "#f47230")]:
    ax.plot(grid * 100, stats.beta.pdf(grid, *post[seg]), color=c, lw=2.2, label=seg)
ax.set_xlabel("conversion probability (%)"); ax.legend(frameon=False); show(fig)` },

  { id: "boot", needs: ["welch"], title: "Lecture 9 · Bootstrap the revenue decomposition", explain: "Each replicate resamples both arms with replacement and recomputes revenue ratio = buyer ratio × basket ratio.", code:
`B = 2000                                     # try 500 or 5000
reps = st.bootstrap_two_sample(ha.decomposition_stats, M, C, B=B, rng=7)
names = ["diff ($)", "revenue ratio", "buyer ratio", "basket ratio"]
for j, nm in enumerate(names):
    lo, hi = st.percentile_ci(reps[:, j])
    print(f"{nm:14s} 95% CI [{lo:.3f}, {hi:.3f}]")
share = np.log(reps[:, 2]) / np.log(reps[:, 1])
print("share of log-lift from more buyers: 95% CI", np.round(st.percentile_ci(share), 3))
print("bootstrap SE of diff:", round(reps[:, 0].std(ddof=1), 4), "| Welch SE:", round(st.welch_t(M, C)["se"], 4))

fig, axes = plt.subplots(1, 3, figsize=(10, 2.6), sharex=True)
for ax, j in zip(axes, [1, 2, 3]):
    ax.hist(reps[:, j], bins=50, color="#257de0"); ax.axvline(1, color="k", ls="--"); ax.set_title(names[j])
show(fig)` },

  { id: "concrete", needs: ["setup"], title: "Mission 02 · Lecture 12 · Fit Abrams' law", explain: "log f = β<sub>0</sub> + β<sub>1</sub> w/b + γ<sub>1</sub> a + γ<sub>2</sub> a² with a = log(age/28); β̂ = (XᵀX)⁻¹Xᵀy.", code:
`d = ca.load()                                 # 1,030 tests, 427 mixtures
X, names = ca.design(d, "abrams_wb", degree=2)
Xd = st.add_intercept(X)
fit = st.ols(Xd, d.y.to_numpy())
for nm, b, se in zip(["intercept"] + names, fit["beta"], fit["se"]):
    print(f"{nm:14s} {b:8.3f}   SE {se:.3f}   t {b / se:6.1f}")
print("\\nR^2 =", round(fit["r2"], 3), "| strength change per +0.1 w/b:", f"{100 * (np.exp(0.1 * fit['beta'][1]) - 1):.0f}%")
h_ii = st.hat_diag(Xd)
print("trace(H) =", round(h_ii.sum(), 6), " (should equal p + 1 =", Xd.shape[1], ")")
kappa = lambda kind: st.condition_number(st.add_intercept(st.standardize(ca.design(d, kind, 2)[0])[0]))
print(f"kappa(X^T X), standardized: law {kappa('abrams_wb'):.1f} | 7 raw amounts {kappa('ingredients'):.0f} | quadratic {kappa('quadratic'):.1e}")` },

  { id: "select", needs: ["concrete"], title: "Lectures 14–15 · AIC, BIC and grouped 10-fold CV", explain: "Folds are whole mixtures, so a recipe never appears in both training and validation.", code:
`rng = np.random.default_rng(ca.SEED)
train, test = ca.split_by_mixture(d, rng)
folds = st.kfold_indices(len(train), K=10, rng=rng, groups=train.mix.to_numpy())
rows = pd.DataFrame(ca.select_degree(train, folds))
rows["aic"] -= rows.aic.min(); rows["bic"] -= rows.bic.min()
print(rows[["degree", "aic", "bic", "cv_mse", "cv_se", "r2_adj"]].round(4).to_string(index=False))` },

  { id: "reg", needs: ["select"], title: "Lectures 14, 16 · Ridge CV and the lasso path", explain: "Ridge on the 44-term quadratic expansion; lasso on ratios + raw amounts to see which variable enters first.", code:
`lams = np.geomspace(1000, 1e-3, 25)
mse_r, se_r = ca.cv_penalized(train, "quadratic", "ridge", lams, folds)
print("ridge: CV-best lambda =", lams[mse_r.argmin()].round(4), "| CV MSE =", mse_r.min().round(4))

Bpath, names = ca.path(train, "mixed", "lasso", np.geomspace(600, 0.05, 40), degree=2)
entered = sorted((int(np.argmax(np.abs(Bpath[:, j]) > 1e-10)), nm) for j, nm in enumerate(names) if np.any(np.abs(Bpath[:, j]) > 1e-10))
print("lasso: order of entry as lambda falls ->", [nm for _, nm in entered[:5]])

fig, ax = plt.subplots(figsize=(8, 2.8))
ax.plot(np.log10(lams), mse_r, color="#f47230", lw=2); ax.set_xlabel("log10 lambda"); ax.set_ylabel("grouped CV MSE"); show(fig)` },

  { id: "tests", needs: ["setup"], title: "Run the 31 unit tests", explain: "Our methods checked against SciPy / scikit-learn and against properties from lecture (trace H = p + 1, ridge → OLS as λ → 0, sequential Bayes = batch Bayes…).", code:
`import micropip, pyodide_js
await pyodide_js.loadPackage("scikit-learn")
await micropip.install("pytest")
import pytest
exit_code = pytest.main(["-q", "-p", "no:cacheprovider", "tests"])
print("exit code:", exit_code, "(0 = all passed)")` },

  { id: "scratch", needs: ["setup"], title: "Scratchpad", explain: "Everything defined above is still in memory. Try anything.", code:
`# e.g. a Welch test on the women's email among past women's buyers only
sub = h[(h.womens == 1) & (h.mens == 0)]
r = st.welch_t(sub.loc[sub.segment == "Womens E-Mail", "spend"], sub.loc[sub.segment == "No E-Mail", "spend"])
print(f"diff = \${r['diff']:.3f}, T_W = {r['t']:.2f}, p = {r['p']:.2g}")` },
];

const PRELUDE = `
import sys, os, io, base64
os.chdir("/home/pyodide/project"); sys.path.insert(0, "/home/pyodide/project/src")
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as _plt
_images = []
def show(fig=None):
    fig = fig or _plt.gcf(); buf = io.BytesIO(); fig.savefig(buf, format="png", dpi=110, bbox_inches="tight"); _plt.close(fig)
    _images.append(base64.b64encode(buf.getvalue()).decode())
`;

let py = null, booting = false, busy = false;
const editors = {}, ran = new Set();
$("#toc").innerHTML = CELLS.map(c => `<a class="tag" href="#cell-${c.id}">${esc(c.title.split("·").pop().trim())}</a>`).join("");
$("#cells").innerHTML = CELLS.map(c => `<article class="cell" id="cell-${c.id}"><div class="bar"><h3>${esc(c.title)}</h3><span class="status" id="st-${c.id}"></span><button class="btn sm solid" type="button" data-run="${c.id}">Run ▶</button></div>
  <div class="explain">${c.explain}</div><textarea class="code" id="code-${c.id}" spellcheck="false" aria-label="Python code">${esc(c.code)}</textarea><div class="out" id="out-${c.id}" aria-live="polite"></div></article>`).join("");
for (const c of CELLS) { const ta = $("#code-" + c.id);
  if (window.CodeMirror) { const cm = CodeMirror.fromTextArea(ta, { mode: "python", lineNumbers: true, indentUnit: 4, viewportMargin: Infinity, extraKeys: { "Shift-Enter": () => runCell(c.id), Tab: cm => cm.replaceSelection("    ") } }); editors[c.id] = () => cm.getValue(); }
  else { ta.rows = c.code.split("\n").length + 1; ta.addEventListener("keydown", e => { if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); runCell(c.id); } if (e.key === "Tab") { e.preventDefault(); ta.setRangeText("    ", ta.selectionStart, ta.selectionEnd, "end"); } }); editors[c.id] = () => ta.value; } }
document.addEventListener("click", e => { const b = e.target.closest("[data-run]"); if (b) runCell(b.dataset.run); });

const setStatus = (t, p) => { $("#status").textContent = t; if (p !== undefined) $("#bootBar").style.width = p + "%"; };
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("could not load " + src)); document.head.appendChild(s); }); }

async function boot() {
  if (py) return py; if (booting) { while (!py) await new Promise(r => setTimeout(r, 200)); return py; }
  booting = true; $("#bootBtn").disabled = true;
  try {
    setStatus("Downloading the Python runtime…", 8); await loadScript(PYODIDE + "pyodide.js");
    const p = await loadPyodide({ indexURL: PYODIDE }); setStatus("Loading NumPy, pandas, SciPy, Matplotlib…", 35);
    await p.loadPackage(["numpy", "pandas", "scipy", "matplotlib", "micropip"]); setStatus("Copying our project files and both datasets…", 75);
    for (const [i, f] of FILES.entries()) { const r = await fetch(f); if (!r.ok) throw new Error("missing " + f); const buf = new Uint8Array(await r.arrayBuffer()), full = "/home/pyodide/project/" + f;
      p.FS.mkdirTree(full.slice(0, full.lastIndexOf("/"))); p.FS.writeFile(full, buf); setStatus(`Copying project files (${i + 1}/${FILES.length})…`, 75 + 20 * (i + 1) / FILES.length); }
    await p.runPythonAsync(PRELUDE); py = p; setStatus("Python ready · run any cell", 100); $("#bootBtn").textContent = "Python ready"; $("#runAll").disabled = false;
  } catch (e) { booting = false; $("#bootBtn").disabled = false; setStatus("Could not start Python: " + e.message + ". Check the connection and press Start again.", 0); throw e; }
  return py;
}
async function runCell(id, chained) {
  const c = CELLS.find(x => x.id === id); if (busy && !chained) return;
  busy = true; $$("[data-run]").forEach(b => b.disabled = true);
  try {
    const p = await boot();
    for (const need of c.needs || []) if (!ran.has(need)) await runCell(need, true);
    const out = $("#out-" + id), st = $("#st-" + id); out.innerHTML = ""; st.textContent = "running…"; const t0 = performance.now();
    const write = s => { out.appendChild(document.createTextNode(s + "\n")); }, dec = new TextDecoder();
    const raw = { write: buf => { out.appendChild(document.createTextNode(dec.decode(buf))); return buf.length; } };
    p.setStdout(raw); p.setStderr(raw);
    p.runPython("_images.clear()");
    try {
      await p.loadPackagesFromImports(editors[id]());
      const res = await p.runPythonAsync(editors[id]());
      if (res !== undefined && res !== null) { const r = p.globals.get("repr"); write(typeof res === "object" && res.toString ? r(res) : String(res)); if (res.destroy) res.destroy(); }
      for (const b64 of p.globals.get("_images").toJs()) { const img = new Image(); img.src = "data:image/png;base64," + b64; img.alt = "Figure output"; out.appendChild(img); }
      ran.add(id); $("#cell-" + id).dataset.ran = "1"; st.textContent = `done in ${fmt((performance.now() - t0) / 1000, 1)} s`;
    } catch (e) { const lines = String(e.message || e).trim().split("\n"); const div = document.createElement("div"); div.className = "err"; div.textContent = lines.slice(-14).join("\n"); out.appendChild(div); st.textContent = "error"; if (chained) throw e; }
  } finally { if (!chained) { busy = false; $$("[data-run]").forEach(b => b.disabled = false); } }
}
$("#bootBtn").addEventListener("click", () => boot().catch(() => {}));
$("#runAll").addEventListener("click", async () => { for (const c of CELLS) { if (c.id === "scratch") continue; await runCell(c.id); } });
if (location.hash && ["#email", "#concrete"].includes(location.hash)) { const el = $("#cell-" + location.hash.slice(1)); if (el) setTimeout(() => el.scrollIntoView(), 300); }
