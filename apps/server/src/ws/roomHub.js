import { WebSocketServer } from 'ws'
import { getRoomById, updateRoomStatus } from '../store/room.js'
import { getParticipantByToken, listParticipants, touchParticipant, getRoomStats } from '../store/participant.js'

const OBSTACLE_COLORS = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#A78BFA', '#34D399', '#F97316', '#38BDF8', '#F472B6']

function normalizeCandidates(rawCandidates) {
  if (!Array.isArray(rawCandidates)) {
    return []
  }
  return rawCandidates
    .map((candidate) => String(candidate ?? '').trim())
    .filter(Boolean)
}

function buildAssignments(roomId) {
  const participants = listParticipants(roomId)
  const assignments = {}

  participants.forEach((participant, index) => {
    assignments[participant.participantId] = {
      obstacleId: index,
      color: OBSTACLE_COLORS[index % OBSTACLE_COLORS.length],
      nickname: participant.displayName || `Player ${index + 1}`,
    }
  })



  return assignments
}

function safeJsonParse(payload) {
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

export function attachRoomHub(server) {
  const wss = new WebSocketServer({ server, path: '/ws' })
  const rooms = new Map()
  const clients = new Map()
  const roomAssignments = new Map()

  function getRoomClients(roomId) {
    let roomSet = rooms.get(roomId)
    if (!roomSet) {
      roomSet = new Set()
      rooms.set(roomId, roomSet)
    }
    return roomSet
  }

  function broadcastToRoom(roomId, payload, shouldSend) {
    const roomSet = rooms.get(roomId)
    if (!roomSet) {
      return
    }
    const message = JSON.stringify(payload)
    for (const ws of roomSet) {
      if (ws.readyState !== ws.OPEN) {
        continue
      }
      const client = clients.get(ws)
      if (shouldSend && !shouldSend(client)) {
        continue
      }
      ws.send(message)
    }
  }

  function broadcastRoomState(roomId) {
    const stats = getRoomStats(roomId)
    broadcastToRoom(roomId, { type: 'room_state', ...stats })
  }

  function removeClient(ws) {
    const client = clients.get(ws)
    if (!client) {
      return
    }
    const roomSet = rooms.get(client.roomId)
    if (roomSet) {
      roomSet.delete(ws)
      if (roomSet.size === 0) {
        rooms.delete(client.roomId)
        roomAssignments.delete(client.roomId)
      }
    }
    clients.delete(ws)
  }

  function handleJoin(ws, message) {
    const { roomId, role, token } = message
    if (!roomId || !role || !token) {
      return
    }

    const room = getRoomById(roomId)
    if (!room) {
      return
    }

    if (role === 'host') {
      if (room.hostKey !== token) {
        return
      }
      clients.set(ws, { roomId, role })
      getRoomClients(roomId).add(ws)
      broadcastRoomState(roomId)
      return
    }

    if (role === 'participant') {
      const participant = getParticipantByToken(roomId, token)
      if (!participant) {
        return
      }
      touchParticipant(roomId, token)
      clients.set(ws, { roomId, role, participantId: participant.participantId })
      getRoomClients(roomId).add(ws)
      broadcastRoomState(roomId)
    }
  }

  function handleStartGame(ws, message) {
    const client = clients.get(ws)
    if (!client || client.role !== 'host') {
      return
    }
    const room = getRoomById(client.roomId)
    if (!room) {
      return
    }

    updateRoomStatus(client.roomId, 'playing')

    const candidates = normalizeCandidates(message?.candidates)
    const assignments = buildAssignments(client.roomId)
    roomAssignments.set(client.roomId, assignments)

    broadcastToRoom(client.roomId, {
      type: 'game_started',
      roomId: client.roomId,
      candidates,
      assignments,
    })

    broadcastRoomState(client.roomId)
  }

  function handleObstacleAction(ws, message) {
    const client = clients.get(ws)
    if (!client || client.role !== 'participant') {
      return
    }
    const room = getRoomById(client.roomId)
    if (!room) {
      return
    }

    const assignments = roomAssignments.get(client.roomId)
    const assignment = assignments?.[client.participantId]
    if (!assignment) {
      return
    }

    broadcastToRoom(client.roomId, {
      type: 'obstacle_action',
      roomId: client.roomId,
      participantId: client.participantId,
      obstacleId: assignment.obstacleId,
      action: message?.action || 'tap',
    })
  }

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const message = safeJsonParse(data)
      if (!message || !message.type) {
        return
      }

      if (message.type === 'join') {
        handleJoin(ws, message)
        return
      }

      if (message.type === 'start_game') {
        handleStartGame(ws, message)
        return
      }

      if (message.type === 'obstacle_action') {
        handleObstacleAction(ws, message)
      }
    })

    ws.on('close', () => {
      removeClient(ws)
    })
  })

  return {
    broadcastRoomState,
  }
}
