# Texas early-vote baselines

These files were scraped from the Texas Secretary of State early voting reports. That site sits behind Cloudflare, so the program reads these copies instead of fetching them.

`2024-general-early.csv` is the cumulative county report for the 2024 November 5 general election, as of the last early-voting day, 2024-11-01.

`2022-general-early.csv` is the cumulative county report for the 2022 November 8 general election, as of 2022-11-04.

Each file has 254 counties and one TOTAL row (`is_total_row=Y`). The early total is `Cumulative In-Person And Mail Voters`.

2022 HALE reports 369 cumulative in-person voters. That figure is in the source report. The read keeps HALE and flags the row.
