// Public contract. src/compare.ts implements it.

export type CountyCompare = {
  name: string
  early2026: number
  early2024: number
  ratio: number
  index: number
  margin: number
}

export type CompareRead = {
  state: string
  asOf: string
  early2026: number
  early2024: number
  statewideRatio: number
  marginWeightedExtra: number
  counties: readonly CountyCompare[]
}

export type CountyInput = {
  name: string
  early2026: number
  early2024: number
  rep: number
  dem: number
}

export function rankCounties(input: {
  state: string
  asOf: string
  counties: readonly CountyInput[]
}): CompareRead {
  // index = (early2026 / early2024) / (sum2026 / sum2024).
  // margin = (rep - dem) / (rep + dem).
  // marginWeightedExtra = sum((early2026 - statewideRatio * early2024) * margin).
  // Sort by index descending, then name ascending.
  throw new Error("not implemented")
}

export function compareEarly(state: string): Promise<CompareRead> {
  // Fetch the county CSVs, the 2026 statewide CSV, and the MEDSL presidential file.
  // Join on the normalized county name. Call rankCounties.
  throw new Error("not implemented")
}
