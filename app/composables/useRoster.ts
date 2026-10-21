// Office rosters — fondasi F2, the one replacement for the legacy
// `listModuleRoster` / `listDivisiRoster` calls every module used to make at
// boot. Both reads are open to any signed-in account (laksamana-api
// app/Modules/Account/routes/v1.php:16-18), so a screen only needs the module
// it already has.
//
// Read-only on purpose: writing the roster (POST/PATCH /account/roster) belongs
// to the jadwal module (Pengelola Roster), never here.
//
// Source: laksamana-api/docs/api/account.md "Rosters"; app/Auth/OfficeAccess.php:59-66 (HR columns).

/** `GET /account/roster` — every Office User, never a PIN. Same as legacy `listDivisiRoster`. */
export interface RosterUser {
  id: string
  name: string
  keterangan: string
  noHp: string
  talentaId: string
  active: boolean
  // The six HR columns (OfficeAccess::HR_COLUMNS).
  branch: string
  organization: string
  jobPosition: string
  jobLevel: string
  employmentStatus: string
  joinDate: string
  /** Only the enriched jadwal read (`GET /jadwal/roster`, module `jadwal`) resolves this. */
  divisi?: string
}

/** `GET /account/modules/{module}/members` — users holding one module. Same as legacy `listModuleRoster`. */
export interface ModulMember extends RosterUser {
  username: string
  isModuleAdmin: boolean
}

/** Every Office User, for pickers of crew and divisi. */
export const useRoster = () =>
  useAsyncData('roster', () => useApi()<Envelope<RosterUser[]>>('/account/roster').then(r => r.data), { dedupe: 'defer', default: () => [] })

/** The users who hold one module, e.g. `useModulMembers('reservasi')`. */
export const useModulMembers = (modul: string) =>
  useAsyncData(`members-${modul}`, () => useApi()<Envelope<ModulMember[]>>(`/account/modules/${modul}/members`).then(r => r.data), { dedupe: 'defer', default: () => [] })
