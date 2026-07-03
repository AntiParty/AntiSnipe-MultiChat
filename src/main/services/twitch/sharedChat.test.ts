import { describe, it, expect } from 'vitest'
import { getSharedChatInfo, shouldDropSharedMessage } from './sharedChat'

describe('getSharedChatInfo', () => {
  it('returns null for regular (non-shared) messages', () => {
    expect(getSharedChatInfo({ 'room-id': '111' }, '111')).toBeNull()
  })

  it('marks a message foreign when it originated in another room', () => {
    const info = getSharedChatInfo(
      { 'source-room-id': '222', 'room-id': '111' },
      '111'
    )
    expect(info).toEqual({ sourceRoomId: '222', isForeign: true })
  })

  it('marks a message native when the source room is the current room', () => {
    const info = getSharedChatInfo(
      { 'source-room-id': '111', 'room-id': '111' },
      '111'
    )
    expect(info).toEqual({ sourceRoomId: '111', isForeign: false })
  })

  it('falls back to the room-id tag when the broadcaster id is not yet known', () => {
    const info = getSharedChatInfo({ 'source-room-id': '222', 'room-id': '111' }, undefined)
    expect(info).toEqual({ sourceRoomId: '222', isForeign: true })
  })

  it('is not foreign when neither current room nor room-id tag is known', () => {
    const info = getSharedChatInfo({ 'source-room-id': '222' }, undefined)
    expect(info).toEqual({ sourceRoomId: '222', isForeign: false })
  })
})

describe('shouldDropSharedMessage', () => {
  it('drops foreign copies when their home channel is open', () => {
    expect(shouldDropSharedMessage({ sourceRoomId: '222', isForeign: true }, true)).toBe(true)
  })

  it('keeps foreign messages from channels the user has not joined', () => {
    expect(shouldDropSharedMessage({ sourceRoomId: '222', isForeign: true }, false)).toBe(false)
  })

  it('never drops native messages or non-shared messages', () => {
    expect(shouldDropSharedMessage({ sourceRoomId: '111', isForeign: false }, true)).toBe(false)
    expect(shouldDropSharedMessage(null, true)).toBe(false)
  })
})
