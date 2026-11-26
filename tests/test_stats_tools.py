"""Unit tests / sanity checks for src/asda/stats_tools.py.

Run from the project root:  python -m pytest -q

Each test either (a) compares a hand-written function with a trusted library
routine, or (b) checks a property derived in lecture (e.g. trace(H) = p + 1,
ridge -> OLS as lambda -> 0, lasso is exactly zero for large lambda).
"""
import numpy as np
import pytest
from scipy import stats
from sklearn.linear_model import Lasso, Ridge

from asda import stats_tools as st

RNG = np.random.default_rng(413)


# ---------------- Lecture 8 ----------------
def test_welch_matches_scipy():
    x = RNG.normal(1.0, 2.0, 40)
    y = RNG.normal(0.0, 5.0, 25)
    ours = st.welch_t(x, y)
    ref = stats.ttest_ind(x, y, equal_var=False)
    assert ours["t"] == pytest.approx(ref.statistic, rel=1e-10)
    assert ours["p"] == pytest.approx(ref.pvalue, rel=1e-8)


def test_welch_lecture_example():
    # Lecture 8 worked example: summary stats only, so check the formula directly.
    # Xbar_T = 76, S_T = 12, n_T = 25; Xbar_C = 70, S_C = 8, n_C = 25 -> T_W ~ 2.08
    se = np.sqrt(12 ** 2 / 25 + 8 ** 2 / 25)
    assert (76 - 70) / se == pytest.approx(2.08, abs=0.01)


def test_bonferroni():
    p_adj, rej = st.bonferroni([0.01, 0.02, 0.5], alpha=0.05)
    np.testing.assert_allclose(p_adj, [0.03, 0.06, 1.0])
    assert rej.tolist() == [True, False, False]


# ---------------- Lecture 9 ----------------
def test_bootstrap_se_matches_analytic_for_mean_difference():
    # For a difference of means, the bootstrap SE should be close to the
    # analytic sqrt(S_T^2/n_T + S_C^2/n_C) (up to the (n-1)/n plug-in factor).
    x = RNG.exponential(2.0, 400)
    y = RNG.exponential(1.0, 300)
    reps = st.bootstrap_two_sample(lambda a, b: a.mean(1) - b.mean(1), x, y,
                                   B=4000, rng=1)
    analytic = st.welch_t(x, y)["se"]
    assert reps.std(ddof=1) == pytest.approx(analytic, rel=0.06)
    # replicate distribution is centred on the observed statistic
    assert reps.mean() == pytest.approx(x.mean() - y.mean(), abs=0.03)


def test_bootstrap_is_reproducible():
    x, y = RNG.normal(size=50), RNG.normal(size=60)
    f = lambda a, b: a.mean(1) / (1 + b.mean(1) ** 2)
    r1 = st.bootstrap_two_sample(f, x, y, B=300, rng=7)
    r2 = st.bootstrap_two_sample(f, x, y, B=300, rng=7)
    np.testing.assert_array_equal(r1, r2)


def test_percentile_ci():
    lo, hi = st.percentile_ci(np.arange(1, 1001), 0.90)
    assert lo == pytest.approx(50.95) and hi == pytest.approx(950.05)


# ---------------- Lecture 11 ----------------
def test_beta_posterior_update_and_sequential_equivalence():
    # batch update
    a, b = st.beta_posterior(h=7, n=10, alpha0=2, beta0=3)
    assert (a, b) == (9, 6)
    # sequential update, one flip at a time, gives the same posterior (Lecture 11)
    flips = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1]
    a_s, b_s = 2.0, 3.0
    for f in flips:
        a_s, b_s = st.beta_posterior(f, 1, a_s, b_s)
    assert (a_s, b_s) == (a, b)


def test_beta_summary_matches_scipy():
    s = st.beta_summary(30, 70)
    assert s["mean"] == pytest.approx(0.3)
    assert s["lo"] == pytest.approx(stats.beta.ppf(0.025, 30, 70))


def test_prob_greater_symmetric_and_extreme():
    p_same, _ = st.prob_greater((50, 50), (50, 50), M=200_000, rng=3)
    assert p_same == pytest.approx(0.5, abs=0.01)
    p_big, _ = st.prob_greater((900, 100), (100, 900), M=20_000, rng=3)
    assert p_big == 1.0


def test_beta_posterior_rejects_bad_counts():
    with pytest.raises(ValueError):
        st.beta_posterior(5, 3)


# ---------------- Lectures 12-13 ----------------
def _toy_regression(n=200, p=3):
    X = RNG.normal(size=(n, p))
    beta = np.array([1.5, -2.0, 0.5])[:p]
    y = 3.0 + X @ beta + RNG.normal(0, 0.5, n)
    return X, y


def test_ols_matches_lstsq_and_recovers_truth():
    X, y = _toy_regression()
    Xd = st.add_intercept(X)
    fit = st.ols(Xd, y)
    ref, *_ = np.linalg.lstsq(Xd, y, rcond=None)
    np.testing.assert_allclose(fit["beta"], ref, rtol=1e-10)
    np.testing.assert_allclose(fit["beta"], [3.0, 1.5, -2.0, 0.5], atol=0.15)
    # residuals are orthogonal to every column of X (normal equations)
    np.testing.assert_allclose(Xd.T @ fit["resid"], 0, atol=1e-8)


def test_hat_matrix_properties():
    X, _ = _toy_regression(n=60)
    Xd = st.add_intercept(X)
    h = st.hat_diag(Xd)
    H = Xd @ np.linalg.inv(Xd.T @ Xd) @ Xd.T
    np.testing.assert_allclose(h, np.diag(H), rtol=1e-10)
    assert h.sum() == pytest.approx(Xd.shape[1])          # trace(H) = p + 1
    assert np.all((h > 0) & (h < 1))


def test_condition_number_flags_collinearity():
    x1 = RNG.normal(size=100)
    good = st.add_intercept(np.column_stack([x1, RNG.normal(size=100)]))
    bad = st.add_intercept(np.column_stack([x1, x1 + 1e-3 * RNG.normal(size=100)]))
    assert st.condition_number(bad) > 1e4 * st.condition_number(good)


# ---------------- Lecture 15 ----------------
def test_gaussian_ic_matches_loglik():
    X, y = _toy_regression()
    fit = st.ols(st.add_intercept(X), y)
    n = len(y)
    s2_mle = fit["rss"] / n
    loglik = stats.norm.logpdf(y, fit["fitted"], np.sqrt(s2_mle)).sum()
    ic = st.gaussian_ic(fit["rss"], n, k=fit["q"] + 1)
    assert ic["m2ll"] == pytest.approx(-2 * loglik, rel=1e-10)
    assert ic["bic"] - ic["aic"] == pytest.approx((np.log(n) - 2) * (fit["q"] + 1))


# ---------------- Lecture 14 ----------------
def test_kfold_partitions_data():
    folds = st.kfold_indices(103, K=10, rng=0)
    allidx = np.concatenate(folds)
    assert sorted(allidx.tolist()) == list(range(103))
    assert max(map(len, folds)) - min(map(len, folds)) <= 1


def test_grouped_kfold_keeps_groups_together():
    groups = np.repeat(np.arange(30), 4)
    folds = st.kfold_indices(len(groups), K=5, rng=0, groups=groups)
    for f in folds:
        other = np.setdiff1d(np.arange(len(groups)), f)
        assert set(groups[f]).isdisjoint(groups[other])


# ---------------- Lectures 14, 16 ----------------
def test_ridge_matches_sklearn_and_limits():
    X, y = _toy_regression()
    b0, b = st.ridge(X, y, lam=5.0)
    ref = Ridge(alpha=5.0).fit(X, y)
    np.testing.assert_allclose(b, ref.coef_, rtol=1e-8)
    assert b0 == pytest.approx(ref.intercept_)
    # lambda -> 0 gives OLS
    fit = st.ols(st.add_intercept(X), y)
    np.testing.assert_allclose(st.ridge(X, y, 1e-10)[1], fit["beta"][1:], rtol=1e-6)
    # larger lambda shrinks the coefficient norm
    assert np.linalg.norm(st.ridge(X, y, 1e4)[1]) < np.linalg.norm(b)


def test_lasso_matches_sklearn():
    X, y = _toy_regression(p=3)
    X = np.column_stack([X, RNG.normal(size=(len(y), 4))])  # 4 pure-noise columns
    lam = 40.0
    b0, b = st.lasso(X, y, lam)
    # sklearn minimises (1/2n)||y - Xb||^2 + a||b||_1, i.e. our lam = 2 n a
    ref = Lasso(alpha=lam / (2 * len(y)), tol=1e-12, max_iter=100_000).fit(X, y)
    np.testing.assert_allclose(b, ref.coef_, atol=1e-6)
    assert b0 == pytest.approx(ref.intercept_, abs=1e-6)


def test_lasso_zero_above_lambda_max():
    X, y = _toy_regression()
    Xc, yc = X - X.mean(0), y - y.mean()
    lam_max = 2 * np.max(np.abs(Xc.T @ yc))       # smallest lam with beta_hat = 0
    assert np.all(st.lasso(X, y, lam_max * 1.01)[1] == 0)
    assert np.any(st.lasso(X, y, lam_max * 0.9)[1] != 0)


def test_soft_threshold():
    np.testing.assert_allclose(st.soft_threshold(np.array([-3, -0.5, 0.5, 3]), 1),
                               [-2, 0, 0, 2])
