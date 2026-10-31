// Contract for the implementation. Bodies throw on purpose.
// Copy src/read.ts through readRace, and src/main.ts through main.
// Export readRace and the types on RaceRead. Do not export parsers, pull, or the pack.

export const IMPLEMENTED_STATES = ["MI"] as const
export type ImplementedState = (typeof IMPLEMENTED_STATES)[number]

type ParserId = "mi_2024" | "mi_2026"
type NameRule = "uppercase_trim" | "strip_county_suffix"
type DropRule = "none" | "drop_literal_na"
type BallotOffice = "governor" | "senate"

type EarlyBallots = number & { readonly __brand: "EarlyBallots" }
type SignedEarlyBallots = number & { readonly __brand: "SignedEarlyBallots" }
type ContestBallots = number & { readonly __brand: "ContestBallots" }
type UncastBallots = number & { readonly __brand: "UncastBallots" }
type PaceRatio = number & { readonly __brand: "PaceRatio" }
type MarginShare = number & { readonly __brand: "MarginShare" }
type MarginWeightedEarly = number & { readonly __brand: "MarginWeightedEarly" }
type CountyId = string & { readonly __brand: "CountyId" }
type SnapshotId = string & { readonly __brand: "SnapshotId" }
type CalendarDate = string & { readonly __brand: "CalendarDate" }
type DaysOut = number & { readonly __brand: "DaysOut" }

const CURRENT_CYCLE = 2026
const BASELINE_CYCLE = 2024
type EarlyCycle = typeof CURRENT_CYCLE | typeof BASELINE_CYCLE

const ELECTION_DAY: Record<EarlyCycle, string> = {
  [BASELINE_CYCLE]: "2024-11-05",
  [CURRENT_CYCLE]: "2026-11-03",
}

const PRESIDENTIAL_COUNTY_URL =
  "https://api.electiondata.dev/v1/county-president/table/2024.csv"

const ATTRIBUTION = {
  earlyVote:
    "University of Florida Election Lab. Creative Commons Attribution-NonCommercial-NoDerivatives 4.0.",
  results:
    "MIT Election Data and Science Lab, county presidential returns, CC0, via api.electiondata.dev.",
} as const

const WITHHELD = {
  age: "An in-progress age mix is older than the final electorate. Age is not in this read.",
  gender: "Michigan gender is a weak partisan proxy. Gender is not in this read.",
  mode: "The 2024 file reports all early vote as mail. The 2026 in-person figure is an estimate. This read compares total early ballots only.",
  voteAllocation:
    "Early ballots stay unallocated. A county's presidential margin weights only that county's pace deviation.",
} as const

export type Withheld = typeof WITHHELD

export type ReadError =
  | { kind: "bad_cache_dir" }
  | { kind: "fetch_failed"; url: string }
  | { kind: "not_a_snapshot"; url: string }
  | { kind: "party_columns_present"; family: ParserId }
  | { kind: "stage_identity_failed"; family: ParserId; rawName: string }
  | { kind: "column_sum_mismatch"; family: ParserId; rawName: string }
  | { kind: "county_sum_mismatch"; cycle: EarlyCycle }
  | { kind: "baseline_not_final"; sourceDate: CalendarDate }
  | { kind: "bad_source_date"; cycle: EarlyCycle }
  | { kind: "unjoined_county"; rawName: string }
  | { kind: "duplicate_county"; rawName: string }
  | { kind: "zero_baseline_early"; rawName: string }
  | { kind: "missing_contest_row"; rawName: string }

export type EarlyMode =
  | { kind: "all_early_reported_as_mail" }
  | { kind: "mail_plus_estimated_inperson" }

export type SnapshotMeta = {
  snapshotId: SnapshotId
  sourceDate: CalendarDate
  electionDate: CalendarDate
  daysBeforeElection: DaysOut
  completeness: "in_progress" | "election_day_snapshot"
  mode: EarlyMode
  dataSource: string
  sourceNote: string
}

export type DenominatorEcho =
  | {
      denominator: "uf-turn-2022"
      meaning: "total_turnout_not_early_vote"
      ballots: ContestBallots
    }
  | {
      denominator: "medsl-president-2024"
      meaning: "presidential_ballots"
      ballots: ContestBallots
    }

export type Residual =
  | {
      kind: "residual_dominates"
      denominator: DenominatorEcho
      earlyBallots: EarlyBallots
      uncastBallots: UncastBallots
    }
  | {
      kind: "early_exceeds_denominator"
      denominator: DenominatorEcho
      earlyBallots: EarlyBallots
    }

export type ContestEcho = {
  contest: "president-2024"
  role: "proxy_for_ballot_offices"
  ballotOffices: readonly BallotOffice[]
}

export type SameDay =
  | {
      kind: "unavailable"
      reason: "no_stored_snapshot_at_matching_days_out" | "ambiguous_stored_snapshots"
    }
  | {
      kind: "comparable"
      baselineAsOf: CalendarDate
      currentAsOf: CalendarDate
      daysBeforeElection: DaysOut
    }

export type CountyPaceRow = {
  fips: CountyId
  name: string
  currentEarly: EarlyBallots
  baselineFinalEarly: EarlyBallots
  shareOfOwnFinalEarly: PaceRatio
  extraEarly: SignedEarlyBallots
  dem: ContestBallots
  rep: ContestBallots
  contestBallots: ContestBallots
  margin: MarginShare
}

export type PaceModel = {
  kind: "share_of_final_early_and_margin_weighted_extra"
  comparedWith: "2024_final_snapshot"
  statewideShareOfFinalEarly: PaceRatio
  marginWeightedExtraEarly: MarginWeightedEarly
  counties: readonly CountyPaceRow[]
}

export type PartyView =
  | { kind: "not_reported" }
  | {
      kind: "registration_not_votes"
      dem: EarlyBallots
      rep: EarlyBallots
      noneOrMinor: EarlyBallots
    }

export type RaceRead = {
  state: ImplementedState
  attribution: {
    earlyVote: typeof ATTRIBUTION.earlyVote
    results: typeof ATTRIBUTION.results
    upstreamSource: string
    upstreamNote: string
  }
  contest: ContestEcho
  current: SnapshotMeta
  baseline: SnapshotMeta
  pace: PaceModel
  residuals: {
    ufTurn2022: Residual
    medslPresident2024: Residual
  }
  party: PartyView
  sameDay: SameDay
  withheld: Withheld
}

export type RaceRequest = {
  state: ImplementedState
  cacheDir: string
}

export type RaceResult =
  | { kind: "ok"; read: RaceRead }
  | { kind: "error"; error: ReadError }

type StatePack = {
  nameRule: NameRule
  dropRule: DropRule
  ballotOffices: readonly BallotOffice[]
  columns: { readonly 2024: ParserId; readonly 2026: ParserId }
}

type UfCountyBase = { rawName: string; totalEarly: EarlyBallots }

type UnreportedCounty = UfCountyBase & { kind: "party_unreported" }

type ReportedCounty = UfCountyBase & {
  kind: "party_reported"
  registration: { dem: EarlyBallots; rep: EarlyBallots; noneOrMinor: EarlyBallots }
}

type UnreportedFile =
  | {
      kind: "ok"
      mode: EarlyMode
      counties: readonly [UnreportedCounty, ...UnreportedCounty[]]
    }
  | { kind: "error"; error: ReadError }

type StatewideFile = {
  sourceDate: CalendarDate
  dataSource: string
  sourceNote: string
  votedAll: EarlyBallots
}

type Statewide2026 = StatewideFile & { turn2022: ContestBallots }

type MedslCounty = {
  fips: CountyId
  rawName: string
  dem: ContestBallots
  rep: ContestBallots
  contestBallots: ContestBallots
}

type SeenRecord = { firstSeen: string; url: string }

type PaceInput = {
  fips: CountyId
  name: string
  currentEarly: EarlyBallots
  baselineFinalEarly: EarlyBallots
  dem: ContestBallots
  rep: ContestBallots
  contestBallots: ContestBallots
}

function earlyBallots(n: number): EarlyBallots {
  // Integer, 0 through Number.MAX_SAFE_INTEGER. The only minter of EarlyBallots.
  throw new Error("not implemented")
}

function signedEarlyBallots(n: number): SignedEarlyBallots {
  // Safe integer. Negative is legal. The only minter of SignedEarlyBallots.
  throw new Error("not implemented")
}

function contestBallots(n: number): ContestBallots {
  // Integer, 0 through Number.MAX_SAFE_INTEGER. The only minter of ContestBallots.
  throw new Error("not implemented")
}

function uncastBallots(n: number): UncastBallots {
  // Integer, 1 through Number.MAX_SAFE_INTEGER. residualOf calls this only when the anchor is larger.
  throw new Error("not implemented")
}

function paceRatio(n: number): PaceRatio {
  // Finite and >= 0. Values above 1 are legal. The only minter of PaceRatio.
  throw new Error("not implemented")
}

function marginShare(n: number): MarginShare {
  // Finite, from -1 through 1. The only minter of MarginShare.
  throw new Error("not implemented")
}

function marginWeightedEarly(n: number): MarginWeightedEarly {
  // Finite. Negative is legal. The only minter of MarginWeightedEarly.
  // No function accepts this brand and returns ContestBallots or EarlyBallots.
  throw new Error("not implemented")
}

function countyIdFromMedslFips(fips: string): CountyId {
  // Call this only while reading a MEDSL county_fips cell.
  // Accept five digits. Wayne County, Michigan is 26163.
  // UF ru_id is 23000 plus ctynum. Wayne's ru_id is 23082. This function has no ru_id parameter.
  throw new Error("not implemented")
}

function snapshotId(hash: string): SnapshotId {
  // Accept 64 lowercase hex characters. The only minter of SnapshotId.
  throw new Error("not implemented")
}

function calendarDateFromUf(raw: string): CalendarDate {
  // Accept the UF last_update form M/D/YYYY. Return YYYY-MM-DD.
  // The raw form does not leave this function.
  throw new Error("not implemented")
}

function daysOut(election: CalendarDate, asOf: CalendarDate): DaysOut {
  // Calendar days, election minus asOf, using UTC date parts so DST does not matter.
  // 2024-11-05 minus 2024-11-05 is 0. 2026-11-03 minus 2026-10-30 is 4.
  throw new Error("not implemented")
}

function electionDay(cycle: EarlyCycle): CalendarDate {
  // Brand ELECTION_DAY[cycle]. That record is the only list of election dates.
  throw new Error("not implemented")
}

function assertNever(value: never): never {
  throw new Error("not implemented")
}

function countyUrl(cycle: EarlyCycle, state: ImplementedState): string {
  // 2024: https://election.lab.ufl.edu/data-downloads/earlyvote/2024/county_data_{STATE}.csv
  // 2026: https://election.lab.ufl.edu/data-downloads/earlyvote/2026/{STATE}_county.csv
  // No date parameter. A dated county path 404s, and earlyvote/2022/ 404s.
  throw new Error("not implemented")
}

function statewideUrl(cycle: EarlyCycle): string {
  // https://election.lab.ufl.edu/data-downloads/earlyvote/{cycle}/US.csv
  throw new Error("not implemented")
}

async function pull<T>(input: {
  url: string
  cacheDir: string
  now: () => string
  parse: (csvText: string) => { kind: "ok"; value: T } | { kind: "error"; error: ReadError }
}): Promise<{ kind: "ok"; snapshotId: SnapshotId; value: T } | { kind: "error"; error: ReadError }> {
  // GET input.url. On a non-200 or a network failure, return fetch_failed and write nothing.
  // Hash the body with sha256.
  // Blob path: {cacheDir}/blobs/{hash}. Write a temp file, then rename onto the blob path.
  // Store the body before parsing. A later parser fix re-reads bytes UF has overwritten.
  // If the blob path already exists, leave those bytes in place.
  // Seen path: {cacheDir}/seen/{sha256 of the url}/{hash}. Create it with wx.
  // Body is SeenRecord JSON. firstSeen comes from now(). If wx fails because the file exists, leave it.
  // Then parse. csv-parse output is unknown until parse returns.
  // If parse returns error, keep the blob and the seen file, and return that error.
  // A second pull of the same bytes performs no writes.
  // A crash before rename leaves a temp file. The next pull ignores temps it did not create.
  // There is no manifest. firstSeen is not copied onto RaceRead.
  throw new Error("not implemented")
}

function recordPair(cacheDir: string, countyHash: SnapshotId, statewideHash: SnapshotId): void {
  // Path pairs/{countyHash}/{statewideHash}. Write it once. Never rewrite it.
  // Same-day lookup scans these files. It does not keep a shared index.
  throw new Error("not implemented")
}

function parseMi2026(csvText: string): UnreportedFile {
  // Family mi_2026. Mode is mail_plus_estimated_inperson.
  // Read raw county name, accept_all, inperson_all, and voted_all.
  // If any header ends in _dem, _rep, _none, or a race suffix, return party_columns_present.
  // If accept_all + inperson_all !== voted_all for a county, return stage_identity_failed.
  // Sum the four age columns and the three gender columns. If either sum !== voted_all, return column_sum_mismatch.
  // Then drop age, gender, accept_all, and inperson_all. totalEarly is voted_all.
  // Do not read ctynum or ru_id.
  // Return kind party_unreported. An empty county list is not_a_snapshot.
  throw new Error("not implemented")
}

function parseMi2024(csvText: string): UnreportedFile {
  // Family mi_2024. Mode is all_early_reported_as_mail.
  // totalEarly is voted_all. Do not require voted_all === accept_all on every row.
  // There is no in-person series in this file.
  // Same forbidden party and race headers. Same age and gender sum check, then drop those columns.
  // Ignore return_rate. This file has no ru_id.
  // Return kind party_unreported.
  throw new Error("not implemented")
}

const PARSERS = {
  mi_2024: parseMi2024,
  mi_2026: parseMi2026,
} satisfies Record<ParserId, (csvText: string) => UnreportedFile>

function parseStatewide2026(
  csvText: string,
  state: ImplementedState,
): { kind: "ok"; file: Statewide2026 } | { kind: "error"; error: ReadError } {
  // Select the row whose state_abbv is state.
  // Keep last_update, data_source, notes, voted_all, and turn_2022.
  // turn_2022 is total turnout, minted as ContestBallots.
  // voted_all is minted as EarlyBallots and used only to check the county sum.
  // Do not read party, race, age, or gender cells. A 0 in those cells is not a count.
  throw new Error("not implemented")
}

function parseStatewide2024(
  csvText: string,
  state: ImplementedState,
): { kind: "ok"; file: StatewideFile } | { kind: "error"; error: ReadError } {
  // Select the row whose state_abbv is state.
  // Keep last_update, data_source, notes, and voted_all.
  // Do not read turn_2020. This return type has no turnout field.
  // Do not read party cells.
  throw new Error("not implemented")
}

function parsePresidentialCounties(
  csvText: string,
  state: ImplementedState,
):
  | { kind: "ok"; counties: readonly [MedslCounty, ...MedslCounty[]] }
  | { kind: "error"; error: ReadError } {
  // Keep rows whose state_po is the requested state.
  // One MedslCounty per county_fips. Mint CountyId only here.
  // dem is the sum of candidatevotes where party is DEMOCRAT.
  // rep is the sum where party is REPUBLICAN.
  // contestBallots is totalvotes, taken once per county. Summing it per candidate row multiplies the total.
  // A county missing dem, rep, or a positive totalvotes is missing_contest_row.
  // Duplicate fips is duplicate_county.
  throw new Error("not implemented")
}

const STATE_PACKS = {
  MI: {
    nameRule: "uppercase_trim",
    dropRule: "none",
    ballotOffices: ["governor", "senate"],
    columns: { 2024: "mi_2024", 2026: "mi_2026" },
  },
} satisfies Record<ImplementedState, StatePack>

function applyNameRule(rule: NameRule, rawName: string): string {
  // uppercase_trim: Unicode uppercase, collapsed internal space, trimmed.
  // strip_county_suffix: uppercase_trim, then remove one trailing " COUNTY".
  // Apply the same rule to the UF name and the MEDSL name.
  switch (rule) {
    case "uppercase_trim":
    case "strip_county_suffix":
      throw new Error("not implemented")
    default:
      return assertNever(rule)
  }
}

function isDropped(rule: DropRule, rawName: string): boolean {
  // none: false.
  // drop_literal_na: true only when the trimmed name is NA.
  switch (rule) {
    case "none":
    case "drop_literal_na":
      throw new Error("not implemented")
    default:
      return assertNever(rule)
  }
}

function registration(
  counties: readonly [ReportedCounty, ...ReportedCounty[]],
): PartyView & { kind: "registration_not_votes" } {
  // Sum dem, rep, and noneOrMinor. Do not multiply by MarginShare.
  // The Michigan parsers return UnreportedCounty, so they cannot call this.
  // differentialPace does not take the result.
  throw new Error("not implemented")
}

function differentialPace(
  rows: readonly [PaceInput, ...PaceInput[]],
): { kind: "ok"; pace: PaceModel } | { kind: "error"; error: ReadError } {
  // If any baselineFinalEarly is 0, return zero_baseline_early.
  // If any dem + rep is 0, return missing_contest_row.
  // statewideShare = sum(currentEarly) / sum(baselineFinalEarly).
  // extra_c = currentEarly_c - statewideShare * baselineFinalEarly_c.
  // margin_c = (rep_c - dem_c) / (rep_c + dem_c). contestBallots is not this denominator.
  // marginWeightedExtraEarly = sum(extra_c * margin_c).
  // shareOfOwnFinalEarly_c = currentEarly_c / baselineFinalEarly_c.
  // comparedWith is 2024_final_snapshot.
  // Age, gender, mode, and party registration are not parameters.
  throw new Error("not implemented")
}

function residualOf(input: { early: EarlyBallots; echo: DenominatorEcho }): Residual {
  // early is the county sum of totalEarly, the same sum differentialPace uses.
  // If echo.ballots > early, kind is residual_dominates and uncast = echo.ballots - early.
  // Otherwise kind is early_exceeds_denominator and the result has no uncast field.
  // The subtraction treats early ballots and contest ballots as one scale.
  // They come from different elections. That assumption stays inside this function.
  throw new Error("not implemented")
}

function findSameDay(input: {
  cacheDir: string
  baselineCountyUrl: string
  currentDays: DaysOut
  currentAsOf: CalendarDate
}): SameDay {
  // Scan pairs/ for statewide blobs whose receipt URL is the baseline statewide file
  // and whose county hash was stored for baselineCountyUrl.
  // daysOut comes from last_update, not from firstSeen.
  // Keep snapshots whose days-out equals currentDays.
  // The final 2024 file has days-out 0. It matches only when currentDays is 0.
  // Zero matches: unavailable, no_stored_snapshot_at_matching_days_out.
  // More than one: unavailable, ambiguous_stored_snapshots. Do not pick one.
  // Do not scale the final file to invent a same-day snapshot.
  // A comparable result does not change PaceModel.comparedWith.
  throw new Error("not implemented")
}

function openRequest(raw: { state: string; cacheDir: string }): RaceRequest | ReadError {
  // state must be a member of IMPLEMENTED_STATES.
  // cacheDir must be non-empty and must not contain "://".
  // parseArgs and readRace both call this function.
  throw new Error("not implemented")
}

export async function readRace(raw: {
  state: string
  cacheDir: string
}): Promise<RaceResult> {
  // openRequest. On a ReadError, return it. Trust the narrowed request after that.
  // pack = STATE_PACKS[request.state].
  // Sequential pulls, cacheDir from the request, now from the clock:
  //   statewide 2026, statewide 2024, county URL for each pack.columns entry, PRESIDENTIAL_COUNTY_URL.
  // After both bodies of a cycle are stored, recordPair.
  // Sum county totalEarly and compare to that file's votedAll. On mismatch, county_sum_mismatch.
  // The 2024 statewide date must be election day. Otherwise baseline_not_final.
  // A source date after election day is bad_source_date.
  // completeness is election_day_snapshot when the dates match, otherwise in_progress.
  // Normalize MEDSL names and UF names with pack.nameRule.
  // Drop UF rows isDropped allows. Any other unmatched name is unjoined_county.
  // One miss fails the state. Build a non-empty PaceInput list keyed by MEDSL CountyId.
  // differentialPace, then residualOf twice.
  // ufTurn2022 reads Statewide2026.turn2022.
  // medslPresident2024 sums MedslCounty.contestBallots once per county.
  // PARSERS values return UnreportedFile, so party is { kind: "not_reported" }.
  // Do not call registration.
  // contest.role is proxy_for_ballot_offices. ballotOffices comes from the pack.
  // sameDay comes from findSameDay. withheld is WITHHELD.
  // upstreamSource and upstreamNote come from the 2026 statewide row.
  // sourceNote is copied onto each SnapshotMeta and is not an input to either model.
  throw new Error("not implemented")
}

function parseArgs(
  argv: readonly string[],
): { kind: "ok"; request: { state: string; cacheDir: string } } | { kind: "error"; message: string } {
  // Lives in src/main.ts.
  // Exactly two arguments, state then cacheDir. Reject an argument that starts with "-".
  // There is no default for either argument.
  throw new Error("not implemented")
}

async function main(argv: readonly string[]): Promise<number> {
  // Lives in src/main.ts. Parse argv, call readRace, write RaceResult JSON to stdout.
  // On parse failure or result.kind === "error", write the message or error.kind to stderr and return 1.
  throw new Error("not implemented")
}

async function callerUsageWitness(): Promise<void> {
  const result = await readRace({
    state: "MI",
    cacheDir: ".cache/ev",
  })
  if (result.kind === "error") {
    const kind: ReadError["kind"] = result.error.kind
    void kind
    return
  }
  const extra: MarginWeightedEarly = result.read.pace.marginWeightedExtraEarly
  const uncast = result.read.residuals.ufTurn2022
  const sameDay: SameDay["kind"] = result.read.sameDay.kind
  const role: "proxy_for_ballot_offices" = result.read.contest.role
  const compared: "2024_final_snapshot" = result.read.pace.comparedWith
  void extra
  void uncast
  void sameDay
  void role
  void compared
  if (uncast.kind === "residual_dominates") {
    const ballots: UncastBallots = uncast.uncastBallots
    void ballots
  }
  throw new Error("not implemented")
}

void callerUsageWitness
void main
void parseArgs
void PRESIDENTIAL_COUNTY_URL
void ELECTION_DAY
void countyUrl
void statewideUrl
void electionDay
void daysOut
void calendarDateFromUf
void snapshotId
void countyIdFromMedslFips
void pull
void recordPair
void parseStatewide2026
void parseStatewide2024
void parsePresidentialCounties
void applyNameRule
void isDropped
void registration
void differentialPace
void residualOf
void findSameDay
void openRequest
void earlyBallots
void signedEarlyBallots
void contestBallots
void uncastBallots
void paceRatio
void marginShare
void marginWeightedEarly
void PARSERS
void STATE_PACKS
void ATTRIBUTION
void WITHHELD
