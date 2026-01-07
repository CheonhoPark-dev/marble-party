import { nanoid } from 'nanoid'
import { PARTICIPANT_TTL_MS } from '../config.js'

const participants = new Map()
const roomParticipants = new Map()
const tokenIndex = new Map()

function getRoomSet(roomId) {
  let set = roomParticipants.get(roomId)
  if (!set) {
    set = new Set()
    roomParticipants.set(roomId, set)
  }
  return set
}

function removeParticipantById(participantId) {
  const participant = participants.get(participantId)
  if (!participant) {
    return
  }
  participants.delete(participantId)
  tokenIndex.delete(participant.displayToken)
  const roomSet = roomParticipants.get(participant.roomId)
  if (roomSet) {
    roomSet.delete(participantId)
    if (roomSet.size === 0) {
      roomParticipants.delete(participant.roomId)
    }
  }
}

export function addParticipant(roomId, displayName) {
  const now = Date.now()
  const participant = {
    participantId: nanoid(10),
    roomId,
    displayName,
    displayToken: nanoid(16),
    isReady: false,
    joinedAt: now,
    lastSeenAt: now,
  }

  participants.set(participant.participantId, participant)
  tokenIndex.set(participant.displayToken, participant.participantId)
  getRoomSet(roomId).add(participant.participantId)

  return participant
}

export function getParticipant(roomId, participantId) {
  const participant = participants.get(participantId)
  if (!participant || participant.roomId !== roomId) {
    return null
  }
  return participant
}

export function getParticipantByToken(roomId, token) {
  const participantId = tokenIndex.get(token)
  if (!participantId) {
    return null
  }
  return getParticipant(roomId, participantId)
}

export function touchParticipant(roomId, token) {
  const participant = getParticipantByToken(roomId, token)
  if (participant) {
    participant.lastSeenAt = Date.now()
  }
  return participant
}

export function updateParticipantReady(roomId, participantId, isReady) {
  const participant = getParticipant(roomId, participantId)
  if (!participant) {
    return null
  }
  participant.isReady = Boolean(isReady)
  participant.lastSeenAt = Date.now()
  return participant
}

export function removeParticipant(roomId, participantId) {
  const participant = getParticipant(roomId, participantId)
  if (!participant) {
    return false
  }
  removeParticipantById(participant.participantId)
  return true
}

export function removeParticipantsByRoom(roomId) {
  const roomSet = roomParticipants.get(roomId)
  if (!roomSet) {
    return
  }
  for (const participantId of roomSet) {
    removeParticipantById(participantId)
  }
  roomParticipants.delete(roomId)
}

export function listParticipants(roomId) {
  const roomSet = roomParticipants.get(roomId)
  if (!roomSet) {
    return []
  }
  return Array.from(roomSet).map((participantId) => participants.get(participantId)).filter(Boolean)
}

export function getRoomStats(roomId) {
  const list = listParticipants(roomId)
  const readyCount = list.filter((participant) => participant.isReady).length
  return { participantCount: list.length, readyCount }
}

export function cleanupParticipants() {
  const now = Date.now()
  for (const participant of participants.values()) {
    if (now - participant.lastSeenAt > PARTICIPANT_TTL_MS) {
      removeParticipantById(participant.participantId)
    }
  }
}
