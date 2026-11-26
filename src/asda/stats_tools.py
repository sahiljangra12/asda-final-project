"""Statistical tools for the ASDA final project, written from the lecture notes.

Each function implements one method from EN.553.413/613 and uses the same
notation as the lectures. Library routines (scipy, scikit-learn) are used only
in the unit tests, to check that these hand-written versions agree with them.

Lecture map
-----------
welch_t              Lecture 8   Welch's t-statistic for two independent samples
bonferroni           Lecture 8   p-hacking / multiple testing correction
bootstrap_two_sample Lecture 9   nonparametric bootstrap
percentile_ci        Lecture 9   bootstrap percentile interval
beta_posterior       Lecture 11  Beta-Binomial conjugate update
prob_greater         Lectures 5, 11  Monte Carlo estimate of P(theta_A > theta_B | data)
ols                  Lecture 12  least squares in matrix form, beta_hat = (X^T X)^{-1} X^T y
hat_diag             Lecture 13  leverage h_ii = H_ii, H = X (X^T X)^{-1} X^T
condition_number     Lecture 13  kappa(X^T X) = lambda_max / lambda_min
gaussian_ic          Lecture 15  AIC / BIC for Gaussian regression
kfold_indices        Lecture 14  K-fold cross-validation folds (optionally grouped)
ridge                Lectures 14, 16  ridge regression, closed form
lasso                Lecture 16  lasso by coordinate descent (soft thresholding)
"""
from __future__ import annotations

import numpy as np
from scipy import stats

# ---------------------------------------------------------------------------
# Lecture 8: hypothesis testing
# ---------------------------------------------------------------------------

def welch_t(x_t, x_c):
    """Welch's t-test of H0: mu_T = mu_C against H1: mu_T != mu_C.

    T_W = (Xbar_T - Xbar_C) / sqrt(S_T^2/n_T + S_C^2/n_C)

    Degrees of freedom use the Welch-Satterthwaite approximation, the value
    "statistical software" reports in Lecture 8.

    Returns a dict with the difference, its estimated SE, T_W, df and the
    two-sided p-value.
    """
    x_t = np.asarray(x_t, dtype=float)
    x_c = np.asarray(x_c, dtype=float)
    n_t, n_c = len(x_t), len(x_c)
    s2_t, s2_c = x_t.var(ddof=1), x_c.var(ddof=1)      # unbiased S^2 (Lecture 5)
    diff = x_t.mean() - x_c.mean()
    se = np.sqrt(s2_t / n_t + s2_c / n_c)
    t_w = diff / se
    a, b = s2_t / n_t, s2_c / n_c
    df = (a + b) ** 2 / (a ** 2 / (n_t - 1) + b ** 2 / (n_c - 1))
    p = 2 * stats.t.sf(abs(t_w), df)
    return {"diff": diff, "se": se, "t": t_w, "df": df, "p": p,
            "ci95": (diff - stats.t.ppf(0.975, df) * se,
                     diff + stats.t.ppf(0.975, df) * se)}


def bonferroni(pvals, alpha=0.05):
    """Bonferroni correction: reject H0_j when p_j <= alpha / m.

    Guards against the p-hacking problem in Lecture 8: running m tests at
    level alpha gives a much larger chance of at least one false rejection.
    Returns the adjusted p-values min(1, m p_j) and the reject decisions.
    """
    p = np.asarray(pvals, dtype=float)
    m = len(p)
    p_adj = np.minimum(1.0, m * p)
    return p_adj, p_adj <= alpha

# ---------------------------------------------------------------------------
# Lecture 9: nonparametric bootstrap
# ---------------------------------------------------------------------------

def bootstrap_two_sample(stat_fn, x_t, x_c, B=5000, rng=None, chunk=250):
    """Nonparametric bootstrap for a statistic of two independent samples.

    For replicate b = 1..B, draw X_T^{*(b)} with replacement from the observed
    treatment sample and X_C^{*(b)} from the control sample (each arm keeps its
    own size, mirroring the randomized design), then compute
    theta_hat^{*(b)} = stat_fn(X_T^{*(b)}, X_C^{*(b)}).

    stat_fn must accept 2-D arrays of shape (k, n) and return either a
    length-k vector (one statistic) or a (k, s) array (s statistics computed
    on the SAME resamples), so that replicates can be computed in chunks.
    Returns an array of shape (B,) or (B, s).
    """
    rng = np.random.default_rng(rng)
    x_t = np.asarray(x_t, dtype=float)
    x_c = np.asarray(x_c, dtype=float)
    parts = []
    for start in range(0, B, chunk):
        k = min(chunk, B - start)
        it = rng.integers(0, len(x_t), size=(k, len(x_t)))
        ic = rng.integers(0, len(x_c), size=(k, len(x_c)))
        parts.append(np.asarray(stat_fn(x_t[it], x_c[ic]), dtype=float))
    return np.concatenate(parts, axis=0)


def percentile_ci(reps, level=0.95):
    """Bootstrap percentile interval [q_{alpha/2}, q_{1-alpha/2}]."""
    a = (1 - level) / 2
    lo, hi = np.quantile(reps, [a, 1 - a])
    return float(lo), float(hi)

# ---------------------------------------------------------------------------
# Lecture 11: Bayesian updating, Beta-Binomial conjugacy
# ---------------------------------------------------------------------------

def beta_posterior(h, n, alpha0=1.0, beta0=1.0):
    """Posterior for a Bernoulli probability theta under a Beta prior.

    Prior theta ~ Beta(alpha0, beta0); data: h successes in n trials.
    Posterior theta | x ~ Beta(alpha0 + h, beta0 + n - h).
    """
    if h < 0 or h > n:
        raise ValueError("need 0 <= h <= n")
    return alpha0 + h, beta0 + (n - h)


def beta_summary(a, b, level=0.95):
    """Posterior mean a/(a+b) and equal-tailed credible interval."""
    q = (1 - level) / 2
    return {"mean": a / (a + b),
            "lo": stats.beta.ppf(q, a, b),
            "hi": stats.beta.ppf(1 - q, a, b)}


def prob_greater(post_a, post_b, M=200_000, rng=None):
    """Monte Carlo estimate of P(theta_A > theta_B | data).

    Draw theta_A^(m) ~ Beta(post_a), theta_B^(m) ~ Beta(post_b) independently
    (the two arms are independent samples) and average the indicator.
    Also returns the draws of the difference theta_A - theta_B.
    """
    rng = np.random.default_rng(rng)
    ta = rng.beta(*post_a, size=M)
    tb = rng.beta(*post_b, size=M)
    return float(np.mean(ta > tb)), ta - tb

# ---------------------------------------------------------------------------
# Lectures 12-13: linear regression and diagnostics
# ---------------------------------------------------------------------------

def add_intercept(X):
    X = np.asarray(X, dtype=float)
    if X.ndim == 1:
        X = X[:, None]
    return np.column_stack([np.ones(len(X)), X])


def ols(X, y):
    """Ordinary least squares, y = X beta + eps (X already contains the 1s column).

    beta_hat = (X^T X)^{-1} X^T y, computed by solving the normal equations.
    sigma2_hat = RSS / (n - p - 1)       (unbiased; p+1 = number of columns)
    Var(beta_hat | X) = sigma^2 (X^T X)^{-1}   (Lecture 12, homoscedastic case)
    """
    X = np.asarray(X, dtype=float)
    y = np.asarray(y, dtype=float)
    n, q = X.shape
    XtX = X.T @ X
    beta = np.linalg.solve(XtX, X.T @ y)
    fitted = X @ beta
    resid = y - fitted
    rss = float(resid @ resid)
    sigma2 = rss / (n - q)
    cov = sigma2 * np.linalg.inv(XtX)
    se = np.sqrt(np.diag(cov))
    tss = float(((y - y.mean()) ** 2).sum())
    r2 = 1 - rss / tss
    r2_adj = 1 - (rss / (n - q)) / (tss / (n - 1))
    return {"beta": beta, "se": se, "cov": cov, "fitted": fitted,
            "resid": resid, "rss": rss, "sigma2": sigma2, "n": n, "q": q,
            "r2": r2, "r2_adj": r2_adj}


def hat_diag(X):
    """Leverages h_ii, the diagonal of H = X (X^T X)^{-1} X^T.

    Computed as row sums of (X (X^T X)^{-1}) * X to avoid forming the n x n H.
    Sanity property: sum_i h_ii = trace(H) = number of columns of X.
    """
    X = np.asarray(X, dtype=float)
    A = np.linalg.solve(X.T @ X, X.T).T          # X (X^T X)^{-1}
    return np.einsum("ij,ij->i", A, X)


def cooks_distance(resid, h, sigma2, q):
    """Cook's distance D_i = e_i^2 h_ii / (q sigma2 (1 - h_ii)^2).

    Combines a large residual (outlier) with high leverage, the Lecture 13
    definition of influence.
    """
    return resid ** 2 * h / (q * sigma2 * (1 - h) ** 2)


def condition_number(X):
    """kappa(X^T X) = lambda_max(X^T X) / lambda_min(X^T X)."""
    ev = np.linalg.eigvalsh(np.asarray(X, float).T @ np.asarray(X, float))
    return float(ev.max() / ev.min())

# ---------------------------------------------------------------------------
# Lecture 15: information criteria for Gaussian regression
# ---------------------------------------------------------------------------

def gaussian_ic(rss, n, k):
    """AIC and BIC for a Gaussian linear model.

    With sigma2_MLE = RSS / n, the maximised log-likelihood satisfies
        -2 l_hat = n log(RSS / n) + n log(2 pi) + n.
    AIC = -2 l_hat + 2k,  BIC = -2 l_hat + k log n,
    where k counts every estimated parameter (the coefficients and sigma^2).
    """
    m2ll = n * np.log(rss / n) + n * np.log(2 * np.pi) + n
    return {"m2ll": m2ll, "aic": m2ll + 2 * k, "bic": m2ll + k * np.log(n)}

# ---------------------------------------------------------------------------
# Lecture 14: K-fold cross-validation
# ---------------------------------------------------------------------------

def kfold_indices(n, K=10, rng=None, groups=None):
    """Return a list of K test-index arrays for K-fold cross-validation.

    If `groups` is given, whole groups are assigned to folds, so that every
    observation of one group lands in the same fold (used for concrete
    mixtures tested at several ages: otherwise the same mixture would appear
    in both training and validation sets).
    """
    rng = np.random.default_rng(rng)
    if groups is None:
        perm = rng.permutation(n)
        return [np.sort(f) for f in np.array_split(perm, K)]
    groups = np.asarray(groups)
    uniq = rng.permutation(np.unique(groups))
    folds_g = np.array_split(uniq, K)
    return [np.sort(np.flatnonzero(np.isin(groups, fg))) for fg in folds_g]


def standardize(X_train, X_other=None):
    """Center and scale columns with the TRAINING mean and SD (Lecture 16)."""
    mu = X_train.mean(axis=0)
    sd = X_train.std(axis=0, ddof=0)
    sd[sd == 0] = 1.0
    Z = (X_train - mu) / sd
    if X_other is None:
        return Z, mu, sd
    return Z, (X_other - mu) / sd, mu, sd

# ---------------------------------------------------------------------------
# Lectures 14 and 16: ridge and lasso
# ---------------------------------------------------------------------------

def ridge(Z, y, lam):
    """Ridge regression with an unpenalised intercept.

    (beta0_hat, beta_hat) = argmin ||y - beta0 1 - Z beta||_2^2 + lam ||beta||_2^2.
    With centred y and centred Z this is beta_hat = (Z^T Z + lam I)^{-1} Z^T y
    and beta0_hat = ybar - zbar^T beta_hat.
    Bayesian view (Lecture 16): MAP under beta_j ~ N(0, tau^2), lam = sigma^2 / tau^2.
    """
    Z = np.asarray(Z, float)
    y = np.asarray(y, float)
    zbar, ybar = Z.mean(axis=0), y.mean()
    Zc, yc = Z - zbar, y - ybar
    p = Z.shape[1]
    beta = np.linalg.solve(Zc.T @ Zc + lam * np.eye(p), Zc.T @ yc)
    return ybar - zbar @ beta, beta


def soft_threshold(rho, t):
    """S(rho, t) = sign(rho) max(|rho| - t, 0)."""
    return np.sign(rho) * np.maximum(np.abs(rho) - t, 0.0)


def lasso(Z, y, lam, beta_init=None, tol=1e-10, max_iter=20_000):
    """Lasso by cyclic coordinate descent, unpenalised intercept.

    (beta0_hat, beta_hat) = argmin ||y - beta0 1 - Z beta||_2^2 + lam ||beta||_1.
    Bayesian view (Lecture 16): MAP under Laplace(0, b) priors, lam = 2 sigma^2 / b.

    Coordinate update: with partial residual r_j = y_c - sum_{k != j} z_k beta_k,
        beta_j <- S(z_j^T r_j, lam / 2) / (z_j^T z_j).

    For speed we use z_j^T r_j = c_j - sum_{k != j} G_jk beta_k with the Gram
    matrix G = Z_c^T Z_c and c = Z_c^T y_c, computed once (O(p) per update
    instead of O(n)). `tol` is on the largest coefficient change in a sweep.
    """
    Z = np.asarray(Z, float)
    y = np.asarray(y, float)
    zbar, ybar = Z.mean(axis=0), y.mean()
    Zc, yc = Z - zbar, y - ybar
    p = Z.shape[1]
    G = Zc.T @ Zc
    c = Zc.T @ yc
    diag = np.diag(G).copy()
    beta = np.zeros(p) if beta_init is None else np.array(beta_init, float)
    Gb = G @ beta                                     # running G beta
    half = lam / 2
    for _ in range(max_iter):
        max_step = 0.0
        for j in range(p):
            old = beta[j]
            rho = c[j] - Gb[j] + diag[j] * old        # z_j^T r_j
            new = soft_threshold(rho, half) / diag[j]
            if new != old:
                Gb += G[:, j] * (new - old)
                beta[j] = new
                step = abs(new - old)
                if step > max_step:
                    max_step = step
        if max_step < tol:
            break
    return ybar - zbar @ beta, beta
