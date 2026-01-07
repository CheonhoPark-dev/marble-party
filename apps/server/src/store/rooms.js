import { nanoid } from 'nanoid'
import { createRoomCode } from '@repo/internal-utils'
import { ROOM_TTL_MS, PARTICIPANT_TTL_MS } from '../config.js'

const roomsById = new Map()
const roomIdByCode = new Map()

function nowMs() {
  return Date.now()
}

function buildRoom() {
  const roomId = nanoid(10)
  const roomCode = createRoomCode()
  const hostKey = nanoid(24)
  const createdAt = nowMs()
  const expiresAt = createdAt + ROOM_TTL_MS
  return {
    roomId,
    roomCode,
    hostKey,
    status: 'waiting',
    createdAt,
    expiresAt,
    participants: new Map(),
    participantIdByToken: new Map(),
  }
}

function buildParticipant(displayName) {
  const participantId = nanoid(10)
  const displayToken = nanoid(24)
  const joinedAt = nowMs()
  return {
    participantId,
    displayName,
    displayToken,
    isReady: false,
    joinedAt,
    lastSeenAt: joinedAt,
  }
}

export function createRoom() {
  let room = buildRoom()
  while (roomIdByCode.has(room.roomCode)) {
    room = buildRoom()
  }
  roomsById.set(room.roomId, room)
  roomIdByCode.set(room.roomCode, room.roomId)
  return room
}

export function getRoomById(roomId) {
  const room = roomsById.get(roomId)
  if (!room) return null
  if (room.expiresAt <= nowMs()) {
    deleteRoom(room)
    return null
  }
  return room
}

export function getRoomByCode(roomCode) {
  const roomId = roomIdByCode.get(roomCode)
  if (!roomId) return null
  return getRoomById(roomId)
}

export function validateHost(roomId, hostKey) {
  const room = getRoomById(roomId)
  if (!room) return false
  return room.hostKey === hostKey
}

export function addParticipant(roomId, displayName) {
  const room = getRoomById(roomId)
  if (!room) return null
  const participant = buildParticipant(displayName)
  room.participants.set(participant.participantId, participant)
  room.participantIdByToken.set(participant.displayToken, participant.participantId)
  return participant
}

export function getParticipant(roomId, participantId) {
  const room = getRoomById(roomId)
  if (!room) return null
  return room.participants.get(participantId) || null
}

export function getParticipantByToken(roomId, displayToken) {
  const room = getRoomById(roomId)
  if (!room) return null
  const participantId = room.participantIdByToken.get(displayToken)
  if (!participantId) return null
  return room.participants.get(participantId) || null
}

export function markParticipantReady(roomId, participantId, isReady) {
  const participant = getParticipant(roomId, participantId)
  if (!participant) return null
  participant.isReady = Boolean(isReady)
  participant.lastSeenAt = nowMs()
  return participant
}

export function touchParticipant(roomId, participantId) {
  const participant = getParticipant(roomId, participantId)
  if (!participant) return null
  participant.lastSeenAt = nowMs()
  return participant
}

export function removeParticipantByToken(roomId, displayToken) {
  const room = getRoomById(roomId)
  if (!room) return false
  const participantId = room.participantIdByToken.get(displayToken)
  if (!participantId) return false
  room.participants.delete(participantId)
  room.participantIdByToken.delete(displayToken)
  return true
}

export function closeRoom(roomId) {
  const room = getRoomById(roomId)
  if (!room) return false
  deleteRoom(room)
  return true
}

export function getRoomState(roomId) {
  const room = getRoomById(roomId)
  if (!room) return null
  let readyCount = 0
  for (const participant of room.participants.values()) {
    if (participant.isReady) readyCount += 1
  }
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    status: room.status,
    participantCount: room.participants.size,
    readyCount,
  }
}

export function sweepExpiredRooms() {
  const cutoff = nowMs()
  for (const room of roomsById.values()) {
    if (room.expiresAt <= cutoff) {
      deleteRoom(room)
      continue
    }
    sweepParticipants(room)
  }
}

function sweepParticipants(room) {
  const cutoff = nowMs() - PARTICIPANT_TTL_MS
  for (const participant of room.participants.values()) {
    if (participant.lastSeenAt <= cutoff) {
      room.participantIdByToken.delete(participant.displayToken)
      room.participants.delete(participant.participantId)
    }
  }
}

function deleteRoom(room) {
  roomsById.delete(room.roomId)
  roomIdByCode.delete(room.roomCode)
}
