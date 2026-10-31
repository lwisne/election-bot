import assert from "node:assert/strict"
import { test } from "node:test"
import { rankCounties } from "./compare.ts"

// Expected values are computed from the design formula, not copied from a run.
test("ranks counties by index, then name", () => {
  const read = rankCounties({
    state: "MI",
    asOf: "10/30/2026",
    counties: [
      { name: "A", early2026: 60, early2024: 100, rep: 75, dem: 25 },
      { name: "B", early2026: 40, early2024: 100, rep: 30, dem: 50 },
      { name: "C", early2026: 50, early2024: 100, rep: 40, dem: 40 },
    ],
  })

  assert.equal(read.state, "MI")
  assert.equal(read.asOf, "10/30/2026")
  assert.equal(read.early2026, 150)
  assert.equal(read.early2024, 300)
  assert.equal(read.statewideRatio, 0.5)
  assert.equal(read.marginWeightedExtra, 7.5)
  assert.deepEqual(read.counties, [
    { name: "A", early2026: 60, early2024: 100, ratio: 0.6, index: 1.2, margin: 0.5 },
    { name: "C", early2026: 50, early2024: 100, ratio: 0.5, index: 1, margin: 0 },
    { name: "B", early2026: 40, early2024: 100, ratio: 0.4, index: 0.8, margin: -0.25 },
  ])
})

test("breaks index ties by name", () => {
  const read = rankCounties({
    state: "MI",
    asOf: "10/30/2026",
    counties: [
      { name: "C", early2026: 10, early2024: 100, rep: 1, dem: 1 },
      { name: "B", early2026: 80, early2024: 100, rep: 1, dem: 1 },
      { name: "A", early2026: 10, early2024: 100, rep: 1, dem: 1 },
    ],
  })

  assert.deepEqual(
    read.counties.map((county) => county.name),
    ["B", "A", "C"],
  )
})

test("throws when early2024 is 0", () => {
  assert.throws(
    () =>
      rankCounties({
        state: "MI",
        asOf: "10/30/2026",
        counties: [{ name: "A", early2026: 10, early2024: 0, rep: 3, dem: 2 }],
      }),
    /early2024 is 0 for A/,
  )
})

test("throws when rep + dem is 0", () => {
  assert.throws(
    () =>
      rankCounties({
        state: "MI",
        asOf: "10/30/2026",
        counties: [{ name: "A", early2026: 10, early2024: 10, rep: 0, dem: 0 }],
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
        counties: [
          { name: "A", early2026: 10, early2024: 10, rep: 1, dem: 1 },
          { name: "A", early2026: 12, early2024: 10, rep: 1, dem: 1 },
        ],
      }),
    /duplicate county A/,
  )
})
