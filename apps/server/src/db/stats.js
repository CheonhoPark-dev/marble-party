import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_DB_PATH = path.resolve(__dirname, '..', '..', 'data', 'stats.sqlite')
const DB_PATH = process.env.STATS_DB_PATH || DEFAULT_DB_PATH

let dbInstance = null

const TOTAL_METRICS = [
  'rooms_created',
  'games_started',
  'games_completed',
  'participants_joined',
  'hosts_created',
]

function ensureDb() {
  if (dbInstance) {
    return dbInstance
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_totals (
      metric TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analytics_daily (
      metric TEXT NOT NULL,
      day TEXT NOT NULL,
      value INTEGER NOT NULL,
      PRIMARY KEY (metric, day)
    );
    CREATE TABLE IF NOT EXISTS analytics_weekly (
      metric TEXT NOT NULL,
      week TEXT NOT NULL,
      value INTEGER NOT NULL,
      PRIMARY KEY (metric, week)
    );
  `)

  const insertTotal = db.prepare('INSERT OR IGNORE INTO analytics_totals (metric, value) VALUES (?, 0)')
  TOTAL_METRICS.forEach((metric) => insertTotal.run(metric))

  dbInstance = db
  return dbInstance
}

function formatDay(timestamp = Date.now()) {
  const date = new Date(timestamp)
  return date.toISOString().slice(0, 10)
}

function formatWeek(timestamp = Date.now()) {
  const date = new Date(timestamp)
  const day = date.getUTCDay()
  const diff = (day + 6) % 7
  date.setUTCDate(date.getUTCDate() - diff)
  return date.toISOString().slice(0, 10)
}

function incrementTotal(db, metric, amount) {
  db.prepare('UPDATE analytics_totals SET value = value + ? WHERE metric = ?').run(amount, metric)
}

function incrementDaily(db, metric, day, amount) {
  db.prepare('INSERT INTO analytics_daily (metric, day, value) VALUES (?, ?, ?) ON CONFLICT(metric, day) DO UPDATE SET value = value + excluded.value').run(metric, day, amount)
}

function incrementWeekly(db, metric, week, amount) {
  db.prepare('INSERT INTO analytics_weekly (metric, week, value) VALUES (?, ?, ?) ON CONFLICT(metric, week) DO UPDATE SET value = value + excluded.value').run(metric, week, amount)
}

export function incrementMetric(metric, amount = 1, timestamp = Date.now()) {
  const db = ensureDb()
  const day = formatDay(timestamp)
  const week = formatWeek(timestamp)
  const value = Number.isFinite(amount) ? amount : 1

  const transaction = db.transaction(() => {
    incrementTotal(db, metric, value)
    incrementDaily(db, metric, day, value)
    incrementWeekly(db, metric, week, value)
  })

  transaction()
}

export function recordGameStart({ timestamp = Date.now() } = {}) {
  incrementMetric('games_started', 1, timestamp)
}

export function recordGameCompletion({ timestamp = Date.now() } = {}) {
  incrementMetric('games_completed', 1, timestamp)
}

export function recordRoomCreated({ timestamp = Date.now() } = {}) {
  incrementMetric('rooms_created', 1, timestamp)
  incrementMetric('hosts_created', 1, timestamp)
}

export function recordParticipantJoin({ timestamp = Date.now() } = {}) {
  incrementMetric('participants_joined', 1, timestamp)
}

function rowsToSeries(rows, metricKey) {
  return rows.reduce((acc, row) => {
    if (!acc[row.metric]) {
      acc[row.metric] = {}
    }
    acc[row.metric][metricKey] = Number(row.value || 0)
    return acc
  }, {})
}

export function getTotals() {
  const db = ensureDb()
  const rows = db.prepare('SELECT metric, value FROM analytics_totals').all()
  return rows.reduce((acc, row) => {
    acc[row.metric] = Number(row.value || 0)
    return acc
  }, {})
}

export function getDailySeries(days = 30) {
  const db = ensureDb()
  const limit = Math.max(1, Number(days) || 30)
  const rows = db.prepare('SELECT metric, day, value FROM analytics_daily ORDER BY day DESC LIMIT ?').all(limit * TOTAL_METRICS.length)
  return rows.reduce((acc, row) => {
    if (!acc[row.metric]) {
      acc[row.metric] = []
    }
    acc[row.metric].push({ date: row.day, value: Number(row.value || 0) })
    return acc
  }, {})
}

export function getWeeklySeries(weeks = 12) {
  const db = ensureDb()
  const limit = Math.max(1, Number(weeks) || 12)
  const rows = db.prepare('SELECT metric, week, value FROM analytics_weekly ORDER BY week DESC LIMIT ?').all(limit * TOTAL_METRICS.length)
  return rows.reduce((acc, row) => {
    if (!acc[row.metric]) {
      acc[row.metric] = []
    }
    acc[row.metric].push({ date: row.week, value: Number(row.value || 0) })
    return acc
  }, {})
}
