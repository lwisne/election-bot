// Public contract. src/compare.ts implements it.

export type CountyCompare = {
  name: string
  early2026: number
  baseline: number
  ratio: number
  index: number
  marginPoints: number
  shareChangePoints: number
  contributionPoints: number
  flag?: string
}

export type CompareRead = {
  state: string
  asOf: string
  baselineYear: number
  baselineAsOf: string
  early2026: number
  baseline: number
  statewideRatio: number
  baselineMarginPoints: number
  impliedMarginPoints: number
  shiftPoints: number
  counties: readonly CountyCompare[]
}

export type CountyInput = {
  name: string
  early2026: number
  baseline: number
  rep: number
  dem: number
  flag?: string
}

export function rankCounties(input: {
  state: string
  asOf: string
  baselineYear: number
  baselineAsOf: string
  counties: readonly CountyInput[]
}): CompareRead {
  // index = (early2026 / baseline) / (sum2026 / sumBaseline).
  // marginPoints = 100 * (rep - dem) / (rep + dem). Positive is Republican.
  // shiftPoints = implied 2026 margin minus baseline margin, weights only.
  // contributionPoints sum to shiftPoints.
  // Sort by index descending, then name ascending.
  throw new Error("not implemented")
}

export function compareEarly(state: string): Promise<readonly CompareRead[]> {
  // Fetch the county CSVs, the 2026 statewide CSV, and the MEDSL presidential file.
  // Join on the normalized county name. Call rankCounties.
  throw new Error("not implemented")
}
