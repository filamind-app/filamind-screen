// Shared write-availability state: whether gated writes are allowed now, and a reason when not.

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'

export function useWriteGuard() {
  const { t } = useI18n()
  const session = useSessionStore()
  const ctl = useControlStore()

  const canWrite = computed(() => session.live && session.klippyReady && !ctl.safeMode && !ctl.busy)
  const blockedReason = computed(() => {
    if (ctl.safeMode) return t('control.blocked.safe')
    if (!session.live || !session.klippyReady) return t('control.blocked.offline')
    if (ctl.busy) return t('control.blocked.busy')
    return ''
  })

  return { canWrite, blockedReason }
}
