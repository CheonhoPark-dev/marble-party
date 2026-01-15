import crypto from 'node:crypto'
import {
  createMap,
  deleteMap,
  getMapById,
  listMaps,
  updateMap,
} from '../../db/maps.js'

const SCHEMA_VERSION = 1
const MAX_OBSTACLES = 400
const MAX_WALL_POINTS = 60
const MAX_INTERNAL_WALLS = 20
const MAX_AUTHOR_LENGTH = 24
const MAX_PASSWORD_LENGTH = 6

const OBSTACLE_TYPES = new Set([
  'peg',
  'bumper',
  'spinner',
  'hammer',
  'ramp',
  'kicker',
  'kicker-once',
  'slider',
  'wind',
])

function isNumber(value) {
  return Number.isFinite(value)
}

function normalizeName(name) {
  const normalized = String(name || '').trim()
  if (!normalized) {
    return 'Untitled Map'
  }
  return normalized.slice(0, 60)
}

function normalizeAuthorName(name) {
  const normalized = String(name || '').trim()
  if (!normalized) {
    return null
  }
  return normalized.slice(0, MAX_AUTHOR_LENGTH)
}

function normalizePassword(password) {
  const normalized = String(password || '').trim()
  if (!normalized) {
    return null
  }
  return normalized
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex')
}

function validateAuthorName(authorName) {
  if (!authorName) {
    return 'Author name is required.'
  }
  return null
}

function validatePassword(password) {
  if (!password) {
    return 'Password is required.'
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or less.`
  }
  return null
}

function isValidPoint(point) {
  return point && isNumber(point.x) && isNumber(point.y)
}

function validateWalls(walls) {
  if (!walls || typeof walls !== 'object') {
    return 'Walls must be an object.'
  }
  const sides = ['left', 'right']
  for (const side of sides) {
    const points = walls[side]
    if (!Array.isArray(points)) {
      return `Walls.${side} must be an array.`
    }
    if (points.length > MAX_WALL_POINTS) {
      return `Walls.${side} has too many points.`
    }
    for (const point of points) {
      if (!isValidPoint(point)) {
        return `Walls.${side} has invalid point.`
      }
    }
  }

  const internal = walls.internal
  if (!Array.isArray(internal)) {
    return 'Walls.internal must be an array.'
  }
  if (internal.length > MAX_INTERNAL_WALLS) {
    return 'Walls.internal has too many polylines.'
  }
  for (const polyline of internal) {
    if (!Array.isArray(polyline)) {
      return 'Walls.internal entries must be arrays.'
    }
    if (polyline.length > MAX_WALL_POINTS) {
      return 'Walls.internal polyline has too many points.'
    }
    for (const point of polyline) {
      if (!isValidPoint(point)) {
        return 'Walls.internal has invalid point.'
      }
    }
  }
  return null
}

function validateObstacle(obstacle) {
  if (!obstacle || typeof obstacle !== 'object') {
    return 'Obstacle must be an object.'
  }
  if (!OBSTACLE_TYPES.has(obstacle.type)) {
    return 'Obstacle type is invalid.'
  }
  if (!isNumber(obstacle.x) || !isNumber(obstacle.y)) {
    return 'Obstacle position is invalid.'
  }

  if (obstacle.type === 'peg' || obstacle.type === 'bumper') {
    if (!isNumber(obstacle.radius)) {
      return 'Obstacle radius is required.'
    }
  }
  if (obstacle.type === 'spinner' || obstacle.type === 'hammer' || obstacle.type === 'ramp' || obstacle.type === 'kicker' || obstacle.type === 'kicker-once') {
    if (!isNumber(obstacle.length)) {
      return 'Obstacle length is required.'
    }
    if (obstacle.angle != null && !isNumber(obstacle.angle)) {
      return 'Obstacle angle is invalid.'
    }
  }
  if (obstacle.type === 'slider') {
    if (!isNumber(obstacle.length) || !isNumber(obstacle.range)) {
      return 'Slider length and range are required.'
    }
  }
  if (obstacle.type === 'wind') {
    if (!isNumber(obstacle.width) || !isNumber(obstacle.height)) {
      return 'Wind width and height are required.'
    }
  }
  return null
}

function validateBlueprint(blueprint) {
  if (!blueprint || typeof blueprint !== 'object') {
    return 'Blueprint is required.'
  }
  if (!isNumber(blueprint.width) || !isNumber(blueprint.height)) {
    return 'Blueprint width/height are required.'
  }
  if (blueprint.wallThickness != null && !isNumber(blueprint.wallThickness)) {
    return 'Blueprint wallThickness is invalid.'
  }
  if (!blueprint.floor || typeof blueprint.floor !== 'object') {
    return 'Blueprint floor is required.'
  }
  if (!isNumber(blueprint.floor.y)) {
    return 'Blueprint floor.y is invalid.'
  }
  if (blueprint.floor.inset != null && !isNumber(blueprint.floor.inset)) {
    return 'Blueprint floor.inset is invalid.'
  }

  const wallsError = validateWalls(blueprint.walls)
  if (wallsError) {
    return wallsError
  }

  if (!Array.isArray(blueprint.obstacles)) {
    return 'Blueprint obstacles must be an array.'
  }
  if (blueprint.obstacles.length > MAX_OBSTACLES) {
    return 'Too many obstacles.'
  }

  for (const obstacle of blueprint.obstacles) {
    const obstacleError = validateObstacle(obstacle)
    if (obstacleError) {
      return obstacleError
    }
  }

  return null
}

function parseBlueprint(req) {
  const blueprint = req.body?.blueprint
  const error = validateBlueprint(blueprint)
  if (error) {
    return { error }
  }
  return { blueprint }
}

export function listMapsHandler(_req, res) {
  const maps = listMaps()
  res.json({
    maps: maps.map((map) => ({
      id: map.id,
      name: map.name,
      schemaVersion: map.schemaVersion,
      authorName: map.authorName || null,
      createdAt: map.createdAt,
      updatedAt: map.updatedAt,
    }))
  })
}

export function getMapHandler(req, res) {
  const map = getMapById(req.params.mapId)
  if (!map) {
    return res.status(404).json({ error: 'Map not found.' })
  }
  const blueprint = JSON.parse(map.payload)
  return res.json({
    id: map.id,
    name: map.name,
    schemaVersion: map.schemaVersion,
    authorName: map.authorName || null,
    blueprint,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
  })
}

export function createMapHandler(req, res) {
  const name = normalizeName(req.body?.name)
  const authorName = normalizeAuthorName(req.body?.authorName)
  const password = normalizePassword(req.body?.password)
  const authorError = validateAuthorName(authorName)
  if (authorError) {
    return res.status(400).json({ error: authorError })
  }
  const passwordError = validatePassword(password)
  if (passwordError) {
    return res.status(400).json({ error: passwordError })
  }
  const parsed = parseBlueprint(req)
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error })
  }

  const map = createMap({
    name,
    schemaVersion: SCHEMA_VERSION,
    payload: JSON.stringify(parsed.blueprint),
    authorName,
    passwordHash: hashPassword(password),
  })

  return res.status(201).json({
    id: map.id,
    name: map.name,
    schemaVersion: map.schemaVersion,
    authorName: map.authorName || null,
    blueprint: parsed.blueprint,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
  })
}

export function updateMapHandler(req, res) {
  const map = getMapById(req.params.mapId)
  if (!map) {
    return res.status(404).json({ error: 'Map not found.' })
  }
  const password = normalizePassword(req.body?.password)
  let nextPasswordHash = map.passwordHash || null
  if (map.passwordHash) {
    const passwordError = validatePassword(password)
    if (passwordError) {
      return res.status(400).json({ error: passwordError })
    }
    if (hashPassword(password) !== map.passwordHash) {
      return res.status(403).json({ error: 'Invalid password.' })
    }
  } else if (password) {
    const passwordError = validatePassword(password)
    if (passwordError) {
      return res.status(400).json({ error: passwordError })
    }
    nextPasswordHash = hashPassword(password)
  }

  const name = normalizeName(req.body?.name)
  const parsed = parseBlueprint(req)
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error })
  }

  const authorName = map.authorName || normalizeAuthorName(req.body?.authorName)

  const updated = updateMap(req.params.mapId, {
    name,
    schemaVersion: SCHEMA_VERSION,
    payload: JSON.stringify(parsed.blueprint),
    authorName,
    passwordHash: nextPasswordHash,
  })

  if (!updated) {
    return res.status(404).json({ error: 'Map not found.' })
  }

  return res.json({
    id: updated.id,
    name: updated.name,
    schemaVersion: updated.schemaVersion,
    authorName: updated.authorName || null,
    blueprint: parsed.blueprint,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  })
}

export function deleteMapHandler(req, res) {
  const map = getMapById(req.params.mapId)
  if (!map) {
    return res.status(404).json({ error: 'Map not found.' })
  }
  const password = normalizePassword(req.body?.password)
  if (map.passwordHash) {
    const passwordError = validatePassword(password)
    if (passwordError) {
      return res.status(400).json({ error: passwordError })
    }
    if (hashPassword(password) !== map.passwordHash) {
      return res.status(403).json({ error: 'Invalid password.' })
    }
  }
  const ok = deleteMap(req.params.mapId)
  if (!ok) {
    return res.status(404).json({ error: 'Map not found.' })
  }
  return res.json({ ok: true })
}
