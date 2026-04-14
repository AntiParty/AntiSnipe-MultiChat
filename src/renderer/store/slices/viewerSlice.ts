import type { ViewerEntry, ViewerListPayload } from '@shared/types/viewer'

export type { ViewerEntry, ViewerListPayload }

export interface ViewerSlice {
  viewersByChannel: Record<string, ViewerEntry[]>
  viewerTotalByChannel: Record<string, number>
  viewerIsApiByChannel: Record<string, boolean>
  viewerListOpen: boolean

  setViewerList: (payload: ViewerListPayload) => void
  toggleViewerList: () => void
  openViewerList: () => void
  closeViewerList: () => void
}
