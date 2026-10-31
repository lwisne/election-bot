import { spawn } from "node:child_process"
import { createWriteStream, existsSync } from "node:fs"
import { readFileSync } from "node:fs"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"
import { parse } from "csv-parse/sync"
import { readSosEarly } from "./compare.ts"

const MEDSL_ZIP =
  "https://raw.githubusercontent.com/MEDSL/2022-elections-official/main/individual_states/2022-tx-local-precinct-general.zip"
const PRESIDENT_2024 = "https://api.electiondata.dev/v1/county-president/table/2024.csv"
const PRESIDENT_2020 = "https://api.electiondata.dev/v1/county-president/table/2020.csv"

type TwoParty = { rep: number; dem: number }

export type CountyBacktest = {
  name: string
  early2022: number
  early2024: number
  fixedMargin: number
  margin2022: number
  margin2024: number
  weight2022: number
  weight2024: number
}

export type Decomposition = {
  margin2022Points: number
  margin2024Points: number
  actualShiftPoints: number
  betweenPoints: number
  withinPoints: number
  interactionPoints: number
  withinMovers: {
    name: string
    marginChangePoints: number
    withinPoints: number
  }[]
}

export function countyKey(name: string): string {
  let trimmed = name.trim().toUpperCase()
  const suffix = " COUNTY"
  if (trimmed.endsWith(suffix)) trimmed = trimmed.slice(0, -suffix.length)
  return trimmed.replaceAll(" ", "")
}

export function compositionShiftPoints(counties: readonly { early2022: number; early2024: number; fixedMargin: number }[]): number {
  const early2022 = sum(counties.map((county) => county.early2022))
  const early2024 = sum(counties.map((county) => county.early2024))
  let shift = 0
  for (const county of counties) {
    const share2022 = county.early2022 / early2022
    const share2024 = county.early2024 / early2024
    shift += county.fixedMargin * (share2024 - share2022)
  }
  return shift * 100
}

export function decompose(counties: readonly CountyBacktest[]): Decomposition {
  const margin2022 = sum(counties.map((county) => county.margin2022 * county.weight2022))
  const margin2024 = sum(counties.map((county) => county.margin2024 * county.weight2024))
  const between = sum(counties.map((county) => county.margin2022 * (county.weight2024 - county.weight2022)))
  const within = sum(counties.map((county) => (county.margin2024 - county.margin2022) * county.weight2022))
  const interaction = sum(
    counties.map((county) => (county.margin2024 - county.margin2022) * (county.weight2024 - county.weight2022)),
  )
  const movers = counties
    .map((county) => ({
      name: county.name,
      marginChangePoints: (county.margin2024 - county.margin2022) * 100,
      withinPoints: (county.margin2024 - county.margin2022) * county.weight2022 * 100,
    }))
    .sort((a, b) => Math.abs(b.withinPoints) - Math.abs(a.withinPoints))
  return {
    margin2022Points: margin2022 * 100,
    margin2024Points: margin2024 * 100,
    actualShiftPoints: (margin2024 - margin2022) * 100,
    betweenPoints: between * 100,
    withinPoints: within * 100,
    interactionPoints: interaction * 100,
    withinMovers: movers,
  }
}

async function main(): Promise<void> {
  const early2022 = readSosEarly(readFileSync(new URL("../data/tx/2022-general-early.csv", import.meta.url), "utf8"))
  const early2024 = readSosEarly(readFileSync(new URL("../data/tx/2024-general-early.csv", import.meta.url), "utf8"))
  const [president2024, president2020, governor] = await Promise.all([
    fetchCsv(PRESIDENT_2024),
    fetchCsv(PRESIDENT_2020),
    loadGovernor(),
  ])
  const pres2024 = readPresident(president2024, "2024")
  const pres2020 = readPresident(president2020, "2020")
  const panel = join(early2022.counties, early2024.counties, governor.votes, pres2024.votes, pres2020.votes)

  const govMargins = panel.map((county) => ({
    early2022: county.early2022,
    early2024: county.early2024,
    fixedMargin: county.margin2022,
  }))
  const presMargins = panel.map((county) => ({
    early2022: county.early2022,
    early2024: county.early2024,
    fixedMargin: county.margin2020,
  }))
  const predictedGov = compositionShiftPoints(govMargins)
  const predictedPres = compositionShiftPoints(presMargins)
  const actual = decompose(panel)

  const lines = [
    "Texas early-vote composition backtest, 2022 to 2024",
    "Predicted shift holds county partisanship fixed and changes only each county's share of early vote.",
    "It is not a forecast of how counties voted. It is the composition piece alone.",
    "",
    "Sources",
    "Early vote: Texas Secretary of State cumulative county reports, committed in data/tx.",
    "2022 file is the last early-voting day, 2022-11-04. 2024 file is 2024-11-01.",
    "The early total is Cumulative In-Person And Mail Voters. 2022 Hale in-person is 369 at the source and is kept.",
    "2022 governor: MIT Election Data and Science Lab precinct file, Texas VTD general, office GOVERNOR.",
    "https://github.com/MEDSL/2022-elections-official individual_states/2022-tx-local-precinct-general.zip",
    "Two-party votes are Abbott (Republican) and O'Rourke (Democrat). Other candidates are excluded.",
    "2020 and 2024 president: MIT county presidential returns, CC0, via api.electiondata.dev table/2020.csv and table/2024.csv.",
    "Harvard Dataverse doi:10.7910/DVN/VOQCHQ. Two-party votes are the Republican and Democratic candidate rows.",
    "",
    `Counties joined: ${panel.length}`,
    `2022 governor two-party votes: Abbott ${formatInt(sum(panel.map((c) => c.rep2022)))}, O'Rourke ${formatInt(sum(panel.map((c) => c.dem2022)))}`,
    `2024 president two-party votes: Republican ${formatInt(sum(panel.map((c) => c.rep2024)))}, Democratic ${formatInt(sum(panel.map((c) => c.dem2024)))}`,
    "",
    "Predicted composition shift of the early-vote electorate, 2022 weights to 2024 weights",
    `Fixed at 2022 governor margins: ${formatParty(predictedGov)}`,
    `Fixed at 2020 presidential margins: ${formatParty(predictedPres)}`,
    "",
    "Actual statewide two-party margin, (Republican - Democratic) / (Republican + Democratic)",
    `2022 governor: ${formatParty(actual.margin2022Points)}`,
    `2024 president: ${formatParty(actual.margin2024Points)}`,
    `Actual shift, 2024 president minus 2022 governor: ${formatParty(actual.actualShiftPoints)}`,
    "",
    "All-ballot gap, 100 * (Republican - Democratic) / all ballots. This is the R+10.9 and R+13.7 scale.",
    `2022 governor: ${formatParty(100 * (sum(panel.map((c) => c.rep2022)) - sum(panel.map((c) => c.dem2022))) / governor.allVotes)}`,
    `2024 president: ${formatParty(100 * (sum(panel.map((c) => c.rep2024)) - sum(panel.map((c) => c.dem2024))) / pres2024.allVotes)}`,
    "",
    "Decomposition of that actual shift. Shares are each county's share of statewide two-party votes, not early votes.",
    `Between counties, 2022 margins times the change in final-vote share: ${formatParty(actual.betweenPoints)}`,
    `Within counties, margin change times the 2022 final-vote share: ${formatParty(actual.withinPoints)}`,
    `Interaction, margin change times share change: ${formatParty(actual.interactionPoints)}`,
    `Sum of the three parts: ${formatParty(actual.betweenPoints + actual.withinPoints + actual.interactionPoints)}`,
    "",
    "Largest within-county contributions to the actual statewide shift",
    "county  margin_change_pts  within_pts",
    ...actual.withinMovers.slice(0, 10).map((county) =>
      `${county.name.padEnd(16)} ${formatSigned(county.marginChangePoints).padStart(8)} ${formatSigned(county.withinPoints).padStart(10)}`,
    ),
    "",
    "Michigan early-vote backtest skipped. UF publishes a 2024 Michigan county early file and no 2020 or 2022 county early file.",
  ]
  process.stdout.write(`${lines.join("\n")}\n`)
}

type PanelCounty = CountyBacktest & {
  margin2020: number
  rep2022: number
  dem2022: number
  rep2024: number
  dem2024: number
}

function join(
  early2022: Map<string, { name: string; total: number }>,
  early2024: Map<string, { name: string; total: number }>,
  governor: Map<string, TwoParty>,
  president2024: Map<string, TwoParty>,
  president2020: Map<string, TwoParty>,
): PanelCounty[] {
  const keys = [...early2022.keys()].sort()
  const rows: PanelCounty[] = []
  for (const key of keys) {
    const base = early2022.get(key)
    const target = early2024.get(key)
    const gov = governor.get(key)
    const pres24 = president2024.get(key)
    const pres20 = president2020.get(key)
    if (!base || !target || !gov || !pres24 || !pres20) {
      throw new Error(`missing join for ${key}`)
    }
    rows.push({
      name: target.name,
      early2022: base.total,
      early2024: target.total,
      fixedMargin: margin(gov.rep, gov.dem),
      margin2022: margin(gov.rep, gov.dem),
      margin2024: margin(pres24.rep, pres24.dem),
      margin2020: margin(pres20.rep, pres20.dem),
      weight2022: 0,
      weight2024: 0,
      rep2022: gov.rep,
      dem2022: gov.dem,
      rep2024: pres24.rep,
      dem2024: pres24.dem,
    })
  }
  const twoParty2022 = sum(rows.map((county) => county.rep2022 + county.dem2022))
  const twoParty2024 = sum(rows.map((county) => county.rep2024 + county.dem2024))
  for (const county of rows) {
    county.weight2022 = (county.rep2022 + county.dem2022) / twoParty2022
    county.weight2024 = (county.rep2024 + county.dem2024) / twoParty2024
  }
  return rows
}

function margin(rep: number, dem: number): number {
  if (rep + dem === 0) throw new Error("two-party total is 0")
  return (rep - dem) / (rep + dem)
}

function readPresident(text: string, year: string): { votes: Map<string, TwoParty>; allVotes: number } {
  const votes = new Map<string, TwoParty>()
  const seenTotal = new Set<string>()
  let allVotes = 0
  for (const row of parseRows(text)) {
    if (row.state_po !== "TX" || row.year !== year) continue
    const key = countyKey(row.county_name ?? "")
    if (!seenTotal.has(key)) {
      seenTotal.add(key)
      const total = Number(row.totalvotes)
      if (!Number.isFinite(total)) throw new Error(`bad totalvotes for ${key} ${year}`)
      allVotes += total
    }
    if (row.party !== "DEMOCRAT" && row.party !== "REPUBLICAN") continue
    let entry = votes.get(key)
    if (!entry) {
      entry = { rep: 0, dem: 0 }
      votes.set(key, entry)
    }
    const count = Number(row.candidatevotes)
    if (!Number.isFinite(count)) throw new Error(`bad votes for ${key} ${year}`)
    if (row.party === "REPUBLICAN") entry.rep += count
    else entry.dem += count
  }
  return { votes, allVotes }
}

async function loadGovernor(): Promise<{ votes: Map<string, TwoParty>; allVotes: number }> {
  const zipPath = "/tmp/election-bot-2022-tx-precinct.zip"
  if (!existsSync(zipPath)) {
    const response = await fetch(MEDSL_ZIP, { headers: { "User-Agent": "election-bot/0.1" } })
    if (response.status !== 200 || !response.body) {
      throw new Error(`${MEDSL_ZIP} returned ${response.status}`)
    }
    await pipeline(response.body, createWriteStream(zipPath))
  }
  const csvText = await unzip(zipPath, "TX-cleaned.csv")
  const votes = new Map<string, TwoParty>()
  let allVotes = 0
  for (const row of parseRows(csvText)) {
    if (row.office !== "GOVERNOR" || row.mode !== "TOTAL") continue
    const count = Number(row.votes)
    if (!Number.isFinite(count)) throw new Error(`bad governor votes for ${row.county_name}`)
    allVotes += count
    if (row.candidate !== "ABBOTT" && row.candidate !== "O'ROURKE") continue
    const key = countyKey(row.county_name ?? "")
    let entry = votes.get(key)
    if (!entry) {
      entry = { rep: 0, dem: 0 }
      votes.set(key, entry)
    }
    if (row.candidate === "ABBOTT") entry.rep += count
    else entry.dem += count
  }
  return { votes, allVotes }
}

function unzip(zipPath: string, entry: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("unzip", ["-p", zipPath, entry])
    const chunks: Buffer[] = []
    let errorText = ""
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => {
      errorText += chunk.toString("utf8")
    })
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`unzip ${entry} exited ${code}: ${errorText}`))
      else resolve(Buffer.concat(chunks).toString("utf8"))
    })
  })
}

async function fetchCsv(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": "election-bot/0.1" } })
  if (response.status !== 200) throw new Error(`${url} returned ${response.status}`)
  return response.text()
}

function parseRows(text: string): Record<string, string>[] {
  return parse(text, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as Record<string, string>[]
}

function sum(values: number[]): number {
  let total = 0
  for (const value of values) total += value
  return total
}

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

function formatSigned(value: number): string {
  const text = Math.abs(value).toFixed(2)
  if (value > 0) return `+${text}`
  if (value < 0) return `-${text}`
  return "0.00"
}

function formatParty(points: number): string {
  const magnitude = Math.abs(points).toFixed(2)
  if (Math.abs(points) < 0.005) return "even"
  return points > 0 ? `R+${magnitude}` : `D+${magnitude}`
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
