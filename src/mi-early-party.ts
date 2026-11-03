import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parse } from "csv-parse/sync"

export type CountyWeight = {
  name: string
  early: number
  dem: number
  rep: number
}

export type CountyExpect = {
  name: string
  early: number
  expectedDem: number
  expectedRep: number
  netDem: number
}

export type Expectation = {
  total: number
  expectedDem: number
  expectedRep: number
  marginVotes: number
  marginPoints: number
  counties: CountyExpect[]
}

export function countyKey(name: string): string {
  let text = name.trim().toUpperCase().replaceAll(".", "")
  if (text.endsWith(" COUNTY")) text = text.slice(0, -" COUNTY".length)
  text = text.replace(/\s+/g, " ")
  if (text === "GD TRAVERSE") return "GRAND TRAVERSE"
  return text
}

export function expectParty(counties: readonly CountyWeight[]): Expectation {
  let total = 0
  let expectedDem = 0
  let expectedRep = 0
  const rows: CountyExpect[] = []
  for (const county of counties) {
    const twoParty = county.dem + county.rep
    if (twoParty === 0) throw new Error(`two-party total is 0 for ${county.name}`)
    if (county.early < 0) throw new Error(`negative early vote for ${county.name}`)
    const expectedD = county.early * (county.dem / twoParty)
    const expectedR = county.early * (county.rep / twoParty)
    total += county.early
    expectedDem += expectedD
    expectedRep += expectedR
    rows.push({
      name: county.name,
      early: county.early,
      expectedDem: expectedD,
      expectedRep: expectedR,
      netDem: expectedD - expectedR,
    })
  }
  rows.sort((a, b) => b.netDem - a.netDem || a.name.localeCompare(b.name))
  return {
    total,
    expectedDem,
    expectedRep,
    marginVotes: expectedDem - expectedRep,
    marginPoints: total === 0 ? 0 : (100 * (expectedDem - expectedRep)) / total,
    counties: rows,
  }
}

type Pair = Map<string, { dem: number; rep: number }>
type Early = Map<string, number>

function readCsv(name: string): Record<string, string>[] {
  const path = fileURLToPath(new URL(`../data/mi/${name}`, import.meta.url))
  return parse(readFileSync(path, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[]
}

function loadEarly(file: string, column: string): Early {
  const totals = new Map<string, number>()
  for (const row of readCsv(file)) {
    const key = countyKey(row.county)
    if (totals.has(key)) throw new Error(`duplicate county ${key} in ${file}`)
    totals.set(key, Number(row[column]))
  }
  return totals
}

function loadMargins(file: string): Pair {
  const margins = new Map<string, { dem: number; rep: number }>()
  for (const row of readCsv(file)) {
    const key = countyKey(row.county)
    margins.set(key, { dem: Number(row.dem), rep: Number(row.rep) })
  }
  return margins
}

export function weight(early: Early, margins: Pair): CountyWeight[] {
  const counties: CountyWeight[] = []
  const keys = new Set([...early.keys(), ...margins.keys()])
  for (const key of [...keys].sort()) {
    const votes = early.get(key)
    const margin = margins.get(key)
    if (votes === undefined) throw new Error(`no early vote for ${key}`)
    if (margin === undefined) throw new Error(`no margin for ${key}`)
    counties.push({ name: key, early: votes, dem: margin.dem, rep: margin.rep })
  }
  return counties
}

type CycleRow = {
  cycle: string
  weights: string
  result: Expectation
  shiftVs2024: number | null
  shiftVs2022: number | null
}

function main(): void {
  const early2026 = loadEarly("uf_mi_county_2026.csv", "voted_all")
  const early2024 = loadEarly("uf_mi_county_2024.csv", "voted_all")
  const early2022 = loadEarly("sos_2022_av_received_by_county.csv", "ballots_received")
  const pres = loadMargins("medsl_mi_president_2024.csv")
  const gov = loadMargins("governor_2022_county.csv")

  const y2026 = expectParty(weight(early2026, pres))
  const y2024 = expectParty(weight(early2024, pres))
  const y2022pres = expectParty(weight(early2022, pres))
  const y2022gov = expectParty(weight(early2022, gov))

  const cycles: CycleRow[] = [
    { cycle: "2026", weights: "2024 president", result: y2026, shiftVs2024: y2026.marginPoints - y2024.marginPoints, shiftVs2022: y2026.marginPoints - y2022pres.marginPoints },
    { cycle: "2024", weights: "2024 president", result: y2024, shiftVs2024: 0, shiftVs2022: y2024.marginPoints - y2022pres.marginPoints },
    { cycle: "2022", weights: "2024 president", result: y2022pres, shiftVs2024: y2022pres.marginPoints - y2024.marginPoints, shiftVs2022: 0 },
    { cycle: "2022", weights: "2022 governor", result: y2022gov, shiftVs2024: null, shiftVs2022: null },
  ]

  const lines = [
    "Michigan expected early-vote party makeup",
    "Each early ballot is split by that county's two-party share. Expected D plus expected R equals the early-vote total.",
    "Margin is expected Democratic votes minus expected Republican votes. A positive margin point is Democratic.",
    "Shifts compare margin points. The 2024-president rows are the apples-to-apples composition comparison.",
    "2026 and 2024 early totals are UF voted_all. 2026 is the November 2, 2026 file. 2022 is absentee ballots received as of October 31, 2022.",
    "",
    "cycle  weights          total EV    exp R    exp D   margin votes  margin pts  vs 2024 pts  vs 2022 pts",
  ]
  for (const row of cycles) {
    const result = row.result
    lines.push(
      [
        row.cycle.padEnd(6),
        row.weights.padEnd(16),
        fmtInt(result.total).padStart(10),
        fmtInt(result.expectedRep).padStart(8),
        fmtInt(result.expectedDem).padStart(8),
        fmtInt(result.marginVotes).padStart(14),
        fmtPts(result.marginPoints).padStart(12),
        fmtPts(row.shiftVs2024).padStart(12),
        fmtPts(row.shiftVs2022).padStart(12),
      ].join(" "),
    )
  }
  lines.push("", "Top 10 counties by expected net Democratic votes, 2026 early vote times 2024 presidential share")
  lines.push("county            early     net D")
  for (const county of y2026.counties.slice(0, 10)) {
    lines.push(`${county.name.padEnd(16)} ${fmtInt(county.early).padStart(8)} ${fmtInt(county.netDem).padStart(9)}`)
  }
  process.stdout.write(`${lines.join("\n")}\n`)
}

function fmtInt(value: number): string {
  const rounded = Math.round(value)
  const text = Math.abs(rounded).toLocaleString("en-US")
  return rounded < 0 ? `-${text}` : text
}

function fmtPts(value: number | null): string {
  if (value === null) return ""
  const text = Math.abs(value).toFixed(2)
  if (value > 0) return `D+${text}`
  if (value < 0) return `R+${text}`
  return "0.00"
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) main()
