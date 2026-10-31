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
  const header = ["rank", "county", "early_2026", baselineHeader, "ratio", "index", "margin"]
  const rows = read.counties.map((county, index) => [
    String(index + 1),
    county.name,
    formatGrouped(county.early2026),
    formatGrouped(county.baseline),
    county.ratio.toFixed(3),
    county.index.toFixed(3),
    formatMargin(county.margin),
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
    `2026 ${formatGrouped(read.early2026)}  ${read.baselineYear} ${formatGrouped(read.baseline)}  ratio ${read.statewideRatio.toFixed(3)}  margin-weighted extra ${formatGrouped(read.marginWeightedExtra)}`,
  ]
  for (const county of read.counties) {
    if (county.flag) lines.push(`flag ${county.name}: ${county.flag}. Kept in the ranking.`)
  }
  lines.push(line(header), ...rows.map(line))
  return lines.join("\n")
}

function formatGrouped(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

function formatMargin(value: number): string {
  const text = value.toFixed(3)
  return value > 0 ? `+${text}` : text
}
