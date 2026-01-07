import http from 'node:http'
import { createApp } from './app.js'
import { attachRoomHub } from './ws/roomHub.js'
import { cleanupRooms } from './store/room.js'
import { cleanupParticipants } from './store/participant.js'
import { PORT, SWEEP_INTERVAL_MS } from './config.js'

const app = createApp()
const server = http.createServer(app)

const roomHub = attachRoomHub(server)
app.locals.roomHub = roomHub

setInterval(() => {
  cleanupRooms()
  cleanupParticipants()
}, SWEEP_INTERVAL_MS)

server.listen(PORT, () => {
  console.log(`marble-party server listening on ${PORT}`)
})
