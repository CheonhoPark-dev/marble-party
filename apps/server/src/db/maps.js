import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_DB_PATH = path.resolve(__dirname, '..', '..', 'data', 'maps.sqlite')
const DB_PATH = process.env.MAPS_DB_PATH || DEFAULT_DB_PATH

let dbInstance = null

function ensureColumns(db) {
  const columns = db.prepare('PRAGMA table_info(maps)').all().map((col) => col.name)
  if (!columns.includes('author_name')) {
    db.exec('ALTER TABLE maps ADD COLUMN author_name TEXT')
  }
  if (!columns.includes('password_hash')) {
    db.exec('ALTER TABLE maps ADD COLUMN password_hash TEXT')
  }
}

function ensureDb() {
  if (dbInstance) {
    return dbInstance
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      author_name TEXT,
      password_hash TEXT
    );
  `)
  ensureColumns(db)
  dbInstance = db
  return dbInstance
}

function rowToMap(row) {
  if (!row) {
    return null
  }
  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schema_version,
    payload: row.payload,
    authorName: row.author_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listMaps() {
  const db = ensureDb()
  const rows = db.prepare('SELECT id, name, schema_version, payload, author_name, password_hash, created_at, updated_at FROM maps ORDER BY updated_at DESC').all()
  return rows.map(rowToMap)
}

export function getMapById(mapId) {
  const db = ensureDb()
  const row = db.prepare('SELECT id, name, schema_version, payload, author_name, password_hash, created_at, updated_at FROM maps WHERE id = ?').get(mapId)
  return rowToMap(row)
}

export function createMap({ name, schemaVersion, payload, authorName, passwordHash }) {
  const db = ensureDb()
  const now = Date.now()
  const id = nanoid(12)
  db.prepare(
    'INSERT INTO maps (id, name, schema_version, payload, author_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, schemaVersion, payload, authorName, passwordHash, now, now)
  return getMapById(id)
}

export function updateMap(mapId, { name, schemaVersion, payload, authorName, passwordHash }) {
  const db = ensureDb()
  const now = Date.now()
  const result = db.prepare(
    'UPDATE maps SET name = ?, schema_version = ?, payload = ?, author_name = ?, password_hash = ?, updated_at = ? WHERE id = ?'
  ).run(name, schemaVersion, payload, authorName, passwordHash, now, mapId)
  if (result.changes === 0) {
    return null
  }
  return getMapById(mapId)
}

export function deleteMap(mapId) {
  const db = ensureDb()
  const result = db.prepare('DELETE FROM maps WHERE id = ?').run(mapId)
  return result.changes > 0
}
