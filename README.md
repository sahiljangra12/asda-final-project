# ASDA Final Project: EN.553.413/613 Applied Statistics and Data Science I (Fall 2026)

**Live website: https://sahiljangra12.github.io/asda-final-project/**

| Page | What it does |
|---|---|
| [Home](https://sahiljangra12.github.io/asda-final-project/) | Both missions at a glance |
| [Mission 01 · Email](https://sahiljangra12.github.io/asda-final-project/email.html) | Welch + Bonferroni with a live p-hacking simulator, Beta–Binomial posteriors you can play forward, a live bootstrap, subgroup posteriors, CLT check |
| [Mission 02 · Concrete](https://sahiljangra12.github.io/asda-final-project/concrete.html) | Live OLS of Abrams' law, diagnostics, AIC/BIC/grouped CV, ridge & lasso with a λ dial, held-out comparison you can reshuffle, a cement-replacement simulator |
| [Code Lab](https://sahiljangra12.github.io/asda-final-project/lab.html) | Our real Python (`stats_tools.py`, both analyses, the 31 tests) running in the browser via Pyodide |

**Presenting:** press **Present** in the top bar on a mission page. Each chapter fills the screen, and the arrow keys or space move between them (Esc exits). Open the Code Lab and press *Start Python* before the talk, so cells run instantly.

Every number on the mission pages is computed in the browser from the data, so it can differ slightly from the report. The JavaScript uses its own random seeds and train/test split; the report's numbers come from the Python scripts below.

Team: Sahil, Zimo, Feipeng Liu, Sreekar, Shounak

Two analyses on two different datasets from the course collection, each built on different course concepts:

| | Presentation | Written report |
|---|---|---|
| Dataset | P04 Hillstrom Email Marketing Experiment (64,000 customers) | P01 Concrete Compressive Strength (1,030 tests) |
| Question | Do the emails raise revenue, and is the lift from **more buyers or bigger baskets**? Does matching the email to past purchases matter? | Is strength still governed by **Abrams' law** (water/binder ratio + age), and what do the ingredients add for mixtures never seen in fitting? |
| Concepts | Welch's t + Bonferroni (L8) · nonparametric bootstrap (L9) · Bayesian Beta–Binomial updating (L11) | Regression + diagnostics (L12–13) · polynomial basis, AIC/BIC, grouped K-fold CV (L14–15) · ridge & lasso (L14, L16) |
| Code | `src/hillstrom_analysis.py` | `src/concrete_analysis.py` |
| Output | `slides/Hillstrom_Presentation.pptx`, `interactive/hillstrom_explorer.html` | `report/report.pdf` |

## Reproduce everything

```bash
pip install -r requirements.txt
python run_all.py          # both analyses, interactive page, tests (~2 min)
```

or step by step:

```bash
python src/hillstrom_analysis.py     # ~15 s  -> outputs/results/hillstrom_results.json, outputs/figures/H*
python src/concrete_analysis.py      # ~1 min -> outputs/results/concrete_results.json, outputs/figures/C*, report/macros.tex
python src/build_interactive.py      # -> interactive/hillstrom_explorer.html (open in any browser)
python -m pytest                     # 31 unit tests / sanity checks
cd report && latexmk -pdf report.tex # 4-page report; every number comes from macros.tex
python slides/capture_screens.py     # with the site served on :8765: refresh the screen captures used in the deck
node slides/build_slides.js          # rebuild the deck: slides 1-9 mirror email.html screens 1-9, then backup slides
```

All random steps use fixed seeds (`SEED` at the top of each script), so every number in the report and slides is reproduced exactly.

## Layout

```
index.html, email.html, concrete.html, lab.html   the website (GitHub Pages)
assets/                   site CSS and JavaScript (core.js = maths, charts; one file per page)
data/                     hillstrom.csv, concrete.csv (see data/SOURCES.md)
src/asda/stats_tools.py   every statistical method, written from the lecture formulas
src/asda/plotstyle.py     shared figure style (fixed colours per experimental arm)
src/hillstrom_analysis.py analysis 1 (presentation)
src/concrete_analysis.py  analysis 2 (report)
src/build_interactive.py  builds the interactive explorer
tests/                    unit tests: methods vs scipy/scikit-learn and lecture properties
interactive/              explorer_template.html (source) + hillstrom_explorer.html (built)
report/                   report.tex, macros.tex (generated), report.pdf
slides/                   build_slides.js, Hillstrom_Presentation.pptx (speaker notes inside)
outputs/                  figures (report size + slides/ larger-type versions), results JSON
```

## Where each method lives (for Q&A at the board)

| Method | Lecture | Function (`src/asda/stats_tools.py`) | Test |
|---|---|---|---|
| Welch's t-statistic, Welch–Satterthwaite df | 8 | `welch_t` | `test_welch_matches_scipy`, `test_welch_lecture_example` |
| Bonferroni correction | 8 | `bonferroni` | `test_bonferroni` |
| Nonparametric bootstrap, percentile CI | 9 | `bootstrap_two_sample`, `percentile_ci` | `test_bootstrap_se_matches_analytic_for_mean_difference` |
| Beta–Binomial posterior; sequential = batch | 11 | `beta_posterior`, `beta_summary` | `test_beta_posterior_update_and_sequential_equivalence` |
| P(θ_A > θ_B) by Monte Carlo | 5, 11 | `prob_greater` | `test_prob_greater_symmetric_and_extreme` |
| OLS in matrix form, SEs, R² | 12–13 | `ols` | `test_ols_matches_lstsq_and_recovers_truth` |
| Leverage h_ii, Cook's distance | 13 | `hat_diag`, `cooks_distance` | `test_hat_matrix_properties` |
| Condition number κ(XᵀX) | 13 | `condition_number` | `test_condition_number_flags_collinearity` |
| AIC / BIC for Gaussian regression | 15 | `gaussian_ic` | `test_gaussian_ic_matches_loglik` |
| (Grouped) K-fold CV | 14 | `kfold_indices` | `test_grouped_kfold_keeps_groups_together` |
| Ridge (closed form) | 14, 16 | `ridge` | `test_ridge_matches_sklearn_and_limits` |
| Lasso (coordinate descent, soft-thresholding) | 16 | `lasso`, `soft_threshold` | `test_lasso_matches_sklearn`, `test_lasso_zero_above_lambda_max` |

Analysis-specific checks: `tests/test_hillstrom.py` (revenue identity μ_T/μ_C = (p_T/p_C)(m_T/m_C), randomization balance, spend bounds) and `tests/test_concrete.py` (ratios, 427 mixtures, train/test mixtures disjoint, physical signs of the law).

## Key data decisions

* **Hillstrom.** No missing values; `conversion == (spend > 0)` is asserted. Spend has a $29.99 floor and a $499 cap, a limitation for basket-size estimates. The bootstrap resamples each arm separately, keeping arm sizes fixed as in the randomized design.
* **Concrete.** 1,030 tests come from 427 distinct mixtures, many tested at several ages. Tests of one mixture are not independent, so the held-out test set (85 mixtures) and every CV fold are formed from **whole mixtures**. The 25 exact duplicate rows are replicate cylinders and are kept. Strength is modelled on the log scale, which is the form Abrams' law predicts.

AI-assisted coding was used; every team member is responsible for and able to explain every line.
