---
title: "Which satellite product can serve as the comparator — the AOD report, harvested"
date: 2026-07-25
source: ψ/writing/research/2026-07-25_se-asia-satellite-aod-validation.md
kind: harvest
status: decision-support
tags: [harvest, satellite-pm25-products, multi-source-fusion-qa, methodology]
---

# Which satellite product can serve as the comparator

Harvest of [the SE Asia AOD validation report](2026-07-25_se-asia-satellite-aod-validation.md).
The report answers a literature question; this file turns it into a decision, a verification
queue, and a list of what is genuinely absent from the literature.

**Read the source report's `## Review` section first.** One of its citations was fabricated and
one of its "already catalogued" markers pointed at the wrong paper. Numbers below are reproduced
from it *as claims*, with their measurement conditions attached — not as established facts.

---

## 1. The decision this serves

> **Which satellite product should be the comparator when assessing the confidence of a dense
> low-cost PM2.5 sensor network in northern Thailand, at hourly resolution, during the
> burning season?**

This matters because the proposal promised multi-source comparison (GEMS, WRF-CHEM, BAM) and the
methodology needs a defensible answer for the source it actually leans on. Principle 2 —
cite what the methodology uses, not what the proposal promised.

**What the report supports:** Himawari-8/9 is the defensible comparator, in one of two forms —
MAIAC AOD (1 km, 10-minute) or an ML model on raw TOA reflectance. GEMS keeps the hourly
cadence the thesis needs but carries a reported slope of 0.56 against AERONET, so it cannot be
used off the shelf during exactly the episodes that matter most.

**What would flip this decision** — state these in the methodology as the conditions of the choice:

| If this turns out to be true | Then |
|---|---|
| Himawari MAIAC 1 km is not actually available for the thesis period/domain | fall back to GEMS **with** a documented non-linear bias correction, or to MODIS/MAIAC and drop the hourly claim |
| The thesis only needs daily agreement, not hourly | MODIS/MAIAC (1 km) becomes the better choice outright — the geostationary advantage disappears |
| Training data for a TOA-reflectance ML model can't be assembled for the domain | the TOA route is out; it is only as good as its local training set |
| GEMS is a required comparator for external reasons (the proposal, a committee expectation) | keep it, but report it as bias-corrected and bounded, never as a validated agreement |

---

## 2. Candidate comparison — every number with its conditions attached

A bare R² is not comparable across these rows. Wavelength, temporal-matching window, station
count and AOD regime all move it, and the source report says so explicitly. Conditions are
therefore kept in the same cell as the number.

| Product | Spatial / temporal | Reported best R² — **and under what conditions** | Reported bias | Under heavy smoke | Verdict for *hourly* comparison |
|---|---|---|---|---|---|
| **Himawari-8 AHI, TOA reflectance + ML** | 5 km / 10 min | PM2.5 R² = 0.91 — Chimla et al. 2025, northern Thailand, ensemble ML **with meteorological covariates**; this is a PM2.5 model score, *not* an AOD validation | depends entirely on local training data | **best** — bypasses L2 cloud-flagging that deletes smoke pixels | **strongest**, with the caveat that R²=0.91 is not an apples-to-apples number against the AOD rows |
| **Himawari-8 AHI (MAIAC AOD)** | 1 km GeoNEX / 5 km std / 10 min | 0.77 — She et al. 2019, MAIAC retrieval at 470 nm interpolated to 550 nm | +0.02 (vs −0.05 for standard JMA) | moderate–good; time-series BRDF mitigates smoke/cloud misclassification | **strong** — cadence matches sensor sampling |
| **GEMS L2 AOD** | 3.5 × 8 km at Seoul / hourly | 0.75 — Jang et al. 2025, mainland SE Asia, AERONET 500 nm → 550 nm by power law, **± 20 min** matching | **slope 0.56**; over-estimates when AERONET AOD < 0.5, severely under-estimates above 1.0 | poor — UV-Vis optimal estimation struggles with absorbing carbonaceous aerosol | **moderate** — right cadence, wrong magnitude in burning season |
| **MODIS / MAIAC** | 1 km / 1–2 per day | 0.83–0.84 — Nakapan et al. 2022 | minor negative bias over bright transitioning agricultural surfaces | good; preserves plumes better than Dark Target / Deep Blue | **low** for hourly; best available for *spatial* pattern |
| **VIIRS (NOAA-20/NPP)** | 750 m / 1–2 per day | 0.907 — Meng et al. 2015, **broader Asia, not SE Asia, and 11 years old** | variable; sensitive to albedo shifts | poor — thick smoke routinely flagged as cloud | **low** — sampling too sparse for diurnal work |
| **MISR (Terra)** | 4.4 km / multi-day | n/a for this domain | within error envelope when data exists | **fails** — capped at AOD 3.0, screens out extreme events | **disqualified** for burning-season use |

**The three disagreements, resolved for this thesis:**

1. **Geostationary vs polar-orbiting.** Polar orbiters (Terra 10:30, Aqua/NOAA-20 13:30) miss the
   late-afternoon burning peak entirely. For an *hourly* confidence assessment the temporal match
   is not optional, so geostationary wins — at the cost of 3.5–5 km pixels averaging over a
   burning field and clean hillside in the Chiang Mai basin.
2. **GEMS bias direction.** Early work (Kim 2020, Cho 2024) projected "slight" underestimation;
   Jang et al. 2025 reports structural underestimation with slope 0.56 **and a sign reversal
   below AOD 0.5**. Cite Jang for the operational number and note the disagreement — a
   sign-reversing bias is a methodological hazard, not a footnote.
3. **AOD vs TOA reflectance.** Bai et al. (Crossref dates it **2021**, the report said 2020)
   found TOA reflectance beat processed AOD (R² 0.75 vs 0.65) with Random Forest; Chimla et al.
   2025 replicated the pattern over northern Thailand. The mechanism is the point: conservative
   L2 retrievals flag dense-smoke pixels as cloud and delete them, so the AOD product is missing
   data precisely when PM2.5 is highest. **This is the single most useful finding in the report
   for our methodology** — it says the processed product fails in a *structured*, explainable way.

---

## 3. Verification queue

Ranked by how much a wrong answer would cost. Nothing here should reach the thesis unverified.

| # | Claim to verify | Why it matters | How |
|---|---|---|---|
| 1 | **Jang et al. 2025 slope = 0.56 and the AOD 0.5 sign reversal** | the whole "GEMS needs correction" argument rests on it | primary text, `10.1007/s44408-025-00030-0` (DOI confirmed) |
| 2 | **Chimla et al. 2025 R² = 0.91** — and whether it is PM2.5 prediction, not AOD validation | quoted beside AOD R² values it is not comparable to | primary text, `10.3390/atmos16111304` (DOI confirmed) |
| 3 | **She et al. 2019 R² = 0.77 / bias +0.02** applies to *this* domain | the report attributed this paper to the wrong author entirely | primary text, `10.3390/rs11232771` (DOI confirmed) |
| 4 | **Himawari MAIAC 1 km actually covers the thesis period and domain** | the recommendation collapses if the data isn't there | GeoNEX / JAXA archive query — a data-availability check, not a literature one |
| 5 | **Bai et al. R² 0.75 vs 0.65** | the TOA-over-AOD argument | primary text, `10.4209/aaqr.2020.05.0257` (Crossref year = 2021) |
| 6 | **Nakapan et al. 2022 R² 0.83–0.84** and its matching window | our closest domain analogue | primary text, `10.2306/scienceasia1513-1874.2022.001` |
| 7 | **MISR AOD 3.0 cap** | a strong claim, cited to a comparison paper rather than MISR documentation | JPL MISR v23 product spec |
| 8 | **Fengyun-4A metrics (Aman et al. 2024)** | report states these could not be verified at all | primary text; treat as unknown until then |

**Wavelength harmonisation is a methodology requirement, not a detail.** GEMS operates at 443 nm,
AERONET at 440/500/675 nm, MAIAC retrieves at 470 nm and interpolates to 550 nm. Any comparison
must state its conversion. Likewise the matching window: Jang used ± 20 min, O et al. ± 15 min,
and the report notes that reported-R² differences across papers are often artefacts of that
choice rather than real algorithmic difference.

---

## 4. Gaps, classified

The report claims three absences. An absence is only interesting once you know *why* it's absent,
so each is classified rather than repeated.

| Gap | Classification | Reasoning |
|---|---|---|
| **No peer-reviewed TROPOMI visible-spectrum AOD validation vs AERONET over Thailand / Laos / Vietnam, 2021–2026** | **plausible real absence** — needs one confirming search before being claimed | TROPOMI's UV Aerosol Index and Aerosol Layer Height *are* validated; a standard visible AOD product is a different thing. Consistent with S5P's aerosol products not centring on visible AOD. **If it survives verification this is a genuine contribution opportunity**, and the cheapest one available to this thesis. |
| **No 2021–2026 study quantifying VIIRS AOD error strictly during the Indochina burning season** | **likely real absence, low value** | VIIRS's 1–2 daily overpasses make it a poor fit for the question, so the absence is unsurprising and filling it would not help this thesis. |
| **No recent MISR v23 evaluation under multi-day smoke inversion** | **real absence, explained by the instrument** | MISR is multi-day and capped at AOD 3.0, so it is structurally unable to observe the events. The absence is a consequence, not an oversight. |
| **Fengyun-4A heavy-smoke performance** | **search failure, not absence** | The report says it "could not be verified from the available literature corpus" — that is a statement about its own search, not about the literature. Re-search before concluding anything. |

⚠️ **Do not write "no published validation exists" into the thesis on the strength of one report.**
A single agentic search failing to find something is weak evidence of absence. Gap 1 needs a
deliberate negative search — Scopus/WoS on TROPOMI + AOD + AERONET + each country, plus a check of
the S5P product documentation — before it can be claimed as a contribution.

---

## 5. What this changes

- **Methodology:** name Himawari-8/9 as the comparator, with the conditions in §1 stated as
  conditions. Do not present GEMS agreement without its slope.
- **Related work:** the AOD-vs-TOA mechanism (§2.3) belongs in the chapter — it explains *why* a
  processed product fails during the episodes of interest, which is exactly the kind of
  structured failure a confidence-scoring thesis should engage with.
- **Cards to enrich after verification:** `jang2025`, `chimla2025`, `she2019`, `bai2021`,
  `nakapan2022`, `o2025`, `aman2024` — add the measurement conditions (wavelength, window,
  stations, period) to each card's `## Notes`, since the conditions are what make the numbers
  usable.
- **Still blocked:** Lin's CCC, Bland–Altman limits of agreement and a Deming slope need the
  parent oracle's `artifacts/comparison/multi_source_comparison_overall.csv`. They cannot be
  computed from r / bias / RMSE alone.

---

*Citation Oracle ✦ — harvested by an AI (Rule 6). Every number here is a claim from the source
report until item 1–8 above says otherwise.*
