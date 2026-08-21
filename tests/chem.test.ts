import { describe, expect, it } from 'vitest'
import { CHEMICALS, findChemical } from '../src/lib/chem/chemicals'
import { equivalentWeight, prepare, stockStrength } from '../src/lib/chem/solution'
import type { Chemical } from '../src/lib/chem/chemicals'

const oxalic = findChemical('oxalic')!
const naoh = findChemical('naoh')!
const kmno4 = findChemical('kmno4')!
const hcl = findChemical('hcl')!
const h2so4 = findChemical('h2so4')!

describe('equivalent weight', () => {
  it('divides the molar mass by the n-factor', () => {
    // 126.07 / 2 — the classic N/10 oxalic acid figure of 63.035
    expect(equivalentWeight(oxalic)).toBeCloseTo(63.035, 3)
    expect(equivalentWeight(naoh)).toBeCloseTo(40, 3)
    // KMnO4 in acid: 158.03 / 5
    expect(equivalentWeight(kmno4)).toBeCloseTo(31.606, 3)
  })

  it('refuses a zero n-factor rather than dividing by it', () => {
    expect(() => equivalentWeight({ ...oxalic, nFactor: 0 })).toThrow(/n-factor/)
  })
})

describe('solid preparation', () => {
  it('matches the worked N/10 oxalic acid in 1 L', () => {
    const result = prepare({
      chemical: oxalic,
      mode: 'normality',
      strength: 0.1,
      volumeMl: 1000,
      correctForAssay: false,
    })
    expect(result.kind).toBe('solid')
    if (result.kind !== 'solid') return
    // 0.1 × 63.035 × 1 = 6.3035 g
    expect(result.weighGrams).toBeCloseTo(6.3035, 4)
  })

  it('scales with the volume', () => {
    const half = prepare({
      chemical: oxalic,
      mode: 'normality',
      strength: 0.1,
      volumeMl: 250,
      correctForAssay: false,
    })
    if (half.kind !== 'solid') return
    expect(half.weighGrams).toBeCloseTo(1.5759, 4)
  })

  it('weighs out more when the bottle is not pure', () => {
    const pure = prepare({ chemical: naoh, mode: 'normality', strength: 0.1, volumeMl: 1000, correctForAssay: false })
    const real = prepare({ chemical: naoh, mode: 'normality', strength: 0.1, volumeMl: 1000, correctForAssay: true })
    if (pure.kind !== 'solid' || real.kind !== 'solid') return
    expect(pure.weighGrams).toBeCloseTo(4, 4)
    // 4 / 0.97 for a 97% bottle
    expect(real.weighGrams).toBeCloseTo(4.1237, 4)
    expect(real.weighGrams).toBeGreaterThan(pure.weighGrams)
  })

  it('uses the molar mass for molarity, not the equivalent weight', () => {
    const molar = prepare({ chemical: kmno4, mode: 'molarity', strength: 0.1, volumeMl: 1000, correctForAssay: false })
    const normal = prepare({ chemical: kmno4, mode: 'normality', strength: 0.1, volumeMl: 1000, correctForAssay: false })
    if (molar.kind !== 'solid' || normal.kind !== 'solid') return
    expect(molar.weighGrams).toBeCloseTo(15.803, 3)
    expect(normal.weighGrams).toBeCloseTo(3.1606, 4)
    // n-factor 5, so the two differ by exactly that
    expect(molar.weighGrams / normal.weighGrams).toBeCloseTo(5, 6)
  })
})

describe('concentrated liquids', () => {
  it('works out the strength of the bottle', () => {
    // (10 × 35 × 1.18) / 36.46 = 11.33 N
    expect(stockStrength(hcl).normality).toBeCloseTo(11.327, 2)
    // (10 × 98 × 1.84) / 49.04 = 36.77 N
    expect(stockStrength(h2so4).normality).toBeCloseTo(36.77, 2)
    // …which is half that in molarity, H2SO4 being diprotic
    expect(stockStrength(h2so4).molarity).toBeCloseTo(18.385, 2)
    expect(stockStrength(h2so4).normality / stockStrength(h2so4).molarity).toBeCloseTo(2, 6)
  })

  it('refuses a solid', () => {
    expect(() => stockStrength(naoh)).toThrow(/liquid/)
  })

  it('dilutes by V1N1 = V2N2', () => {
    const result = prepare({ chemical: hcl, mode: 'normality', strength: 0.1, volumeMl: 1000, correctForAssay: false })
    expect(result.kind).toBe('liquid')
    if (result.kind !== 'liquid') return
    // (0.1 × 1000) / 11.327 = 8.83 mL
    expect(result.takeMl).toBeCloseTo(8.828, 2)
    expect(result.waterMl).toBeCloseTo(1000 - 8.828, 2)
  })

  it('tells the user to add acid to water', () => {
    const result = prepare({ chemical: h2so4, mode: 'normality', strength: 1, volumeMl: 500, correctForAssay: false })
    expect(result.steps.join(' ')).toContain('acid to water')
  })
})

describe('input guards', () => {
  it('rejects a strength or volume of zero', () => {
    const base = { chemical: oxalic, mode: 'normality' as const, correctForAssay: false }
    expect(() => prepare({ ...base, strength: 0, volumeMl: 1000 })).toThrow(/Strength/)
    expect(() => prepare({ ...base, strength: 0.1, volumeMl: 0 })).toThrow(/Volume/)
  })
})

describe('reference data', () => {
  it('gives every reagent a usable molar mass and n-factor', () => {
    for (const c of CHEMICALS as Chemical[]) {
      expect(c.molarMass, c.name).toBeGreaterThan(0)
      expect(c.nFactor, c.name).toBeGreaterThan(0)
      expect(c.assay, c.name).toBeGreaterThan(0)
      expect(c.assay, c.name).toBeLessThanOrEqual(100)
    }
  })

  it('gives every liquid a specific gravity, since the maths needs one', () => {
    for (const c of CHEMICALS.filter((x) => x.state === 'liquid')) {
      expect(c.specificGravity, c.name).toBeGreaterThan(0)
    }
  })

  it('uses unique ids', () => {
    const ids = CHEMICALS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
