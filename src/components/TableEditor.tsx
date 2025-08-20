import React from 'react'
import type { Row } from '../utils/xlsx'
import { maskCurrencyFromDigits, normalizePrice } from '../utils/format'

type Props = {
  rows: Row[]
  setRows: React.Dispatch<React.SetStateAction<Row[]>>
  onFocusAny?: () => void
  /** Optional: hide the “Add row” button once this many rows exist (e.g. 9 for Featured) */
  maxRows?: number
}

export default function TableEditor({ rows, setRows, onFocusAny, maxRows }: Props) {
  const addRow = () =>
    setRows(prev => [...prev, { name: '', size: '', price: '$0.00' }])

  const update = (i: number, key: keyof Row, val: string) =>
    setRows(prev => {
      const copy = [...prev]
      copy[i] = { ...copy[i], [key]: val }
      return copy
    })

  const remove = (i: number) =>
    setRows(prev => {
      const copy = [...prev]
      copy.splice(i, 1)
      return copy
    })

  const onFocus = () => onFocusAny?.()

  const onPriceChange = (i: number, val: string) =>
    update(i, 'price', maskCurrencyFromDigits(val))

  const onPriceBlur = (i: number, val: string) =>
    update(i, 'price', normalizePrice(val))

  // Fixed widths for compact, tidy layout
  const SIZE_COL_W = 150
  const PRICE_COL_W = 96
  const REMOVE_COL_W = 60

  const canAddMore = maxRows === undefined || rows.length < maxRows

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-2">
        <thead>
          <tr className="text-xs text-neutral-500">
            {/* Product Name takes remaining width automatically */}
            <th className="text-left px-2">Product Name</th>
            <th className="text-left px-2" style={{ width: SIZE_COL_W }}>
              Size
            </th>
            <th className="text-left px-2" style={{ width: PRICE_COL_W }}>
              Price
            </th>
            <th className="px-2" style={{ width: REMOVE_COL_W }}>
              Remove
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => {
            // --- Validation per row ---
            const nameError = !r.name.trim()
            const priceVal = parseFloat(r.price.replace(/[^0-9.]/g, '')) || 0
            const priceError = priceVal < 0.01

            return (
              <tr key={i} className="align-top">
                {/* Product Name — expands to fill saved space */}
                <td className="px-2 align-top">
                  <div>
                    <input
                      className={`w-full border rounded p-1 truncate ${nameError ? 'border-red-500' : ''}`}
                      value={r.name}
                      onFocus={onFocus}
                      onChange={e => update(i, 'name', e.target.value)}
                      title={r.name}
                      placeholder="Product name"
                    />
                    {nameError && (
                      <div className="text-xs text-red-600 mt-1">Product name is required</div>
                    )}
                  </div>
                </td>

                {/* Size — fixed sensible width */}
                <td className="px-2 align-top">
                  <input
                    className="border rounded p-1 truncate"
                    style={{ width: SIZE_COL_W }}
                    value={r.size}
                    onFocus={onFocus}
                    onChange={e => update(i, 'size', e.target.value)}
                    title={r.size}
                    placeholder="e.g. 750ml"
                  />
                </td>

                {/* Price — compact, right-aligned, tabular numerals; fits `$555.55` */}
                <td className="px-2 align-top">
                  <div>
                    <input
                      className={`border rounded p-1 truncate text-right tabular-nums ${priceError ? 'border-red-500' : ''}`}
                      style={{ width: PRICE_COL_W }}
                      value={r.price}
                      onFocus={onFocus}
                      onChange={e => onPriceChange(i, e.target.value)}
                      onBlur={e => onPriceBlur(i, e.target.value)}
                      title={r.price}
                      placeholder="$0.00"
                    />
                    {priceError && (
                      <div className="text-xs text-red-600 mt-1">Price must be at least $0.01</div>
                    )}
                  </div>
                </td>

                {/* Remove */}
                <td className="px-2 text-center align-middle" style={{ width: REMOVE_COL_W }}>
                  <button className="text-red-600" onClick={() => remove(i)} aria-label={`Remove row ${i + 1}`}>
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-2 py-3 text-sm text-neutral-500">
                No rows yet.
              </td>
            </tr>
          )}

          {/* Add row under the last row (hidden when at maxRows) */}
          {canAddMore && (
            <tr>
              <td colSpan={4} className="px-2 pt-1">
                <button
                  className="text-sm px-3 py-1 rounded bg-neutral-200 hover:bg-neutral-300"
                  onClick={addRow}
                >
                  + Add row
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
