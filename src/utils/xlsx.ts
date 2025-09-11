import * as XLSX from 'xlsx'

export type FeaturedItem = { name: string; size: string; price: string; imageUrl: string }
export type Row = { name: string; size: string; price: string }
export type WorkbookData = { featured: FeaturedItem[]; grocery: Row[]; frozen: Row[]; meat: Row[]; produce: Row[] }

export type WorkbookIssue = {
  level: 'error' | 'warning'
  code: string
  message: string
  sheet?: string
  row?: number
  column?: string
}

export type ParseResult = {
  data: WorkbookData
  issues: WorkbookIssue[]
}

const REQUIRED_SHEETS = ['Featured Items', 'Grocery', 'Frozen Foods', 'Meat', 'Produce'] as const
type RequiredSheet = typeof REQUIRED_SHEETS[number]

/**
 * Sheets created by Google Sheets add-ons (e.g., AutoCrat) that we should ignore
 * and not surface as “unexpected”.
 * Add more patterns if you encounter other system sheets.
 */
const IGNORED_SHEET_PATTERNS: RegExp[] = [
  /^do not delete\b.*autocrat/i,        // "DO NOT DELETE - AutoCrat Job Selections"
  /^autocrat/i,                         // any sheet starting with "AutoCrat..."
  /^autocrat job/i,                     // safety net for variants
  // Add more here if needed, e.g. /^Merge Status$/i
]

// Column sets per sheet
const COLS = {
  featured: ['Product Name', 'Size', 'Price', 'Image File'] as const,
  rows: ['Product Name', 'Size', 'Price'] as const,
}

function isIgnoredSheet(name: string) {
  return IGNORED_SHEET_PATTERNS.some((re) => re.test(name))
}

function sheetToJson(wb: XLSX.WorkBook, name: string) {
  const ws = wb.Sheets[name]
  if (!ws) return null
  // defval:'' keeps empty cells defined; raw:true preserves numbers
  return XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: true })
}

function haveColumns(rows: Record<string, any>[], needed: readonly string[]) {
  if (!rows || rows.length === 0) return true // empty sheet: let row validators handle it
  return needed.every((col) => Object.prototype.hasOwnProperty.call(rows[0], col))
}

function toStr(v: any) {
  if (v == null) return ''
  return String(v).trim()
}

function cellStr(r: Record<string, any>, key: string) {
  return toStr(r?.[key])
}

function parseFeaturedRows(
  raw: Record<string, any>[] | null,
  issues: WorkbookIssue[],
): FeaturedItem[] {
  if (!raw) return []
  if (!haveColumns(raw, COLS.featured)) {
    issues.push({
      level: 'error',
      code: 'missing_columns_featured',
      message: `“Featured Items” is missing one or more required columns: ${COLS.featured.join(', ')}`,
      sheet: 'Featured Items',
    })
    return []
  }

  const out: FeaturedItem[] = []
  let dropped = 0

  raw.forEach((r, i) => {
    const rowNum = i + 2 // +2 = header row + 1-indexed
    const name = cellStr(r, 'Product Name')
    const size = cellStr(r, 'Size')
    const price = toStr(r['Price']) // keep original (e.g., "$1.99")
    const imageUrl = cellStr(r, 'Image File')

    if (!name) {
      dropped++
      issues.push({
        level: 'warning',
        code: 'featured_missing_name',
        message: `Featured row ${rowNum} skipped: “Product Name” is required.`,
        sheet: 'Featured Items',
        row: rowNum,
        column: 'Product Name',
      })
      return
    }

    if (!price) {
      issues.push({
        level: 'warning',
        code: 'featured_missing_price',
        message: `Featured row ${rowNum}: “Price” is empty.`,
        sheet: 'Featured Items',
        row: rowNum,
        column: 'Price',
      })
    }

    out.push({ name, size, price, imageUrl })
  })

  if (out.length === 0 && raw.length > 0) {
    issues.push({
      level: 'error',
      code: 'featured_no_valid_rows',
      message: `“Featured Items” could not be parsed into any valid items.`,
      sheet: 'Featured Items',
    })
  } else if (dropped > 0) {
    issues.push({
      level: 'warning',
      code: 'featured_dropped_rows',
      message: `Some Featured rows were skipped due to missing required fields.`,
      sheet: 'Featured Items',
    })
  }

  // limit to 9 per original behavior
  return out.slice(0, 9)
}

function parseSimpleRows(
  raw: Record<string, any>[] | null,
  sheetName: RequiredSheet,
  issues: WorkbookIssue[],
): Row[] {
  if (!raw) return []
  if (!haveColumns(raw, COLS.rows)) {
    issues.push({
      level: 'error',
      code: 'missing_columns_rows',
      message: `“${sheetName}” is missing one or more required columns: ${COLS.rows.join(', ')}`,
      sheet: sheetName,
    })
    return []
  }

  const out: Row[] = []
  let dropped = 0

  raw.forEach((r, i) => {
    const rowNum = i + 2
    const name = cellStr(r, 'Product Name')
    const size = cellStr(r, 'Size')
    const price = toStr(r['Price'])

    if (!name) {
      dropped++
      // silently drop empty-name rows but note once
      if (dropped === 1) {
        issues.push({
          level: 'warning',
          code: 'rows_missing_name',
          message: `Some rows in “${sheetName}” were skipped because “Product Name” is required.`,
          sheet: sheetName,
        })
      }
      return
    }

    out.push({ name, size, price })
  })

  if (out.length === 0 && raw.length > 0) {
    issues.push({
      level: 'error',
      code: 'rows_no_valid_rows',
      message: `“${sheetName}” has no valid rows after parsing.`,
      sheet: sheetName,
    })
  }

  return out
}

/**
 * Rich parser with sheet/column validation and multi-issue reporting.
 * - Parses whatever is valid
 * - Returns issues[] including errors & warnings
 */
export function parseWorkbookDetailed(buf: ArrayBuffer): ParseResult {
  const issues: WorkbookIssue[] = []
  let wb: XLSX.WorkBook

  try {
    wb = XLSX.read(buf, { type: 'array' })
  } catch (e) {
    return {
      data: { featured: [], grocery: [], frozen: [], meat: [], produce: [] },
      issues: [
        {
          level: 'error',
          code: 'read_failed',
          message:
            'Could not read your spreadsheet. Ensure it is a valid .xlsx file (Excel workbook).',
        },
      ],
    }
  }

  const present = new Set<string>(wb.SheetNames)
  const missing = REQUIRED_SHEETS.filter((n) => !present.has(n))
  if (missing.length) {
    issues.push({
      level: 'error',
      code: 'missing_sheets',
      message: `Missing required sheet${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
    })
  }

  // Only warn for extras that are not in REQUIRED_SHEETS and not in IGNORED_SHEET_PATTERNS
  const extras = wb.SheetNames
    .filter((n) => !REQUIRED_SHEETS.includes(n as RequiredSheet))
    .filter((n) => !isIgnoredSheet(n))

  if (extras.length) {
    issues.push({
      level: 'warning',
      code: 'unexpected_sheets',
      message: `Found sheet${extras.length > 1 ? 's' : ''} we don’t use: ${extras.join(', ')}.`,
    })
  }

  // Parse per sheet (gracefully even if missing)
  const rawFeatured = sheetToJson(wb, 'Featured Items')
  const rawGrocery = sheetToJson(wb, 'Grocery')
  const rawFrozen = sheetToJson(wb, 'Frozen Foods')
  const rawMeat = sheetToJson(wb, 'Meat')
  const rawProduce = sheetToJson(wb, 'Produce')

  const featured = rawFeatured ? parseFeaturedRows(rawFeatured, issues) : []
  const grocery = rawGrocery ? parseSimpleRows(rawGrocery, 'Grocery', issues) : []
  const frozen = rawFrozen ? parseSimpleRows(rawFrozen, 'Frozen Foods', issues) : []
  const meat = rawMeat ? parseSimpleRows(rawMeat, 'Meat', issues) : []
  const produce = rawProduce ? parseSimpleRows(rawProduce, 'Produce', issues) : []

  return {
    data: { featured, grocery, frozen, meat, produce },
    issues,
  }
}

/**
 * Backward-compat thin wrapper (kept so existing imports don’t break).
 * Throws if anything goes wrong.
 */
export function parseWorkbook(buf: ArrayBuffer): WorkbookData {
  const { data, issues } = parseWorkbookDetailed(buf)
  const hasBlockingErrors = issues.some((i) => i.level === 'error')
  if (hasBlockingErrors) {
    // Throw a compact error for legacy callers
    const msgs = issues
      .filter((i) => i.level === 'error')
      .map((i) => i.message)
      .join(' | ')
    throw new Error(msgs || 'Workbook parse failed.')
  }
  return data
}
