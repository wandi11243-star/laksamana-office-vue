// HR API calls (laksamana-api/docs/api/hr.md). One document, one revision:
// every read carries `meta.version` (= `_rev`), every write sends it back as
// `If-Match` and the server refuses a stale writer with 428/409 — the legacy
// "Perubahan Tidak Tersimpan" modal maps 1:1 onto `tanganiKonflik`.
//
// Records live on many resources, so the CRUD helpers are generic; the
// nested maps (kpi-actuals / monthly-inputs / settings / attendance) and the
// append-only audit have their own calls.
import type { HrAkademiStat, HrEmployee, HrState } from '~/utils/hr'
import { isOfficeHrAdmin, normalHr } from '~/utils/hr'
import type { Versi } from '~/utils/versi'
import { ifMatch, versiDari } from '~/utils/versi'

/** The current rev of the whole HR document, shared by every write. */
export const useHrVersi = () => useState<Versi | undefined>('hr-versi', () => undefined)

export function useHrState() {
  const versi = useHrVersi()
  return useAsyncData('hr-state', async () => {
    const r = await useApi()<Envelope<unknown>>('/hr/state')
    versi.value = versiDari(r)
    return normalHr(r.data)
  }, { default: () => normalHr(null) })
}

/** Akademi completion per Office user id (`GET /hr/training-stats`). */
export const useHrTrainingStats = () =>
  useAsyncData('hr-training-stats', () => useApi()<Envelope<Record<string, HrAkademiStat>>>('/hr/training-stats').then(r => r.data), {
    default: () => ({}) as Record<string, HrAkademiStat>,
  })

/** One write with the document rev attached; keeps the rev fresh on success. */
export async function hrTulis<T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: Record<string, unknown>) {
  const versi = useHrVersi()
  const r = await useApi()<Envelope<T>>(path, {
    method,
    body,
    headers: versi.value !== undefined ? ifMatch(versi.value) : undefined,
  })
  const nv = versiDari(r)
  if (nv !== undefined) versi.value = nv
  return r
}

// ---------------------------------------------------------------- records

export const hrCreate = <T>(res: string, body: Record<string, unknown>) => hrTulis<T>(`/hr/${res}`, 'POST', body)
export const hrUpdate = <T>(res: string, id: string, body: Record<string, unknown>) => hrTulis<T>(`/hr/${res}/${id}`, 'PUT', body)
export const hrPatch = <T>(res: string, id: string, body: Record<string, unknown>) => hrTulis<T>(`/hr/${res}/${id}`, 'PATCH', body)
export const hrDelete = <T>(res: string, id: string) => hrTulis<T>(`/hr/${res}/${id}`, 'DELETE')

// ---------------------------------------------------------------- nested maps

export const hrSaveKpiActual = (divId: string, mk: string, itemId: string, value: number | null) =>
  hrTulis<{ saved: boolean }>(`/hr/kpi-actuals/${divId}/${mk}/${itemId}`, 'PUT', { value })

export const hrSaveMonthlyInput = (empId: string, mk: string, value: Record<string, unknown> | null) =>
  hrTulis<{ saved: boolean }>(`/hr/monthly-inputs/${empId}/${mk}`, 'PUT', { value })

export const hrSaveSetting = (key: string, value: unknown) =>
  hrTulis<{ saved: boolean }>(`/hr/settings/${key}`, 'PUT', { value })

export const hrSaveAttendance = (mk: string, value: unknown | null) =>
  hrTulis<{ saved: boolean }>(`/hr/attendance/${mk}`, 'PUT', { value })

/** Audit is append-only and does not bump the rev, so it needs no If-Match. */
export const hrPostAudit = (action: string, detail = '') =>
  useApi()<Envelope<{ id: string }>>('/hr/audit', { method: 'POST', body: { action, detail } })

// ---------------------------------------------------------------- base

/**
 * Everything a screen needs: the document, the viewer's employee record, and
 * their standing. A session without an `employees` row is served an in-memory
 * incomplete record, like the old `resolveOfficeUser` (:899) — HRD completes
 * it on the Kru page; the login itself never writes (F.14).
 */
export function useHrDasar() {
  const me = useMe()
  const { data: state, pending: pendingState, error, refresh } = useHrState()
  const { data: akademi } = useHrTrainingStats()
  const s = computed<HrState>(() => state.value ?? normalHr(null))
  const officeAdmin = computed(() => isOfficeHrAdmin(me.value))

  const cu = computed<HrEmployee | null>(() => {
    const m = me.value
    if (!m) return null
    const found = s.value.employees.find(e => e.id === m.id)
    if (found) return found
    return {
      id: m.id,
      name: m.name,
      role: m.keterangan || '',
      divId: '',
      level: 'Staff',
      appRole: isOfficeHrAdmin(m) ? 'hr' : 'staff',
      joinDate: '',
      birthDate: '',
      status: 'Aktif',
      phone: '',
      email: '',
      notes: '',
      probationEnd: '',
      contractEnd: '',
    }
  })

  const pending = computed(() => pendingState.value)

  return { me, s, state, akademi, cu, officeAdmin, pending, error, refresh }
}
