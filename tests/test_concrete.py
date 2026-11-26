"""Sanity checks for the Concrete analysis (src/concrete_analysis.py)."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import concrete_analysis as ca  # noqa: E402
from asda import stats_tools as st  # noqa: E402


@pytest.fixture(scope="module")
def data():
    return ca.load()       # load() asserts 1,030 rows, no NAs, positive strength and cement


def test_derived_ratios(data):
    np.testing.assert_allclose(data.wb, data.water / (data.cement + data.slag + data.ash))
    assert (data.wb <= data.wc + 1e-12).all()        # binder >= cement, so w/b <= w/c
    assert np.isclose(data.slag_share + data.ash_share + data.cement / data.binder, 1).all()


def test_mixture_ids(data):
    # 427 distinct recipes; every row of one mixture has identical ingredients
    assert data.mix.nunique() == 427
    assert (data.groupby("mix")[ca.ING].nunique() == 1).all().all()


def test_train_test_split_keeps_mixtures_apart(data):
    tr, te = ca.split_by_mixture(data, np.random.default_rng(ca.SEED))
    assert set(tr.mix).isdisjoint(te.mix)
    assert len(tr) + len(te) == len(data)


def test_design_shapes(data):
    X, names = ca.design(data, "abrams_wb", degree=3)
    assert X.shape == (len(data), 4) and len(names) == 4
    Xq, nq = ca.design(data, "quadratic")
    assert Xq.shape[1] == 8 + 8 * 9 // 2 == 44 == len(nq)    # linear + squares + pairwise
    # age polynomial is centred at 28 days
    assert np.allclose(ca.age_poly(data[data.age == 28], 2), 0)


def test_cv_ols_uses_held_out_folds(data):
    # A model evaluated on held-out folds cannot beat its own in-sample fit
    folds = st.kfold_indices(len(data), K=5, rng=0, groups=data.mix.to_numpy())
    cv_mse, _ = ca.cv_ols(data, "abrams_wb", 2, folds)
    X, _ = ca.design(data, "abrams_wb", 2)
    fit = st.ols(st.add_intercept(X), data.y.to_numpy())
    assert cv_mse > fit["rss"] / len(data)


def test_abrams_sign(data):
    # Physical sanity: more water per unit binder -> weaker concrete; older -> stronger
    X, _ = ca.design(data, "abrams_wb", 1)
    beta = st.ols(st.add_intercept(X), data.y.to_numpy())["beta"]
    assert beta[1] < 0 and beta[2] > 0
