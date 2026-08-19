/** Hybrid Input Workspace (PRD v1.1 §3.2) — one slot, two ways to fill it. */
import { useRef, useState } from 'react'
import type { Item } from '../types'
import { ACCEPTED } from '../lib/extract'
import { Segmented } from './Segmented'
import {
  BadgeCheckIcon,
  BotIcon,
  ClipboardIcon,
  FileUpIcon,
  PencilIcon,
  TrashIcon,
} from './Icons'

interface Props {
  item: Item
  index: number
  canRemove: boolean
  onPatch: (patch: Partial<Item>) => void
  onFile: (file: File) => void
  onParse: () => void
  onEdit: () => void
  onRemove: () => void
}

export function ItemCard({
  item,
  index,
  canRemove,
  onPatch,
  onFile,
  onParse,
  onEdit,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const questionCount =
    item.paper?.parts.reduce((n, p) => n + p.questions.length, 0) ?? 0

  const dropClass = [
    'dropzone',
    dragOver ? 'is-over' : '',
    item.error ? 'is-error' : item.fileName ? 'is-done' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="item" aria-label={item.title}>
      <header className="item__head">
        <input
          className="item__name"
          value={item.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          aria-label={`Name for item ${index + 1}`}
        />
        {canRemove && (
          <button
            type="button"
            className="icon-btn"
            onClick={onRemove}
            aria-label={`Remove ${item.title}`}
            title="Remove"
          >
            <TrashIcon size={17} />
          </button>
        )}
      </header>

      <Segmented
        ariaLabel={`Input mode for ${item.title}`}
        size="sm"
        value={item.mode}
        onChange={(mode) => onPatch({ mode })}
        options={[
          { value: 'file', label: 'File Upload', icon: <FileUpIcon size={15} /> },
          { value: 'text', label: 'Paste Text', icon: <ClipboardIcon size={15} /> },
        ]}
      />

      <div className="item__body">
        {item.mode === 'file' ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onFile(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className={dropClass}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) onFile(file)
              }}
            >
              <FileUpIcon size={22} />
              <div className="dropzone__title">
                {item.fileName ?? 'Drop a file or click to browse'}
              </div>
              <div className="dropzone__hint">
                {item.fileName
                  ? `${item.fileKind?.toUpperCase()} · click to replace`
                  : 'PDF · DOCX · TXT · PNG · JPG'}
              </div>
            </button>

            {item.imageUrl && (
              <img className="item__thumb" src={item.imageUrl} alt={`Preview of ${item.fileName}`} />
            )}
          </>
        ) : (
          <textarea
            className="textarea"
            rows={8}
            value={item.rawText}
            placeholder={'Paste unformatted questions or notes here...'}
            onChange={(e) =>
              onPatch({
                rawText: e.target.value,
                status: e.target.value.trim() ? 'raw' : 'empty',
                paper: undefined,
                error: undefined,
              })
            }
          />
        )}

        {item.busy && (
          <div className="busy">
            <span className="spinner" />
            {item.busy}
          </div>
        )}

        {item.error && <p className="note note--error">{item.error}</p>}

        {!item.busy && item.mode === 'file' && item.rawText && !item.paper && (
          <p className="note">
            {item.rawText.length.toLocaleString()} characters extracted — ready to parse.
          </p>
        )}
      </div>

      {item.paper ? (
        <>
          <button type="button" className="btn" onClick={onEdit}>
            <PencilIcon size={16} />
            Edit Structured Data
          </button>
          {item.status === 'approved' ? (
            <span className="badge badge--ready">
              <BadgeCheckIcon size={16} />
              Ready for generation
            </span>
          ) : (
            <span className="badge badge--review">
              {questionCount} question{questionCount === 1 ? '' : 's'} — review needed
            </span>
          )}
        </>
      ) : (
        <button
          type="button"
          className="btn"
          onClick={onParse}
          disabled={!item.rawText.trim() || Boolean(item.busy)}
        >
          <BotIcon size={16} />
          Parse &amp; Format
        </button>
      )}
    </section>
  )
}
