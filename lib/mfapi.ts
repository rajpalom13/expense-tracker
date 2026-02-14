/**
 * MFAPI.in integration for fetching mutual fund NAV data.
 * Free API, no authentication required.
 * Docs: https://api.mfapi.in
 */

export interface MFAPISchemeData {
  meta: {
    fund_house: string
    scheme_type: string
    scheme_category: string
    scheme_code: number
    scheme_name: string
  }
  data: Array<{
    date: string
    nav: string
  }>
  status: string
}

export interface MFAPISearchResult {
  schemeCode: number
  schemeName: string
}

export interface NAVResult {
  schemeCode: number
  schemeName: string
  latestNAV: number
  date: string
}

export interface TrailingReturn {
  period: string
  years: number
  annualizedReturn: number
  startNAV: number
  endNAV: number
  startDate: string
  endDate: string
}

const MFAPI_BASE = "https://api.mfapi.in/mf"

/**
 * Search for mutual fund schemes by name.
 * Returns matching scheme codes and names.
 */
export async function searchSchemes(query: string): Promise<MFAPISearchResult[]> {
  const response = await fetch(`${MFAPI_BASE}/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) return []
  const data = await response.json()
  if (!Array.isArray(data)) return []
  return data.map((item: { schemeCode: number; schemeName: string }) => ({
    schemeCode: item.schemeCode,
    schemeName: item.schemeName,
  }))
}

/**
 * Fetch latest NAV for a given scheme code.
 */
export async function fetchLatestNAV(schemeCode: number): Promise<NAVResult | null> {
  try {
    const response = await fetch(`${MFAPI_BASE}/${schemeCode}/latest`)
    if (!response.ok) {
      // Fallback: fetch full data and take first entry
      const fullResponse = await fetch(`${MFAPI_BASE}/${schemeCode}`)
      if (!fullResponse.ok) return null
      const fullData = (await fullResponse.json()) as MFAPISchemeData
      if (!fullData.data?.length) return null
      const latest = fullData.data[0]
      return {
        schemeCode,
        schemeName: fullData.meta?.scheme_name || "",
        latestNAV: parseFloat(latest.nav),
        date: latest.date,
      }
    }
    const data = await response.json()
    if (!data.data?.length) return null
    const latest = data.data[0]
    return {
      schemeCode,
      schemeName: data.meta?.scheme_name || "",
      latestNAV: parseFloat(latest.nav),
      date: latest.date,
    }
  } catch {
    return null
  }
}

/**
 * Fetch full NAV history for a scheme.
 */
export async function fetchNAVHistory(schemeCode: number): Promise<MFAPISchemeData | null> {
  try {
    const response = await fetch(`${MFAPI_BASE}/${schemeCode}`)
    if (!response.ok) return null
    return (await response.json()) as MFAPISchemeData
  } catch {
    return null
  }
}

/**
 * Fetch latest NAVs for multiple scheme codes in parallel.
 */
export async function fetchMultipleNAVs(schemeCodes: number[]): Promise<Record<number, NAVResult>> {
  const results: Record<number, NAVResult> = {}
  const promises = schemeCodes.map(async (code) => {
    const nav = await fetchLatestNAV(code)
    if (nav) results[code] = nav
  })
  await Promise.all(promises)
  return results
}

/**
 * Calculate trailing returns from NAV history.
 * Returns annualized returns for 1Y, 3Y, 5Y periods.
 */
export function calculateTrailingReturns(navHistory: MFAPISchemeData): TrailingReturn[] {
  if (!navHistory.data?.length) return []

  const periods = [
    { period: "1Y", years: 1 },
    { period: "3Y", years: 3 },
    { period: "5Y", years: 5 },
  ]

  // Parse dates: DD-MM-YYYY format from MFAPI
  const parsedData = navHistory.data
    .map((entry) => {
      const parts = entry.date.split("-")
      if (parts.length !== 3) return null
      const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      return { date, nav: parseFloat(entry.nav) }
    })
    .filter((e): e is { date: Date; nav: number } => e !== null && !isNaN(e.nav))
    .sort((a, b) => b.date.getTime() - a.date.getTime()) // Most recent first

  if (parsedData.length < 2) return []

  const latestEntry = parsedData[0]
  const results: TrailingReturn[] = []

  for (const { period, years } of periods) {
    const targetDate = new Date(latestEntry.date)
    targetDate.setFullYear(targetDate.getFullYear() - years)

    // Find closest NAV to target date
    let closestEntry = parsedData[parsedData.length - 1]
    let closestDiff = Math.abs(closestEntry.date.getTime() - targetDate.getTime())

    for (const entry of parsedData) {
      const diff = Math.abs(entry.date.getTime() - targetDate.getTime())
      if (diff < closestDiff) {
        closestDiff = diff
        closestEntry = entry
      }
    }

    // Only include if we found data within 30 days of the target date
    if (closestDiff > 30 * 24 * 60 * 60 * 1000) continue

    const actualYears =
      (latestEntry.date.getTime() - closestEntry.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

    if (actualYears < 0.5) continue // Need at least 6 months of data

    const totalReturn = (latestEntry.nav - closestEntry.nav) / closestEntry.nav
    const annualizedReturn = (Math.pow(1 + totalReturn, 1 / actualYears) - 1) * 100

    results.push({
      period,
      years,
      annualizedReturn: Math.round(annualizedReturn * 100) / 100,
      startNAV: closestEntry.nav,
      endNAV: latestEntry.nav,
      startDate: closestEntry.date.toISOString().split("T")[0],
      endDate: latestEntry.date.toISOString().split("T")[0],
    })
  }

  return results
}

/**
 * Well-known scheme name to code mapping for common funds.
 * This is a best-effort mapping; users should search and confirm.
 */
export const COMMON_SCHEME_CODES: Record<string, number> = {
  // Nifty 50 Index Funds
  "UTI Nifty 50 Index Fund": 120716,
  "HDFC Index Fund-NIFTY 50 Plan": 101525,
  "ICICI Prudential Nifty 50 Index Fund": 120837,
  // Flexi Cap
  "Parag Parikh Flexi Cap Fund": 122639,
  "HDFC Flexi Cap Fund": 100056,
  // Small Cap
  "Nippon India Small Cap Fund": 113177,
  "SBI Small Cap Fund": 125497,
  // Mid Cap
  "HDFC Mid-Cap Opportunities Fund": 100090,
  "Kotak Emerging Equity Fund": 105091,
}

/**
 * Fuzzy match a scheme name to find the best matching scheme code.
 * Tries exact match first, then partial match.
 */
export async function findSchemeCode(schemeName: string): Promise<number | null> {
  // Direct lookup in common schemes
  for (const [name, code] of Object.entries(COMMON_SCHEME_CODES)) {
    if (schemeName.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(schemeName.toLowerCase())) {
      return code
    }
  }

  // Search via API
  const results = await searchSchemes(schemeName)
  if (results.length === 0) return null

  // Try exact match
  const exact = results.find(
    (r) => r.schemeName.toLowerCase() === schemeName.toLowerCase()
  )
  if (exact) return exact.schemeCode

  // Try partial match - prefer "Direct" plan and "Growth" option
  const direct = results.filter(
    (r) => r.schemeName.toLowerCase().includes("direct") && r.schemeName.toLowerCase().includes("growth")
  )
  if (direct.length > 0) return direct[0].schemeCode

  // Return first result as fallback
  return results[0].schemeCode
}
