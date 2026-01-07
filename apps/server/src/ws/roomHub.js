import { WebSocketServer } from 'ws'
import { getRoomById, updateRoomStatus } from '../store/room.js'
import { getParticipantByToken, touchParticipant, getRoomStats } from '../store/participant.js'

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

  function handleStartGame(ws) {
    const client = clients.get(ws)
    if (!client || client.role !== 'host') {
      return
    }
    const room = getRoomById(client.roomId)
    if (!room) {
      return
    }
    updateRoomStatus(client.roomId, 'playing')
    broadcastToRoom(client.roomId, { type: 'game_started', roomId: client.roomId })
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
    broadcastToRoom(client.roomId, {
      type: 'obstacle_action',
      roomId: client.roomId,
      participantId: client.participantId,
      obstacleId: message?.obstacleId || null,
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
        handleStartGame(ws)
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
