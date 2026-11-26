"""Sanity checks for the Hillstrom analysis (src/hillstrom_analysis.py)."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import hillstrom_analysis as ha  # noqa: E402


@pytest.fixture(scope="module")
def data():
    return ha.load()          # load() itself asserts row count, no NAs, conversion == (spend > 0)


def test_revenue_identity_holds_exactly():
    # mu_T / mu_C = (p_T / p_C) * (m_T / m_C) for any spend vectors
    rng = np.random.default_rng(0)
    t = np.where(rng.random((5, 500)) < 0.03, rng.gamma(2, 50, (5, 500)), 0)
    c = np.where(rng.random((5, 400)) < 0.02, rng.gamma(2, 50, (5, 400)), 0)
    s = ha.decomposition_stats(t, c)
    np.testing.assert_allclose(s[:, 1], s[:, 2] * s[:, 3], rtol=1e-12)
    np.testing.assert_allclose(s[:, 0], t.mean(1) - c.mean(1))


def test_decomposition_of_identical_samples_is_one():
    x = np.array([0, 0, 0, 30.0, 0, 120.0])
    s = ha.decomposition_stats(x, x)[0]
    np.testing.assert_allclose(s, [0, 1, 1, 1])


def test_arms_and_groups_are_complete(data):
    assert set(data.segment) == {ha.CONTROL, ha.MENS, ha.WOMENS}
    assert data.past.value_counts().sum() == 64_000
    # every customer bought men's or women's merchandise before
    assert ((data.mens + data.womens) >= 1).all()


def test_randomization_balance(data):
    # with 10 balance tests, |T| > 3 would be a red flag for the randomization
    bal = ha.randomization_check(data)
    assert max(abs(v) for v in bal.values()) < 3


def test_spend_bounds(data):
    buyers = data.loc[data.spend > 0, "spend"]
    assert buyers.min() == pytest.approx(29.99)
    assert buyers.max() == pytest.approx(499.0)
