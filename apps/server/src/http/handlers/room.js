import qrcode from 'qrcode'
import { buildJoinUrl, isValidRoomCode, normalizeRoomCode, sanitizeDisplayName } from '@repo/internal-utils'
import { createRoom, getRoomByCode, getRoomById, closeRoom } from '../../store/room.js'
import {
  addParticipant,
  getParticipant,
  getParticipantByToken,
  getRoomStats,
  removeParticipant,
  removeParticipantsByRoom,
  updateParticipantReady,
  touchParticipant,
} from '../../store/participant.js'

function getBearerToken(req) {
  const header = req.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : ''
}

function getHostKey(req) {
  return req.get('x-host-key') || ''
}

function getBaseUrl(req) {
  return req.get('origin') || `${req.protocol}://${req.get('host')}`
}

export async function createRoomHandler(req, res) {
  const room = createRoom()
  const joinUrl = buildJoinUrl(getBaseUrl(req), room.roomCode)
  const qrDataUrl = joinUrl ? await qrcode.toDataURL(joinUrl) : ''

  res.status(201).json({
    roomId: room.roomId,
    roomCode: room.roomCode,
    hostKey: room.hostKey,
    joinUrl,
    qrDataUrl,
    ...getRoomStats(room.roomId),
  })
}

export function getRoomStatusHandler(req, res) {
  const room = getRoomById(req.params.roomId)
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' })
  }
  res.json({
    roomId: room.roomId,
    roomCode: room.roomCode,
    status: room.status,
    ...getRoomStats(room.roomId),
  })
}

export function joinRoomHandler(req, res) {
  const roomCode = normalizeRoomCode(req.body?.roomCode)
  if (!isValidRoomCode(roomCode)) {
    return res.status(400).json({ error: 'Invalid room code.' })
  }

  const room = getRoomByCode(roomCode)
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' })
  }

  const displayName = sanitizeDisplayName(req.body?.displayName)
  const participant = addParticipant(room.roomId, displayName)

  const roomHub = req.app.locals.roomHub
  if (roomHub) {
    roomHub.broadcastRoomState(room.roomId)
  }

  res.json({
    roomId: room.roomId,
    roomCode: room.roomCode,
    participantId: participant.participantId,
    displayToken: participant.displayToken,
  })
}

export function readyParticipantHandler(req, res) {
  const roomId = req.params.roomId
  const participantId = req.params.participantId
  const token = getBearerToken(req)
  const participant = getParticipant(roomId, participantId)

  if (!participant || participant.displayToken !== token) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }

  updateParticipantReady(roomId, participantId, req.body?.isReady)

  const roomHub = req.app.locals.roomHub
  if (roomHub) {
    roomHub.broadcastRoomState(roomId)
  }

  res.json({ ok: true })
}

export function leaveRoomHandler(req, res) {
  const roomId = req.params.roomId
  const token = getBearerToken(req)
  const participant = getParticipantByToken(roomId, token)

  if (!participant) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }

  removeParticipant(roomId, participant.participantId)

  const roomHub = req.app.locals.roomHub
  if (roomHub) {
    roomHub.broadcastRoomState(roomId)
  }

  res.json({ ok: true })
}

export function closeRoomHandler(req, res) {
  const roomId = req.params.roomId
  const hostKey = getHostKey(req)

  if (!hostKey) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }

  const result = closeRoom(roomId, hostKey)
  if (!result.ok) {
    if (result.error === 'unauthorized') {
      return res.status(401).json({ error: 'Unauthorized.' })
    }
    return res.status(404).json({ error: 'Room not found.' })
  }

  removeParticipantsByRoom(roomId)

  const roomHub = req.app.locals.roomHub
  if (roomHub) {
    roomHub.broadcastRoomState(roomId)
  }

  res.json({ ok: true })
}

export function touchParticipantHandler(req, res, next) {
  const roomId = req.params.roomId
  const token = getBearerToken(req)
  if (token) {
    touchParticipant(roomId, token)
  }
  next()
}
