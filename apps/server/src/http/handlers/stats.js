import { getDailySeries, getTotals, getWeeklySeries } from '../../db/stats.js'

export function getStatsHandler(req, res) {
  const days = Number(req.query?.days)
  const weeks = Number(req.query?.weeks)
  res.json({
    totals: getTotals(),
    daily: getDailySeries(Number.isFinite(days) ? days : undefined),
    weekly: getWeeklySeries(Number.isFinite(weeks) ? weeks : undefined),
  })
}
