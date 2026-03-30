import type { StateCreator } from 'zustand'
import type { AuthState, AllAuthState } from '@shared/types/ipc'

export interface AuthSlice {
  auth: AllAuthState
  updateAuthState: (platform: 'twitch' | 'youtube', state: AuthState) => void
  hydrateAuth: (auth: AllAuthState) => void
}

export const createAuthSlice: StateCreator<
  AuthSlice,
  [['zustand/immer', never]],
  [],
  AuthSlice
> = set => ({
  auth: {
    twitch: { status: 'unauthenticated' },
    youtube: { status: 'unauthenticated' }
  },

  updateAuthState: (platform, authState) => {
    set(state => {
      state.auth[platform] = authState
    })
  },

  hydrateAuth: auth => {
    set(state => {
      state.auth = auth
    })
  }
})
