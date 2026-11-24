import { createEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik } from '~/utils/versi'

/**
 * Saving a new event plan (`eventForm(null,{status:'Planning'})`), shared by
 * Perencanaan and the Kalender: the body of EventForm becomes a Planning row
 * created by the signed-in account. `sesudah` reloads the caller's data.
 * Resolves true when the plan was saved.
 */
export function useRencanaBaru(sesudah: () => Promise<unknown>) {
  const toast = useToast()
  const me = useMe()

  async function simpan(body: Record<string, unknown>, ideaId: unknown = null): Promise<boolean> {
    try {
      await createEvent('events', {
        ...body,
        idea_id: ideaId ?? null,
        status: 'Planning',
        createdBy: me.value?.name ?? '',
        createdById: me.value?.id ?? '',
        createdAt: Date.now(),
      })
      toast.add({ title: 'Rencana baru dibuat', color: 'success' })
      await sesudah()
      return true
    }
    catch (e) {
      if (!(await tanganiKonflik(e, sesudah))) toast.add({ title: apiErrorMessage(e), color: 'error' })
      return false
    }
  }

  return { simpan }
}
