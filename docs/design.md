# Early-vote playground

## Problem

The playground reads county early-vote totals for the current cycle, sets them next to the prior cycle's county early vote, and sets both next to historical county results. The first state is Michigan. The 2026 ballot there is an open governor race and a Senate seat. Another state is a pack record and a parser. The model functions stay as they are.

The repo is empty, so the constraints come from the files, not from existing types. They were fetched on 31 October 2026.

UF Election Lab pages are HTML. The numbers come from CSV. The statewide file is one row per state and one snapshot, at `/data-downloads/earlyvote/{year}/US.csv`. The county path changed between cycles. 2024 is `/data-downloads/earlyvote/2024/county_data_{ST}.csv`. 2026 is `/data-downloads/earlyvote/2026/{ST}_county.csv`. Dated paths, a `daily/` prefix, and `earlyvote/2022/` returned 404. UF keeps no daily county archive. The 2024 Michigan county file is the election-day snapshot. Its `last_update` is 11/5/2024. The live 2026 file is whatever UF last wrote. The copy fetched for this design has `last_update` 10/30/2026.

Michigan does not have party registration. The 2026 county file has no party columns and no race columns. Statewide party cells are 0, which means "not reported." The page's own script drops the party chart when those cells are falsy. Age and gender are real counts. The chart code labels the four age columns as 18-25, 26-40, 41-65, and over 65. The 2024 county file has no in-person columns. `voted_all` equals mail returned, and the page says Michigan did not distinguish mail from in-person, so mail in that file is all early vote. The 2026 statewide note says the state still does not identify mode, and that the in-person column is estimated from mail-application data. On the measured 30 October 2026 snapshot, county `voted_all` sums to 1,858,731, and `accept_all` plus `inperson_all` equals `voted_all`. Those 1,858,731 ballots sit against UF `turn_2022` of 4,500,400. That figure matches the 2022 statewide turnout total. It counts all ballots cast in 2022, early and Election Day together.

`ru_id` is not FIPS. Wayne is `ctynum` 82 and `ru_id` 23082 in the UF file, and FIPS 26163 in the MIT county file. The presidential county history that joins cleanly is MIT Election Data and Science Lab, county returns for 2000 through 2024, CC0, via `https://api.electiondata.dev/v1/county-president/table/2024.csv`. That catalog has statewide Senate results and House district results. It does not have county governor or county Senate. Michigan names match between UF and MEDSL for the counties checked. Both sides use `ALCONA`, with no `COUNTY` suffix. Wisconsin's UF file writes `ADAMS COUNTY`. Georgia's 2026 file has a 160th row, `county=NA`.

The UF license on the national early-vote page is CC BY-NC-ND 4.0. The program does not commit those CSVs.

The files can answer what share of the 2024 final early vote is already in. A same-day comparison with 2024 would need a county snapshot from the same number of days before that election, and UF does not publish one. An in-progress age mix is older than a final electorate, so age against the 2024 final file measures how early the calendar is. The Michigan Department of State said the 2024 early and mail patterns were not correlated with partisan support ([the 3 July 2025 release](https://www.michigan.gov/sos/resources/news/2025/07/03/mdos-releases-2024-election-data-showing-record-turnout-in-states-election-after-proposal-2022-2)). The usable signal is differential pace. It is the counties that are ahead of the statewide completion rate, weighted by historical margin. The ballots not yet cast are most of the electorate. The read has to show that mass, and it has nowhere to put a Michigan point margin.

## Usage (caller's view)

You run one command. It prints one JSON object.

```bash
node src/main.ts MI .cache/ev
```

There is no default state and no default cache directory. There is no flag for a model, a cycle, a denominator, or an office. Governor and Senate do not change the arithmetic until a county file for that office exists. The read names both offices and labels the margin source as a proxy.

In a program you call `readRace`.

```ts
import { readRace } from "../src/read"

const result = await readRace({
  state: "MI",
  cacheDir: ".cache/ev",
})

if (result.kind === "error") {
  process.stderr.write(result.error.kind + "\n")
} else {
  const extra = result.read.pace.marginWeightedExtraEarly
  const uncast = result.read.residuals.ufTurn2022
  const sameDay = result.read.sameDay.kind
  const role = result.read.contest.role
  void extra
  void uncast
  void sameDay
  void role
}
```

`extra` is a branded ballot-scale number. It is not a vote count. `uncast` is the residual against 2022 turnout, and `residuals.medslPresident2024` is the other scale, on every read. `sameDay` is `unavailable` until this cache holds a baseline snapshot at the same days-out. `role` is `proxy_for_ballot_offices`.

The types in [sketch.ts](sketch.ts) are this usage, written out. The implementation copies them into `src/read.ts` and `src/main.ts`. It does not grow a second entry point.

## Shape

**Stack.** Strict TypeScript on Node 22 or newer. `node src/main.ts` runs the CLI. String unions only, so the files stay erasable and there is no compile step. The only dependency is `csv-parse`. A hand-rolled splitter would break on the quoted statewide `notes` field, which contains commas. The program has no web UI, no notebook, no database, and no job runner. Python was the other serious option, and it lost because the next edit could sum `voted_dem` for Michigan and get 0. In this design that edit does not typecheck.

**Files.** `src/read.ts` owns the pack, the URLs, `pull`, the parsers, `differentialPace`, `residualOf`, and `readRace`. `src/main.ts` parses two arguments and writes the JSON. The only exported function is `readRace`. Helpers stay unexported, so `main` cannot import a parser and skip the join. Two files are the whole trace.

**Request.** `state` and `cacheDir`. `EarlyCycle` is 2024 or 2026. `countyUrl` has no date argument. A same-day 2024 path is not something the request can name. `ELECTION_DAY` is the only list of election dates. 2024-11-05 and 2026-11-03.

**Domain.** `CountyId` is minted only from a MEDSL `county_fips` cell. The UF parsers return a raw name and `totalEarly`. They have no `ru_id` field. `EarlyBallots`, `ContestBallots`, `UncastBallots`, `PaceRatio`, `MarginShare`, and `MarginWeightedEarly` are distinct brands, each with one minter. No function takes `MarginWeightedEarly` and returns ballots. Per type-system-discipline, a Michigan county value has no party counts. If a Michigan file grows `*_dem` headers, the parser returns `party_columns_present` instead of treating 0 as a count. A later state that reports registration returns `ReportedCounty`. `registration` can sum those counts into a `PartyView` of kind `registration_not_votes`. `differentialPace` does not take that view. Per model-the-domain, the pack is the state list. Michigan's `nameRule` is `uppercase_trim`. `strip_county_suffix` is there for a file that writes `ADAMS COUNTY`. `drop_literal_na` is there for Georgia's extra row. One name that does not join fails the state. A partial Michigan index is not a successful read.

**Cache.** `pull` is the only writer under `cacheDir`. The blob path is `{cacheDir}/blobs/{sha256}`. The body is stored with a temp file and a rename before the parser runs, so a parser fix can re-read bytes UF has already overwritten. The seen path is `{cacheDir}/seen/{sha256 of the url}/{hash}`, created with `wx`. The body records `firstSeen` and the URL. `firstSeen` stays out of `RaceRead`, so a repeat of the same bytes is the same JSON. A re-pull of the same bytes writes nothing. A failed GET writes nothing and does not return an older hash as today's file. There is no manifest. A pair file `{cacheDir}/pairs/{countyHash}/{statewideHash}` records that those two bodies were fetched together. Same-day lookup scans pair files for the baseline county URL, reads `last_update` from the statewide blob, and keeps a snapshot only when its days-out equals the current days-out. Zero matches, or more than one, is `unavailable`. The final 2024 file has days-out 0, so it matches only on election day. `.gitignore` ignores `.cache/`. Per make-operations-idempotent, a crash leaves a temp file the next pull ignores. Per separate-before-serializing-shared-state, two pulls of the same new hash rename identical bytes and race `wx`. One seen file remains.

**Flow.** `readRace` checks the request, then pulls the 2026 statewide file, the 2024 statewide file, the two county files, and the MEDSL presidential file. County `voted_all` must sum to the statewide `voted_all`. The 2026 parser requires `accept_all + inperson_all === voted_all` on each county, then drops those columns. The 2024 parser does not require voted to equal accept on every row, because that equality was checked on sample rows and on the statewide totals, not on all 83 counties. Age and gender are summed and checked against `voted_all`, then dropped. The pace model and the residual both use the county sum of `totalEarly`.

**Pace.** `differentialPace` answers the question the files can answer. It compares current early ballots with that county's final 2024 early ballots.

```
statewideShare = sum(currentEarly) / sum(baselineFinalEarly)
extra_c = currentEarly_c - statewideShare * baselineFinalEarly_c
margin_c = (rep_c - dem_c) / (rep_c + dem_c)
marginWeightedExtraEarly = sum(extra_c * margin_c)
```

`margin_c` is the two-party presidential margin. MEDSL `totalvotes` stays on the row as `contestBallots` and is not the margin denominator, because third-party votes would dilute the lean. A zero baseline or a zero two-party total fails the read. Uniform pace makes every `extra_c` zero, so the weighted sum is zero. The sign is positive when ballots are running ahead of statewide pace in counties that voted more Republican for president in 2024. The product stays unassigned to a candidate. The MDOS release is the reason. The brand keeps the product off the residual.

**Residual.** `residualOf` runs twice, once per anchor, and assigns nobody the uncast ballots. `uf-turn-2022` echoes `turn_2022` with the meaning `total_turnout_not_early_vote`. `medsl-president-2024` echoes the sum of MEDSL `totalvotes`, taken once per county, with the meaning `presidential_ballots`. If the anchor is larger than early ballots, the kind is `residual_dominates`. Otherwise the object has no uncast field. On the measured 30 October snapshot, 1,858,731 early ballots against 4,500,400 lands in `residual_dominates`. The presidential sum is computed from the file. The program does not hardcode it, and it does not substitute the MDOS turnout figure 5,706,503.

**Interface depth.** `readRace` is the operation. Behind it sit the URL table, HTTP, the hash layout, CSV columns, the name join, both formulas, the license lines, and the refusals in `WITHHELD`. The caller passes two arguments. State selects the pack. The cache directory is the archive UF will not keep. The caller does not name a model or a denominator. Both models run, and both residuals come back, because hiding one scale would be a choice the type should not offer. The return is wide because the uncast share, the proxy label, and the same-day status are the result.

## Synthesis decision

The two sketches agreed on the shape. TypeScript, two files, one exported function, a content-addressed cache with no manifest, pace against the final 2024 early snapshot, a residual that does not award the uncast ballots, and no party counts for Michigan. That consensus is the design. Claude could not run the cross-judge. Opus and Sonnet both returned a usage error, and the judge has to come from a different family than this session, so the judge was skipped.

Candidate B is the base. It refuses a blended lean, mints county identity only from MEDSL FIPS, fails the state on one unmatched name, and returns a `RaceResult` instead of throwing. Its `MarginWeightedEarly` brand is the summary number. A dimensionless index of the same product would be a second way to read one formula.

Two grafts from candidate A, folded in as if they had been part of that base.

The request dropped its denominator and contest arguments. Both anchors are fields on every read. A one-value contest flag, and a denominator flag that can hide the other scale, were a wider surface with less policy behind them. Office is not an argument either. Governor and Senate do not change the arithmetic yet. The read labels them as `ballotOffices` and sets `contest.role` to `proxy_for_ballot_offices`.

The cache stores the body before parsing, and `sameDay` is a status computed from stored pairs. Candidate B parsed before rename, which drops the only copy of a file UF is about to overwrite, and it hardcoded same-day as withheld forever. The pace model stays `comparedWith: "2024_final_snapshot"`. A comparable same-day status does not switch the formula. It only reports that a later model could be pointed at a stored pair. The final 2024 file still cannot pose as that pair unless the current days-out is 0.

Rejected from both sketches. A blended `registration-shift` that treats uncast ballots as the 2024 presidential margin. An age-gap number against the final 2024 mix. A hand-rolled CSV parser. Continuing after a failed join. An `office` argument that does not change the result. Per-state classes, a staged fetch-parse-model pipeline, and DuckDB over the raw CSV. Each of those puts column names, the meaning of 0, or the uncast assumption in the caller's hands.

## Tradeoffs accepted

- We accept a request that cannot name a cycle, in exchange for a call that cannot ask for a 2024 daily file or a 2022 early URL. Those paths 404.
- We accept presidential margins labeled as a proxy for governor and Senate, in exchange for a read that runs on the one county history with a documented CSV.
- We accept `marginWeightedExtraEarly` as ballots times a two-party margin, in exchange for a single summary that is zero when every county matches the statewide pace. The MDOS release cuts against reading that product as votes. The brand is what enforces the cut.
- We accept both residuals on every read, in exchange for a request with no denominator flag. The caller cannot print one scale and forget the other.
- We accept that distinct snapshots live only on the machine that ran the pull, in exchange for a cache with no shared manifest.
- We accept a long `src/read.ts`, in exchange for helpers a second module cannot import.
- We accept failing the whole state on one unmatched name, in exchange for a read that cannot drop Wayne and continue.
- We accept a refetch on every run, and an error when the network fails, in exchange for a result that never labels an older hash as today's file.
- We accept keeping raw UF bytes after a parser error, in exchange for being able to re-parse a snapshot UF has overwritten. The git repo still has no CSV.

## Alternatives considered

A staged pipeline would export fetch, parse, join, and a model as separate calls. The caller would have to know column families, the join key, and the order, including the rule that a Michigan 0 is not a Democratic count. That interface is wide. `readRace` hides that policy.

Per-state classes with optional party and in-person methods would make the caller test which methods exist. A missing Michigan party figure would come back as 0. The pack plus `UnreportedFile` has no party-count fields, so the missing numbers have nowhere to land.

DuckDB, or a dataframe, over the cached CSV would make the query the interface. `ru_id` and `voted_dem` would leak into every query, and two queries would become two definitions of pace. `readRace` hides the wire schema.

A function that returns one number would be a smaller signature, and it would drop the uncast share, the proxy label, and the missing same-day archive. The return type is wide so those fields stay on the value.

## Open questions and risks

UF overwrites the live county file. The default is that a gitignored directory on the machine that runs the pull is the archive through election day. If you want that archive on a shared disk, say which disk, and the layout stays the same.

The margin source is 2024 president, labeled as a proxy. If you want the governor or Senate result instead, the next ingest is the Michigan precinct file or the MVIC pages, behind the same contest type. This design does not scrape them.

The read refuses a Michigan point margin. It also has no field for a lean you supply. The program will not default that lean from a county's 2024 presidential share. If you want the field anyway, say so. The request grows one branded number, and the residual still does not absorb it.

CC BY-NC-ND forbids derivatives and commercial use. The program does not commit UF bytes. Local JSON still repeats county totals. The default is a private noncommercial playground with the attribution string on every read. If anyone other than you will run it, that needs a legal check before the first shared output.

MDOS published 2024 turnout of 5,706,503. That figure is not in the MEDSL file, so it is not a residual anchor. If you want it as a third anchor, it should be a typed constant with the release URL, not a second copy of the same ballots.

A stored blob that a later parser rejects stays on disk, and the read returns the parser error. Deleting a bad blob is manual.

## Next implementation step

Implement `pull` and the two Michigan parsers until they admit the four UF files and the MEDSL presidential file, including the 2026 check that `accept_all + inperson_all` equals `voted_all`, and stop before `differentialPace`.
