export const cn = (...classes) => classes.filter(Boolean).join(' ')

export const ROOM_CODE_LENGTH = 4
export const MAX_DISPLAY_NAME_LENGTH = 12
export const ROOM_CODE_PATTERN = new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`)

export function normalizeRoomCode(input) {
  return String(input ?? '').replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH)
}

export function formatRoomCode(input) {
  const normalized = normalizeRoomCode(input)
  return normalized.padStart(ROOM_CODE_LENGTH, '0')
}

export function isValidRoomCode(code) {
  return ROOM_CODE_PATTERN.test(String(code))
}

export function createRoomCode() {
  const random = Math.floor(Math.random() * Math.pow(10, ROOM_CODE_LENGTH))
  return formatRoomCode(random)
}

export function sanitizeDisplayName(name) {
  const trimmed = String(name ?? '').trim().replace(/\s+/g, ' ')
  return trimmed.slice(0, MAX_DISPLAY_NAME_LENGTH)
}

export function safePathSegment(segment) {
  return String(segment ?? '').replace(/[^a-zA-Z0-9-_]/g, '')
}

export function buildJoinUrl(baseUrl, roomCode) {
  try {
    const url = new URL(baseUrl)
    url.searchParams.set('code', normalizeRoomCode(roomCode))
    return url.toString()
  } catch {
    return ''
  }
}
