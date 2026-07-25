# Bibliography audit — what the corpus claimed vs what Crossref says

Every card in `ψ/papers/` diffed against its state at commit `051014b` (before any DOI
verification), with each changed field classified. This file exists because a bibliography's
credibility rests on its provenance: every correction below is checkable against the DOI on the card.

| | count |
|---|---|
| cards in corpus | 62 |
| cards with a Crossref-verified DOI | 61 |
| **cards carrying at least one error** | **14** |
| **individual errors corrected** | **18** |
| benign completions (restored subtitle, filled page range) | 8 |
| volume fields reformatted (`11(23)` → volume + issue) | 2 |

> Commit `c01b2f5` summarised this as "11 citation errors". That undercounted — the verified
> figure is **18 errors across 14 cards**. This table is the authority,
> and it is regenerated from git rather than typed by hand.

## Errors corrected

| card | field | the corpus claimed | Crossref says | old citekey |
|---|---|---|---|---|
| `buya2023` | author | Amnuaylojaroen, T. | Buya, S. | `amnuaylojaroen2023` |
| `buya2025` | author | Taneepanichskuld, N., et al. | Buya, S. | `taneepanichskuld2025` |
| `buya2025` | volume | 41 | 36 | `taneepanichskuld2025` |
| `chen2024` | author | Shao, Y. | Chen, D. | `shao2024` |
| `chen2024` | pages | 169348 | 169801 | `shao2024` |
| `chen2024` | volume | 912 | 914 | `shao2024` |
| `jin2022` | author | Li, R. | Jin, C. | `li2022` |
| `koziel2025` | pages | 2069 | 18573 | `scientificreports2025` |
| `nakapan2022` | pages | 1-8 | 75 | — |
| `ravindra2024` | pages | 833 | 326 | `npjclimate2024` |
| `she2019` | title | Validation of GeoNEX Himawari-8 MAIAC Aerosol Optical Depth | Evaluation of the Multi-Angle Implementation of Atmospheric Correcti… | — |
| `supasri2023` | author | Jarernwong, K., et al. | Supasri, T. | `jarernwong2023b` |
| `supasri2023` | pages | 12328 | 12753 | `jarernwong2023b` |
| `thongsame2024` | journal | Atmospheric Pollution Research | Atmospheric Environment: X | `atmosphericpollution2024` |
| `villarrealmarines2024` | pages | 837 | 293 | `npjclimate2024b` |
| `wongnakae2023` | author | Amnuaylojaroen, T., et al. | Wongnakae, P. | `amnuaylojaroen2023b` |
| `yu2023` | pages | 363 | 41 | `npjclimate2023` |
| `zhu2023` | author | Tian, X., et al. | Zhu, S. | `tian2023` |

## Benign changes (not errors)

| card | field | before | after |
|---|---|---|---|
| `bai2022` | title | LGHAP: The long-term gap-free high-resolution air pollutan… | LGHAP: the Long-term Gap-free High-resolution Air Pollutan… |
| `bai2024` | title | LGHAP v2: A global gap-free aerosol optical depth and PM2.… | LGHAP v2: a global gap-free aerosol optical depth and PM 2… |
| `barkjohn2021` | title | Development and application of a United States-wide correc… | Development and application of a United States-wide correc… |
| `chimla2025` | volume | 16(11) | 16 |
| `o2025` | title | Estimating hourly ground-level aerosols using Geostationar… | Estimating hourly ground-level aerosols using Geostationar… |
| `patel2024` | title | Towards a hygroscopic growth calibration for low-cost PM2.… | Towards a hygroscopic growth calibration for low-cost PM 2… |
| `pendergrass2025` | title | A continuous 2011-2022 record of fine particulate matter (… | A continuous 2011–2022 record of fine particulate matter (… |
| `porcheddu2025` | title | Machine learning data fusion for high spatio-temporal reso… | Machine learning data fusion for high spatio-temporal reso… |
| `porcheddu2025` | pages | 4771 | 4771-4789 |
| `she2019` | volume | 11(23) | 11 |

---

The durable check is `citation doi --all` (a dry run): it re-queries Crossref and reports any card
that no longer agrees with it. Run it before trusting the `.bib` in a submission.

*Citation Oracle ✦ — written by an AI (Rule 6: an Oracle never pretends to be human).*
