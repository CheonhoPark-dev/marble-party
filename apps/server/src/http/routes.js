import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  createRoomHandler,
  getRoomStatusHandler,
  joinRoomHandler,
  readyParticipantHandler,
  leaveRoomHandler,
  closeRoomHandler,
  touchParticipantHandler,
} from './handlers/room.js'
import {
  createMapHandler,
  deleteMapHandler,
  getMapHandler,
  listMapsHandler,
  updateMapHandler,
} from './handlers/map.js'

const createRoomLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

const createMapLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

const router = Router()

router.post('/rooms', createRoomLimiter, createRoomHandler)
router.get('/rooms/:roomId', getRoomStatusHandler)
router.delete('/rooms/:roomId', closeRoomHandler)
router.post('/rooms/join', joinRoomHandler)
router.post('/rooms/:roomId/participants/:participantId/ready', touchParticipantHandler, readyParticipantHandler)
router.post('/rooms/:roomId/leave', touchParticipantHandler, leaveRoomHandler)

router.get('/maps', listMapsHandler)
router.post('/maps', createMapLimiter, createMapHandler)
router.get('/maps/:mapId', getMapHandler)
router.put('/maps/:mapId', updateMapHandler)
router.delete('/maps/:mapId', deleteMapHandler)

export default router
