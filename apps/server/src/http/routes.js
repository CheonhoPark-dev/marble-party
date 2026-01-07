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

const router = Router()

router.post('/rooms', createRoomHandler)
router.get('/rooms/:roomId', getRoomStatusHandler)
router.delete('/rooms/:roomId', closeRoomHandler)
router.post('/rooms/join', joinRoomHandler)
router.post('/rooms/:roomId/participants/:participantId/ready', touchParticipantHandler, readyParticipantHandler)
router.post('/rooms/:roomId/leave', touchParticipantHandler, leaveRoomHandler)

export default router
