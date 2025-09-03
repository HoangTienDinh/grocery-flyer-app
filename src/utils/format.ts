export function normalizeDollarOnly(input: string): string {
  const trimmed = input.trim()

  // Allow free text if it contains non-numeric characters (excluding $ . ,)
  if (/[^0-9.,$]/.test(trimmed)) {
    return trimmed
  }

  // Strip $ and commas, parse number
  const numeric = parseFloat(trimmed.replace(/[$,]/g, ''))
  if (isNaN(numeric)) {
    return trimmed // return as-is if parse fails
  }

  return `$${numeric.toFixed(2)}`
}