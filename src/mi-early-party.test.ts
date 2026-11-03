import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parse } from "csv-parse/sync"
import { test } from "node:test"
import { expectParty } from "./mi-early-party.ts"

test("splits each county's early votes by its two-party share", () => {
  const result = expectParty([
    { name: "A", early: 100, dem: 60, rep: 40 },
    { name: "B", early: 100, dem: 30, rep: 70 },
  ])
  assert.equal(result.total, 200)
  assert.ok(Math.abs(result.expectedDem - 90) < 1e-9)
  assert.ok(Math.abs(result.expectedRep - 110) < 1e-9)
  assert.ok(Math.abs(result.marginVotes - -20) < 1e-9)
  assert.ok(Math.abs(result.marginPoints - -10) < 1e-9)
  assert.deepEqual(
    result.counties.map((county) => county.name),
    ["A", "B"],
  )
  assert.ok(Math.abs(result.counties[0].netDem - 20) < 1e-9)
  assert.ok(Math.abs(result.counties[1].netDem - -40) < 1e-9)
})

test("2022 absentee county file matches the SOS sheet total", () => {
  const path = fileURLToPath(new URL("../data/mi/sos_2022_av_received_by_county.csv", import.meta.url))
  const rows = parse(readFileSync(path, "utf8"), { columns: true, skip_empty_lines: true, trim: true }) as { ballots_received: string }[]
  const total = rows.reduce((sum, row) => sum + Number(row.ballots_received), 0)
  assert.equal(rows.length, 83)
  assert.equal(total, 1126246)
})
