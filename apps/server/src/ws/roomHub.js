import { WebSocketServer } from 'ws'
import { getRoomById } from '../store/room.js'
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

  function broadcastRoomState(roomId) {
    const stats = getRoomStats(roomId)
    const roomSet = rooms.get(roomId)
    if (!roomSet) {
      return
    }
    const payload = JSON.stringify({ type: 'room_state', ...stats })
    for (const ws of roomSet) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload)
      }
    }
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

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const message = safeJsonParse(data)
      if (!message || message.type !== 'join') {
        return
      }

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
    })

    ws.on('close', () => {
      removeClient(ws)
    })
  })

  return {
    broadcastRoomState,
  }
}
