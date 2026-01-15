import { Router } from 'express'
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

const router = Router()

router.post('/rooms', createRoomHandler)
router.get('/rooms/:roomId', getRoomStatusHandler)
router.delete('/rooms/:roomId', closeRoomHandler)
router.post('/rooms/join', joinRoomHandler)
router.post('/rooms/:roomId/participants/:participantId/ready', touchParticipantHandler, readyParticipantHandler)
router.post('/rooms/:roomId/leave', touchParticipantHandler, leaveRoomHandler)

router.get('/maps', listMapsHandler)
router.post('/maps', createMapHandler)
router.get('/maps/:mapId', getMapHandler)
router.put('/maps/:mapId', updateMapHandler)
router.delete('/maps/:mapId', deleteMapHandler)

export default router
