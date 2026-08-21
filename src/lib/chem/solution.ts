/**
 * Solution preparation arithmetic.
 *
 * Pure functions, no rounding until the very end — the numbers here decide what
 * gets weighed out, so every step is testable on its own.
 */
import type { Chemical } from './chemicals'

export type Concentration = 'normality' | 'molarity'

export interface PrepRequest {
  chemical: Chemical
  mode: Concentration
  /** N or M, as chosen by `mode`. */
  strength: number
  /** Final volume to prepare, in mL. */
  volumeMl: number
  /** Correct the weight for the purity printed on the bottle. */
  correctForAssay: boolean
}

export interface SolidPrep {
  kind: 'solid'
  equivalentWeight: number
  /** Weight of the pure substance the strength calls for. */
  theoreticalGrams: number
  /** What to actually weigh, once the bottle's purity is taken into account. */
  weighGrams: number
  steps: string[]
}

export interface LiquidPrep {
  kind: 'liquid'
  equivalentWeight: number
  /** Strength of the concentrated bottle, worked out from assay and density. */
  stockNormality: number
  stockMolarity: number
  /** How much of the concentrated acid to measure out, in mL. */
  takeMl: number
  /** Roughly how much water it goes into. */
  waterMl: number
  steps: string[]
}

export type PrepResult = SolidPrep | LiquidPrep

export function equivalentWeight(chemical: Chemical): number {
  if (chemical.nFactor <= 0) throw new Error('n-factor must be greater than zero')
  return chemical.molarMass / chemical.nFactor
}

/**
 * Strength of a concentrated liquid reagent.
 *
 *   normality = (10 × assay% × specific gravity) ÷ equivalent weight
 *
 * The 10 converts "grams per 100 g of solution" into grams per litre.
 */
export function stockStrength(chemical: Chemical): { normality: number; molarity: number } {
  if (chemical.state !== 'liquid' || !chemical.specificGravity) {
    throw new Error('Stock strength applies to concentrated liquids only')
  }
  const gramsPerLitre = 10 * chemical.assay * chemical.specificGravity
  return {
    normality: gramsPerLitre / equivalentWeight(chemical),
    molarity: gramsPerLitre / chemical.molarMass,
  }
}

function round(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

export function prepare(request: PrepRequest): PrepResult {
  const { chemical, mode, strength, volumeMl, correctForAssay } = request
  if (strength <= 0) throw new Error('Strength must be greater than zero')
  if (volumeMl <= 0) throw new Error('Volume must be greater than zero')

  const litres = volumeMl / 1000
  const eq = equivalentWeight(chemical)

  if (chemical.state === 'solid') {
    // Normality works on equivalents, molarity on moles — that is the only
    // difference between the two.
    const perLitre = mode === 'normality' ? strength * eq : strength * chemical.molarMass
    const theoretical = perLitre * litres
    const weigh = correctForAssay && chemical.assay > 0 ? theoretical / (chemical.assay / 100) : theoretical

    return {
      kind: 'solid',
      equivalentWeight: eq,
      theoreticalGrams: theoretical,
      weighGrams: weigh,
      steps: [
        `Equivalent weight = ${chemical.molarMass} ÷ ${chemical.nFactor} = ${round(eq, 4)} g/eq`,
        mode === 'normality'
          ? `Weight = N × Eq. wt × V(L) = ${strength} × ${round(eq, 4)} × ${round(litres, 4)} = ${round(theoretical, 4)} g`
          : `Weight = M × Molar mass × V(L) = ${strength} × ${chemical.molarMass} × ${round(litres, 4)} = ${round(theoretical, 4)} g`,
        correctForAssay && chemical.assay > 0
          ? `Corrected for ${chemical.assay}% purity → ${round(theoretical, 4)} ÷ ${chemical.assay / 100} = ${round(weigh, 4)} g`
          : 'No purity correction applied.',
        `Weigh ${round(weigh, 4)} g accurately, dissolve in a little distilled water,`,
        `then make up to ${volumeMl} mL in a standard flask and mix well.`,
      ],
    }
  }

  const stock = stockStrength(chemical)
  const stockStrengthValue = mode === 'normality' ? stock.normality : stock.molarity
  // V1 N1 = V2 N2, solved for the volume of concentrate to take.
  const takeMl = (strength * volumeMl) / stockStrengthValue

  return {
    kind: 'liquid',
    equivalentWeight: eq,
    stockNormality: stock.normality,
    stockMolarity: stock.molarity,
    takeMl,
    waterMl: Math.max(0, volumeMl - takeMl),
    steps: [
      `Equivalent weight = ${chemical.molarMass} ÷ ${chemical.nFactor} = ${round(eq, 4)} g/eq`,
      `Stock strength = (10 × ${chemical.assay}% × ${chemical.specificGravity}) ÷ ${
        mode === 'normality' ? `${round(eq, 4)}` : `${chemical.molarMass}`
      } = ${round(stockStrengthValue, 4)} ${mode === 'normality' ? 'N' : 'M'}`,
      `V₁ = (${strength} × ${volumeMl}) ÷ ${round(stockStrengthValue, 4)} = ${round(takeMl, 3)} mL`,
      `Take about half the flask of distilled water first, add ${round(takeMl, 3)} mL of the acid slowly`,
      `down the side, swirl, cool, then make up to ${volumeMl} mL.`,
      'Always add acid to water, never water to acid.',
    ],
  }
}
