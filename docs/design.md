# Early-vote playground

## Problem

The playground shows which Michigan counties are casting early ballots ahead of, or behind, the rest of the state, compared with those counties' final 2024 early vote. The 2026 file is the live cumulative snapshot. The 2024 file is the election-day snapshot. Treat those two shapes as the comparison. The cycle is close to Election Day, so this read does not adjust for days-out.

Michigan has no party registration. The county files carry a total, `voted_all`, plus age and gender. The read uses `voted_all` only. The 2024 presidential margin sits beside each county so a high index in a Republican county is visible as such. It is not a vote forecast.

## Usage

```bash
node --experimental-strip-types src/main.ts MI
node --experimental-strip-types src/main.ts TX
```

Each command prints a ranked table, then the same read as JSON. Texas prints two reads. 2026 against the 2024 final early vote comes first. 2026 against the 2022 final early vote comes second. Rank 1 is the county furthest ahead of the statewide ratio.

`compareEarly` fetches and joins. `rankCounties` is the pure comparison the table prints.

```ts
import { compareEarly } from "../src/compare.ts"

const [read] = await compareEarly("MI")
const top = read.counties[0]
```

`top.index` is above 1 when that county's 2026 early vote is a larger share of its baseline early vote than the state's is. `top.margin` is the 2024 two-party presidential margin. Positive means Republican.

## Shape

**Stack.** TypeScript on Node 22, run with type stripping. The only dependency is `csv-parse`. No UI, database, cache, or job runner.

**Files.** `src/compare.ts` fetches, parses, and ranks. `src/main.ts` prints the table and the JSON. A test calls `compareEarly` only through the pure rank function's result shape, using fixture rows rather than the network.

**Comparison.** One index. These two descriptions are the same number.

```
ratio_c = early2026_c / baseline_c
statewideRatio = sum(early2026) / sum(baseline)
index_c = ratio_c / statewideRatio
```

`index_c` also equals the county's share of 2026 statewide early vote divided by its share of 2024 statewide early vote. The table shows `ratio` and `index`. It does not print the share form a second time.

Counties sort by `index` descending, then by name. A county with no 2024 early vote fails the read.

**Margin.** From the MIT county presidential file for 2024. `margin = (rep - dem) / (rep + dem)`. Reported figures are that share times 100, in percentage points. Positive is Republican.

The statewide numbers hold each county's margin fixed and change only the weights. The baseline electorate weights counties by their share of baseline early vote. The implied 2026 electorate weights the same margins by their share of 2026 early vote. The shift is the implied margin minus the baseline margin. A negative shift is a move toward Democrats. This is a composition effect. It says which counties are turning out. It does not say that a county changed its partisanship.

```
baselineMargin = 100 * sum(margin_c * baselineShare_c)
impliedMargin = 100 * sum(margin_c * share2026_c)
shift = impliedMargin - baselineMargin
shareChange_c = 100 * (share2026_c - baselineShare_c)
contribution_c = margin_c * shareChange_c
```

The county contributions sum to the statewide shift.

**Sources.** County files are `county_data_{ST}.csv` for 2024 and `{ST}_county.csv` for 2026, under `https://election.lab.ufl.edu/data-downloads/earlyvote/`. The 2026 statewide `US.csv` supplies `last_update` and the `voted_all` checksum. County sums must match that statewide total. The presidential file is `https://api.electiondata.dev/v1/county-president/table/2024.csv`. Join on the county name after trimming, uppercasing, and removing one trailing ` COUNTY`. `ru_id` is not FIPS. Wayne is 23082 in the UF file and 26163 in the MIT file. The join does not use `ru_id`.

One unmatched name fails the read. The UF license is CC BY-NC-ND 4.0. The program does not commit those CSVs.

**Texas.** UF has a 2026 county file and no 2024 county file. The 2024 and 2022 baselines are the Texas Secretary of State cumulative reports committed in `data/tx/`. The early total there is `Cumulative In-Person And Mail Voters`. The TOTAL row is the checksum, not a county. County names drop spaces before the join, so MIT `LA SALLE` matches `LASALLE`. 2022 HALE stays in the ranking and carries a flag because the source in-person total is 369.

**Left out.** Same-day status, days-out, pair files, a content-addressed archive, residual anchors, age, gender, mode, and party registration. A state with both UF county files uses the Michigan path. Texas is the one state with local baselines.

## Open questions

None for this read. A governor or Senate county file would replace the presidential margin column. This version does not fetch one.
