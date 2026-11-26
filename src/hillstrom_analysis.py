"""Analysis 1 (presentation): Hillstrom email marketing experiment.

Research question
-----------------
Customers were randomized to a men's-merchandise email, a women's-merchandise
email, or no email. Over the next two weeks:
  (Q1) Does each email raise revenue per customer?
  (Q2) Is the revenue lift driven by MORE BUYERS (conversion) or BIGGER
       BASKETS (spend per buyer)?
  (Q3) Does it matter whether the email matches what the customer bought
       before (men's vs women's merchandise)?

Course concepts used
--------------------
  * Welch's t-test with a Bonferroni correction            (Lecture 8)
  * Nonparametric bootstrap for the revenue decomposition  (Lecture 9)
  * Bayesian Beta-Binomial inference + Monte Carlo         (Lectures 5, 11)

Revenue identity used for Q2. For an arm with conversion probability p and
mean spend per buyer m, mean revenue per customer is mu = p * m. The ratio
of treatment to control revenue factors exactly:

    mu_T / mu_C = (p_T / p_C) * (m_T / m_C)
    log-lift    =  buyer effect + basket effect.

Run from the project root:   python src/hillstrom_analysis.py
Outputs: outputs/results/hillstrom_results.json, outputs/figures/H*.{pdf,png},
         interactive/hillstrom_data.json
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from asda import stats_tools as st          # noqa: E402
from asda import plotstyle as ps            # noqa: E402

SEED = 20261207            # fixed seed: every number in the slides is reproducible
B = 10_000                 # bootstrap replicates
M = 400_000                # Monte Carlo draws from posteriors
FIG = ROOT / "outputs" / "figures"
RES = ROOT / "outputs" / "results"
CONTROL, MENS, WOMENS = "No E-Mail", "Mens E-Mail", "Womens E-Mail"
EMAILS = [MENS, WOMENS]


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
def load():
    """Load the data and run the documented data checks."""
    h = pd.read_csv(ROOT / "data" / "hillstrom.csv")
    assert len(h) == 64_000, "expected 64,000 customers"
    assert h.isna().sum().sum() == 0, "no missing values expected"
    # conversion is exactly 'spent something'; spend is never negative
    assert ((h.conversion == 1) == (h.spend > 0)).all()
    assert (h.spend >= 0).all()
    # past-purchase category; every customer bought men's and/or women's items
    h["past"] = np.select(
        [(h.mens == 1) & (h.womens == 0), (h.mens == 0) & (h.womens == 1)],
        ["Men's only", "Women's only"], "Both")
    return h


def randomization_check(h):
    """Covariates should be balanced across arms if randomization worked.

    Welch t-statistics of each pre-treatment covariate, each email vs control.
    Under successful randomization these behave like N(0,1) draws.
    """
    out = {}
    for cov in ["recency", "history", "newbie", "mens", "womens"]:
        for arm in EMAILS:
            r = st.welch_t(h.loc[h.segment == arm, cov], h.loc[h.segment == CONTROL, cov])
            out[f"{cov}|{arm}"] = round(float(r["t"]), 3)
    return out


# ---------------------------------------------------------------------------
# Concept 1: Welch t-tests + Bonferroni (Lecture 8)
# ---------------------------------------------------------------------------
def welch_family(h):
    """Primary family: 3 comparisons of mean spend per customer."""
    pairs = [(MENS, CONTROL), (WOMENS, CONTROL), (MENS, WOMENS)]
    rows = []
    for a, b in pairs:
        r = st.welch_t(h.loc[h.segment == a, "spend"], h.loc[h.segment == b, "spend"])
        rows.append({"comparison": f"{a} vs {b}", **{k: (list(v) if isinstance(v, tuple) else float(v))
                                                     for k, v in r.items()}})
    p_adj, rej = st.bonferroni([r["p"] for r in rows])
    for r, pa, rj in zip(rows, p_adj, rej):
        r["p_bonf"], r["reject_bonf"] = float(pa), bool(rj)
    return rows


def subgroup_welch(h):
    """Secondary family: email vs control within each past-purchase group (6 tests).

    Shows why a correction matters: slicing the data many ways is exactly the
    p-hacking risk described in Lecture 8.
    """
    rows = []
    for g in ["Men's only", "Women's only", "Both"]:
        d = h[h.past == g]
        for arm in EMAILS:
            r = st.welch_t(d.loc[d.segment == arm, "spend"], d.loc[d.segment == CONTROL, "spend"])
            rows.append({"group": g, "arm": arm, "diff": float(r["diff"]),
                         "se": float(r["se"]), "t": float(r["t"]), "p": float(r["p"])})
    p_adj, rej = st.bonferroni([r["p"] for r in rows])
    for r, pa, rj in zip(rows, p_adj, rej):
        r["p_bonf"], r["reject_bonf"] = float(pa), bool(rj)
    return rows


# ---------------------------------------------------------------------------
# Concept 2: nonparametric bootstrap of the revenue decomposition (Lecture 9)
# ---------------------------------------------------------------------------
def decomposition_stats(t, c):
    """Statistics on bootstrap resamples t (k, n_T) and c (k, n_C) of spend.

    Columns: [mu_T - mu_C, mu_T/mu_C, p_T/p_C, m_T/m_C]
    where p = share of customers who bought and m = mean spend among buyers.
    """
    t, c = np.atleast_2d(t), np.atleast_2d(c)
    pt, pc = (t > 0).mean(1), (c > 0).mean(1)
    mt = t.sum(1) / (t > 0).sum(1)
    mc = c.sum(1) / (c > 0).sum(1)
    return np.column_stack([t.mean(1) - c.mean(1), t.mean(1) / c.mean(1), pt / pc, mt / mc])


DECOMP_NAMES = ["diff", "revenue_ratio", "buyer_ratio", "basket_ratio"]


def bootstrap_decomposition(h, rng):
    c = h.loc[h.segment == CONTROL, "spend"].to_numpy()
    out = {}
    for i, arm in enumerate(EMAILS):
        t = h.loc[h.segment == arm, "spend"].to_numpy()
        obs = decomposition_stats(t, c)[0]
        reps = st.bootstrap_two_sample(decomposition_stats, t, c, B=B, rng=rng)
        res = {}
        for j, name in enumerate(DECOMP_NAMES):
            lo, hi = st.percentile_ci(reps[:, j])
            res[name] = {"obs": float(obs[j]), "lo": lo, "hi": hi,
                         "se_boot": float(reps[:, j].std(ddof=1))}
        # share of the log revenue lift explained by more buyers
        share = np.log(reps[:, 2]) / np.log(reps[:, 1])
        res["buyer_share"] = {"obs": float(np.log(obs[2]) / np.log(obs[1])),
                              "lo": st.percentile_ci(share)[0], "hi": st.percentile_ci(share)[1]}
        res["welch_se"] = float(st.welch_t(t, c)["se"])
        res["reps"] = reps            # kept in memory for figures only
        out[arm] = res
    return out


# ---------------------------------------------------------------------------
# Concept 3: Bayesian Beta-Binomial inference (Lecture 11)
# ---------------------------------------------------------------------------
PRIORS = {"Uniform Beta(1,1)": (1.0, 1.0),
          "Jeffreys Beta(0.5,0.5)": (0.5, 0.5),
          # 'a typical email converts ~1%' prior worth 200 customers
          "Informative Beta(2,198)": (2.0, 198.0),
          # sceptical: every arm's prior centred at the control rate (~0.57%),
          # worth 5,000 customers, i.e. a prior belief of 'no email effect'
          "Sceptical Beta(29,4971)": (29.0, 4971.0)}


def bayes_arms(h, rng, prior=(1.0, 1.0)):
    """Posterior for each arm's conversion probability theta_arm."""
    post = {}
    for arm in ps.ARMS:
        d = h[h.segment == arm]
        a, b = st.beta_posterior(int(d.conversion.sum()), len(d), *prior)
        post[arm] = {"a": a, "b": b, "n": len(d), "h": int(d.conversion.sum()),
                     **{k: float(v) for k, v in st.beta_summary(a, b).items()}}
    comps = {}
    for x, y in [(MENS, CONTROL), (WOMENS, CONTROL), (MENS, WOMENS)]:
        pg, diff = st.prob_greater((post[x]["a"], post[x]["b"]), (post[y]["a"], post[y]["b"]), M=M, rng=rng)
        lo, hi = np.quantile(diff, [0.025, 0.975])
        comps[f"{x} > {y}"] = {"prob": pg, "diff_mean": float(diff.mean()),
                              "diff_lo": float(lo), "diff_hi": float(hi)}
    return post, comps


def bayes_prior_sensitivity(h, rng):
    out = {}
    for name, pr in PRIORS.items():
        _, comps = bayes_arms(h, rng, prior=pr)
        out[name] = {k: round(v["prob"], 4) for k, v in comps.items()}
    return out


def bayes_heterogeneity(h, rng):
    """Posterior conversion lift theta_email - theta_control within each past-purchase group."""
    rows = []
    for g in ["Men's only", "Women's only", "Both"]:
        d = h[h.past == g]
        posts = {arm: st.beta_posterior(int(d.loc[d.segment == arm, "conversion"].sum()),
                                        int((d.segment == arm).sum())) for arm in ps.ARMS}
        for arm in EMAILS:
            pg, diff = st.prob_greater(posts[arm], posts[CONTROL], M=M, rng=rng)
            lo, hi = np.quantile(diff, [0.025, 0.975])
            rows.append({"group": g, "arm": arm, "n_arm": int((d.segment == arm).sum()),
                         "conv_arm": int(d.loc[d.segment == arm, "conversion"].sum()),
                         "conv_ctrl": int(d.loc[d.segment == CONTROL, "conversion"].sum()),
                         "n_ctrl": int((d.segment == CONTROL).sum()),
                         "prob_pos": pg, "lift_mean": float(diff.mean()),
                         "lift_lo": float(lo), "lift_hi": float(hi)})
        # matched vs unmatched email in this group
        pg, diff = st.prob_greater(posts[MENS], posts[WOMENS], M=M, rng=rng)
        rows.append({"group": g, "arm": "Mens > Womens", "prob_pos": pg,
                     "lift_mean": float(diff.mean()),
                     "lift_lo": float(np.quantile(diff, 0.025)),
                     "lift_hi": float(np.quantile(diff, 0.975))})
    return rows


def sequential_updating(h, rng, arm=MENS, steps=60):
    """Lecture 11: processing customers one batch at a time gives the same final
    posterior as all at once. Records P(theta_arm > theta_control) as data arrive."""
    t = rng.permutation(h.loc[h.segment == arm, "conversion"].to_numpy())
    c = rng.permutation(h.loc[h.segment == CONTROL, "conversion"].to_numpy())
    n = min(len(t), len(c))
    checkpoints = np.unique(np.geomspace(50, n, steps).astype(int))
    out = []
    for k in checkpoints:
        pt = st.beta_posterior(int(t[:k].sum()), k)
        pc = st.beta_posterior(int(c[:k].sum()), k)
        pg, _ = st.prob_greater(pt, pc, M=40_000, rng=rng)
        out.append({"n": int(k), "prob": pg, "a_t": pt[0], "b_t": pt[1], "a_c": pc[0], "b_c": pc[1]})
    return out


# ---------------------------------------------------------------------------
# Figures
# ---------------------------------------------------------------------------
def fig_funnel(h):
    ps.apply()
    fig, axes = ps.subplots(1, 3, figsize=(10.5, 3.4))
    metrics = [("visit", "Visited site (%)", 100), ("conversion", "Bought something (%)", 100),
               ("spend", "Revenue per customer ($)", 1)]
    for ax, (col, title, scale) in zip(axes, metrics):
        for i, arm in enumerate(ps.ARMS):
            x = h.loc[h.segment == arm, col].to_numpy() * scale
            m, se = x.mean(), x.std(ddof=1) / np.sqrt(len(x))
            ax.bar(i, m, color=ps.ARM_COLORS[arm], width=0.62)
            ax.errorbar(i, m, yerr=1.96 * se, color=ps.INK, capsize=4, lw=1.3)
            ax.text(i, m + 1.96 * se, f"{m:.2f}" if scale == 1 else f"{m:.2f}%",
                    ha="center", va="bottom", fontsize=(11.5 if ps.SLIDES else 9), color=ps.INK)
        ax.set_xticks(range(3), ["No email", "Men's", "Women's"])
        ax.set_title(title)
        ax.grid(axis="x", visible=False)
        ax.set_ylim(0, ax.get_ylim()[1] * 1.12)
    if not ps.SLIDES:
        fig.suptitle("Both emails lift visits, purchases and revenue (bars: 95% CI for the mean)",
                     x=0.01, ha="left", fontsize=11, color=ps.INK2)
    fig.tight_layout()
    ps.save(fig, FIG / "H1_funnel")


def fig_spend_distribution(h):
    ps.apply()
    fig, axes = ps.subplots(1, 2, figsize=(10.5, 3.4), gridspec_kw={"width_ratios": [1, 1.6]})
    ax = axes[0]
    zero = [(h.loc[h.segment == a, "spend"] == 0).mean() * 100 for a in ps.ARMS]
    ax.bar(range(3), zero, color=[ps.ARM_COLORS[a] for a in ps.ARMS], width=0.62)
    for i, z in enumerate(zero):
        ax.text(i, z, f"{z:.2f}%", ha="center", va="bottom", fontsize=(11.5 if ps.SLIDES else 9))
    ax.set_ylim(95, 100.2)
    ax.set_xticks(range(3), ["No email", "Men's", "Women's"])
    ax.set_title("Customers who spent $0")
    ax.grid(axis="x", visible=False)
    ax = axes[1]
    for a in ps.ARMS:
        x = np.sort(h.loc[(h.segment == a) & (h.spend > 0), "spend"].to_numpy())
        ecdf = np.arange(1, len(x) + 1) / len(x)
        ax.step(x, ecdf, where="post", color=ps.ARM_COLORS[a],
                label=f"{ps.ARM_LABELS[a]} (n = {len(x)} buyers)")
    ax.set_xscale("log")
    ax.xaxis.set_minor_formatter(mpl.ticker.NullFormatter())
    ax.set_xticks([29.99, 50, 100, 200, 499], ["$29.99\nfloor", "$50", "$100", "$200", "$499\ncap"])
    ax.set_xlabel("Spend among buyers (log scale)")
    ax.set_ylabel("Share of buyers spending $\\leq$ x")
    ax.set_title("Among buyers: skewed spend, same distribution in every arm")
    ax.legend(fontsize=(11 if ps.SLIDES else 8.5), loc="lower right")
    fig.tight_layout()
    ps.save(fig, FIG / "H2_spend_distribution")


def fig_posteriors(post):
    ps.apply()
    fig, ax = ps.subplots(figsize=(8.5, 3.6), slide_scale=(0.82, 1.0))
    grid = np.linspace(0.003, 0.016, 1200)
    for arm in ps.ARMS:
        p = post[arm]
        dens = stats.beta.pdf(grid, p["a"], p["b"])
        ax.fill_between(grid * 100, dens, color=ps.ARM_COLORS[arm], alpha=0.18, lw=0)
        ax.plot(grid * 100, dens, color=ps.ARM_COLORS[arm], lw=2)
        k = np.argmax(dens)
        ax.text(grid[k] * 100, dens[k] * 1.03,
                (f"{ps.ARM_LABELS[arm]}" if ps.SLIDES else
                 f"{ps.ARM_LABELS[arm]}\nBeta({p['a']:.0f}, {p['b']:,.0f})"),
                ha="center", va="bottom", fontsize=(11.5 if ps.SLIDES else 9), color=ps.INK)
    ax.set_xlabel(r"Conversion probability $\theta$ (%)")
    ax.set_ylabel(r"Posterior density $p(\theta\mid\mathbf{x})$")
    ax.set_ylim(0, ax.get_ylim()[1] * 1.28)
    if not ps.SLIDES:
        ax.set_title("Posterior conversion rates, uniform Beta(1,1) prior")
    fig.tight_layout()
    ps.save(fig, FIG / "H3_posteriors")


def fig_decomposition(boot):
    ps.apply()
    fig, ax = ps.subplots(figsize=(8.5, 3.6), slide_scale=(0.78, 1.15))
    labels = {"revenue_ratio": "Revenue per customer", "buyer_ratio": "Buyers (conversion)",
              "basket_ratio": "Basket (spend per buyer)"}
    y = 0
    yt, yl = [], []
    for arm in EMAILS:
        for key in ["revenue_ratio", "buyer_ratio", "basket_ratio"]:
            r = boot[arm][key]
            ax.plot([r["lo"], r["hi"]], [y, y], color=ps.ARM_COLORS[arm], lw=3, solid_capstyle="round")
            ax.plot(r["obs"], y, "o", ms=8, color=ps.ARM_COLORS[arm], mec="white", mew=2)
            ax.text(r["hi"] + 0.05, y, f"{r['obs']:.2f}  [{r['lo']:.2f}, {r['hi']:.2f}]",
                    va="center", fontsize=(11 if ps.SLIDES else 8.5), color=ps.INK)
            yt.append(y)
            yl.append(f"{'Men' if arm == MENS else 'Women'}'s: {key.split('_')[0]}" if ps.SLIDES
                      else f"{'Men' if arm == MENS else 'Women'}'s email: {labels[key]}")
            y -= 1
        y -= 0.6
    ax.axvline(1, color=ps.INK2, lw=1, ls="--")
    ax.set_yticks(yt, yl, fontsize=(11.5 if ps.SLIDES else 9))
    ax.set_xlabel("Ratio email / control  (1 = no effect)")
    ax.set_xlim(0.6, 3.6)
    ax.grid(axis="y", visible=False)
    if not ps.SLIDES:
        ax.set_title(f"Revenue lift = buyer effect x basket effect (bootstrap 95% CIs, B = {B:,})")
    fig.tight_layout()
    ps.save(fig, FIG / "H4_decomposition")


def fig_heterogeneity(rows):
    ps.apply()
    fig, ax = ps.subplots(figsize=(8.5, 3.6), slide_scale=(1.0, 1.3))
    groups = ["Men's only", "Women's only", "Both"]
    yt, yl = [], []
    y = 0
    for g in groups:
        for arm in EMAILS:
            r = next(r for r in rows if r["group"] == g and r["arm"] == arm)
            col = ps.ARM_COLORS[arm]
            ax.plot([r["lift_lo"] * 100, r["lift_hi"] * 100], [y, y], color=col, lw=3,
                    solid_capstyle="round")
            ax.plot(r["lift_mean"] * 100, y, "o", ms=8, color=col, mec="white", mew=2)
            ax.text(2.35, y, f"P(lift > 0) = {r['prob_pos']:.3f}", va="center", fontsize=(11 if ps.SLIDES else 8.5))
            yt.append(y)
            yl.append(f"{'Men' if arm == MENS else 'Women'}'s email")
            y -= 1
        ax.text(-0.98, y + 2.55, {"Men's only": "Past buyers of men's merchandise only",
                "Women's only": "Past buyers of women's merchandise only",
                "Both": "Past buyers of both"}[g], fontsize=(11.5 if ps.SLIDES else 9), fontweight="bold", color=ps.INK)
        y -= 1.1
    ax.axvline(0, color=ps.INK2, lw=1, ls="--")
    ax.set_yticks(yt, yl, fontsize=(11.5 if ps.SLIDES else 9))
    ax.set_xlim(-1.0, 3.3)
    ax.set_xlabel(r"Posterior conversion lift $\theta_{\mathrm{email}}-\theta_{\mathrm{control}}$ (percentage points)")
    ax.grid(axis="y", visible=False)
    ax.set_ylim(y + 0.4, 0.9)
    if not ps.SLIDES:
        ax.set_title("Conversion lift by past purchases: the women's email misses men's buyers", pad=12)
    fig.tight_layout()
    ps.save(fig, FIG / "H5_heterogeneity")


def fig_bootstrap_vs_clt(boot):
    ps.apply()
    fig, axes = ps.subplots(1, 2, figsize=(10.5, 3.3), slide_scale=(1.0, 1.15))
    for ax, arm in zip(axes, EMAILS):
        reps = boot[arm]["reps"][:, 0]
        ax.hist(reps, bins=60, density=True, color=ps.ARM_COLORS[arm], alpha=0.55)
        g = np.linspace(reps.min(), reps.max(), 300)
        d = boot[arm]["diff"]["obs"]
        ax.plot(g, stats.norm.pdf(g, d, boot[arm]["welch_se"]), color=ps.INK, lw=1.8,
                label=f"Normal, Welch SE = {boot[arm]['welch_se']:.3f}")
        ax.set_title(f"{ps.ARM_LABELS[arm]} minus control" if ps.SLIDES else
                     f"{ps.ARM_LABELS[arm]} minus control: bootstrap SE = {boot[arm]['diff']['se_boot']:.3f}")
        ax.set_xlabel(r"$\bar X_T^{*}-\bar X_C^{*}$  (\$ per customer)")
        ax.legend(fontsize=(11 if ps.SLIDES else 8.5), loc="upper left")
    fig.tight_layout()
    ps.save(fig, FIG / "H6_bootstrap_vs_clt")


def fig_sequential(seq):
    ps.apply()
    fig, ax = ps.subplots(figsize=(8.5, 3.0))
    n = [s["n"] for s in seq]
    ax.plot(n, [s["prob"] for s in seq], color=ps.BLUE)
    ax.axhline(0.95, color=ps.INK2, lw=1, ls="--")
    ax.text(n[-1], 0.90, "0.95", ha="right", va="top", fontsize=(11 if ps.SLIDES else 8.5), color=ps.INK2)
    ax.set_xscale("log")
    ax.set_xlabel("Customers observed per arm")
    ax.set_ylabel(r"$P(\theta_{\mathrm{men}} > \theta_{\mathrm{ctrl}} \mid \mathrm{data})$")
    ax.set_ylim(0, 1.03)
    ax.set_title("Sequential Bayesian updating: evidence accumulates as customers arrive")
    fig.tight_layout()
    ps.save(fig, FIG / "H7_sequential")


# ---------------------------------------------------------------------------
def main():
    global FIG
    FIG.mkdir(parents=True, exist_ok=True)
    RES.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)
    h = load()

    arms = {}
    for arm in ps.ARMS:
        d = h[h.segment == arm]
        buyers = d[d.spend > 0]
        arms[arm] = {"n": len(d), "visit_rate": float(d.visit.mean()),
                     "conv_rate": float(d.conversion.mean()), "conversions": int(d.conversion.sum()),
                     "revenue_per_customer": float(d.spend.mean()),
                     "basket": float(buyers.spend.mean()), "basket_median": float(buyers.spend.median()),
                     "n_at_cap": int((d.spend >= 499).sum()),
                     "n_at_floor": int((buyers.spend.round(2) == 29.99).sum())}

    balance = randomization_check(h)
    welch = welch_family(h)
    sub = subgroup_welch(h)
    boot = bootstrap_decomposition(h, rng)
    post, comps = bayes_arms(h, rng)
    sens = bayes_prior_sensitivity(h, rng)
    het = bayes_heterogeneity(h, rng)
    seq = sequential_updating(h, rng)

    fig_funnel(h)
    fig_spend_distribution(h)
    fig_posteriors(post)
    fig_decomposition(boot)
    fig_heterogeneity(het)
    fig_bootstrap_vs_clt(boot)
    fig_sequential(seq)

    # second pass: the same figures with larger type for the slides
    main_fig, FIG = FIG, FIG / "slides"
    FIG.mkdir(exist_ok=True)
    ps.SLIDES = True
    fig_funnel(h); fig_posteriors(post); fig_decomposition(boot); fig_heterogeneity(het)
    fig_bootstrap_vs_clt(boot); fig_sequential(seq)
    ps.SLIDES, FIG = False, main_fig

    boot_json = {arm: {k: v for k, v in r.items() if k != "reps"} for arm, r in boot.items()}
    results = {"seed": SEED, "B": B, "M": M, "arms": arms, "balance_t": balance,
               "max_abs_balance_t": max(abs(v) for v in balance.values()),
               "welch": welch, "subgroup_welch": sub, "bootstrap": boot_json,
               "posterior": post, "posterior_comparisons": comps,
               "prior_sensitivity": sens, "heterogeneity": het}
    (RES / "hillstrom_results.json").write_text(json.dumps(results, indent=2))

    # compact data for the interactive explorer (counts only: no individual records)
    inter = {"arms": {a: {"n": arms[a]["n"], "h": arms[a]["conversions"],
                          "revenue": arms[a]["revenue_per_customer"], "basket": arms[a]["basket"]}
                      for a in ps.ARMS},
             "groups": {g: {a: {"n": int(((h.past == g) & (h.segment == a)).sum()),
                                "h": int(h.loc[(h.past == g) & (h.segment == a), "conversion"].sum())}
                            for a in ps.ARMS} for g in ["Men's only", "Women's only", "Both"]},
             "sequential": [{"n": q["n"], "prob": round(q["prob"], 4)} for q in seq],
             # buyers' spend amounts per arm (non-buyers spent $0): enough for an exact
             # nonparametric bootstrap in the browser, with no customer-level records
             "buyer_spend": {a: np.round(np.sort(h.loc[(h.segment == a) & (h.spend > 0), "spend"].to_numpy()), 2).tolist()
                             for a in ps.ARMS},
             "results": {"welch": [{k: r[k] for k in ("comparison", "diff", "se", "t", "p", "p_bonf")} for r in welch],
                         "decomp": {a: {k: boot_json[a][k] for k in ("revenue_ratio", "buyer_ratio", "basket_ratio", "buyer_share")}
                                    for a in EMAILS}}}
    (ROOT / "interactive" / "hillstrom_data.json").write_text(json.dumps(inter))

    # console summary
    print("Arms:", json.dumps(arms, indent=1))
    print("max |balance t| =", results["max_abs_balance_t"])
    for r in welch:
        print(f"{r['comparison']}: diff={r['diff']:.3f} SE={r['se']:.3f} T={r['t']:.2f} "
              f"p={r['p']:.2e} p_bonf={r['p_bonf']:.2e}")
    for arm in EMAILS:
        b = boot_json[arm]
        print(arm, {k: (round(v['obs'], 3), round(v['lo'], 3), round(v['hi'], 3))
                    for k, v in b.items() if isinstance(v, dict)},
              "welchSE", round(b["welch_se"], 4), "bootSE", round(b["diff"]["se_boot"], 4))
    print(json.dumps(comps, indent=1))
    print(json.dumps(sens, indent=1))
    for r in het:
        print(r["group"], r["arm"], round(r["prob_pos"], 4),
              round(r["lift_mean"] * 100, 3), round(r["lift_lo"] * 100, 3), round(r["lift_hi"] * 100, 3))
    for r in sub:
        print("sub", r["group"], r["arm"], round(r["diff"], 3), round(r["p"], 4), round(r["p_bonf"], 4), r["reject_bonf"])


if __name__ == "__main__":
    main()
