/**
 * Solution Preparation — pick a reagent, say how strong and how much, and get
 * the weight to put on the balance.
 *
 * Every reference number stays editable. A bottle of NaOH is rarely the purity
 * printed in a textbook, and the n-factor depends on the reaction, so the app
 * offers a sensible default and then gets out of the way.
 */
import { useMemo, useState } from 'react'
import { CHEMICALS } from '../../lib/chem/chemicals'
import type { Chemical } from '../../lib/chem/chemicals'
import { prepare, stockStrength } from '../../lib/chem/solution'
import type { Concentration } from '../../lib/chem/solution'

const VOLUME_PRESETS = [100, 250, 500, 1000, 2000]
const STRENGTH_PRESETS = [0.02, 0.05, 0.1, 0.5, 1]

function fmt(value: number, places = 4): string {
  if (!Number.isFinite(value)) return '—'
  return Number(value.toFixed(places)).toString()
}

export function SolutionPrep() {
  const [id, setId] = useState(CHEMICALS[0].id)
  const [mode, setMode] = useState<Concentration>('normality')
  const [strength, setStrength] = useState('0.1')
  const [volume, setVolume] = useState('1000')
  const [correctForAssay, setCorrectForAssay] = useState(true)

  // Local copies, so a corrected purity or n-factor never edits the reference
  // list under another user's feet.
  const [overrides, setOverrides] = useState<Record<string, Partial<Chemical>>>({})

  const base = CHEMICALS.find((c) => c.id === id)!
  const chemical: Chemical = { ...base, ...overrides[id] }
  const edited = Boolean(overrides[id] && Object.keys(overrides[id]).length > 0)

  const patch = (change: Partial<Chemical>) =>
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...change } }))

  const result = useMemo(() => {
    try {
      return {
        value: prepare({
          chemical,
          mode,
          strength: Number(strength),
          volumeMl: Number(volume),
          correctForAssay,
        }),
        error: null as string | null,
      }
    } catch (err) {
      return { value: null, error: err instanceof Error ? err.message : 'Could not work that out' }
    }
  }, [chemical, mode, strength, volume, correctForAssay])

  const stock = chemical.state === 'liquid' && chemical.specificGravity ? stockStrength(chemical) : null

  return (
    <div className="prep">
      <section className="prep__panel">
        <h2 className="prep__heading">What are you making?</h2>

        <label className="field">
          <span className="field__label">Reagent</span>
          <select className="select" value={id} onChange={(e) => setId(e.target.value)}>
            <optgroup label="Solids">
              {CHEMICALS.filter((c) => c.state === 'solid').map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.formula}
                </option>
              ))}
            </optgroup>
            <optgroup label="Concentrated liquids">
              {CHEMICALS.filter((c) => c.state === 'liquid').map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.formula}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <div className="field">
          <span className="field__label">Express the strength as</span>
          <div className="seg">
            <button className={mode === 'normality' ? 'on' : ''} onClick={() => setMode('normality')}>
              Normality (N)
            </button>
            <button className={mode === 'molarity' ? 'on' : ''} onClick={() => setMode('molarity')}>
              Molarity (M)
            </button>
          </div>
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">Strength ({mode === 'normality' ? 'N' : 'M'})</span>
            <input
              className="input input--sm"
              inputMode="decimal"
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Final volume (mL)</span>
            <input
              className="input input--sm"
              inputMode="decimal"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          </label>
        </div>

        <div className="prep__presets">
          {STRENGTH_PRESETS.map((s) => (
            <button key={s} className={`chip${Number(strength) === s ? ' chip--on' : ''}`} onClick={() => setStrength(String(s))}>
              {s} {mode === 'normality' ? 'N' : 'M'}
            </button>
          ))}
        </div>
        <div className="prep__presets">
          {VOLUME_PRESETS.map((v) => (
            <button key={v} className={`chip${Number(volume) === v ? ' chip--on' : ''}`} onClick={() => setVolume(String(v))}>
              {v} mL
            </button>
          ))}
        </div>

        <h2 className="prep__heading prep__heading--rule">
          Reference values
          {edited && (
            <button className="linkish" onClick={() => setOverrides((p) => ({ ...p, [id]: {} }))}>
              reset to book values
            </button>
          )}
        </h2>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">Molar mass (g/mol)</span>
            <input
              className="input input--sm"
              inputMode="decimal"
              value={chemical.molarMass}
              onChange={(e) => patch({ molarMass: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field__label">n-factor</span>
            <input
              className="input input--sm"
              inputMode="decimal"
              value={chemical.nFactor}
              onChange={(e) => patch({ nFactor: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field__label">Assay / purity (%)</span>
            <input
              className="input input--sm"
              inputMode="decimal"
              value={chemical.assay}
              onChange={(e) => patch({ assay: Number(e.target.value) })}
            />
          </label>
          {chemical.state === 'liquid' && (
            <label className="field">
              <span className="field__label">Specific gravity</span>
              <input
                className="input input--sm"
                inputMode="decimal"
                value={chemical.specificGravity ?? ''}
                onChange={(e) => patch({ specificGravity: Number(e.target.value) })}
              />
            </label>
          )}
        </div>

        {chemical.note && <p className="field__note">⚗ {chemical.note}</p>}

        {chemical.state === 'solid' && (
          <label className="checkbox">
            <input type="checkbox" checked={correctForAssay} onChange={(e) => setCorrectForAssay(e.target.checked)} />
            Correct the weight for the bottle’s purity
          </label>
        )}
      </section>

      <section className="prep__result">
        {result.error ? (
          <p className="note note--error">{result.error}</p>
        ) : result.value?.kind === 'solid' ? (
          <>
            <div className="prep__headline">
              <span className="prep__number">{fmt(result.value.weighGrams)}</span>
              <span className="prep__unit">grams</span>
            </div>
            <p className="prep__sub">
              of {chemical.name} in {volume} mL — {strength} {mode === 'normality' ? 'N' : 'M'}
            </p>
            <dl className="prep__facts">
              <div>
                <dt>Equivalent weight</dt>
                <dd>{fmt(result.value.equivalentWeight)} g/eq</dd>
              </div>
              <div>
                <dt>Theoretical (100% pure)</dt>
                <dd>{fmt(result.value.theoreticalGrams)} g</dd>
              </div>
            </dl>
          </>
        ) : result.value ? (
          <>
            <div className="prep__headline">
              <span className="prep__number">{fmt(result.value.takeMl, 3)}</span>
              <span className="prep__unit">mL of concentrate</span>
            </div>
            <p className="prep__sub">
              made up to {volume} mL — {strength} {mode === 'normality' ? 'N' : 'M'} {chemical.name}
            </p>
            <dl className="prep__facts">
              <div>
                <dt>Bottle strength</dt>
                <dd>
                  {fmt(stock?.normality ?? 0, 2)} N · {fmt(stock?.molarity ?? 0, 2)} M
                </dd>
              </div>
              <div>
                <dt>Water (approx.)</dt>
                <dd>{fmt(result.value.waterMl, 1)} mL</dd>
              </div>
            </dl>
          </>
        ) : null}

        {result.value && (
          <>
            <h3 className="prep__heading prep__heading--rule">How to make it</h3>
            <ol className="prep__steps">
              {result.value.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <button
              type="button"
              className="btn btn--auto"
              onClick={() => navigator.clipboard?.writeText(result.value!.steps.join('\n'))}
            >
              Copy the method
            </button>
          </>
        )}
      </section>
    </div>
  )
}
