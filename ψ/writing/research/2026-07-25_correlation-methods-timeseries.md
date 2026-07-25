---
title: Correlation methods for environmental time-series comparison
date: 2026-07-25
source: /deep-research via Sonnet subagent, commissioned by Nat
oracle: citation (m5)
status: research findings — NOT yet verified against primary PDFs (see flags)
anchors:
  dustboy_vs_bam: { r: 0.87, bias: +18.8, rmse: 37.7 }
  gems_eta72_vs_bam: { r: 0.76, bias: -3.4, rmse: 27.3 }
---

# Correlation ≠ Accuracy — what the statistics literature says about our numbers

> **The finding that matters**: the source with the *best correlation* (DustBoy, r=0.87)
> is **not** the most accurate one (GEMS eta72, RMSE=27.3 vs DustBoy 37.7). This is the
> exact failure mode the method-comparison literature was built to warn about.

## 1. Why r can't see our bias

**Pearson r is invariant to scale and offset**, so DustBoy's consistent **+18.8 µg/m³**
overshoot barely dents r=0.87. Bland & Altman (1986) showed two methods can correlate
almost perfectly while disagreeing by a practically unacceptable margin — r measures
*association*, not *agreement*.

- Bland, J.M. & Altman, D.G. (1986). Statistical methods for assessing agreement between
  two methods of clinical measurement. *The Lancet* 327(8476), 307–310. (no DOI assigned;
  PMID 2868172)

## 2. The arithmetic that should go in the thesis

**Only ~25% of DustBoy's error is the correctable bias:**

```
bias²      = 18.8²  ≈  353
total MSE  = 37.7²  ≈ 1421
bias share = 353/1421 ≈ 25%
remainder  ≈ 1068  →  RMSE-equivalent ≈ 32.7 µg/m³ of unsystematic scatter
```

So **a linear bias correction cannot fix DustBoy** — it addresses a quarter of the squared
error and leaves ~32.7 µg/m³ of random scatter. This is a strong, defensible statement for
the defence, and it directly bounds the claim "calibration will fix it".

- Willmott, C.J. (1981). On the validation of models. *Physical Geography* 2(2), 184–194.
  DOI 10.1080/02723646.1981.10642213 — systematic/unsystematic RMSE decomposition
- Kobayashi, K. & Salam, M.U. (2000). Comparing simulated and measured values using mean
  squared deviation and its components. *Agronomy Journal* 92(2), 345–352.
  DOI 10.2134/agronj2000.922345x

## 3. Metrics we're missing (ranked by what a committee will ask for)

| Metric | Have it? | Why it matters here |
|---|---|---|
| Pearson r | ✅ | Keep — but **never report alone**; always with the 1:1 line |
| Bias / MBE | ✅ | This is what actually separates DustBoy from GEMS |
| RMSE | ✅ | Add **MAE** too (less outlier-sensitive during burning spikes) |
| RMSE decomposition | ❌ | The 25%/75% split above — high value, trivial to compute |
| **Lin's CCC** | ❌ | CCC = r × Cb: penalises exactly our failure mode. Likely ranks **GEMS above DustBoy**, inverting the r-based ranking |
| **Bland–Altman + LoA** | ❌ | The expected figure for any method-comparison chapter; shows whether bias grows with concentration |
| **Deming/orthogonal regression** | ❌ | BAM is *not* error-free, so OLS understates the slope. Pre-empts a likely committee objection |
| EPA target comparison | ❌ | External pass/fail bar instead of only DustBoy-vs-GEMS relative comparison |
| Taylor diagram | ❌ | One figure: r + σ-ratio + centred RMSE for all sources vs BAM |
| Season-stratified r | ❌ | Blocks the "shared seasonal cycle inflated r" critique |
| Effective sample size | ❌ | Needed if r came from hourly (autocorrelated) data |

- Lin, L.I-K. (1989). A concordance correlation coefficient to evaluate reproducibility.
  *Biometrics* 45(1), 255–268. DOI 10.2307/2532051
- Taylor, K.E. (2001). Summarizing multiple aspects of model performance in a single
  diagram. *JGR: Atmospheres* 106(D7), 7183–7192. DOI 10.1029/2000JD900719
- Willmott, Robeson & Matsuura (2012). A refined index of model performance.
  *Int. J. Climatology* 32(13), 2088–2094. DOI 10.1002/joc.2419
- Linnet, K. (1993). Evaluation of regression procedures for methods comparison studies.
  *Clinical Chemistry* 39(3), 424–432 — Deming vs OLS

## 4. The regulator bar (sobering)

✅ **VERIFIED against the primary sources, 2026-07-25** — the EPA numbers below are transcribed
from Table ES-2 of EPA/600/R-20/280 itself (the 79-page PDF, not a secondary summary), and the
EU numbers from the Directive text on EUR-Lex (CELEX:32008L0050, Annex I Section A).

**US EPA PM2.5 air-sensor targets — base (field) testing**, on **24-hour averages**
(§3.1: "the sensor and FRM/FEM data will be compared at 24-hour averages"):

| Attribute | Metric | Target |
|---|---|---|
| Precision | SD **or** CV | SD ≤ 5 µg/m³ **-OR-** CV ≤ 30% |
| Bias | Slope | 1.0 ± 0.35 |
| Bias | Intercept *b* | −5 ≤ *b* ≤ 5 µg/m³ |
| Linearity | R² | ≥ 0.70 |
| Error | RMSE **or** NRMSE | RMSE ≤ 7 µg/m³ **-OR-** NRMSE ≤ 30% |

Two corrections to how this was written before, both material:

1. **The precision and error targets are disjunctive**, not single values. The report is explicit:
   "A sensor will meet this target if either the RMSE or NRMSE meet this criterion." Quoting
   RMSE ≤ 7 alone overstates the bar.
2. **NRMSE normalises by the reference mean**, not by range:
   `NRMSE = RMSE / mean(valid 24-h FRM/FEM PM2.5 over the whole test period) × 100`.
   This matters here, because a high-concentration site can pass on NRMSE while failing RMSE.

> **DustBoy RMSE 37.7 µg/m³ fails the RMSE ≤ 7 target by >5×.** It could only pass on the NRMSE
> limb if the reference period mean exceeded **≈126 µg/m³** (37.7 / 0.30) — far above any plausible
> season-long mean for northern Thailand, even with burning-season daily peaks above that. So the
> failure holds, but state it as "fails both limbs of the EPA error target, the NRMSE limb by
> construction", not as "5× the target" alone. Bias +18.8 also exceeds the intercept window
> (−5 to 5) by ~4×. GEMS (27.3) is closer and also fails.
> Report as a bounded-use statement, not a pass.

**EU Directive 2008/50/EC, Annex I §A — PM10/PM2.5** (the Directive lists both together):

| Measurement type | Relative expanded uncertainty | Min. data capture | Min. time coverage |
|---|---|---|---|
| Fixed | 25% | 90% | — |
| Indicative | 50% | 90% | 14% |

- Duvall, R. et al. (2021). *Performance Testing Protocols, Metrics, and Target Values for
  Fine Particulate Matter Air Sensors*. EPA/600/R-20/280, US EPA ORD. Table ES-2 / Table 4-2.
- Directive 2008/50/EC, Annex I §A — EU Data Quality Objectives (verified on EUR-Lex)
- CEN/TS 17660-2:2024/2025 — Performance evaluation of air-quality sensor systems, PM
- ASTM D8406-22; South Coast AQMD **AQ-SPEC** field/lab protocols (R² ≥ 0.8 screening)

## 5. Time-series pitfalls that apply to us directly

- **Autocorrelation shrinks effective N** — if r=0.87 was computed on hourly data with
  day-to-day persistence, the CI on r is much wider than nominal N implies.
  `n_eff ≈ N(1−ρ)/(1+ρ)`. Bretherton et al. (1999), *J. Climate* 12(7), 1990–2009.
  DOI 10.1175/1520-0442(1999)012<1990:TENOSD>2.0.CO;2
- **Averaging window inflates r mechanically** — daily-averaged r > hourly r for the same
  data. Report r at hourly *and* daily, and never compare across windows.
- **Shared seasonality can manufacture r** — both series rise every burning season
  regardless of sensor quality. Yule (1926) *JRSS* 89(1), 1–63; Granger & Newbold (1974)
  *J. Econometrics* 2(2), 111–120, DOI 10.1016/0304-4076(74)90034-7.
  → report burning vs non-burning separately, or deseasonalise.
- **Check lag before trusting pointwise metrics** — GEMS is geostationary/hourly; satellite
  overpass vs ground reporting time must be aligned (CCF at lag 0).
- **Granger causality / transfer entropy** are for *causal* questions (fire → PM2.5), not
  for "is DustBoy accurate". Amornbunchornvej et al. (2021), *ACM TKDD* 15(4):62,
  DOI 10.1145/3441452.
- **DTW aligns, it doesn't score** — never report DTW in place of RMSE/bias.

## 6. Five mistakes to avoid with *our* exact numbers

1. Don't present r=0.87 as "DustBoy is the better source" — lead with CCC, or bias+RMSE.
2. Don't compare DustBoy's r and GEMS' r unless both used the same averaging window.
3. Don't call RMSE=37.7 "sensor error" — 75% of it is *not* the correctable bias.
4. Don't derive a calibration slope with OLS (BAM has error) — use Deming.
5. Don't pool the whole year — season-stratify or deseasonalise first.

## 7. Corpus candidates (new papers to add)

| Paper | Venue | Why |
|---|---|---|
| Bland & Altman (1986) | The Lancet | Foundation of the correlation≠agreement argument |
| Lin (1989) | Biometrics | CCC — the single metric that resolves our contradiction |
| Willmott (1981) | Physical Geography | RMSE decomposition + index of agreement |
| Duvall et al. (2021) | EPA/600/R-20/280 | The regulator target table to cite verbatim |
| **Bean (2021)** | *AMT* 14, 7369–7379, DOI 10.5194/amt-14-7369-2021 | R²/RMSE depend on averaging time & concentration range; proposes prediction intervals — justifies our multi-metric approach |
| Taylor (2001) | JGR Atmospheres | One-figure multi-source summary |
| Bretherton et al. (1999) | J. Climate | Effective sample size |
| Kobayashi & Salam (2000) | Agronomy Journal | MSD decomposition |
| CEN/TS 17660-2 | CEN | EU sensor classification |
| **GEMS AOD validation vs AERONET, mainland SE Asia** | *AAQR* 2025, DOI 10.1007/s44408-025-00030-0 | Validates GEMS AOD over Thailand (12 stations, 2021–24); lower R / higher RMSE near equator — context for our eta72 numbers |
| **Near-real-time biomass-burning PM2.5 emissions, N. Thailand (FINNv2.5)** | PMC12846012 (2026) | Thailand fire→PM2.5 lag work; burning-season taproot |
| **Seasonal field calibration of low-cost PM2.5 sensors in Thailand** | *Atmosphere* 14(3):496, DOI 10.3390/atmos14030496 | Thailand-specific calibration companion |

## 8. Honest flags (do not skip before citing)

- ✅ **RESOLVED 2026-07-25** — the EPA numeric targets are now taken from Table ES-2 of
  EPA/600/R-20/280 itself. The secondary summary was substantively right but **understated
  the bar in two ways**: precision is `SD ≤ 5 µg/m³ OR CV ≤ 30%`, and error is
  `RMSE ≤ 7 µg/m³ OR NRMSE ≤ 30%` — either limb passes. See §4.
- ✅ **RESOLVED 2026-07-25** — EU Annex I §A verified on EUR-Lex (CELEX:32008L0050):
  PM10/PM2.5 fixed **25%**, indicative **50%**, data capture **90%**, indicative time
  coverage **14%**. See §4.
- ⚠️ **CCC, Bland–Altman LoA and Deming slope cannot be computed from r/bias/RMSE alone** —
  they need each series' standard deviation or the raw paired data. Get the paired data
  from the parent oracle (`artifacts/comparison/multi_source_comparison_overall.csv`).

---

*Researched by a Sonnet subagent for Citation Oracle ✦ · findings are literature claims,
not yet primary-source verified where flagged.*
