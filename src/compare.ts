import { readFileSync } from "node:fs"
import { parse } from "csv-parse/sync"

export type CountyCompare = {
  name: string
  early2026: number
  baseline: number
  ratio: number
  index: number
  marginPoints: number
  shareChangePoints: number
  contributionPoints: number
  flag?: string
}

export type CompareRead = {
  state: string
  asOf: string
  baselineYear: number
  baselineAsOf: string
  early2026: number
  baseline: number
  statewideRatio: number
  baselineMarginPoints: number
  impliedMarginPoints: number
  shiftPoints: number
  counties: readonly CountyCompare[]
}

export type CountyInput = {
  name: string
  early2026: number
  baseline: number
  rep: number
  dem: number
  flag?: string
}

const USER_AGENT = "election-bot/0.1"
const SOS_EARLY = "Cumulative In-Person And Mail Voters"
const SOS_IN_PERSON = "Cumulative In-Person Voters"
const HALE_FLAG = "2022 SOS cumulative in-person is 369"

export function rankCounties(input: {
  state: string
  asOf: string
  baselineYear: number
  baselineAsOf: string
  counties: readonly CountyInput[]
}): CompareRead {
  const seen = new Set<string>()
  for (const county of input.counties) {
    if (seen.has(county.name)) {
      throw new Error(`duplicate county ${county.name}`)
    }
    seen.add(county.name)
    if (county.baseline === 0) {
      throw new Error(`baseline is 0 for ${county.name}`)
    }
    if (county.rep + county.dem === 0) {
      throw new Error(`rep + dem is 0 for ${county.name}`)
    }
  }

  let early2026 = 0
  let baseline = 0
  for (const county of input.counties) {
    early2026 += county.early2026
    baseline += county.baseline
  }
  if (baseline === 0) {
    throw new Error("baseline sum is 0")
  }

  const statewideRatio = early2026 / baseline
  if (statewideRatio === 0) {
    throw new Error("statewide early-vote ratio is 0")
  }

  let baselineMarginPoints = 0
  let impliedMarginPoints = 0
  const counties: CountyCompare[] = []
  for (const county of input.counties) {
    const ratio = county.early2026 / county.baseline
    const margin = (county.rep - county.dem) / (county.rep + county.dem)
    const share2026 = county.early2026 / early2026
    const shareBaseline = county.baseline / baseline
    const shareChangePoints = (share2026 - shareBaseline) * 100
    const contributionPoints = margin * shareChangePoints
    baselineMarginPoints += margin * shareBaseline * 100
    impliedMarginPoints += margin * share2026 * 100
    const row: CountyCompare = {
      name: county.name,
      early2026: county.early2026,
      baseline: county.baseline,
      ratio,
      index: ratio / statewideRatio,
      marginPoints: margin * 100,
      shareChangePoints,
      contributionPoints,
    }
    if (county.flag) row.flag = county.flag
    counties.push(row)
  }

  counties.sort((a, b) => {
    if (a.index !== b.index) return a.index < b.index ? 1 : -1
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return 0
  })

  return {
    state: input.state,
    asOf: input.asOf,
    baselineYear: input.baselineYear,
    baselineAsOf: input.baselineAsOf,
    early2026,
    baseline,
    statewideRatio,
    baselineMarginPoints,
    impliedMarginPoints,
    shiftPoints: impliedMarginPoints - baselineMarginPoints,
    counties,
  }
}

export async function compareEarly(state: string): Promise<readonly CompareRead[]> {
  if (state === "TX") return compareTexas()
  return [await compareFromUf(state)]
}

async function compareFromUf(state: string): Promise<CompareRead> {
  const [text2026, text2024, textUs, textPresident] = await Promise.all([
    fetchCsv(`https://election.lab.ufl.edu/data-downloads/earlyvote/2026/${state}_county.csv`),
    fetchCsv(`https://election.lab.ufl.edu/data-downloads/earlyvote/2024/county_data_${state}.csv`),
    fetchCsv("https://election.lab.ufl.edu/data-downloads/earlyvote/2026/US.csv"),
    fetchCsv("https://api.electiondata.dev/v1/county-president/table/2024.csv"),
  ])

  const current = readUfCounties(text2026)
  const baseline = readUfCounties(text2024)
  const statewide = readStatewide(textUs, state)
  assertSum(state, sum([...current.values()].map((county) => county.total)), statewide.votedAll)
  const counties = joinCounties(current, baseline, readPresidential(textPresident, state), new Map())
  return rankCounties({
    state,
    asOf: statewide.asOf,
    baselineYear: 2024,
    baselineAsOf: "11/5/2024",
    counties,
  })
}

async function compareTexas(): Promise<readonly CompareRead[]> {
  const [text2026, textUs, textPresident] = await Promise.all([
    fetchCsv("https://election.lab.ufl.edu/data-downloads/earlyvote/2026/TX_county.csv"),
    fetchCsv("https://election.lab.ufl.edu/data-downloads/earlyvote/2026/US.csv"),
    fetchCsv("https://api.electiondata.dev/v1/county-president/table/2024.csv"),
  ])

  const current = readUfCounties(text2026)
  const statewide = readStatewide(textUs, "TX")
  assertSum("TX", sum([...current.values()].map((county) => county.total)), statewide.votedAll)
  const votes = readPresidential(textPresident, "TX")
  const reads: CompareRead[] = []
  for (const baseline of [
    { year: 2024, file: "2024-general-early.csv" },
    { year: 2022, file: "2022-general-early.csv" },
  ] as const) {
    const sos = readSosEarly(readFileSync(new URL(`../data/tx/${baseline.file}`, import.meta.url), "utf8"))
    const counties = joinCounties(current, sos.counties, votes, sos.flags)
    reads.push(
      rankCounties({
        state: "TX",
        asOf: statewide.asOf,
        baselineYear: baseline.year,
        baselineAsOf: sos.asOf,
        counties,
      }),
    )
  }
  return reads
}

export type NamedTotal = { name: string; total: number }

export function readSosEarly(text: string): {
  asOf: string
  total: number
  counties: Map<string, NamedTotal>
  flags: Map<string, string>
} {
  const counties = new Map<string, NamedTotal>()
  const flags = new Map<string, string>()
  let total: number | undefined
  let asOf = ""
  for (const row of parseRows(text)) {
    const raw = (row.County ?? "").trim()
    const name = countyKey(raw)
    if (!name) throw new Error("SOS row missing County")
    const early = numberField(row, SOS_EARLY, name)
    if (row.is_total_row === "Y" || name === "TOTAL") {
      if (total !== undefined) throw new Error("duplicate SOS total row")
      total = early
      asOf = row.report_date ?? ""
      continue
    }
    if (counties.has(name)) throw new Error(`duplicate county ${name}`)
    counties.set(name, { name: raw.toUpperCase(), total: early })
    const inPerson = numberField(row, SOS_IN_PERSON, name)
    if (name === "HALE" && inPerson === 369) flags.set(name, HALE_FLAG)
    if (!asOf && row.report_date) asOf = row.report_date
  }
  if (total === undefined) throw new Error("SOS file has no total row")
  if (!asOf) throw new Error("SOS file has no report_date")
  const countySum = sum([...counties.values()].map((county) => county.total))
  if (countySum !== total) {
    throw new Error(`SOS county sum ${countySum} does not equal TOTAL ${total}`)
  }
  return { asOf, total, counties, flags }
}

async function fetchCsv(url: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`${url} failed: ${message}`)
  }
  if (response.status !== 200) {
    throw new Error(`${url} returned ${response.status}`)
  }
  return response.text()
}

function parseRows(text: string): Record<string, string>[] {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[]
}

function countyKey(name: string): string {
  let trimmed = name.trim().toUpperCase()
  const suffix = " COUNTY"
  if (trimmed.endsWith(suffix)) trimmed = trimmed.slice(0, -suffix.length)
  // MEDSL writes "LA SALLE". UF and the Texas SOS file write "LASALLE".
  return trimmed.replaceAll(" ", "")
}

function numberField(row: Record<string, string>, key: string, where: string): number {
  const raw = row[key]
  if (raw === undefined || raw === "") {
    throw new Error(`missing ${key} for ${where}`)
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw new Error(`bad ${key} for ${where}: ${raw}`)
  }
  return value
}

function readUfCounties(text: string): Map<string, NamedTotal> {
  const totals = new Map<string, NamedTotal>()
  for (const row of parseRows(text)) {
    const raw = (row.county ?? "").trim()
    const name = countyKey(raw)
    if (!name) throw new Error("county row missing county")
    if (totals.has(name)) throw new Error(`duplicate county ${name}`)
    totals.set(name, { name: raw.toUpperCase(), total: numberField(row, "voted_all", name) })
  }
  return totals
}

function readStatewide(text: string, state: string): { asOf: string; votedAll: number } {
  let found: { asOf: string; votedAll: number } | undefined
  for (const row of parseRows(text)) {
    if (row.state_abbv !== state) continue
    if (found) throw new Error(`duplicate statewide row for ${state}`)
    if (!row.last_update) throw new Error(`missing last_update for ${state}`)
    found = { asOf: row.last_update, votedAll: numberField(row, "voted_all", state) }
  }
  if (!found) throw new Error(`no statewide row for ${state}`)
  return found
}

function readPresidential(text: string, state: string): Map<string, { rep: number; dem: number }> {
  const votes = new Map<string, { rep: number; dem: number }>()
  for (const row of parseRows(text)) {
    if (row.state_po !== state) continue
    const name = countyKey(row.county_name ?? "")
    if (!name) throw new Error("MEDSL row missing county_name")
    let entry = votes.get(name)
    if (!entry) {
      entry = { rep: 0, dem: 0 }
      votes.set(name, entry)
    }
    if (row.party !== "DEMOCRAT" && row.party !== "REPUBLICAN") continue
    const count = numberField(row, "candidatevotes", name)
    if (row.party === "DEMOCRAT") entry.dem += count
    else entry.rep += count
  }
  return votes
}

function joinCounties(
  current: Map<string, NamedTotal>,
  baseline: Map<string, NamedTotal>,
  votes: Map<string, { rep: number; dem: number }>,
  flags: Map<string, string>,
): CountyInput[] {
  const names = [...new Set([...current.keys(), ...baseline.keys(), ...votes.keys()])].sort()
  const counties: CountyInput[] = []
  for (const name of names) {
    const early2026 = current.get(name)
    const baselineEarly = baseline.get(name)
    const margin = votes.get(name)
    if (early2026 === undefined) throw new Error(`no 2026 row for ${name}`)
    if (baselineEarly === undefined) throw new Error(`no baseline row for ${name}`)
    if (margin === undefined) throw new Error(`no MEDSL row for ${name}`)
    const county: CountyInput = {
      name: early2026.name,
      early2026: early2026.total,
      baseline: baselineEarly.total,
      rep: margin.rep,
      dem: margin.dem,
    }
    const flag = flags.get(name)
    if (flag) county.flag = flag
    counties.push(county)
  }
  return counties
}

function assertSum(state: string, countySum: number, statewide: number): void {
  if (countySum !== statewide) {
    throw new Error(
      `${state} 2026 county voted_all sum ${countySum} does not equal statewide voted_all ${statewide}`,
    )
  }
}

function sum(values: Iterable<number>): number {
  let total = 0
  for (const value of values) total += value
  return total
}
