// Lightweight inline icon set (stroke style, currentColor) — no dependency.
type P = { className?: string }
const base = (className = 'h-5 w-5') => ({
  className,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const IconUpload = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
)
export const IconGrid = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
export const IconLayers = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
)
export const IconReceipt = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 3v18l2-1.2L9 21l2-1.2L13 21l2-1.2L17 21l2-1.2V3l-2 1.2L15 3l-2 1.2L11 3 9 4.2 7 3 5 4.2Z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
)
export const IconShield = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
export const IconChart = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 3v18h18" />
    <path d="m7 14 3-3 3 3 5-6" />
  </svg>
)
export const IconSliders = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="14" cy="18" r="2" />
  </svg>
)
export const IconDownload = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 4v12m0 0 4-4m-4 4-4-4" />
    <path d="M4 18h16" />
  </svg>
)
export const IconScale = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3v18M7 21h10M5 7h14M5 7 3 13h4L5 7Zm14 0-2 6h4l-2-6Z" />
  </svg>
)
export const IconBolt = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
)
export const IconWallet = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
    <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1Z" />
    <circle cx="16" cy="13" r="1.3" />
  </svg>
)
export const IconAlert = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
)
export const IconHash = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 9h14M5 15h14M9 4 7 20M17 4l-2 16" />
  </svg>
)
export const IconFlag = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 21V4m0 0 9 1 5-1v9l-5 1-9-1" />
  </svg>
)
