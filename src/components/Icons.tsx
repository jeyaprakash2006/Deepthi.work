/** Inline stroke icons — no icon-font dependency, and html2canvas-safe. */
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const FileUpIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 3v5h5" />
    <path d="M19 12V8l-5-5H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h6" />
    <path d="M17 22v-6" />
    <path d="m14.5 18.5 2.5-2.5 2.5 2.5" />
  </Svg>
)

export const ClipboardIcon = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="3" width="8" height="4" rx="1" />
    <path d="M16 5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" />
  </Svg>
)

export const TrashIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </Svg>
)

export const PencilIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
)

export const BotIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="8" width="16" height="12" rx="2" />
    <path d="M12 8V4" />
    <circle cx="9" cy="14" r="1" fill="currentColor" />
    <circle cx="15" cy="14" r="1" fill="currentColor" />
    <path d="M2 13v2M22 13v2" />
  </Svg>
)

export const CheckCircleIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </Svg>
)

export const BadgeCheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="m12 2 2.4 1.8 3-.2.9 2.9 2.5 1.6-1.1 2.8 1.1 2.8-2.5 1.6-.9 2.9-3-.2L12 20l-2.4-1.8-3 .2-.9-2.9L3.2 13.9l1.1-2.8-1.1-2.8 2.5-1.6.9-2.9 3 .2Z" />
    <path d="m9 12 2 2 4-4.5" />
  </Svg>
)

export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const ImageIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m4 17 4.5-4.5 3 3L15 12l5 5" />
  </Svg>
)

export const PdfIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 17v-4h1.2a1.2 1.2 0 0 1 0 2.4H8.5" />
    <path d="M13.5 17v-4h2" />
  </Svg>
)

export const TextIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9h10M7 13h10M7 17h6" />
  </Svg>
)

export const SinglePageIcon = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </Svg>
)

export const SplitPageIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="3" width="16" height="8" rx="1.5" />
    <rect x="4" y="13" width="16" height="8" rx="1.5" />
  </Svg>
)

export const DownloadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v12" />
    <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
    <path d="M4 20h16" />
  </Svg>
)

export const EyeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const SlidersIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="16" cy="18" r="2" />
  </Svg>
)

export const StyleIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9.6-10-9.6Z" />
  </Svg>
)

export const ChevronIcon = ({ open, ...p }: P & { open?: boolean }) => (
  <Svg {...p}>
    <path d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
  </Svg>
)

export const AppMark = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#0d2f18" aria-hidden="true">
    <circle cx="8" cy="7" r="2.1" />
    <circle cx="15" cy="6" r="2.1" />
    <circle cx="6" cy="14" r="2.1" />
    <circle cx="13" cy="13" r="2.1" />
    <circle cx="18" cy="12" r="2.1" />
    <circle cx="10" cy="19" r="2.1" />
    <circle cx="17" cy="18.5" r="2.1" />
  </svg>
)

/** Aa — typography and emphasis. */
export function TypeIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 18 7.5 6 12 18" />
      <path d="M4.6 14h5.8" />
      <path d="M20.5 18v-5.2a2.3 2.3 0 0 0-4.4-.9" />
      <path d="M20.5 15.4a3 3 0 1 0-2.2 2.6" />
    </Svg>
  )
}

/** Page geometry — margins, columns, rows. */
export function LayoutIcon(p: P) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M14 9v12" />
    </Svg>
  )
}

/** The content that goes on the paper. */
export function ContentIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </Svg>
  )
}

/** A over A — the same paper printed on both halves of a split sheet. */
export function HalvesSameIcon(p: P) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 12h18" strokeDasharray="2.5 2" />
      <path d="M8.4 9.2 10 5.8l1.6 3.4" />
      <path d="M8.9 8.2h2.2" />
      <path d="M8.4 18.2 10 14.8l1.6 3.4" />
      <path d="M8.9 17.2h2.2" />
    </Svg>
  )
}

/** A over B — swap which paper sits on which half. */
export function HalvesSwapIcon(p: P) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 12h18" strokeDasharray="2.5 2" />
      <path d="M7.4 9.2 9 5.8l1.6 3.4" />
      <path d="M7.9 8.2h2.2" />
      <path d="M7.6 18.4v-3.6h1.7a.9.9 0 0 1 0 1.8H7.6h1.9a.9.9 0 0 1 0 1.8z" />
      <path d="m15.5 7.5 1.6-1.6 1.6 1.6" />
      <path d="m18.7 16.5-1.6 1.6-1.6-1.6" />
    </Svg>
  )
}

export function UndoIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 7v6h6" />
      <path d="M3.5 13a9 9 0 1 0 2.6-7.4L3 8.7" />
    </Svg>
  )
}

export function RedoIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M21 7v6h-6" />
      <path d="M20.5 13a9 9 0 1 1-2.6-7.4L21 8.7" />
    </Svg>
  )
}

/* ------------------------------------------------------- tool icons --- */

export function PaperToolIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M15 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6z" />
      <path d="M15 2v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </Svg>
  )
}

export function FlaskIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M9 3h6" />
      <path d="M10 3v6.5L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9.5V3" />
      <path d="M7.4 14h9.2" />
    </Svg>
  )
}

export function SigmaIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M17 4H7l6 8-6 8h10" />
    </Svg>
  )
}

export function ChartIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 3v18h18" />
      <path d="M7 15v3" />
      <path d="M12 9v9" />
      <path d="M17 5v13" />
    </Svg>
  )
}

export function CalendarIcon(p: P) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </Svg>
  )
}

export function StampIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M5 21h14" />
      <path d="M6 17h12v-1.5a2 2 0 0 0-2-2h-1.6l.5-4.2A2.6 2.6 0 0 0 12.3 6h-.6A2.6 2.6 0 0 0 9.1 9.3l.5 4.2H8a2 2 0 0 0-2 2z" />
    </Svg>
  )
}

export function ArrowLeftIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Svg>
  )
}

export function RotateCcwIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </Svg>
  )
}

export function MaximizeIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </Svg>
  )
}

export function MinimizeIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </Svg>
  )
}

export function ChevronLeftIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  )
}

export function ChevronRightIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  )
}

export function SearchIcon(p: P) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  )
}

export function SettingsIcon(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  )
}

/* ── Icons that replaced emoji, so every glyph in the UI is one stroke set ── */

export const XIcon = (p: P) => (
  <Svg {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
)

export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

export const AlertIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Svg>
)

export const PrinterIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 14h12v8H6z" />
  </Svg>
)

export const BankIcon = (p: P) => (
  <Svg {...p}>
    <path d="m3 9 9-6 9 6" />
    <path d="M4 10v9" />
    <path d="M9 10v9" />
    <path d="M15 10v9" />
    <path d="M20 10v9" />
    <path d="M2 21h20" />
  </Svg>
)

export const FolderIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" />
  </Svg>
)

export const ScissorsIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.12 15.88" />
    <path d="M14.47 14.48 20 20" />
    <path d="M8.12 8.12 12 12" />
  </Svg>
)

export const GridIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
  </Svg>
)

export const PackageIcon = (p: P) => (
  <Svg {...p}>
    <path d="m7.5 4.27 9 5.15" />
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </Svg>
)

export const FlaskSmallIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 2v7.5L4.6 18A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-3L14 9.5V2" />
    <path d="M8.5 2h7" />
    <path d="M7 15h10" />
  </Svg>
)
