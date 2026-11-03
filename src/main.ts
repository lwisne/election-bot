import { compareEarly, type CompareRead } from "./compare.ts"

const args = process.argv.slice(2)
if (args.length !== 1 || args[0].startsWith("-")) {
  process.stderr.write("expected one state abbreviation\n")
  process.exitCode = 1
} else {
  try {
    const reads = await compareEarly(args[0])
    process.stdout.write(reads.map(render).join("\n"))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}

function render(read: CompareRead): string {
  return `${renderTable(read)}\n\n${JSON.stringify(read, null, 2)}\n`
}

function renderTable(read: CompareRead): string {
  const baselineHeader = `early_${read.baselineYear}`
  const header = ["rank", "county", "early_2026", baselineHeader, "ratio", "index", "margin_pts"]
  const rows = read.counties.map((county, index) => [
    String(index + 1),
    county.name,
    formatGrouped(county.early2026),
    formatGrouped(county.baseline),
    county.ratio.toFixed(3),
    county.index.toFixed(3),
    formatSigned(county.marginPoints),
  ])
  const widths = header.map((label, column) => {
    let width = label.length
    for (const row of rows) width = Math.max(width, row[column].length)
    return width
  })
  const alignRight = [true, false, true, true, true, true, true]
  const line = (cells: string[]) =>
    cells
      .map((cell, column) =>
        alignRight[column] ? cell.padStart(widths[column]) : cell.padEnd(widths[column]),
      )
      .join("  ")

  const lines = [
    `${read.state} early vote vs ${read.baselineYear} final`,
    `as of ${read.asOf}. baseline as of ${read.baselineAsOf}`,
    `2026 ${formatGrouped(read.early2026)}  ${read.baselineYear} ${formatGrouped(read.baseline)}  ratio ${read.statewideRatio.toFixed(3)}`,
    "Composition, holding each county's 2024 two-party margin fixed. This is which counties are voting, not how a county votes.",
    `Baseline electorate ${formatParty(read.baselineMarginPoints)}`,
    `Implied 2026 electorate ${formatParty(read.impliedMarginPoints)}`,
    `Shift ${formatParty(read.shiftPoints)}`,
  ]
  for (const county of read.counties) {
    if (county.flag) lines.push(`flag ${county.name}: ${county.flag}. Kept in the ranking.`)
  }
  lines.push(
    "",
    "Toward R, largest contributions to the shift",
    contributorTable(toward(read.counties, "R")),
    "",
    "Toward D, largest contributions to the shift",
    contributorTable(toward(read.counties, "D")),
    "",
    line(header),
    ...rows.map(line),
  )
  return lines.join("\n")
}

function toward(counties: readonly CompareRead["counties"][number][], direction: "R" | "D") {
  const filtered = counties.filter((county) =>
    direction === "R" ? county.contributionPoints > 0 : county.contributionPoints < 0,
  )
  filtered.sort((a, b) =>
    direction === "R" ? b.contributionPoints - a.contributionPoints : a.contributionPoints - b.contributionPoints,
  )
  return filtered.slice(0, 10)
}

function contributorTable(counties: readonly CompareRead["counties"][number][]): string {
  const header = ["rank", "county", "share_change_pts", "contribution_pts", "margin_pts"]
  const rows = counties.map((county, index) => [
    String(index + 1),
    county.name,
    formatSigned(county.shareChangePoints),
    formatSigned(county.contributionPoints),
    formatSigned(county.marginPoints),
  ])
  const widths = header.map((label, column) => {
    let width = label.length
    for (const row of rows) width = Math.max(width, row[column].length)
    return width
  })
  const alignRight = [true, false, true, true, true]
  const line = (cells: string[]) =>
    cells
      .map((cell, column) =>
        alignRight[column] ? cell.padStart(widths[column]) : cell.padEnd(widths[column]),
      )
      .join("  ")
  return [line(header), ...rows.map(line)].join("\n")
}

function formatGrouped(value: number): string {
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
