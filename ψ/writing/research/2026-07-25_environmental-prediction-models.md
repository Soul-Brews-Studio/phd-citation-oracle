---
title: Environmental prediction models for PM2.5 (2021–2026)
date: 2026-07-25
source: /deep-research via Sonnet subagent, commissioned by Nat
oracle: citation (m5)
status: research findings — three DOIs explicitly unverified (see flags)
---

# Environmental prediction models for PM2.5 — and the prior art we must confront

> **The finding that matters most**: the thesis's core idea — a *confidence/trust score
> for low-cost sensors* — has **recent, direct prior art**. It must be cited and
> differentiated, not discovered late.

## ⚠️ Prior art on the confidence score (read this first)

**"Dynamic calibration of low-cost PM2.5 sensors using trust-based consensus mechanisms"**,
*npj Climate and Atmospheric Science* (2025). Builds a **per-sensor trust score from four
indicators — accuracy, stability, responsiveness, consensus alignment** — then applies
*deeper correction to low-trust sensors and minimal correction to high-trust ones*.
Reports MAE reduction **up to 68%** for poor sensors, 35–38% for already-reliable ones.

This is functionally the same shape as DustBoy's 5-factor A–F confidence grade. Position
the thesis explicitly: extend it to a **burning-season / regional regime**, or differentiate
on methodology. (Also already in our corpus as *Mahajan & Helbing 2025* — the corpus notes
call it "HIGHEST CONCEPTUAL ALIGNMENT". This research independently confirms that judgement.)

Also structurally close: **"Evaluating ML methods for PM2.5 estimation using satellite AOD,
low-cost and reference-grade monitors in Kampala"**, *Int. J. Environ. Sci. Technol.* (2025),
DOI 10.1007/s13762-025-06674-0 — the only found paper with our exact three-source structure
in a comparable Global-South setting.

## Model families — accuracy, data needs, failure modes

| Family | Reported performance | Failure mode / cost |
|---|---|---|
| **LSTM** baseline | R² 0.83–0.998, RMSE 1.9–14.4 (city/horizon dependent) | Degrades fast with horizon (R² 0.83@1h → 0.63@3h); needs long gap-free hourly series |
| **CNN-LSTM** hybrid | R²=0.91, RMSE=8.2 vs LSTM 0.83/14.4, CNN 0.85/11.4 | Best-of-both spatial+temporal, higher training cost |
| **Transformer** (AirFormer) | 5–8% error reduction over SOTA at 72 h, 1,085 stations | Needs large multi-station corpora; gain marginal at 1–6 h |
| **XGBoost / RF** | Mixed: XGB R²=0.81/RMSE 13.6; RF RMSE 7.7; hybrid RF-XGB −25–26% RMSE | Simple, strong baseline. One study found **AOD did not beat raw TOA reflectance** |
| **Spatial GNN** (PM2.5-GNN) | GNN+RNN with domain-informed edges | Needs a well-defined station graph — a real constraint for sparse/irregular low-cost nets |

- *Sustainability* 14(4):2068 (2022), DOI 10.3390/su14042068 — LSTM
- CNN-LSTM, *PeerJ* (2024), https://peerj.com/articles/17811/ *(DOI unverified)*
- AirFormer, Liang et al., *Proc. AAAI* 37(12):14329–14337 (2023), DOI 10.1609/aaai.v37i12.26676
- *Atmosphere* 16(12):1317 (2025), DOI 10.3390/atmos16121317 — hybrid RF-XGBoost
- PM2.5-GNN, Wang et al., *ACM SIGSPATIAL '20*, DOI 10.1145/3397536.3422208
- Group-Aware GNN, *ACM TKDD* (2023/24), DOI 10.1145/3631713
- AccuAir (KDD Cup 2018 winner), *ACM SIGKDD '19*, DOI 10.1145/3292500.3330787

## Burning-season / extreme episodes — why Feb–Apr is special (and citable)

- **CTMs and ML fail in opposite directions during smoke**: CTMs overestimate **3–5×**;
  ML tracks closer but **severely under-predicts the highest-pollution days**.
  *Environ. Sci. Technol.* (2024), DOI 10.1021/acs.est.4c05922
- **Foundation models regress toward typical scales above ~500 µg/m³**, suppressing exactly
  the peaks needed to trigger exceedance alarms. arXiv:2607.07951 (2026) — **preprint, not
  peer reviewed**.
- **Low-cost sensors are nonlinear at high concentration, worse in smoke/haze** —
  *Aerosol Science and Technology* (2024), DOI 10.1080/02786826.2024.2368733.
  **Load-bearing citation** for why a static/linear confidence score is insufficient during
  the burning season → argues for a **time-varying, season-aware** trust score.
- **Northern Thailand, direct geographic match**: Kawichai et al. (2025), *Toxics* 13(3):170,
  DOI 10.3390/toxics13030170 — 8 upper-northern provinces, **RF best (R²=0.93, RMSE=6.82)**,
  fire-hotspot counts a critical predictor, Feb–mid-Apr named as dominant driver.
  *(Already in our corpus.)*
- **Chiang Mai hotspot distance**: RF > XGBoost/CNN (R² 0.74–0.91); hotspot influence extends
  to **~700 km** — regional, not just local, attribution. *Eng. & Appl. Sci. Research* (Thai
  journal) *(DOI unverified)*.
- KDD Cup benchmark documents the same pattern generically: PM2.5 is easy when air is
  "good", errors balloon exactly when concentrations spike.

## Low-cost networks: model INPUT vs correction TARGET

Two structurally different framings — the thesis should state its choice unambiguously:

1. **As correction target** (dominant): reference monitor = truth, sensor = noisy signal to
   calibrate (matches our BAM-as-ground-truth setup). PurpleAir calibration papers report
   R 0.58→0.85, or R²=0.93 with RMSE −41–60%.
2. **As spatial input** (fewer, arguably more novel): dense low-cost data as an extra
   predictor layer alongside satellite/reanalysis — Bi et al. (2019), *Environ. Sci. Technol.*
   53(4), DOI 10.1021/acs.est.9b06046. **This framing makes DustBoy's 1,148-sensor density an
   asset rather than noise.**

Benchmarks: KDD Cup 2018 (Beijing 35 + London 24 stations, hourly 2017–18); older UCI Beijing
PM2.5 hourly set. OpenAQ is a live aggregation API, not a fixed ML benchmark.

## GEMS is not ground truth (directly relevant to our comparison)

**GEMS AOD validated against 12 AERONET stations in Thailand/Laos/Cambodia (2021–2024):
good overall correlation (R²≈0.75) but GEMS systematically UNDERESTIMATES AOD.**
*Aerosol and Air Quality Research* (2025), DOI 10.1007/s44408-025-00030-0.

→ Our multi-source comparison must treat GEMS as a comparator **with its own error bars**,
not an oracle. Pairs with the correlation research: GEMS eta72's bias of −3.4 µg/m³ is
consistent with a known regional underestimation.
Also: first GEMS aerosol results, *Atmos. Meas. Tech.* 17:4369 (2024).

## What this means for the thesis

- **Confront the prior art** (npj trust-based consensus) explicitly in related-work.
- **Burning-season nonlinearity is documented, not a hunch** → justify a season-aware
  confidence score.
- **GEMS has a known regional bias** → never frame it as truth.
- **RF is the regional workhorse** (two independent northern-Thailand studies) → a defensible
  baseline if a prediction component is needed.
- **Choose the framing**: DustBoy as correction-target (conventional) or as spatial input
  (novel, plays to the density advantage).

## Corpus candidates

| Paper | Venue | Why |
|---|---|---|
| Dynamic calibration … trust-based consensus | npj Clim. Atmos. Sci. 2025 | Closest prior art to our core contribution |
| ML for PM2.5 with AOD + low-cost + reference, Kampala | Int. J. Environ. Sci. Technol. 2025 | Same three-source structure, Global South |
| Kawichai et al., Long-term retrospective PM2.5, upper N. Thailand | Toxics 13(3):170, 2025 | Direct geographic match, RF benchmark R²=0.93 |
| GEMS AOD vs AERONET, mainland SE Asia | AAQR 2025 | GEMS's own bias in our region |
| Response of low-cost sensors to high PM2.5 in bushfire/haze | Aerosol Sci. Technol. 2024 | Nonlinearity at high concentration |
| Evaluating CTM and ML models for wildfire smoke PM2.5 | Environ. Sci. Technol. 2024 | Opposite-direction failure modes in smoke |
| Chiang Mai hotspot-count ensemble (0–1000 km) | Eng. & Appl. Sci. Research | Local grounding, ~700 km influence |
| AccuAir (KDD Cup 2018) | ACM SIGKDD 2019 | Canonical benchmark reference |
| Bi et al., Incorporating low-cost sensors into high-resolution modeling | Environ. Sci. Technol. 2019 | The "sensor as input" precedent |

## ⚠️ Verify before citing

- **npj trust-based consensus DOI** — inferred from the npj article-number convention, not
  fetched (auth-gated). Verify.
- **Kampala paper's exact R²/RMSE** — full text paywalled; DOI pattern confirmed only.
- **Chiang Mai hotspot paper DOI** — not captured.
- arXiv:2607.07951 is a **preprint** — cite as such or not at all.

---

*Researched by a Sonnet subagent for Citation Oracle ✦ · claims are literature-reported,
flagged where unverified.*
