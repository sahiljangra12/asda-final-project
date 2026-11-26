"""Analysis 2 (written report): Concrete compressive strength.

Research question
-----------------
Abrams' law (1918) says the strength of concrete is governed by one number,
the water-to-cement ratio: f = A / B^(w/c), i.e. log f is LINEAR in w/c.
Modern mixes replace part of the cement with slag and fly ash, so engineers
use the water-to-binder ratio w/b instead. We ask:

  (Q1) How much of the variation in strength does a two-variable physical
       law -- water/binder ratio plus curing age -- explain?
  (Q2) After choosing the age curve by AIC/BIC/cross-validation, do the
       individual ingredients (and their interactions) add predictive
       information beyond the law, when judged on mixtures never seen in
       fitting?
  (Q3) When a lasso may choose freely among raw ingredients and ratios,
       does it select the water/binder ratio?

Course concepts used
--------------------
  * Multiple linear regression in matrix form + diagnostics:
    heteroscedasticity, Q-Q, leverage/Cook's distance, collinearity kappa
                                                        (Lectures 12-13)
  * Model selection: polynomial basis in log-age, AIC, BIC and
    (grouped) K-fold cross-validation                   (Lectures 14-15)
  * Ridge and lasso regularization paths, lambda by CV  (Lectures 14, 16)

Design choice: 1,030 tests come from 427 distinct mixtures, many tested at
several ages. Tests of one mixture share its batch, so they are not
independent; cross-validation folds and the held-out test set are therefore
formed from whole MIXTURES.

Run from the project root:   python src/concrete_analysis.py
Outputs: outputs/results/concrete_results.json, outputs/figures/C*.{pdf,png},
         report/macros.tex (every number quoted in the report)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from asda import stats_tools as st          # noqa: E402
from asda import plotstyle as ps            # noqa: E402

SEED = 553413
K = 10                       # folds
TEST_FRAC = 0.2              # share of mixtures held out for the final test
FIG = ROOT / "outputs" / "figures"
RES = ROOT / "outputs" / "results"

ING = ["cement", "slag", "ash", "water", "sp", "coarse", "fine"]
ING_LABEL = {"cement": "cement", "slag": "slag", "ash": "fly ash", "water": "water",
             "sp": "superplast.", "coarse": "coarse agg.", "fine": "fine agg."}


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
def load():
    d = pd.read_csv(ROOT / "data" / "concrete.csv").rename(columns={
        "blast_furnace_slag": "slag", "fly_ash": "ash", "superplasticizer": "sp",
        "coarse_aggregate": "coarse", "fine_aggregate": "fine",
        "compressive_strength": "strength"})
    assert len(d) == 1030 and d.isna().sum().sum() == 0
    assert (d.strength > 0).all() and (d.cement > 0).all()
    d["binder"] = d.cement + d.slag + d.ash
    d["wc"] = d.water / d.cement                     # Abrams' original ratio
    d["wb"] = d.water / d.binder                     # water / binder ratio
    d["slag_share"] = d.slag / d.binder
    d["ash_share"] = d.ash / d.binder
    d["log_age"] = np.log(d.age)
    d["y"] = np.log(d.strength)                      # response: log strength
    d["mix"] = pd.factorize(d[ING].round(3).astype(str).agg("|".join, axis=1))[0]
    return d


def split_by_mixture(d, rng):
    mixes = rng.permutation(d.mix.unique())
    test_mix = mixes[: int(round(TEST_FRAC * len(mixes)))]
    is_test = d.mix.isin(test_mix).to_numpy()
    return d[~is_test].reset_index(drop=True), d[is_test].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Design matrices
# ---------------------------------------------------------------------------
LA_CENTER = np.log(28.0)          # centre log-age at the 28-day standard test


def age_poly(d, degree):
    la = d.log_age.to_numpy() - LA_CENTER
    return np.column_stack([la ** k for k in range(1, degree + 1)])


def design(d, kind, degree=1):
    """Return (X without intercept, column names) for each candidate model."""
    A = age_poly(d, degree)
    an = [f"(log age)^{k}" if k > 1 else "log age" for k in range(1, degree + 1)]
    if kind == "abrams_wc":
        return np.column_stack([d.wc, A]), ["w/c"] + an
    if kind == "abrams_wb":
        return np.column_stack([d.wb, A]), ["w/b"] + an
    if kind == "abrams_wb_plus":
        # law + composition of the binder + its interaction with age
        X = np.column_stack([d.wb, d.slag_share, d.ash_share, d.sp, A,
                             d.wb * A[:, 0], d.slag_share * A[:, 0], d.ash_share * A[:, 0]])
        return X, (["w/b", "slag share", "ash share", "superplast."] + an +
                   ["w/b x log age", "slag share x log age", "ash share x log age"])
    if kind == "ingredients":
        return np.column_stack([d[ING].to_numpy(), A]), [ING_LABEL[c] for c in ING] + an
    if kind == "quadratic":
        base = np.column_stack([d[ING].to_numpy(), d.log_age.to_numpy() - LA_CENTER])
        names = [ING_LABEL[c] for c in ING] + ["log age"]
        cols, nm = [base], list(names)
        for i in range(base.shape[1]):
            for j in range(i, base.shape[1]):
                cols.append(base[:, [i]] * base[:, [j]])
                nm.append(f"{names[i]}^2" if i == j else f"{names[i]} x {names[j]}")
        return np.column_stack(cols), nm
    if kind == "mixed":
        # interpretable candidates for the lasso: raw amounts AND ratios
        X = np.column_stack([d.wb, d.wc, d[ING].to_numpy(), A])
        return X, ["w/b", "w/c"] + [ING_LABEL[c] for c in ING] + an
    raise ValueError(kind)


# ---------------------------------------------------------------------------
# Concept 1: OLS + diagnostics
# ---------------------------------------------------------------------------
def diagnostics(d):
    out = {}
    # (a) raw strength vs log strength: heteroscedasticity check
    X, _ = design(d, "abrams_wb", degree=2)
    Xd = st.add_intercept(X)
    raw = st.ols(Xd, d.strength.to_numpy())
    lg = st.ols(Xd, d.y.to_numpy())

    def spread_ratio(fit):
        """SD of residuals in top vs bottom third of fitted values (1 = constant variance)."""
        q = np.quantile(fit["fitted"], [1 / 3, 2 / 3])
        lo = fit["resid"][fit["fitted"] <= q[0]].std()
        hi = fit["resid"][fit["fitted"] >= q[1]].std()
        return float(hi / lo)

    out["n_neg_fitted_raw"] = int((raw["fitted"] < 0).sum())
    out["spread_ratio_raw"] = spread_ratio(raw)
    out["spread_ratio_log"] = spread_ratio(lg)
    out["levene_raw_p"], out["levene_log_p"] = None, None
    # (b) leverage and influence on the log model
    h = st.hat_diag(Xd)
    cook = st.cooks_distance(lg["resid"], h, lg["sigma2"], lg["q"])
    out["max_leverage"] = float(h.max())
    out["mean_leverage"] = float(h.mean())             # = (p+1)/n
    out["n_high_leverage"] = int((h > 2 * h.mean()).sum())
    out["n_cook_gt_4n"] = int((cook > 4 / len(h)).sum())
    out["max_cook"] = float(cook.max())
    top = int(np.argmax(cook))
    out["max_cook_row"] = {"age": int(d.age[top]), "wb": float(d.wb[top]),
                           "strength": float(d.strength[top])}
    # (c) normality of residuals: Q-Q correlation
    sr = lg["resid"] / np.sqrt(lg["sigma2"] * (1 - h))
    osm, osr = stats.probplot(sr, dist="norm", fit=False)
    out["qq_corr"] = float(np.corrcoef(osm, osr)[0, 1])
    # (d) collinearity: condition numbers on standardized columns
    for kind in ["abrams_wb", "ingredients", "quadratic"]:
        Xk, _ = design(d, kind, degree=2)
        Z, *_ = st.standardize(Xk)
        out[f"kappa_{kind}"] = st.condition_number(st.add_intercept(Z))
    out["mix_total_mean"] = float(d[ING].sum(axis=1).mean())
    out["mix_total_sd"] = float(d[ING].sum(axis=1).std())
    return out, raw, lg, h, cook, sr


# ---------------------------------------------------------------------------
# Concept 2: model selection (AIC / BIC / grouped K-fold CV)
# ---------------------------------------------------------------------------
def cv_ols(d, kind, degree, folds):
    """Grouped K-fold CV mean squared error on the log scale."""
    sq = np.empty(len(d))
    for f in folds:
        tr = np.setdiff1d(np.arange(len(d)), f)
        X, _ = design(d, kind, degree)
        fit = st.ols(st.add_intercept(X[tr]), d.y.to_numpy()[tr])
        pred = st.add_intercept(X[f]) @ fit["beta"]
        sq[f] = (d.y.to_numpy()[f] - pred) ** 2
    return float(sq.mean()), float(sq.std(ddof=1) / np.sqrt(len(sq)))


def select_degree(d, folds, kind="abrams_wb", max_deg=6):
    rows = []
    for deg in range(1, max_deg + 1):
        X, _ = design(d, kind, deg)
        fit = st.ols(st.add_intercept(X), d.y.to_numpy())
        ic = st.gaussian_ic(fit["rss"], fit["n"], k=fit["q"] + 1)
        cv, cv_se = cv_ols(d, kind, deg, folds)
        rows.append({"degree": deg, "aic": float(ic["aic"]), "bic": float(ic["bic"]),
                     "cv_mse": cv, "cv_se": cv_se, "r2": fit["r2"], "r2_adj": fit["r2_adj"]})
    return rows


# ---------------------------------------------------------------------------
# Concept 3: ridge and lasso
# ---------------------------------------------------------------------------
def cv_penalized(d, kind, method, lams, folds, degree=1):
    """Grouped K-fold CV MSE for each lambda. Standardization uses the training fold only."""
    X, _ = design(d, kind, degree)
    y = d.y.to_numpy()
    err = np.zeros((len(lams), len(y)))
    for f in folds:
        tr = np.setdiff1d(np.arange(len(y)), f)
        Ztr, Zte, *_ = st.standardize(X[tr], X[f])
        beta = None
        for i, lam in enumerate(lams):               # large -> small lambda, warm starts
            if method == "ridge":
                b0, beta = st.ridge(Ztr, y[tr], lam)
            else:
                b0, beta = st.lasso(Ztr, y[tr], lam, beta_init=beta, tol=1e-6, max_iter=5000)
            err[i, f] = (y[f] - (b0 + Zte @ beta)) ** 2
    mse = err.mean(axis=1)
    se = err.std(axis=1, ddof=1) / np.sqrt(len(y))
    return mse, se


def path(d, kind, method, lams, degree=1):
    X, names = design(d, kind, degree)
    Z, *_ = st.standardize(X)
    y = d.y.to_numpy()
    B, beta = [], None
    for lam in lams:
        if method == "ridge":
            _, beta = st.ridge(Z, y, lam)
        else:
            _, beta = st.lasso(Z, y, lam, beta_init=beta, tol=1e-7, max_iter=5000)
        B.append(beta.copy())
    return np.array(B), names


def fit_predict(train, test, kind, degree=1, method="ols", lam=None):
    Xtr, names = design(train, kind, degree)
    Xte, _ = design(test, kind, degree)
    ytr = train.y.to_numpy()
    if method == "ols":
        fit = st.ols(st.add_intercept(Xtr), ytr)
        return st.add_intercept(Xte) @ fit["beta"], fit, names
    Ztr, Zte, *_ = st.standardize(Xtr, Xte)
    if method == "ridge":
        b0, beta = st.ridge(Ztr, ytr, lam)
    else:
        b0, beta = st.lasso(Ztr, ytr, lam, tol=1e-7, max_iter=20_000)
    return b0 + Zte @ beta, {"beta": beta, "b0": b0}, names


# ---------------------------------------------------------------------------
# Figures
# ---------------------------------------------------------------------------
def fig_diagnostics(d, raw, lg, h, cook, sr):
    ps.apply()
    fig, axes = plt.subplots(1, 4, figsize=(13, 3.1))
    ax = axes[0]
    ax.scatter(raw["fitted"], raw["resid"], s=7, color=ps.GREY, alpha=0.6, lw=0)
    ax.axhline(0, color=ps.INK, lw=1)
    ax.set(title="(a) Raw MPa: curved, fitted < 0", xlabel="Fitted strength (MPa)", ylabel="Residual (MPa)")
    ax = axes[1]
    ax.scatter(lg["fitted"], lg["resid"], s=7, color=ps.BLUE, alpha=0.6, lw=0)
    ax.axhline(0, color=ps.INK, lw=1)
    ax.set(title="(b) log MPa: no trend", xlabel="Fitted log strength", ylabel="Residual")
    ax = axes[2]
    osm, osr = stats.probplot(sr, dist="norm", fit=False)
    ax.scatter(osm, osr, s=7, color=ps.BLUE, alpha=0.6, lw=0)
    lim = [min(osm.min(), osr.min()), max(osm.max(), osr.max())]
    ax.plot(lim, lim, color=ps.INK, lw=1)
    ax.set(title="(c) Normal Q-Q (log model)", xlabel="Theoretical quantile", ylabel="Studentized residual")
    ax = axes[3]
    big = cook > 4 / len(cook)
    ax.scatter(h[~big], sr[~big], s=7, color=ps.GREY, alpha=0.6, lw=0, label="Cook's D <= 4/n")
    ax.scatter(h[big], sr[big], s=12, color=ps.ORANGE, lw=0, label="Cook's D > 4/n")
    ax.axvline(2 * h.mean(), color=ps.INK2, ls="--", lw=1)
    ax.set(title="(d) Leverage vs residual", xlabel=r"Leverage $h_{ii}$", ylabel="Studentized residual")
    ax.legend(fontsize=7.5, loc="lower right")
    fig.tight_layout()
    ps.save(fig, FIG / "C1_diagnostics")


def fig_degree(rows):
    ps.apply()
    fig, axes = plt.subplots(1, 2, figsize=(8.6, 2.9))
    deg = [r["degree"] for r in rows]
    ax = axes[0]
    aic = np.array([r["aic"] for r in rows]); bic = np.array([r["bic"] for r in rows])
    ax.plot(deg, aic - aic.min(), "o-", color=ps.BLUE, label="AIC")
    ax.plot(deg, bic - bic.min(), "s-", color=ps.ORANGE, label="BIC")
    ax.set(xlabel=r"Degree $d$ of log-age polynomial", ylabel="Criterion minus its minimum",
           title="(a) Information criteria")
    ax.legend()
    ax = axes[1]
    cv = np.array([r["cv_mse"] for r in rows]); se = np.array([r["cv_se"] for r in rows])
    ax.errorbar(deg, cv, yerr=se, fmt="o-", color=ps.AQUA, capsize=3)
    ax.set(xlabel=r"Degree $d$", ylabel="CV MSE of log strength",
           title=f"(b) Grouped {K}-fold CV (+/- 1 SE)")
    for a in axes:
        a.set_xticks(deg)
    fig.tight_layout()
    ps.save(fig, FIG / "C2_degree_selection")


def fig_paths(lams, Bl, names_l, sel_l, lams_q, lams_r, mse_r, lam_r, mse_l, lam_l, lam_l1se):
    ps.apply()
    fig, axes = plt.subplots(1, 2, figsize=(12, 3.6), gridspec_kw={"width_ratios": [1.45, 1]})
    ax = axes[0]
    ll = np.log10(lams)
    highlight = {"w/b": ps.BLUE, "w/c": ps.ORANGE, "log age": ps.AQUA, "(log age)^2": ps.VIOLET}
    for j, nm in enumerate(names_l):
        hl = nm in highlight
        ax.plot(ll, Bl[:, j], color=highlight.get(nm, ps.GREY), lw=2.2 if hl else 1.2,
                alpha=1 if hl else 0.7, zorder=3 if hl else 2)
    # direct labels for the highlighted variables; raw ingredient amounts share one label
    x_lab = ll[-1] - 0.08
    for j, nm in enumerate(names_l):
        if nm in highlight:
            ax.text(x_lab, Bl[-1, j], nm, ha="left", va="center", fontsize=8, color=ps.INK)
    grey_end = [Bl[-1, j] for j, nm in enumerate(names_l) if nm not in highlight]
    ax.text(x_lab, max(grey_end) + 0.03, "7 raw ingredient\namounts (grey)", ha="left",
            va="bottom", fontsize=7.5, color=ps.INK2)
    ax.axvline(np.log10(sel_l), color=ps.INK2, ls="--", lw=1)
    ax.text(np.log10(sel_l), ax.get_ylim()[1], r" $\lambda_{CV}$", va="top", fontsize=8.5)
    ax.set_xlim(ll[0], ll[-1] - 0.75)
    ax.set(xlabel=r"$\log_{10}\lambda$  (penalty weakens to the right)",
           ylabel=r"Standardized coefficient $\hat\beta_j$",
           title="(a) Lasso path: raw amounts and ratios compete")
    ax = axes[1]
    ax.plot(np.log10(lams_r), mse_r, color=ps.ORANGE, label="Ridge")
    ax.plot(np.log10(lams_q), mse_l, color=ps.BLUE, label="Lasso")
    ax.axvline(np.log10(lam_r), color=ps.ORANGE, ls=":", lw=1.2)
    ax.axvline(np.log10(lam_l), color=ps.BLUE, ls=":", lw=1.2)
    ax.axvline(np.log10(lam_l1se), color=ps.BLUE, ls="--", lw=1.2)
    ax.text(np.log10(lam_l1se), ax.get_ylim()[1], " lasso 1-SE", va="top", fontsize=8)
    ax.invert_xaxis()
    ax.set(xlabel=r"$\log_{10}\lambda$", ylabel="Grouped CV MSE of log strength",
           title=r"(b) $\lambda$ by grouped 10-fold CV, 44 quadratic terms")
    ax.legend(fontsize=8, loc="center left")
    fig.tight_layout()
    ps.save(fig, FIG / "C3_regularization")


def fig_abrams_curves(d, fit, degree):
    ps.apply()
    fig, ax = plt.subplots(figsize=(6.2, 3.3))
    ages = [3, 7, 28, 90, 365]
    cols = ["#9dc8f7", "#519ced", "#257de0", "#1757ac", "#0e3d7e"]
    wb = np.linspace(d.wb.min(), d.wb.max(), 100)
    for a, c in zip(ages, cols):
        sub = d[d.age == a] if a != 90 else d[d.age.isin([90, 91])]
        ax.scatter(sub.wb, sub.strength, s=8, color=c, alpha=0.55, lw=0)
        wa = np.linspace(sub.wb.min(), sub.wb.max(), 100)      # no extrapolation
        g = pd.DataFrame({"wb": wa, "log_age": np.log(a)})
        X, _ = design(g, "abrams_wb", degree)
        ax.plot(wa, np.exp(st.add_intercept(X) @ fit["beta"]), color=c, lw=2)
        ax.text(wa[0] - 0.01, np.exp(st.add_intercept(X[:1]) @ fit["beta"])[0], f"{a} d",
                ha="right", va="center", fontsize=8, color=ps.INK)
    ax.set_xlim(d.wb.min() - 0.07, d.wb.max() + 0.02)
    ax.set(xlabel="Water / binder ratio  w/b", ylabel="Compressive strength (MPa)",
           title="Fitted Abrams-type curves by curing age (points: data at that age)")
    fig.tight_layout()
    ps.save(fig, FIG / "C4_abrams_curves")


def fig_comparison(rows):
    ps.apply()
    fig, ax = plt.subplots(figsize=(6.4, 3.0))
    labels = [r["label"] for r in rows]
    cv = [np.sqrt(r["cv_mse"]) for r in rows]
    te = [r["test_rmse"] for r in rows]
    y = np.arange(len(rows))[::-1]
    ax.barh(y + 0.19, cv, height=0.36, color=ps.BLUE, label="Grouped CV (training mixtures)")
    ax.barh(y - 0.19, te, height=0.36, color=ps.ORANGE, label="Held-out mixtures (test)")
    for yy, c, t in zip(y, cv, te):
        ax.text(max(c, t) + 0.004, yy, f"test {t:.3f}", va="center", fontsize=8)
    ax.set_yticks(y, labels, fontsize=8.5)
    ax.set_xlabel("Root mean squared error of log strength")
    ax.set_xlim(0, 0.39)
    ax.grid(axis="y", visible=False)
    ax.legend(fontsize=7.5, loc="upper center", bbox_to_anchor=(0.5, -0.2), ncol=2)
    ax.set_title("Out-of-sample error by model")
    fig.tight_layout()
    ps.save(fig, FIG / "C5_model_comparison")


# ---------------------------------------------------------------------------
def main():
    FIG.mkdir(parents=True, exist_ok=True)
    RES.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)
    d = load()
    train, test = split_by_mixture(d, rng)
    folds = st.kfold_indices(len(train), K=K, rng=rng, groups=train.mix.to_numpy())

    summary = {"n": len(d), "n_mix": int(d.mix.nunique()), "n_dup": int(d.duplicated(subset=ING + ["age", "strength"]).sum()),
               "n_multi_age_mix": int((d.groupby("mix").age.nunique() > 1).sum()),
               "n_train": len(train), "n_test": len(test),
               "n_mix_train": int(train.mix.nunique()), "n_mix_test": int(test.mix.nunique()),
               "n_28": int((d.age == 28).sum()), "wb_min": float(d.wb.min()), "wb_max": float(d.wb.max()),
               "strength_min": float(d.strength.min()), "strength_max": float(d.strength.max()),
               "strength_mean": float(d.strength.mean()), "strength_sd": float(d.strength.std())}

    # --- Concept 1: diagnostics (on the training mixtures) ---
    diag, raw, lg, h, cook, sr = diagnostics(train)
    fig_diagnostics(train, raw, lg, h, cook, sr)

    # --- Concept 2: degree of the age polynomial ---
    deg_rows = select_degree(train, folds)
    d_aic = min(deg_rows, key=lambda r: r["aic"])["degree"]
    d_bic = min(deg_rows, key=lambda r: r["bic"])["degree"]
    best_cv = min(deg_rows, key=lambda r: r["cv_mse"])
    # one-standard-error rule: smallest degree within 1 SE of the best CV error
    d_cv1se = min(r["degree"] for r in deg_rows if r["cv_mse"] <= best_cv["cv_mse"] + best_cv["cv_se"])
    D = d_bic
    fig_degree(deg_rows)

    # Abrams law coefficients (law with chosen age curve), full training set
    Xa, names_a = design(train, "abrams_wb", D)
    law = st.ols(st.add_intercept(Xa), train.y.to_numpy())
    t_wb = law["beta"][1] / law["se"][1]
    # independent-observation check: 28-day tests, one per mixture
    t28 = train[train.age == 28].drop_duplicates("mix")
    f28 = st.ols(st.add_intercept(t28.wb.to_numpy()), t28.y.to_numpy())
    # same law with w/c (Abrams' original)
    Xc, _ = design(train, "abrams_wc", D)
    law_wc = st.ols(st.add_intercept(Xc), train.y.to_numpy())

    # binder-composition model: law + what replaces cement, and how that changes with age
    Xp, names_p = design(train, "abrams_wb_plus", D)
    plus = st.ols(st.add_intercept(Xp), train.y.to_numpy())
    plus_coef = {nm: {"beta": float(bb), "se": float(se)}
                 for nm, bb, se in zip(["intercept"] + names_p, plus["beta"], plus["se"])}

    def replacement_effect(share_name, share, age):
        """% change in strength when `share` of the binder is slag/ash instead of cement."""
        la = np.log(age / 28.0)
        b0 = plus_coef[share_name]["beta"] + plus_coef[f"{share_name} x log age"]["beta"] * la
        return float(100 * (np.exp(b0 * share) - 1))

    repl = {f"{nm}|{age}": replacement_effect(nm, 0.3, age)
            for nm in ["slag share", "ash share"] for age in [7, 28, 365]}

    # --- Concept 3: lasso path on mixed features + ridge/lasso on quadratic expansion ---
    lams_mixed = np.geomspace(600, 0.05, 70)
    Bl, names_l = path(train, "mixed", "lasso", lams_mixed, degree=D)
    # order in which variables enter the lasso path
    entry = []
    for j, nm in enumerate(names_l):
        nz = np.flatnonzero(np.abs(Bl[:, j]) > 1e-10)
        entry.append((float(lams_mixed[nz[0]]) if len(nz) else 0.0, nm))
    entry.sort(reverse=True)
    mse_mixed, se_mixed = cv_penalized(train, "mixed", "lasso", lams_mixed, folds, degree=D)
    lam_mixed = float(lams_mixed[np.argmin(mse_mixed)])
    Bsel = Bl[np.argmin(mse_mixed)]

    lams_q = np.geomspace(1000, 0.05, 30)
    lams_r = np.geomspace(1000, 1e-4, 50)          # ridge is closed form: a wider grid is cheap
    mse_r, se_r = cv_penalized(train, "quadratic", "ridge", lams_r, folds)
    mse_l, se_l = cv_penalized(train, "quadratic", "lasso", lams_q, folds)
    lam_r = float(lams_r[np.argmin(mse_r)])
    lam_l = float(lams_q[np.argmin(mse_l)])
    # one-standard-error rule: largest lambda whose CV error is within 1 SE of the minimum
    i_min = int(np.argmin(mse_l))
    lam_l1se = float(lams_q[np.flatnonzero(mse_l <= mse_l[i_min] + se_l[i_min])[0]])
    fig_paths(lams_mixed, Bl, names_l, lam_mixed, lams_q, lams_r, mse_r, lam_r, mse_l, lam_l, lam_l1se)

    # --- Model comparison on held-out mixtures ---
    specs = [("Abrams w/c + age", "abrams_wc", D, "ols", None),
             ("Abrams w/b + age", "abrams_wb", D, "ols", None),
             ("w/b + binder mix + age", "abrams_wb_plus", D, "ols", None),
             ("7 ingredients + age", "ingredients", D, "ols", None),
             ("Quadratic (44 terms), OLS", "quadratic", 1, "ols", None),
             ("Quadratic, ridge", "quadratic", 1, "ridge", lam_r),
             ("Quadratic, lasso", "quadratic", 1, "lasso", lam_l),
             ("Quadratic, lasso (1-SE)", "quadratic", 1, "lasso", lam_l1se)]
    comp = []
    for label, kind, deg, method, lam in specs:
        if method == "ols":
            cv, cv_se = cv_ols(train, kind, deg, folds)
            Xk, _ = design(train, kind, deg)
            fk = st.ols(st.add_intercept(Xk), train.y.to_numpy())
            ic = st.gaussian_ic(fk["rss"], fk["n"], fk["q"] + 1)
            n_par, aic, bic = fk["q"], float(ic["aic"]), float(ic["bic"])
        else:
            m, s = (mse_r, se_r) if method == "ridge" else (mse_l, se_l)
            grid = lams_r if method == "ridge" else lams_q
            i = int(np.flatnonzero(grid == lam)[0]); cv, cv_se = float(m[i]), float(s[i])
            n_par, aic, bic = None, None, None
        pred, fitk, _ = fit_predict(train, test, kind, deg, method, lam)
        resid = test.y.to_numpy() - pred
        n_nonzero = int((np.abs(fitk["beta"]) > 1e-10).sum()) if method == "lasso" else None
        comp.append({"label": label, "kind": kind, "method": method, "cv_mse": cv, "cv_se": cv_se,
                     "test_rmse": float(np.sqrt((resid ** 2).mean())),
                     "test_mape": float(np.mean(np.abs(np.expm1(-resid)))),     # |f_hat - f| / f
                     "n_params": n_par, "aic": aic, "bic": bic, "n_nonzero": n_nonzero})
    fig_comparison(comp)
    fig_abrams_curves(train, law, D)

    # share of log-strength variance explained by the two-variable law
    tss = ((train.y - train.y.mean()) ** 2).sum()
    results = {"summary": summary, "diagnostics": diag, "degree_rows": deg_rows,
               "d_aic": d_aic, "d_bic": d_bic, "d_cv": best_cv["degree"], "d_cv1se": d_cv1se, "D": D,
               "law": {"names": ["intercept"] + names_a, "beta": law["beta"].tolist(),
                       "se": law["se"].tolist(), "r2": law["r2"], "t_wb": float(t_wb),
                       "sigma": float(np.sqrt(law["sigma2"]))},
               "law_wc_r2": law_wc["r2"],
               "law28": {"n": f28["n"], "beta": f28["beta"].tolist(), "se": f28["se"].tolist(), "r2": f28["r2"]},
               "lasso_entry_order": entry, "lam_mixed": lam_mixed,
               "lasso_mixed_selected": {nm: float(b) for nm, b in zip(names_l, Bsel)},
               "plus": {"coef": plus_coef, "r2": plus["r2"]}, "replacement30": repl,
               "lam_ridge": lam_r, "lam_lasso": lam_l, "lam_lasso_1se": lam_l1se,
               "comparison": comp}
    (RES / "concrete_results.json").write_text(json.dumps(results, indent=2))
    write_macros(results)
    print(json.dumps({k: v for k, v in results.items() if k not in ("degree_rows",)}, indent=1)[:6000])
    for r in deg_rows:
        print(r)


def write_macros(r):
    """Every number quoted in the report, as LaTeX macros (no hand-copied numbers)."""
    s, dg, law, comp = r["summary"], r["diagnostics"], r["law"], {c["label"]: c for c in r["comparison"]}
    m = {}
    m["NObs"] = f"{s['n']:,}"; m["NMix"] = s["n_mix"]; m["NMultiAge"] = s["n_multi_age_mix"]
    m["NTrain"] = s["n_train"]; m["NTest"] = s["n_test"]
    m["NMixTrain"] = s["n_mix_train"]; m["NMixTest"] = s["n_mix_test"]; m["NDup"] = s["n_dup"]
    m["StrMin"] = f"{s['strength_min']:.1f}"; m["StrMax"] = f"{s['strength_max']:.1f}"
    m["WBmin"] = f"{s['wb_min']:.2f}"; m["WBmax"] = f"{s['wb_max']:.2f}"
    m["MixTotal"] = f"{dg['mix_total_mean']:,.0f}"; m["MixTotalSD"] = f"{dg['mix_total_sd']:.0f}"
    m["NNegRaw"] = dg["n_neg_fitted_raw"]
    pc = r["plus"]["coef"]
    m["PlusRsq"] = f"{r['plus']['r2']:.3f}"
    for key, nm in [("Slag", "slag share"), ("Ash", "ash share"), ("SP", "superplast."),
                    ("SlagAge", "slag share x log age"), ("AshAge", "ash share x log age"),
                    ("WBAge", "w/b x log age"), ("WBplus", "w/b")]:
        m[f"Beta{key}"] = f"{pc[nm]['beta']:.2f}"; m[f"Se{key}"] = f"{pc[nm]['se']:.2f}"
        m[f"T{key}"] = f"{pc[nm]['beta'] / pc[nm]['se']:.1f}"
    m["BetaSP"] = f"{pc['superplast.']['beta']:.4f}"; m["SeSP"] = f"{pc['superplast.']['se']:.4f}"
    rp = r["replacement30"]
    for key, nm in [("Slag", "slag share"), ("Ash", "ash share")]:
        for age, w in [(7, "Seven"), (28, "TwentyEight"), (365, "Year")]:
            m[f"Repl{key}{w}"] = f"{rp[nm + '|' + str(age)]:+.0f}"
    law_b = r["law"]["beta"]; law_se = r["law"]["se"]
    m["WBlo"] = f"{law_b[1] - 1.96 * law_se[1]:.2f}"; m["WBhi"] = f"{law_b[1] + 1.96 * law_se[1]:.2f}"
    m["AbramsB"] = f"{np.exp(-law_b[1]):.1f}"
    m["GammaOne"] = f"{law_b[2]:.3f}"; m["GammaTwo"] = f"{law_b[3]:.3f}"
    m["SeGammaOne"] = f"{law_se[2]:.3f}"; m["SeGammaTwo"] = f"{law_se[3]:.3f}"
    m["LawAIC"] = f"{min(rr['aic'] for rr in r['degree_rows']):.1f}"
    m["SpreadRaw"] = f"{dg['spread_ratio_raw']:.2f}"; m["SpreadLog"] = f"{dg['spread_ratio_log']:.2f}"
    m["QQcorr"] = f"{dg['qq_corr']:.3f}"; m["NHighLev"] = dg["n_high_leverage"]
    m["NCook"] = dg["n_cook_gt_4n"]; m["MaxCook"] = f"{dg['max_cook']:.3f}"
    m["KappaLaw"] = f"{dg['kappa_abrams_wb']:.1f}"; m["KappaIng"] = f"{dg['kappa_ingredients']:,.0f}"
    m["KappaQuad"] = f"{dg['kappa_quadratic']:.1e}".replace("e+0", r"\times10^{").replace("e+", r"\times10^{") + "}"
    m["DAIC"] = r["d_aic"]; m["DBIC"] = r["d_bic"]; m["DCV"] = r["d_cv"]; m["DCVse"] = r["d_cv1se"]; m["Dsel"] = r["D"]
    m["BetaWB"] = f"{law['beta'][1]:.2f}"; m["SeWB"] = f"{law['se'][1]:.2f}"; m["TWB"] = f"{law['t_wb']:.1f}"
    m["LawRsq"] = f"{law['r2']:.3f}"; m["LawWCRsq"] = f"{r['law_wc_r2']:.3f}"; m["LawSigma"] = f"{law['sigma']:.3f}"
    m["StrengthFactor"] = f"{np.exp(-law['beta'][1] * 0.1):.2f}"      # strength multiplier per -0.1 w/b
    m["PctPerTenth"] = f"{(1 - np.exp(law['beta'][1] * 0.1)) * 100:.0f}"
    m["NTwentyEight"] = r["law28"]["n"]; m["BetaWBtwentyEight"] = f"{r['law28']['beta'][1]:.2f}"
    m["SeWBtwentyEight"] = f"{r['law28']['se'][1]:.2f}"; m["RsqTwentyEight"] = f"{r['law28']['r2']:.3f}"
    m["LamMixed"] = f"{r['lam_mixed']:.2f}"; m["LamRidge"] = f"{r['lam_ridge']:.3g}"; m["LamLasso"] = f"{r['lam_lasso']:.3f}"
    m["FirstEntry"] = r["lasso_entry_order"][0][1]; m["SecondEntry"] = r["lasso_entry_order"][1][1]
    m["NZLasso"] = comp["Quadratic, lasso"]["n_nonzero"]
    gap = (comp["Abrams w/b + age"]["test_rmse"] - comp["w/b + binder mix + age"]["test_rmse"]) / \
          (comp["Abrams w/b + age"]["test_rmse"] - min(c["test_rmse"] for c in comp.values()))
    m["GapShare"] = f"{100 * gap:.0f}"
    m["NZLassoSE"] = comp["Quadratic, lasso (1-SE)"]["n_nonzero"]
    m["LamLassoSE"] = f"{r['lam_lasso_1se']:.2f}"
    keymap = {"Abrams w/c + age": "WC", "Abrams w/b + age": "WB", "w/b + binder mix + age": "WBplus",
              "7 ingredients + age": "Ing", "Quadratic (44 terms), OLS": "QuadOLS",
              "Quadratic, ridge": "Ridge", "Quadratic, lasso": "Lasso",
              "Quadratic, lasso (1-SE)": "LassoSE"}
    for lab, key in keymap.items():
        c = comp[lab]
        m[f"CV{key}"] = f"{np.sqrt(c['cv_mse']):.3f}"
        m[f"Test{key}"] = f"{c['test_rmse']:.3f}"
        m[f"Mape{key}"] = f"{100 * c['test_mape']:.1f}"
        if c["bic"] is not None:
            m[f"BIC{key}"] = f"{c['bic']:.0f}"; m[f"AIC{key}"] = f"{c['aic']:.0f}"
            m[f"P{key}"] = c["n_params"]
    lines = ["% Auto-generated by src/concrete_analysis.py -- do not edit by hand."]
    for k, v in m.items():
        assert k.isalpha(), k
        lines.append(f"\\newcommand{{\\{k}}}{{{v}}}")
    (ROOT / "report").mkdir(exist_ok=True)
    (ROOT / "report" / "macros.tex").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
