import { nanoid } from 'nanoid'
import { createRoomCode } from '@repo/internal-utils'
import { ROOM_TTL_MS } from '../config.js'

const rooms = new Map()
const roomCodes = new Map()

function createUniqueRoomCode() {
  let attempts = 0
  while (attempts < 10) {
    const code = createRoomCode()
    if (!roomCodes.has(code)) {
      return code
    }
    attempts += 1
  }
  return createRoomCode()
}

function isRoomExpired(room) {
  return Date.now() > room.expiresAt
}

function removeRoom(room) {
  rooms.delete(room.roomId)
  roomCodes.delete(room.roomCode)
}

export function createRoom() {
  const createdAt = Date.now()
  const roomId = nanoid(10)
  const roomCode = createUniqueRoomCode()
  const hostKey = nanoid(16)
  const room = {
    roomId,
    roomCode,
    hostKey,
    status: 'waiting',
    createdAt,
    expiresAt: createdAt + ROOM_TTL_MS,
  }

  rooms.set(roomId, room)
  roomCodes.set(roomCode, roomId)

  return room
}

export function getRoomById(roomId) {
  const room = rooms.get(roomId)
  if (!room) {
    return null
  }
  if (isRoomExpired(room)) {
    removeRoom(room)
    return null
  }
  return room
}

export function getRoomByCode(roomCode) {
  const roomId = roomCodes.get(roomCode)
  if (!roomId) {
    return null
  }
  return getRoomById(roomId)
}

export function closeRoom(roomId, hostKey) {
  const room = getRoomById(roomId)
  if (!room) {
    return { ok: false, error: 'not_found' }
  }
  if (room.hostKey !== hostKey) {
    return { ok: false, error: 'unauthorized' }
  }
  removeRoom(room)
  return { ok: true }
}

export function cleanupRooms() {
  for (const room of rooms.values()) {
    if (isRoomExpired(room)) {
      removeRoom(room)
    }
  }
}
