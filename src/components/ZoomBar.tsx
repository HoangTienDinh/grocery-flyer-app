import React from "react"

type Props = {
  zoom: number
  setZoom: (v: number) => void
  fitOn: boolean
  toggleFit: () => void
  resetFit: () => void
}

export default function ZoomBar({
  zoom,
  setZoom,
  fitOn,
  toggleFit,
}: Props) {
  const pct = Math.round(zoom * 100)

  const minus = () => {
    if (fitOn) return
    setZoom(Math.max(5, Math.round(pct - 10)) / 100)
  }
  const plus = () => {
    if (fitOn) return
    setZoom(Math.min(500, Math.round(pct + 10)) / 100)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Fit width toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={fitOn}
        onClick={toggleFit}
        className="group flex items-center gap-2 rounded-md px-2 py-0 transition-colors duration-150 hover:bg-neutral-100"
      >
        <span className={fitOn ? "text-sm font-medium text-blue-700" : "text-sm font-medium text-neutral-800"}>
          Fit width
        </span>

        {/* pill switch */}
        <span
          aria-hidden="true"
          className={[
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150",
            fitOn ? "bg-blue-600" : "bg-neutral-300",
          ].join(" ")}
        >
          <span
            className={[
              "h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-150",
              fitOn ? "translate-x-4" : "translate-x-1",
            ].join(" ")}
          />
        </span>
      </button>

      {/* Zoom controls — compact & disabled when fitOn */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={minus}
          aria-label="Zoom out"
          disabled={fitOn}
          className={[
            "h-6 w-6 rounded-md border border-neutral-200 text-[13px] leading-none",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "hover:bg-neutral-100",
          ].join(" ")}
        >
          –
        </button>

        <div className="min-w-[1.5rem] text-center text-sm tabular-nums">
          {pct}%
        </div>

        <button
          type="button"
          onClick={plus}
          aria-label="Zoom in"
          disabled={fitOn}
          className={[
            "h-6 w-6 rounded-md border border-neutral-200 text-[13px] leading-none",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "hover:bg-neutral-100",
          ].join(" ")}
        >
          +
        </button>
      </div>
    </div>
  )
}
