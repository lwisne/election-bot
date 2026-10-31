import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { rankCounties, readSosEarly } from "./compare.ts"

// Expected values are computed from the design formula, not copied from a run.
test("ranks counties by index, then name", () => {
  const read = rankCounties({
    state: "MI",
    asOf: "10/30/2026",
    baselineYear: 2024,
    baselineAsOf: "11/5/2024",
    counties: [
      { name: "A", early2026: 60, baseline: 100, rep: 75, dem: 25 },
      { name: "B", early2026: 40, baseline: 100, rep: 30, dem: 50 },
      { name: "C", early2026: 50, baseline: 100, rep: 40, dem: 40 },
    ],
  })

  assert.equal(read.state, "MI")
  assert.equal(read.asOf, "10/30/2026")
  assert.equal(read.baselineYear, 2024)
  assert.equal(read.early2026, 150)
  assert.equal(read.baseline, 300)
  assert.equal(read.statewideRatio, 0.5)
  assert.equal(read.marginWeightedExtra, 7.5)
  assert.deepEqual(read.counties, [
    { name: "A", early2026: 60, baseline: 100, ratio: 0.6, index: 1.2, margin: 0.5 },
    { name: "C", early2026: 50, baseline: 100, ratio: 0.5, index: 1, margin: 0 },
    { name: "B", early2026: 40, baseline: 100, ratio: 0.4, index: 0.8, margin: -0.25 },
  ])
})

test("breaks index ties by name", () => {
  const read = rankCounties({
    state: "MI",
    asOf: "10/30/2026",
    baselineYear: 2024,
    baselineAsOf: "11/5/2024",
    counties: [
      { name: "C", early2026: 10, baseline: 100, rep: 1, dem: 1 },
      { name: "B", early2026: 80, baseline: 100, rep: 1, dem: 1 },
      { name: "A", early2026: 10, baseline: 100, rep: 1, dem: 1 },
    ],
  })

  assert.deepEqual(
    read.counties.map((county) => county.name),
    ["B", "A", "C"],
  )
})

test("throws when baseline is 0", () => {
  assert.throws(
    () =>
      rankCounties({
        state: "MI",
        asOf: "10/30/2026",
        baselineYear: 2024,
        baselineAsOf: "11/5/2024",
        counties: [{ name: "A", early2026: 10, baseline: 0, rep: 3, dem: 2 }],
      }),
    /baseline is 0 for A/,
  )
})

test("throws when rep + dem is 0", () => {
  assert.throws(
    () =>
      rankCounties({
        state: "MI",
        asOf: "10/30/2026",
        baselineYear: 2024,
        baselineAsOf: "11/5/2024",
        counties: [{ name: "A", early2026: 10, baseline: 10, rep: 0, dem: 0 }],
      }),
    /rep \+ dem is 0 for A/,
  )
})

test("throws when two rows share a name", () => {
  assert.throws(
    () =>
      rankCounties({
        state: "MI",
        asOf: "10/30/2026",
        baselineYear: 2024,
        baselineAsOf: "11/5/2024",
        counties: [
          { name: "A", early2026: 10, baseline: 10, rep: 1, dem: 1 },
          { name: "A", early2026: 12, baseline: 10, rep: 1, dem: 1 },
        ],
      }),
    /duplicate county A/,
  )
})

test("keeps a Hale flag on the ranked row", () => {
  const read = rankCounties({
    state: "TX",
    asOf: "10/30/2026",
    baselineYear: 2022,
    baselineAsOf: "2022-11-04",
    counties: [
      {
        name: "HALE",
        early2026: 10,
        baseline: 20,
        rep: 3,
        dem: 1,
        flag: "2022 SOS cumulative in-person is 369",
      },
      { name: "BEXAR", early2026: 30, baseline: 40, rep: 1, dem: 2 },
    ],
  })

  const hale = read.counties.find((county) => county.name === "HALE")
  assert.equal(hale?.flag, "2022 SOS cumulative in-person is 369")
  assert.equal(read.counties.find((county) => county.name === "BEXAR")?.flag, undefined)
})

test("SOS total row is a checksum and Hale 369 is flagged", () => {
  const header =
    "County,Registered Voters,# In Person On 11/04/2022,Cumulative In-Person Voters,Cumulative % In-Person,Cumulative By Mail Voters,Cumulative In-Person And Mail Voters,Cumulative Percent Early Voting,is_total_row,report_date,election"
  const text = [
    header,
    "HALE,10,0,369,2%,1,579,3%,N,2022-11-04,general",
    "BEXAR,10,1,10,1%,1,11,1%,N,2022-11-04,general",
    "TOTAL,20,1,379,1%,2,590,1%,Y,2022-11-04,general",
  ].join("\n")
  const sos = readSosEarly(text)
  assert.equal(sos.asOf, "2022-11-04")
  assert.equal(sos.total, 590)
  assert.equal(sos.counties.size, 2)
  assert.equal(sos.counties.get("HALE")?.total, 579)
  assert.equal(sos.counties.get("HALE")?.name, "HALE")
  assert.equal(sos.flags.get("HALE"), "2022 SOS cumulative in-person is 369")
  assert.equal(sos.flags.has("BEXAR"), false)
})

test("committed Texas baselines have 254 counties and flag only 2022 Hale", () => {
  const file2024 = readFileSync(new URL("../data/tx/2024-general-early.csv", import.meta.url), "utf8")
  const file2022 = readFileSync(new URL("../data/tx/2022-general-early.csv", import.meta.url), "utf8")
  const sos2024 = readSosEarly(file2024)
  const sos2022 = readSosEarly(file2022)
  assert.equal(sos2024.counties.size, 254)
  assert.equal(sos2022.counties.size, 254)
  assert.equal(sos2024.asOf, "2024-11-01")
  assert.equal(sos2022.asOf, "2022-11-04")
  assert.equal(sos2024.total, 9058436)
  assert.equal(sos2022.total, 5497027)
  assert.equal(sos2024.flags.size, 0)
  assert.deepEqual([...sos2022.flags.keys()], ["HALE"])
  assert.equal(sos2022.counties.get("HALE")?.total, 579)
  assert.equal(sos2024.counties.has("LASALLE"), true)
  assert.equal(sos2022.counties.has("LASALLE"), true)
  assert.equal(sos2024.counties.get("DEAF SMITH".replaceAll(" ", ""))?.name, "DEAF SMITH")
})
