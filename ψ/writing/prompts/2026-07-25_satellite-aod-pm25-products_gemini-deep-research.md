---
title: Satellite aerosol/AOD products for PM2.5 over mainland SE Asia — Gemini Deep Research brief
date: 2026-07-25
tool: Google Gemini Deep Research
skill: gemini-deep-research
topic: PM2.5 and aerosol AOD satellites
scoping:
  purpose: Compare satellite products
  geography: Northern Thailand + mainland SE Asia
  deliverable: Annotated bibliography
  recency: 2021–2026 + foundational
dedupe: 16 satellite/fusion papers already in artifacts/literature_corpus.jsonl are named in the brief as already-known
---

# The brief

Paste into Gemini → Deep Research. **Read and edit the generated plan before approving it** —
that is the one cheap place to catch a wrong turn.

```
# Research objective
Determine which satellite aerosol product (or combination) is the most defensible comparator
for evaluating a dense ground network of low-cost PM2.5 sensors over northern Thailand, and
produce an annotated bibliography that documents each candidate's validated performance in
that region.

# Context to assume
- Audience: a PhD researcher working on low-cost PM2.5 sensor confidence assessment in
  northern Thailand. Assume fluency in AOD retrieval, PM2.5 estimation, and validation
  statistics. No introduction to remote sensing.
- Already known — do NOT spend research effort re-finding or summarising these, they are
  already catalogued. Cite them only where needed for comparison:
  Kim et al. (2020) GEMS mission, BAMS · Cho et al. (2024) first GEMS aerosol results, AMT ·
  Jang et al. (2025) GEMS AOD validation over mainland SE Asia, AAQR · O et al. (2025) GEMS
  AOD to hourly PM2.5 via ML, AMT · van Donkelaar et al. (2021) WashU/ACAG SatPM2.5, ES&T ·
  Wei et al. (2023) GlobalHighPM2.5/GHAP, Nature Communications · Bai et al. (2022, 2024)
  LGHAP v1 and v2, ESSD · Li et al. (2022) CAMS and MERRA-2 validation, Atmos. Environ. ·
  Aman et al. (2024) Fengyun-4A geostationary PM2.5 over Bangkok, AQAH · Tian et al. (2023)
  review of satellite PM2.5 challenges, Environmental Reviews · Shao et al. (2024) PM2.5
  dataset for the Mekong River Basin, STOTEN · Bainomugisha et al. (2025) low-cost plus
  satellite in Kampala, IJEST · plus two npj Climate and Atmospheric Science papers on
  synergistic ground+geostationary estimation (2023) and low-cost sensor network trends (2025).
- What I want that I do not already have: the same depth of evidence for the products I have
  NOT catalogued — MODIS/MAIAC, VIIRS (NOAA-20/21), Sentinel-5P TROPOMI, Himawari-8/9 AHI,
  Terra/Aqua MISR — specifically as validated over mainland Southeast Asia, so I can compare
  them on equal terms against GEMS.
- Working hypothesis, which I want tested and disconfirmed if the evidence points that way:
  for hourly PM2.5 comparison during northern Thailand's Feb–April biomass-burning season, a
  geostationary product (GEMS or Himawari AHI) is preferable to polar-orbiting MODIS/VIIRS
  because of diurnal sampling, despite GEMS's documented underestimation.

# Scope
- In scope, as candidate products: GEMS (GK-2B), MODIS (including MAIAC/MCD19A2), VIIRS
  (NOAA-20/21 Deep Blue and AERDB), Sentinel-5P TROPOMI aerosol products, Himawari-8/9 AHI,
  MISR, Fengyun-4A, and the gap-filled/derived PM2.5 datasets built on them (ACAG/WashU,
  GHAP, LGHAP, CAMS and MERRA-2 reanalysis where used as a PM2.5 comparator).
- In scope, as evidence: validation against AERONET or ground PM2.5 monitors located in
  Thailand, Laos, Cambodia, Myanmar, Vietnam, or peninsular Malaysia; retrieval performance
  under biomass-burning aerosol; cloud and smoke screening behaviour; diurnal sampling.
- Out of scope: validation studies confined to China, Korea or Japan, EXCEPT where the paper
  establishes a method or a product-level bias that demonstrably transfers to Southeast Asia
  — say explicitly why it transfers when you include one. Also out of scope: health-effect
  epidemiology, PM2.5 forecasting, chemical transport model intercomparison (WRF-Chem,
  CMAQ), trace-gas products (NO2, SO2, HCHO), and anything about sensor hardware.
- Time window: 2021–2026 for validation and product evaluation, plus foundational papers
  older than that where they remain the standard reference for a retrieval algorithm.
- Languages: English primarily; include Thai-language sources if they contain validation data
  not published in English, and note the language.

# Source quality
- Prefer: peer-reviewed journals; official algorithm theoretical basis documents (ATBDs) and
  product user guides from NASA, NOAA, ESA/Copernicus, JAXA and NIER/KARI; AERONET
  documentation for reference-data conventions.
- Acceptable if explicitly labelled as such: preprints, conference papers, theses, agency
  technical memoranda.
- Avoid: SEO summaries of remote-sensing products, undated pages, vendor or marketing copy,
  AI-generated overviews, and any validation figure quoted without stating the reference data,
  the matching window, and the wavelength.
- Cite every entry with authors, year, full title, venue, and a DOI or direct URL. Never
  invent a DOI or a citation. If you cannot find a DOI, give the publisher URL and say the
  DOI could not be confirmed.

# Specific things to verify
- The claim that GEMS AOD systematically UNDERESTIMATES over mainland Southeast Asia, with
  R² around 0.75 against roughly 12 AERONET stations for 2021–2024. Confirm the direction of
  the bias, the actual R², the number of stations, and the exact period, from the primary
  paper rather than a secondary mention.
- The claim that for at least one PM2.5 estimation model, using satellite AOD did NOT improve
  performance compared with using top-of-atmosphere reflectance directly. Identify who
  reported this, the model, the region, and whether it has been replicated.
- Whether an operational Himawari-8/9 AHI AOD product with published validation over mainland
  Southeast Asia exists, and if so its temporal resolution and its documented performance
  under heavy smoke.
- For each product: whether its AOD is reported at 550 nm or another wavelength, since
  comparing across wavelengths without conversion is a common error.

# What to produce
An annotated bibliography, organised BY PRODUCT, then a comparison table synthesised from it.

1. Direct answer to the objective (max 200 words): which product, and under what conditions
   the answer changes.

2. Annotated bibliography grouped by product (GEMS, MODIS/MAIAC, VIIRS, TROPOMI, Himawari
   AHI, MISR, Fengyun, derived PM2.5 datasets). For EVERY entry use exactly these fields:
   - Citation: authors, year, title, venue, DOI or URL
   - Product and algorithm version
   - Study region and period
   - Reference data used (AERONET level, or which ground monitors)
   - Reported metrics, quoted exactly with units: R² or r, RMSE, bias/MBE, and the
     AOD wavelength and temporal matching window they were computed under
   - Spatial resolution and revisit/temporal resolution
   - Documented limitation, especially under biomass-burning aerosol or cloud
   - One line: why it matters for a northern-Thailand low-cost-sensor comparison
   Mark clearly which entries are already in my catalogued list above.

3. Comparison table — columns: product · spatial resolution · temporal resolution/revisit ·
   best validated R² over mainland SE Asia (with source) · reported bias direction and
   magnitude · performance under heavy smoke · data latency and access · suitability as an
   hourly comparator for a ground network.

4. Where the sources disagree — particularly on GEMS bias direction or magnitude, and on
   whether geostationary sampling actually beats polar-orbiting for this use case.

5. What could not be verified, and what would be needed to verify it.

6. Gaps: which of these products has NO published validation over mainland Southeast Asia at
   all. That absence is itself a finding worth stating plainly.

7. Full reference list.

# Rules
- Distinguish what a paper demonstrates from what it asserts or projects.
- Never present metrics computed under different wavelengths, matching windows, or averaging
  periods as directly comparable. If a source omits those conditions, include the number but
  mark it as not comparable and say why.
- Quote every figure with its units and measurement conditions rather than paraphrasing.
- Where sources conflict, present both positions and say which is better supported, and why.
- Flag every claim you could not confirm from a primary or authoritative source.
- If the evidence does not support a clean product recommendation, say so plainly rather than
  smoothing it into one.
- Do not add general background on remote sensing, PM2.5 health effects, or the AOD concept.
```

## How to run it

1. Open Gemini and select **Deep Research**.
2. Paste the brief above.
3. **Read the generated plan and edit it** before approving — check that no step has wandered
   into China-only validation or into forecasting, and that the four verification targets each
   appear as their own step.
