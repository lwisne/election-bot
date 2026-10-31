// Public contract. src/compare.ts implements it.

export type CountyCompare = {
  name: string
  early2026: number
  baseline: number
  ratio: number
  index: number
  margin: number
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
  marginWeightedExtra: number
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
  // margin = (rep - dem) / (rep + dem).
  // marginWeightedExtra = sum((early2026 - statewideRatio * baseline) * margin).
  // Sort by index descending, then name ascending.
  throw new Error("not implemented")
}

export function compareEarly(state: string): Promise<readonly CompareRead[]> {
  // Fetch the county CSVs, the 2026 statewide CSV, and the MEDSL presidential file.
  // Join on the normalized county name. Call rankCounties.
  throw new Error("not implemented")
}
