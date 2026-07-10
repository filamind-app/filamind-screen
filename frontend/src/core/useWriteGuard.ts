// Shared write-availability state: whether gated writes are allowed now, and a reason when not.

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'

export function useWriteGuard() {
  const { t } = useI18n()
  const session = useSessionStore()
  const ctl = useControlStore()

  // Deliberately NOT gated on ctl.busy: the control store is multi-flight, and folding the
  // in-flight refcount in here would disable Pause/Cancel for the whole duration of any other
  // write (e.g. the PAUSE parking macro) - exactly when stopping the print matters most.
  const canWrite = computed(() => session.live && session.klippyReady && !ctl.safeMode)
  const blockedReason = computed(() => {
    if (ctl.safeMode) return t('control.blocked.safe')
    if (!session.live || !session.klippyReady) return t('control.blocked.offline')
    return ''
  })

  return { canWrite, blockedReason }
}
