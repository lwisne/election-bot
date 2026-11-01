import assert from "node:assert/strict"
import { test } from "node:test"
import { actualMargin, averageRace } from "./senate2018.ts"

test("keeps the latest poll per pollster inside the three-week window", () => {
  const result = averageRace([
    { race: "AZ", pollster: "A", end: "2018-10-01", dem: 40, gop: 50 },
    { race: "AZ", pollster: "A", end: "2018-10-20", dem: 48, gop: 47 },
    { race: "AZ", pollster: "A", end: "2018-10-20", dem: 50, gop: 45 },
    { race: "AZ", pollster: "B", end: "2018-11-05", dem: 51, gop: 46 },
    { race: "AZ", pollster: "C", end: "2018-11-06", dem: 90, gop: 1 },
  ])
  assert.ok(result)
  assert.equal(result.n, 2)
  // Pollster A’s same-day polls average to (1 + 5) / 2 = 3. Pollster B is 5. Mean is 4.
  assert.ok(Math.abs(result.margin - 4) < 1e-9)
})

test("California uses the two Democrats when there is no Republican", () => {
  const margin = actualMargin([
    { party: "DEMOCRAT", votes: 60, name: "Feinstein" },
    { party: "DEMOCRAT", votes: 40, name: "de Leon" },
  ])
  assert.ok(margin)
  assert.equal(margin.dem, "Feinstein")
  assert.equal(margin.gop, "de Leon")
  assert.ok(Math.abs(margin.margin - 20) < 1e-9)
})

test("Maine uses the independent when that candidate leads the Democrat", () => {
  const margin = actualMargin([
    { party: "OTHER", votes: 300, name: "King" },
    { party: "DEMOCRAT", votes: 60, name: "Ringelstein" },
    { party: "REPUBLICAN", votes: 200, name: "Brakey" },
  ])
  assert.ok(margin)
  assert.equal(margin.dem, "King")
  assert.equal(margin.gop, "Brakey")
  assert.ok(Math.abs(margin.margin - 20) < 1e-9)
})
