import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parse } from "csv-parse/sync"

const WINDOW_START = "2018-10-16"
const WINDOW_END = "2018-11-05"

const POSTAL: Record<string, string> = {
  Arizona: "AZ",
  California: "CA",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Hawaii: "HI",
  Indiana: "IN",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Dakota": "ND",
  Ohio: "OH",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
}

export type PollObs = {
  race: string
  pollster: string
  end: string
  dem: number
  gop: number
}

export type RaceAverage = { margin: number; n: number }

export function averageRace(polls: readonly PollObs[], start = WINDOW_START, end = WINDOW_END): RaceAverage | null {
  const inWindow = polls.filter((poll) => poll.end >= start && poll.end <= end)
  const latest = new Map<string, string>()
  for (const poll of inWindow) {
    const prev = latest.get(poll.pollster)
    if (prev === undefined || poll.end > prev) latest.set(poll.pollster, poll.end)
  }
  const byPollster = new Map<string, number[]>()
  for (const poll of inWindow) {
    if (poll.end !== latest.get(poll.pollster)) continue
    const margins = byPollster.get(poll.pollster) ?? []
    margins.push(poll.dem - poll.gop)
    byPollster.set(poll.pollster, margins)
  }
  if (byPollster.size === 0) return null
  const pollsterMargins = [...byPollster.values()].map((margins) => margins.reduce((sum, margin) => sum + margin, 0) / margins.length)
  const margin = pollsterMargins.reduce((sum, value) => sum + value, 0) / pollsterMargins.length
  return { margin, n: pollsterMargins.length }
}

type Candidate = { party: string; votes: number; name: string }

export function actualMargin(candidates: readonly Candidate[]): { margin: number; dem: string; gop: string } | null {
  const major = candidates.filter((candidate) => candidate.party === "DEMOCRAT" || candidate.party === "REPUBLICAN" || candidate.party === "OTHER" || candidate.party === "INDEPENDENT")
  const republicans = major.filter((candidate) => candidate.party === "REPUBLICAN")
  const others = major.filter((candidate) => candidate.party !== "REPUBLICAN")
  if (others.length === 0) return null
  const ranked = [...others].sort((a, b) => b.votes - a.votes)
  const dem = ranked[0]
  const gop = republicans.sort((a, b) => b.votes - a.votes)[0] ?? ranked[1]
  if (!gop || dem.name === gop.name) return null
  return { margin: (100 * (dem.votes - gop.votes)) / (dem.votes + gop.votes), dem: dem.name, gop: gop.name }
}

function dataFile(name: string): string {
  return fileURLToPath(new URL(`../data/polls/2018/${name}`, import.meta.url))
}

function rows(name: string): Record<string, string>[] {
  return parse(readFileSync(dataFile(name), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[]
}

export function loadElectoralVote(): PollObs[] {
  const polls: PollObs[] = []
  for (const row of rows("electoral_vote_senate_polls.csv")) {
    if (row.Pollster.startsWith("Election")) continue
    const end = parseMonthDay(row.Date)
    const dem = Number(row.Dem)
    const gop = Number(row.GOP)
    if (!end || !Number.isFinite(dem) || !Number.isFinite(gop)) continue
    polls.push({
      race: raceFromEv(row.State),
      pollster: row.Pollster.replace(/-\d+$/, ""),
      end,
      dem,
      gop,
    })
  }
  return polls
}

export function loadFiveThirtyEight(): PollObs[] {
  const questions = new Map<string, { race: string; pollster: string; end: string; pcts: { party: string; pct: number }[] }>()
  for (const row of rows("fte_senate_polls_2018.csv")) {
    if (row.stage !== "general" && row.stage !== "jungle primary") continue
    if (row.hypothetical === "true" || row.internal === "true") continue
    if (row.partisan === "DEM" || row.partisan === "REP") continue
    const end = parseSlashDate(row.end_date)
    if (!end) continue
    const pct = Number(row.pct)
    if (!Number.isFinite(pct)) continue
    const race = raceFromFte(row.state, row.seat_name)
    let question = questions.get(row.question_id)
    if (!question) {
      question = { race, pollster: row.display_name, end, pcts: [] }
      questions.set(row.question_id, question)
    }
    question.pcts.push({ party: row.party, pct })
  }
  const polls: PollObs[] = []
  for (const question of questions.values()) {
    const sides = matchup(question.pcts)
    if (!sides) continue
    polls.push({ race: question.race, pollster: question.pollster, end: question.end, dem: sides.dem, gop: sides.gop })
  }
  return polls
}

function matchup(pcts: readonly { party: string; pct: number }[]): { dem: number; gop: number } | null {
  const reps = pcts.filter((candidate) => candidate.party === "REP")
  const others = pcts.filter((candidate) => candidate.party !== "REP")
  if (reps.length > 0 && others.length > 0) {
    return {
      dem: Math.max(...others.map((candidate) => candidate.pct)),
      gop: Math.max(...reps.map((candidate) => candidate.pct)),
    }
  }
  const ranked = [...pcts].sort((a, b) => b.pct - a.pct)
  if (ranked.length < 2) return null
  return { dem: ranked[0].pct, gop: ranked[1].pct }
}

export function loadActual(): Map<string, { margin: number; dem: string; gop: string }> {
  const byRace = new Map<string, Candidate[]>()
  for (const row of rows("medsl_senate_2018.csv")) {
    if (row.mode !== "total" || row.writein === "True") continue
    const race = row.special === "True" ? `${row.state_po}-special` : row.state_po
    const list = byRace.get(race) ?? []
    list.push({ party: row.party_simplified, votes: Number(row.candidatevotes), name: row.candidate })
    byRace.set(race, list)
  }
  const margins = new Map<string, { margin: number; dem: string; gop: string }>()
  for (const [race, candidates] of byRace) {
    const margin = actualMargin(candidates)
    if (margin) margins.set(race, margin)
  }
  return margins
}

export type RaceRow = {
  race: string
  ev: RaceAverage | null
  fte: RaceAverage | null
  actual: number | null
  evError: number | null
  fteError: number | null
}

export function buildTable(ev: readonly PollObs[], fte: readonly PollObs[], actual: ReadonlyMap<string, { margin: number }>): RaceRow[] {
  const races = new Set<string>([...ev.map((poll) => poll.race), ...fte.map((poll) => poll.race), ...actual.keys()])
  const table: RaceRow[] = []
  for (const race of [...races].sort()) {
    const evAvg = averageRace(ev.filter((poll) => poll.race === race))
    const fteAvg = averageRace(fte.filter((poll) => poll.race === race))
    const actualMargin = actual.get(race)?.margin ?? null
    table.push({
      race,
      ev: evAvg,
      fte: fteAvg,
      actual: actualMargin,
      evError: evAvg && actualMargin !== null ? evAvg.margin - actualMargin : null,
      fteError: fteAvg && actualMargin !== null ? fteAvg.margin - actualMargin : null,
    })
  }
  return table
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function raceFromEv(state: string): string {
  if (state.endsWith("-special")) {
    const postal = POSTAL[state.slice(0, -"-special".length)]
    if (!postal) throw new Error(`unknown state ${state}`)
    return `${postal}-special`
  }
  const postal = POSTAL[state]
  if (!postal) throw new Error(`unknown state ${state}`)
  return postal
}

function raceFromFte(state: string, seat: string): string {
  const postal = POSTAL[state]
  if (!postal) throw new Error(`unknown state ${state}`)
  return seat === "Class II" ? `${postal}-special` : postal
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
}

function parseMonthDay(value: string): string | null {
  const match = /^([A-Za-z]+)\s+(\d{1,2})$/.exec(value.trim())
  if (!match) return null
  const month = MONTHS[match[1].slice(0, 3)]
  if (!month) return null
  return `2018-${month}-${match[2].padStart(2, "0")}`
}

function parseSlashDate(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(value.trim())
  if (!match) return null
  return `20${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`
}

function fmt(value: number | null): string {
  if (value === null) return ""
  const text = Math.abs(value).toFixed(1)
  if (value > 0) return `D+${text}`
  if (value < 0) return `R+${text}`
  return "0.0"
}

function summary(label: string, errors: number[]): string {
  const bias = mean(errors)
  const abs = mean(errors.map((error) => Math.abs(error)))
  if (bias === null || abs === null) return `${label}: no races`
  return `${label}: n=${errors.length}  mean error ${fmt(bias)}  mean absolute error ${abs.toFixed(1)}`
}

function main(): void {
  const ev = loadElectoralVote()
  const fte = loadFiveThirtyEight()
  const actual = loadActual()
  const table = buildTable(ev, fte, actual)
  const lines = [
    "2018 Senate polling average, 2018-10-16 through 2018-11-05",
    "One poll per pollster, most recent end date. Margin is Democratic percentage minus Republican percentage.",
    "Error is the polling average minus the actual margin. Positive means the polls were too Democratic.",
    "",
    "race         EV     n   FTE     n   actual  EV error  FTE error",
  ]
  for (const row of table) {
    lines.push(
      [
        row.race.padEnd(12),
        fmt(row.ev?.margin ?? null).padStart(6),
        String(row.ev?.n ?? "").padStart(3),
        fmt(row.fte?.margin ?? null).padStart(6),
        String(row.fte?.n ?? "").padStart(3),
        fmt(row.actual).padStart(8),
        fmt(row.evError).padStart(9),
        fmt(row.fteError).padStart(10),
      ].join(" "),
    )
  }
  const evErrors = table.flatMap((row) => (row.evError === null ? [] : [row.evError]))
  const fteErrors = table.flatMap((row) => (row.fteError === null ? [] : [row.fteError]))
  const overlap = table.flatMap((row) => (row.ev && row.fte ? [row.ev.margin - row.fte.margin] : []))
  lines.push(
    "",
    summary("Electoral Vote", evErrors),
    summary("FiveThirtyEight", fteErrors),
    `Sources overlap on ${overlap.length} races. Mean EV minus FTE is ${fmt(mean(overlap))}.`,
    "Mississippi-special actual margin is Hyde-Smith vs Espy only. MEDSL has no third candidate, so it is not the November 6 jungle.",
  )
  process.stdout.write(`${lines.join("\n")}\n`)
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) main()
