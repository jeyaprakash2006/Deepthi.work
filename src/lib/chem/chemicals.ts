/**
 * Reference data for lab reagents.
 *
 * IMPORTANT: the n-factor is not a property of the compound alone — it depends
 * on the reaction. KMnO4 is 5 in acid and 3 in neutral or alkaline medium;
 * Na2CO3 is 2 to methyl orange but 1 to phenolphthalein. The values below are
 * the common teaching-lab case, and every one of them is editable in the app.
 * Check them against your own manual before preparing anything.
 */

export type ChemState = 'solid' | 'liquid'

export interface Chemical {
  id: string
  name: string
  formula: string
  /** g/mol */
  molarMass: number
  /** Equivalents per mole for the reaction this reagent is normally used in. */
  nFactor: number
  state: ChemState
  /** Purity as supplied, percent. */
  assay: number
  /** Liquids only — g/mL, needed to turn a bottle percentage into normality. */
  specificGravity?: number
  /** Where the n-factor comes from, shown beside the field. */
  note?: string
}

export const CHEMICALS: Chemical[] = [
  // ---- Acidimetry / alkalimetry standards -------------------------------
  { id: 'oxalic', name: 'Oxalic acid dihydrate', formula: 'H₂C₂O₄·2H₂O', molarMass: 126.07, nFactor: 2, state: 'solid', assay: 99.5, note: 'Diprotic — 2 replaceable H⁺' },
  { id: 'khp', name: 'Potassium hydrogen phthalate', formula: 'KHC₈H₄O₄', molarMass: 204.22, nFactor: 1, state: 'solid', assay: 99.9, note: 'Primary standard for alkali' },
  { id: 'naoh', name: 'Sodium hydroxide', formula: 'NaOH', molarMass: 40.0, nFactor: 1, state: 'solid', assay: 97, note: 'Hygroscopic — standardise after preparing' },
  { id: 'koh', name: 'Potassium hydroxide', formula: 'KOH', molarMass: 56.11, nFactor: 1, state: 'solid', assay: 85 },
  { id: 'na2co3', name: 'Sodium carbonate (anhydrous)', formula: 'Na₂CO₃', molarMass: 105.99, nFactor: 2, state: 'solid', assay: 99.5, note: '2 to methyl orange, 1 to phenolphthalein' },
  { id: 'nahco3', name: 'Sodium bicarbonate', formula: 'NaHCO₃', molarMass: 84.01, nFactor: 1, state: 'solid', assay: 99 },
  { id: 'borax', name: 'Borax', formula: 'Na₂B₄O₇·10H₂O', molarMass: 381.37, nFactor: 2, state: 'solid', assay: 99.5 },
  { id: 'caco3', name: 'Calcium carbonate', formula: 'CaCO₃', molarMass: 100.09, nFactor: 2, state: 'solid', assay: 99 },

  // ---- Redox -----------------------------------------------------------
  { id: 'kmno4', name: 'Potassium permanganate', formula: 'KMnO₄', molarMass: 158.03, nFactor: 5, state: 'solid', assay: 99, note: '5 in acidic medium, 3 in neutral/alkaline' },
  { id: 'k2cr2o7', name: 'Potassium dichromate', formula: 'K₂Cr₂O₇', molarMass: 294.18, nFactor: 6, state: 'solid', assay: 99.9, note: 'Primary standard' },
  { id: 'mohr', name: 'Ferrous ammonium sulphate (Mohr’s salt)', formula: 'FeSO₄(NH₄)₂SO₄·6H₂O', molarMass: 392.14, nFactor: 1, state: 'solid', assay: 99 },
  { id: 'na2s2o3', name: 'Sodium thiosulphate', formula: 'Na₂S₂O₃·5H₂O', molarMass: 248.18, nFactor: 1, state: 'solid', assay: 99.5 },
  { id: 'kio3', name: 'Potassium iodate', formula: 'KIO₃', molarMass: 214.0, nFactor: 6, state: 'solid', assay: 99.5 },
  { id: 'iodine', name: 'Iodine (resublimed)', formula: 'I₂', molarMass: 253.81, nFactor: 2, state: 'solid', assay: 99.5 },
  { id: 'na2c2o4', name: 'Sodium oxalate', formula: 'Na₂C₂O₄', molarMass: 133.99, nFactor: 2, state: 'solid', assay: 99.5 },

  // ---- Complexometry / precipitation ------------------------------------
  { id: 'edta', name: 'EDTA disodium salt', formula: 'C₁₀H₁₄N₂Na₂O₈·2H₂O', molarMass: 372.24, nFactor: 2, state: 'solid', assay: 99, note: 'Usually made up as molarity' },
  { id: 'agno3', name: 'Silver nitrate', formula: 'AgNO₃', molarMass: 169.87, nFactor: 1, state: 'solid', assay: 99.9 },
  { id: 'nacl', name: 'Sodium chloride', formula: 'NaCl', molarMass: 58.44, nFactor: 1, state: 'solid', assay: 99.9 },
  { id: 'znso4', name: 'Zinc sulphate heptahydrate', formula: 'ZnSO₄·7H₂O', molarMass: 287.56, nFactor: 2, state: 'solid', assay: 99 },

  // ---- Concentrated liquids ---------------------------------------------
  { id: 'hcl', name: 'Hydrochloric acid (conc.)', formula: 'HCl', molarMass: 36.46, nFactor: 1, state: 'liquid', assay: 35, specificGravity: 1.18 },
  { id: 'h2so4', name: 'Sulphuric acid (conc.)', formula: 'H₂SO₄', molarMass: 98.08, nFactor: 2, state: 'liquid', assay: 98, specificGravity: 1.84 },
  { id: 'hno3', name: 'Nitric acid (conc.)', formula: 'HNO₃', molarMass: 63.01, nFactor: 1, state: 'liquid', assay: 69, specificGravity: 1.41 },
  { id: 'ch3cooh', name: 'Acetic acid (glacial)', formula: 'CH₃COOH', molarMass: 60.05, nFactor: 1, state: 'liquid', assay: 99.5, specificGravity: 1.05 },
  { id: 'h3po4', name: 'Orthophosphoric acid', formula: 'H₃PO₄', molarMass: 98.0, nFactor: 3, state: 'liquid', assay: 85, specificGravity: 1.69 },
  { id: 'nh4oh', name: 'Ammonia solution', formula: 'NH₄OH', molarMass: 35.05, nFactor: 1, state: 'liquid', assay: 25, specificGravity: 0.91 },
]

export function findChemical(id: string): Chemical | undefined {
  return CHEMICALS.find((c) => c.id === id)
}
