import assert from "node:assert/strict"
import { test } from "node:test"
import { compositionShiftPoints, decompose, type CountyBacktest } from "./backtest.ts"

test("composition shift uses early-vote shares and a fixed margin", () => {
  const shift = compositionShiftPoints([
    { early2022: 100, early2024: 100, fixedMargin: 0.2 },
    { early2022: 100, early2024: 300, fixedMargin: -0.1 },
  ])
  assert.ok(Math.abs(shift - -7.5) < 1e-9)
})

test("actual shift splits into between, within, and interaction", () => {
  const counties: CountyBacktest[] = [
    {
      name: "A",
      early2022: 100,
      early2024: 100,
      fixedMargin: 0.2,
      margin2022: 0.2,
      margin2024: 0.4,
      weight2022: 0.5,
      weight2024: 0.5,
    },
    {
      name: "B",
      early2022: 100,
      early2024: 300,
      fixedMargin: -0.1,
      margin2022: -0.2,
      margin2024: -0.1,
      weight2022: 0.5,
      weight2024: 0.5,
    },
  ]
  const result = decompose(counties)
  assert.ok(Math.abs(result.margin2022Points) < 1e-9)
  assert.ok(Math.abs(result.margin2024Points - 15) < 1e-9)
  assert.ok(Math.abs(result.actualShiftPoints - 15) < 1e-9)
  assert.ok(Math.abs(result.betweenPoints) < 1e-9)
  assert.ok(Math.abs(result.withinPoints - 15) < 1e-9)
  assert.ok(Math.abs(result.interactionPoints) < 1e-9)
  assert.ok(
    Math.abs(result.betweenPoints + result.withinPoints + result.interactionPoints - result.actualShiftPoints) < 1e-9,
  )
  assert.equal(result.withinMovers[0].name, "A")
})
