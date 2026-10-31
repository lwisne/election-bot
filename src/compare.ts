import { parse } from "csv-parse/sync"

export type CountyCompare = {
  name: string
  early2026: number
  early2024: number
  ratio: number
  index: number
  margin: number
}

export type CompareRead = {
  state: string
  asOf: string
  early2026: number
  early2024: number
  statewideRatio: number
  marginWeightedExtra: number
  counties: readonly CountyCompare[]
}

export type CountyInput = {
  name: string
  early2026: number
  early2024: number
  rep: number
  dem: number
}

const USER_AGENT = "election-bot/0.1"

export function rankCounties(input: {
  state: string
  asOf: string
  counties: readonly CountyInput[]
}): CompareRead {
  const seen = new Set<string>()
  for (const county of input.counties) {
    if (seen.has(county.name)) {
      throw new Error(`duplicate county ${county.name}`)
    }
    seen.add(county.name)
    if (county.early2024 === 0) {
      throw new Error(`early2024 is 0 for ${county.name}`)
    }
    if (county.rep + county.dem === 0) {
      throw new Error(`rep + dem is 0 for ${county.name}`)
    }
  }

  let early2026 = 0
  let early2024 = 0
  for (const county of input.counties) {
    early2026 += county.early2026
    early2024 += county.early2024
  }
  if (early2024 === 0) {
    throw new Error("early2024 sum is 0")
  }

  const statewideRatio = early2026 / early2024
  if (statewideRatio === 0) {
    throw new Error("statewide early-vote ratio is 0")
  }

  let marginWeightedExtra = 0
  const counties: CountyCompare[] = []
  for (const county of input.counties) {
    const ratio = county.early2026 / county.early2024
    const margin = (county.rep - county.dem) / (county.rep + county.dem)
    const extra = county.early2026 - statewideRatio * county.early2024
    marginWeightedExtra += extra * margin
    counties.push({
      name: county.name,
      early2026: county.early2026,
      early2024: county.early2024,
      ratio,
      index: ratio / statewideRatio,
      margin,
    })
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
    early2026,
    early2024,
    statewideRatio,
    marginWeightedExtra,
    counties,
  }
}

export async function compareEarly(state: string): Promise<CompareRead> {
  const [text2026, text2024, textUs, textPresident] = await Promise.all([
    fetchCsv(`https://election.lab.ufl.edu/data-downloads/earlyvote/2026/${state}_county.csv`),
    fetchCsv(`https://election.lab.ufl.edu/data-downloads/earlyvote/2024/county_data_${state}.csv`),
    fetchCsv("https://election.lab.ufl.edu/data-downloads/earlyvote/2026/US.csv"),
    fetchCsv("https://api.electiondata.dev/v1/county-president/table/2024.csv"),
  ])

  const counties2026 = readUfCounties(text2026)
  const counties2024 = readUfCounties(text2024)
  const statewide = readStatewide(textUs, state)
  const countySum = sum(counties2026.values())
  if (countySum !== statewide.votedAll) {
    throw new Error(
      `2026 county voted_all sum ${countySum} does not equal statewide voted_all ${statewide.votedAll}`,
    )
  }

  const counties = joinCounties(counties2026, counties2024, readPresidential(textPresident, state))
  return rankCounties({ state, asOf: statewide.asOf, counties })
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
  const trimmed = name.trim().toUpperCase()
  const suffix = " COUNTY"
  return trimmed.endsWith(suffix) ? trimmed.slice(0, -suffix.length) : trimmed
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

function readUfCounties(text: string): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of parseRows(text)) {
    const name = countyKey(row.county ?? "")
    if (!name) throw new Error("county row missing county")
    if (totals.has(name)) throw new Error(`duplicate county ${name}`)
    totals.set(name, numberField(row, "voted_all", name))
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
  counties2026: Map<string, number>,
  counties2024: Map<string, number>,
  votes: Map<string, { rep: number; dem: number }>,
): CountyInput[] {
  const names = [...new Set([...counties2026.keys(), ...counties2024.keys(), ...votes.keys()])].sort()
  const counties: CountyInput[] = []
  for (const name of names) {
    const early2026 = counties2026.get(name)
    const early2024 = counties2024.get(name)
    const margin = votes.get(name)
    if (early2026 === undefined || early2024 === undefined) {
      throw new Error(`no UF row for ${name}`)
    }
    if (margin === undefined) {
      throw new Error(`no MEDSL row for ${name}`)
    }
    counties.push({
      name,
      early2026,
      early2024,
      rep: margin.rep,
      dem: margin.dem,
    })
  }
  return counties
}

function sum(values: Iterable<number>): number {
  let total = 0
  for (const value of values) total += value
  return total
}
