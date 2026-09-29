# HR — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - Roster Office: ❌ `listModuleRoster` → ✅ `GET /api/v1/account/modules/hr/members` (U2, T-01).
> - Impor & reset massal → K-01. Audit 800 baris → T-09 / G-11.

## Ringkasan
- Jumlah layar: 17 (0 tersembunyi; 4 di antaranya admin `manageOps`) · Aksi backend lama: 4 (`ping`, `stats`, `getAll`, `saveAll`) + 2 lintas modul (`listModuleRoster`, `trainingStats`) · Gap v1: **0 ❌ · 4 ⚠️** (bentuk simpan, roster Office, impor, reset)
- Staff Performance (People OS) untuk krunya Laksamana Muda: skor bulanan (People Score) dari tujuh komponen (kehadiran Talenta, KPI divisi, training Akademi, customer review, disiplin, teamwork, inisiatif), KPI/OKR, review berlapis, training, kompetensi, coaching, reward/poin, disiplin/SP, engagement (mood & saran), karier/suksesi, data kru, kalender HR, pengaturan, audit. Penggunanya HRD + CEO + manager (kru melihat dirinya sendiri).
- Seluruh skor **dihitung di browser** dari data mentah; tidak ada angka skor yang disimpan server. Migrasi harus memindahkan mesin skor (`peopleScore`, `attendanceDetail`, `kpiItemScore`, `disciplineScore`, `reviewAspectScore`, `activeSP`/`suggestSP`, `nextCertNo`) apa adanya, karena tidak ada di API.
- Risiko terbesar: (1) pola "ubah state lalu `saveAll`" harus dibongkar jadi CRUD per-record + version-check; (2) parser Talenta XLSX tanpa pustaka (kolom dicari lewat judul) harus dipindah setia; (3) data sangat sensitif (PIN/PII kru, SP, nilai review) — gate admin & scope harus benar sebelum data tampil; (4) dua operasi whole-document (impor & reset) tak punya padanan v1.
- Konkurensi v1 **sama** dengan legacy: satu `rev` untuk seluruh dokumen, jadi alur bentrok lama (modal "Perubahan Tidak Tersimpan") dapat dipetakan 1:1.

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | laksamana-office/deploy/hr/index.html | 2.755 |
| backend lama | laksamana-office/hr-mysql/{api.php, lib_hr_mysql.php, schema.sql, README.md} | — |
| kontrak v1 | laksamana-api/docs/api/hr.md | — |
| spec port | laksamana-api/docs/modules/hr.md | — |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md` — tidak ada bagian khusus modul HR (dicari: `grep -n '^#' \| grep -iE 'People\|hr-mysql\|deploy/hr\|SDM\|karyawan\|kru\|kepegawaian'` hanya menemukan §jadwal/DW `:6896`, `:6985`, `:7419`, `:7684`, `:7730`, `:7786`, `:8063` yang tentang roster, bukan modul HR; satu penyebutan lewat di `:11470`) | — |

## B. Akses
- Kunci Modul di launcher: `hr`. Gerbang SSO di `deploy/hr/index.html:9-13`: baca `localStorage['lm_session']`, wajib `expiry` belum lewat dan `modules` memuat `'*'` atau `'hr'`; kalau tidak → `location.replace('../')`.
- Identitas datang dari Office (SSO), modul **tidak punya login sendiri** (`:713-728`). Role internal diturunkan dari status admin modul Office: `officeIsHrAdmin(s)` = `adminModules` memuat `'*'` atau `'hr'` (`:728-731`); `officeToAppRole` memetakan admin → `'hr'`, selain itu → `'staff'` (`:734-737`). **Tidak ada cara jadi `ceo`/`manager` lewat SSO** — `ROLE_LABEL` (`:675`) punya 4 nilai tapi hanya `hr`/`staff` yang bisa lahir dari Office.
- `manageOps` (halaman Operasional & Sistem) = `OFFICE_HR_ADMIN` (superadmin Office + admin modul `hr`, mis. Rizki Arfan), BUKAN `appRole` (`:676-680`, `:728-731`).
- Matriks izin dalam modul (`can(perm)`, `:676-689`):
  | perm | role yang boleh |
  |---|---|
  | manageEmployees, manageSettings, manageDiscipline, manageCareer, seeAll, viewAudit, exportData | `ceo`, `hr` |
  | inputKpi, manageReview, manageTraining, manageReward, coach | `ceo`, `hr`, `manager` |
- `scopeEmps()` (`:699-706`): `seeAll` → semua `Aktif`; `manager` dengan `divId` → divisinya saja; selain itu → dirinya sendiri. Manager tanpa `divId` **sengaja** hanya lihat diri sendiri (bukan semua orang tanpa divisi).
- Gate halaman dijalankan **di router**, bukan hanya sembunyikan nav: `canOpenPage()`/`go()` (`:999-1021`); buka halaman ber-`perm` tanpa hak → `toast('Halaman itu khusus admin.', true)` lalu pindah ke `dash`.
- Aksi khusus admin: Kru (`emp`), Kalender HR (`cal`), Pengaturan (`settings`), Audit Log (`audit`).
- v1 menegakkan gate admin di server: tulis `employees`/`calendar`, `PUT /settings/{key}`, `GET /audit` wajib admin modul (superadmin atau hr admin) atau `403 forbidden`; baca `employees`/`calendar`/`settings` terbuka untuk semua user `hr` (`docs/api/hr.md:12`).

## C. Daftar layar (dari NAV_DEF / TITLES)
Sumber menu: `PAGES` di `deploy/hr/index.html:952-974`; router `go()` `:1004`; pemetaan `RENDER` `:1481`–`:2689`. Tiap layar = satu `RENDER.<key>`.

| key | judul | grup | perm | tampil untuk | bukti |
|---|---|---|---|---|---|
| dash | Anjungan | UTAMA | — | semua | `:954`, `:1481` |
| score | People Score | UTAMA | — | semua | `:955`, `:1554` |
| kehadiran | Kehadiran | KINERJA | — | semua | `:957`, `:1632` |
| kpi | KPI Divisi | KINERJA | — | semua | `:958`, `:1856` |
| okr | OKR & Target | KINERJA | — | semua | `:959`, `:1915` |
| review | Performance Review | KINERJA | — | semua | `:960`, `:1973` |
| training | Training Center | PENGEMBANGAN | — | semua | `:962`, `:2102` |
| comp | Competency Matrix | PENGEMBANGAN | — | semua | `:963`, `:2032` |
| coach | Coaching Log | PENGEMBANGAN | — | semua | `:964`, `:2067` |
| career | Career & Succession | PENGEMBANGAN | — | semua | `:965`, `:2361` |
| reward | Reward & Recognition | BUDAYA | — | semua | `:967`, `:2190` |
| disc | Disiplin | BUDAYA | — | semua | `:968`, `:2262` |
| engage | Engagement | BUDAYA | — | semua | `:969`, `:2310` |
| emp | Kru | OPERASIONAL | `manageOps` | admin modul | `:971`, `:2428` |
| cal | Kalender HR | OPERASIONAL | `manageOps` | admin modul | `:972`, `:2532` |
| settings | Pengaturan | SISTEM | `manageOps` | admin modul | `:973`, `:2568` |
| audit | Audit Log | SISTEM | `manageOps` | admin modul | `:974`, `:2689` |

Jumlah: **17 layar** (14 biasa + 4 admin; `emp`/`cal`/`settings`/`audit` = 4 admin, jadi 13 non-admin). Tidak ada layar tersembunyi di luar daftar.

## D. Detail per layar

Catatan umum: **semua layar memakai satu state `S`** dan menyimpan lewat `save()` (POST `saveAll`, seluruh dokumen). Skor People Score & Kehadiran **dihitung di browser** tiap kali dibaca, bukan disimpan. `scopeEmps()` (`:699`) membatasi siapa yang terlihat. `log()` (`:691`) menulis audit di setiap aksi.

### D.1 dash — Anjungan
- **Tampilan:** kartu sapaan (`Halo, <sapaan> 👋`, divisi + bulan) + People Score diri sendiri (atau "Belum bisa dinilai" bila `completeness < 40`); 4 kartu angka: "Rata-rata People Score", "Training Wajib Selesai", "Pelanggaran Bulan Ini", "Mood Tim" (`kcard` `:1551`); "Insight Otomatis"; "Top 5 People Score"; "KPI per Divisi"; "Agenda Terdekat". Bukti `:1481-1551`.
- **Aksi:** "Buka →" per insight (`go(act)` hanya bila `canOpenPage`), "Lihat semua →" → `score`, "Input KPI →" → `kpi`. Bukti `:1497`, `:1512`, `:1519`.
- **Perhitungan:** `scored = scopeEmps().filter(appRole!=='ceo').map(peopleScore).filter(completeness>=40).sort(score desc)` (`:1483-1485`); `avgScore = avg(...)`, `trainAvg = avg(trainingScore)` (`:1486-1487`); `vioCount` pelanggaran bulan ini non-Dibatalkan (`:1488`); `moodAvg` (`:1489`). Insight dari `buildInsights(mk)` (`:1456`).
- **Catatan:** nama sapaan dari `CU_SAPAAN` (session Office), nama resmi tetap `CU.name` (`:1487` area, `:695`).

### D.2 score — People Score
- **Tampilan:** pemilih bulan (`monthPicker`); catatan bobot; peringatan kru di bawah `SCORE_MIN_COMPLETENESS`; podium 3 besar (bila ≥3 baris); tabel kolom `#, Kru, Divisi, Attend, KPI, Training, Review, Disiplin, Score, Grade, Tren 6 bln, aksi`. Bukti `:1558-1602`.
- **Filter:** pilih bulan; baris dipisah `rows` (completeness ≥ 40, diberi ranking) dan `unrank` (tanpa ranking, redup). `:1560-1562`.
- **Aksi:** "＋ Input Data Bulanan" (bila `can('inputKpi')`) → `openMonthlyInput()`; "Detail" per baris → `openEmpDetail(id)`. `:1563`, `:1590`.
- **Form & field — Input Data Bulanan** (`openMonthlyInput` `:1603-1631`): per kru 3 input — `mi_att_<id>` "Attend %" (0–100), `mi_rev_<id>` "Review 0-100", `mi_kpi_<id>` "KPI Override" (0–120). Simpan menulis `S.monthlyInputs[empId][mk] = {attendance, review, kpiOverride}` (nilai string apa adanya).
- **Perhitungan:** `peopleScore` (`:1361-1391`), bobot `settings.scoreWeights` (attendance 20, kpi 30, training 10, review 15, discipline 10, teamwork 10, initiative 5 — `:585`); komponen kosong → `defaultComponentScore` (75); `completeness` = bobot terisi / total bobot. `gradeOf` (`:1393`) & `gradeTag` (`:1406`, ambang `SCORE_MIN_COMPLETENESS=40` `:1402`). Tren 6 bulan: `lastMonths(6,mk)` (`:1584`).

### D.3 kehadiran — Kehadiran
- **Tampilan:** pemilih bulan (default bulan terakhir yang ada); catatan berkas (`fileName`, `importedBy`, `importedAt`) + aturan; peringatan kru tanpa satu pun check-in (`noData`); peringatan `unmatched` (nama di berkas belum punya Talenta ID); tabel `#, Kru, Divisi, Hari kerja, Hadir, Alpa, Telat, Tanpa out, Presensi, Ketepatan, Skor bulan, Kumulatif, aksi`. Bukti `:1638-1732`.
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ↑ Unggah Report Talenta | `openAttImport()` (bila `can('inputKpi')`) | `saveAll` | `PUT /attendance/{YYYY-MM}` | `:1641`, `:1769` |
  | Hapus bulan ini | `hapusAttBulan(mk)` → `delete S.attendance[mk]` | `saveAll` | `PUT /attendance/{YYYY-MM}` (`null`) | `:1642`, `:1847` |
  | Rincian | `openAttDetail(empId, mk)` | — | — (`GET /attendance`) | `:1728`, `:1739` |
  | Simpan `<bulan>` | `simpanAttImport()` menulis `S.attendance[mk]` | `saveAll` | `PUT /attendance/{YYYY-MM}` | `:1834` |
  | tautan bulan lain | `gotoKehadiran(mk)` | — | — | `:1733` |
- **Form & field — unggah:** file `#attFile` `accept=".xlsx"`; tombol modal "Proses" → `parseTalentaXlsx(file)`; pratinjau lalu "Simpan `<bulan>`". Wajib ada 1 berkas, kalau tidak: `toast('Pilih berkas dulu.', true)` (`:1771`).
- **Impor Talenta (di browser):** baca XLSX sebagai ZIP + XML tanpa pustaka (`unzipEntries` `:1151`, `parseTalentaXlsx` `:1086`); kolom dipetakan lewat **judul** `ATT_KOLOM` (`:1064`); kolom wajib `['talentaId','name','date','shift']`; baris non-tanggal (mis. "TOTAL FOR EMPLOYEE") dilewati; pencocokan kru **hanya lewat `talentaId`**, tidak menebak nama (`:1806-1812`); baris `resign === 'resigned'` dilewati (`:1802`); bulan diambil dari tanggal terbanyak (`:1795-1797`).
- **Perhitungan — `attendanceDetail(empId, mk)` (`:1214-1287`):** urutan per hari: (1) `isOffShift` → `libur`; (2) `code` ber-jatah `excusedCaps` → `izin` selama ≤ jatah, lebih → `izinLewatJatah`+`alpa`; (3) `excusedCodes` (`OTL`,`CT`,`CKM`) → `izin`; (4) ada `checkIn` → `hadir` (penuh / `noCheckoutCredit` bila tanpa `checkOut`); (5) sisanya `alpa`. Penalti telat: `min((lateMin-tol)/(cap-tol),1)` hanya bila `lateMin>tol` (`:1268-1273`). `presence = kredit/hariKerja*100`; `punctuality = clamp((1 - penaltiTelat/hariKerja)*100,0,100)`; `score = clamp((presence*wP + punctuality*wQ)/totalW,0,100)` (wP=70, wQ=30). `hadir===0` sebulan → `noData`, `score=null`. `hariKerja===0` → `null`. `attendanceCumulative` (`:1295`) menimbang per `hariKerja`.
- **Aturan default (`settings.attendanceRules`, `:618-635`):** `lateToleranceMin:15`, `lateCapMin:45`, `noCheckoutCredit:0.5`, `excusedCaps:{I:3,S:2}`, `excusedCodes:['OTL','CT','CKM']`, `offShifts:['dayoff','National Holiday']`, `offShiftContains:['dayoff','day off','libur','holiday']`, `weights:{presence:70,punctuality:30}`.

### D.4 kpi — KPI Divisi
- **Tampilan:** pemilih bulan; satu kartu per divisi ber-template KPI: skor (warna ok ≥100 / gold ≥85 / warn), tabel `Indikator, Bobot, Target, Aktual, Skor` dengan panah `↓`/`↑`. Bukti `:1857-1879`.
- **Aksi:** "✎ Edit Template KPI" (bila `can('manageSettings')`) → `editKpiTemplate()`; "Input" per divisi (bila `can('inputKpi')`) → `inputKpiActual(divId)`. `:1859`, `:1870`.
- **Form — Input KPI** (`:1880`): satu input number per item, label `<nama> (<unit>), target <n>`; simpan `S.kpiActuals[divId][mk]` (hapus key bila kosong). Guard: non-`seeAll` hanya bisa divisi sendiri → `toast('Anda hanya bisa input KPI divisi sendiri.', true)`.
- **Form — Edit Template KPI** (`:1895`): per item: `name`, `weight`, `target`, `unit`, `dir` (`up`/`down`); catatan "Mengubah bobot/target berlaku untuk semua bulan (histori dihitung ulang). Ubah dengan sadar."
- **Perhitungan:** `kpiItemScore` (`:1024`): `dir==='down'` → `actual<=0?120:(target/actual)*100`, else `target<=0?100:(actual/target)*100`, `clamp(0,120)`. `divKpiScore` (`:1032`): rata-rata berbobot item terisi, `clamp(0,120)`. `empKpiScore` (`:1043`): `kpiOverride` (clamp 0–120) menang; else `min(divKpiScore,100)`.
- **Template awal:** 6 divisi (Kitchen, Bar, Marketing, Finance, Store, Event) di `seed()` `:587-593`.

### D.5 okr — OKR & Target
- **Tampilan:** kartu per OKR: `period` tag, pemilik (divisi/nama), objective, bar progres keseluruhan (rata-rata KR), tabel KR `nama, progress/target unit, bar, ↺`. Bukti `:1915-1934`.
- **Aksi:** "＋ OKR Baru" (bila `can('inputKpi')`) → `editOkr()`; "✎" → `editOkr(id)`; "🗑" → `delOkr(id)` (`confirmBox('Hapus OKR ini?')`); "↺" per KR → `updKr(okrId,i)`; "＋ Key Result" menambah baris. `:1918`, `:1923`.
- **Form — OKR** (`:1935-1961`): `okr_ot` Pemilik (`div`/`emp`), `okr_owner` Divisi/Kru, `okr_period` Periode, `okr_obj` Objective, baris KR (`name`, `target`, `unit`, `progress`). Validasi: `toast('Objective dan minimal 1 key result wajib diisi.', true)`.
- **Perhitungan:** `prog = avg(krs.map(k => k.target>0 ? clamp(k.progress/k.target*100,0,100) : 0))` (`:1921`); progres KR `p = target>0?clamp(progress/target*100,0,100):0`.
- **Catatan field:** OKR memakai `ownerType`/`ownerId`/`period` (kode `:1955`), bukan `owner`/`divId`/`month` seperti di komentar seed (`:654`) — README backend menegaskan bentuk diambil dari kode (`hr-mysql/README.md`, "Bentuk record diambil dari KODE").

### D.6 review — Performance Review (multi-layer)
- **Tampilan:** pemilih bulan; catatan 12 aspek skala 1–10 & bobot layer; tabel `Kru, Divisi, Self, Manager, HRD, CEO, Nilai Akhir, aksi`. Bukti `:1974-1993`.
- **Aksi:** "Mulai" / "Lihat / Isi" → `openReview(empId, mk)`.
- **Form — Review** (`:2002-2050`): 12 input number 1–10 untuk `REVIEW_ASPECTS = ['Skill','Knowledge','Attitude','Leadership','Discipline','Communication','Problem Solving','Ownership','Integrity','Initiative','Creativity','Customer Service']` (`:1359`), + `rv_comment` Komentar; menampilkan layer lain read-only. Validasi: `toast('Isi minimal satu aspek.', true)`; tanpa layer (`myLayer` null) → `toast('Anda tidak punya akses menilai kru ini.', true)`.
- **Layer (`myLayer` `:1994`):** `ceo`→ceo, `hr`→hr, `manager` di divisi sama (bukan diri sendiri)→manager, diri sendiri→self, else null.
- **Perhitungan:** `reviewAspectScore` (`:1340`): per aspek rata-rata tertimbang layer terisi (`reviewLayerWeights {self:10,manager:40,hr:20,ceo:30}`), lalu `avg(aspek)*10` (1–10→0–100). `reviewOverallScore` = atas semua `REVIEW_ASPECTS`.

### D.7 comp — Competency Matrix
- **Tampilan:** satu kartu per kru: nama, peran+divisi, tabel `kompetensi, bintang 1–5`, daftar "Perlu training" untuk level ≤2. Bukti `:2032-2050`.
- **Aksi:** "✎" (bila `can('manageTraining')` atau diri sendiri) → `editComp(empId)`; "＋ Kompetensi" menambah baris.
- **Form — Competency** (`:2051`): baris `cm_n_<i>` kompetensi + `cm_l_<i>` level 1–5; simpan `S.competencies[].skills = [{name, level}]`.

### D.8 coach — Coaching Log
- **Tampilan:** catatan "Setiap supervisor/manager wajib coaching rutin. …"; tabel `Tanggal, Kru, Coach, Problem, Action Plan, Deadline, Status, aksi` (deadline lewat → tag "lewat"). Bukti `:2067-2101`.
- **Filter:** hanya yang terlihat: `can('seeAll')` atau `empId===CU.id` atau `coachId===CU.id` atau manager divisi terkait (`:2068`).
- **Aksi:** "＋ Sesi Coaching" (bila `can('coach')`) → `editCoach()`; "✎" → `editCoach(id)`.
- **Form — Coaching** (`:2084-2101`): `co_emp` Kru (select), `co_date` Tanggal, `co_problem` Problem/temuan, `co_plan` Action plan, `co_dl` Deadline, `co_status` Status (`Berjalan`/`Selesai`/`Batal`), `co_fu` Follow up. Validasi: `toast('Problem wajib diisi.', true)`.

### D.9 training — Training Center
- **Tampilan:** catatan sumber training (dari Akademi bila tersambung, else manual); kartu per program: judul, tag "Wajib"/"Opsional", jenis, divisi, passing grade, deskripsi, bar `lulus/target`, 6 hasil terakhir. Bukti `:2102-2133`.
- **Aksi:** "＋ Program Training" (bila `can('manageTraining')`) → `editTraining()`; "✎" → `editTraining(id)`; "Catat Hasil" → `recordTraining(trainingId)`. `:2104`, `:2119`.
- **Form — Program** (`:2134`): `tr_title` Judul (wajib, `toast('Judul wajib diisi.', true)`), `tr_type` Jenis (`Product Knowledge,SOP,Quiz,Assessment,Sertifikasi,Video Training,Hygiene`), `tr_div` Divisi (`all`+divisi), `tr_pg` Passing grade, `tr_mand` Wajib?, `tr_desc` Deskripsi/link.
- **Form — Catat Hasil** (`:2169`): `trc_emp` Kru, `trc_score` Nilai, `trc_date` Tanggal. Validasi `toast('Nilai wajib diisi.', true)`. `lulus = score >= passingGrade`; bila lulus → sertifikat `nextCertNo(date)` + reward `poin trainingPass` (`:2184`).
- **Perhitungan:** `nextCertNo` (`:2155`): `LM-CERT-<tahun>-NNN`, nomor = max yang pernah terbit +1, dijaga unik. `trainingScore` (`:1308`): pakai Akademi `mandPct` bila ada; else manual `done/relevant*100`.
- **Integrasi Akademi:** `trainingFromAkademi` (`:1325`) menandai skor dari Akademi; profil kru menaut ke `../akademi/` (`:2502`).

### D.10 reward — Reward & Recognition
- **Tampilan:** catatan gamifikasi; kartu Employee of the Month (badge terbaru); Leaderboard Poin (Top 10, dengan badge pills); Riwayat Poin Terbaru (12). Bukti `:2190-2213`.
- **Aksi:** "🏆 Beri Badge" (bila `can('manageReward')`) → `giveBadge()`; "＋ Poin / Redeem" → `pointTx()`.
- **Form — Badge** (`:2215`): `bg_emp` Kru, `bg_badge` Badge (`BADGE_LIST` `:2214`, 12 pilihan), `bg_month` Bulan, `bg_note` Catatan. Memberi reward `eom` (Employee of the Month) atau `badge` poin.
- **Form — Poin** (`:2227`): `px_emp` Kru, `px_type` Jenis (`earn`/`redeem`), `px_pts` Poin, `px_reason` Alasan. Validasi `toast('Poin dan alasan wajib diisi.', true)`.
- **Perhitungan:** total poin per kru = Σ `type==='earn'?points:-points` (`:2191`). `pointRules {badge:50, trainingPass:20, eom:150}` (`:601`).

### D.11 disc — Disiplin
- **Tampilan:** catatan eskalasi SP; kartu ringkasan SP aktif/saran; tabel `Tanggal, Kru, Jenis, Tingkat, SP, Catatan, Status, aksi`. Bukti `:2262-2288`.
- **Aksi:** "＋ Catat Pelanggaran" (bila `can('manageDiscipline')` atau `can('coach')`) → `addViolation()`; "✎" → `editViolation(id)`.
- **Form — Pelanggaran** (`:2290-2308`): `vi_emp` Kru, `vi_date` Tanggal, `vi_type` Jenis (`VIO_TYPES` `:2241`: Terlambat, Absen tanpa izin, Merokok di area kerja, Tidak pakai seragam, Komplain pelanggan, Selisih kas, Pelanggaran SOP, Sikap tidak profesional, Lainnya), `vi_sev` Tingkat (`Ringan/Sedang/Berat`), `vi_sp` Terbitkan SP (`''/SP1/SP2/SP3`), `vi_status` Status (`Tercatat/Ditindaklanjuti/Selesai/Dibatalkan`), `vi_note` Catatan; hint saran SP live.
- **Perhitungan:** `activeSP` (`:2242`): SP tertinggi dalam `spValidMonths` bulan terakhir (non-Dibatalkan). `suggestSP` (`:2250`): SP2 & (berat atau sedang≥3) → SP3; SP1 & (berat atau sedang≥2) → SP2; tanpa SP & (berat atau sedang≥2 atau ringan≥`ringanToSP1`) → SP1. `disciplineScore` (`:1334`): `clamp(100 - Σ violationDeduct[severity], 0, 100)`. **Sistem hanya menyarankan SP; keputusan di HRD/CEO** (`:2264`).

### D.12 engage — Engagement
- **Tampilan:** Mood Check Hari Ini (5 tombol emoji); Tren Mood Tim 14 hari (sparkline); Kotak Saran (input + centang "Kirim anonim"); tabel saran `Tanggal, Dari, Saran, Status, Respon, aksi`. Bukti `:2310-2342`.
- **Aksi:** `setMood(v)` (5 tombol `MOODS` `:2309`); "Kirim" → `addSuggestion()`; "Respon" (bila `can('seeAll')`) → `respondSuggestion(id)`.
- **Form — Saran** (`:2349`): `sg_text` teks, `sg_anon` checkbox → `empId: null` bila anonim. Validasi `toast('Tulis dulu sarannya.', true)`. Form Respon (`:2354`): `sg_status` (`Baru/Ditinjau/Diterapkan/Ditolak`), `sg_resp`.
- **Perhitungan:** tren mood per hari; hari dengan < `MOOD_MIN_N=3` check-in **dikosongkan** supaya tidak membocorkan mood individu (`:2325-2330`). `mood` boleh `null` di v1 (`docs/api/hr.md:67`).

### D.13 career — Career & Succession
- **Tampilan:** Career Path per track (kartu dengan timeline jenjang, `req` syarat naik); Succession Planning (tabel `Posisi Target, Kandidat, Kesiapan, Gap, People Score, aksi`). Bukti `:2361-2388`.
- **Aksi:** "✎" track (bila `can('manageCareer')`) → `editCareer(id)`; "＋ Track Baru" → `editCareer()`; "＋ Kandidat" → `editSuccession()`; "✎"/"🗑" kandidat → `editSuccession(id)`/`delSuccession(id)`.
- **Form — Track** (`:2389`): `cp_track` Nama Track, `cp_steps` Jenjang (satu per baris, min 2), `cp_req` Syarat naik level; tombol "Hapus track". Validasi `toast('Track dan minimal 2 jenjang wajib.', true)`.
- **Form — Suksesi** (`:2404`): `sc_pos` Posisi target, `sc_emp` Kandidat, `sc_rd` Kesiapan (`Ready Now/6 Bulan/1 Tahun`), `sc_gap` Gap kompetensi. Validasi `toast('Posisi wajib diisi.', true)` dan `toast('Pilih kandidat dulu.', true)`.
- **Seed:** 3 track (Service, Bar, Kitchen) `:663-667`.

### D.14 emp — Kru (admin `manageOps`)
- **Tampilan:** pencarian nama/jabatan; peringatan kru belum lengkap (`needsSetup` = tanpa `divId`/`role`/`joinDate`); tabel `Nama, Jabatan, Divisi, Level, Bergabung, SP Aktif, Score, aksi`. Bukti `:2428-2463`.
- **Aksi:** pencarian `filterEmp()` (client-side `data-q`); "＋ Kru Baru" (bila `can('manageEmployees')`) → `editEmp()`; "Profil" → `openEmpDetail(id)`; "✎" → `editEmp(id)`.
- **Form — Kru** (`:2464-2488`): `em_name` Nama (wajib, `toast('Nama wajib diisi.', true)`), `em_role` Jabatan, `em_div` Divisi (opsi "Belum diisi" + divisi), `em_level` Level (`Staff/Supervisor/Manager/C-Level`), `em_approle` Akses aplikasi (`ROLE_LABEL`: CEO/HRD/Manager/Kru), `em_join` Bergabung, `em_birth` Ulang tahun, `em_status` Status (`Aktif/Nonaktif`), `em_contract` Kontrak berakhir, `em_prob` Probation selesai, `em_notes` Catatan. **Login/PIN tidak ada di sini** (diatur di Office) `:2486`.
- **Profil** (`openEmpDetail` `:2489`): skor + grade, tren 6 bulan, tabel komponen (Training menaut ke Akademi), badge, ringkasan poin/sertifikat/coaching/pelanggaran/SP, kompetensi, coaching terakhir. `noSave:true`.

### D.15 cal — Kalender HR (admin `manageOps`)
- **Tampilan:** catatan (shift harian di Talenta; kalender ini agenda HR); tabel agenda mendatang + seksi "Sudah lewat". Bukti `:2532-2547`.
- **Sumber item (`calendarItems` `:2522`):** `S.calendar` + otomatis: ulang tahun kru (`🎂 Ulang tahun <nama>`, kind Birthday), `Kontrak habis: <nama>` (kind Kontrak, catatan "Putuskan perpanjang/evaluasi H-30"), `Probation selesai: <nama>` (kind Probation). Dihitung ulang dari profil kru, **tidak disimpan**.
- **Aksi:** "＋ Agenda" (bila `can('seeAll')`) → `addCalEvent()`; "🗑" → `delCalEvent(id)` (`confirmBox('Hapus agenda "<judul>"?')`).
- **Form — Agenda** (`:2548`): `cal_date` Tanggal, `cal_kind` Jenis (`Training/Meeting/Event/Interview/Libur/Lainnya`), `cal_title` Judul (wajib, `toast('Judul wajib.', true)`), `cal_note` Catatan.

### D.16 settings — Pengaturan (admin `manageOps`)
- **Tampilan:** kartu Bobot People Score, Grade & Review, Disiplin & Poin, Kehadiran, Data. Bukti `:2568-2622`.
- **Aksi:** "⬇ Ekspor Backup (JSON)" → `exportJson()`; "⬆ Impor Backup" (input file `.json`) → `importJson`; "Reset ke data awal" → `resetAll()`; "Simpan Pengaturan" → `saveSettings()`.
- **Field:** `sw_<komponen>` (7 bobot), `s_dflt` nilai default, `gr_<i>` grade min, `rw_<layer>` (self/manager/hr/ceo), `vd_<Ringan|Sedang|Berat>`, `sp_r1` Ringan→SP1, `sp_valid` masa berlaku SP, `pr_badge`/`pr_train`/`pr_eom` poin, `ar_wp`/`ar_wt` bobot kehadiran, `ar_tol`/`ar_cap`/`ar_noout`/`ar_capI`/`ar_capS`, `ar_codes`/`ar_off`/`ar_offkw` (daftar dipisah koma).
- **Validasi:** `lateCapMin <= lateToleranceMin` → otomatis disetel `+1` + `toast('Penalti penuh harus lebih besar dari toleransi. Disetel ke <n> menit.', true)` (`:2646-2649`).
- **Data:** bila URL server terisi → "Data tersimpan online…"; else "Belum tersambung ke server…". Backup JSON nama `Staff-Performance_Laksamana_backup_<tanggal>.json`.

### D.17 audit — Audit Log (admin `manageOps`)
- **Tampilan:** tabel `Waktu, User, Aksi, Detail` (200 teratas); `S.audit` di-cap 800 di `log()` (`:692`). Bukti `:2689-2694`.
- **Aksi:** tidak ada (append-only).

### D.18 Lock/boot & Login (di luar menu)
- Layar boot HTML statis `#bootScreen` (`:210-220`), dihapus setelah init sukses; `init()` (`:2699`) urutan: `apiLoad()` → `autoSyncOfficeRoster()` → `loadAkademiStats()` → `bootPeopleOS()`.
- `bootPeopleOS()` (`:905`): `log('LOGIN','')`, cache lokal (bukan save), tampilkan app, `buildNav()`, `go('dash')`. Logout `doLogout()` (`:925`) → `location.replace('../')` (sesi Office tidak dihapus).
- Tidak ada PIN/login lokal: identitas 100% dari `lm_session` Office.

## E. Pemetaan backend

Legacy memakai `hr-mysql/api.php` hanya lewat 2 jalur: GET `?action=getAll` dan POST `{action:'saveAll', data:S, baseRev, by}` (`:437`, `:501`). Plus 2 sumber lintas modul: `account-api-mysql` `listModuleRoster` (`:391`) dan `akademi-api-mysql` `trainingStats` (`:355`). v1 memecah seluruh state menjadi CRUD per resource.

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `getAll` | semua layar (boot) | baca | `GET /state` | ✅ | v1 `/state` = dokumen penuh + `version`/`_rev` |
| `saveAll` | SEMUA tulis (kru, divisi, KPI, OKR, review, kompetensi, training, coaching, reward, badge, pelanggaran, feedback, careerPath, suksesi, mood, saran, kalender, kpiActuals, monthlyInputs, attendance, settings, audit) | tulis | `POST/PUT/PATCH/DELETE /{resource}[/{id}]` + `PUT /kpi-actuals/{divId}/{month}/{itemId}` + `PUT /monthly-inputs/{empId}/{month}` + `PUT /settings/{key}` + `PUT /attendance/{YYYY-MM}` | ⚠️ | v1 granular per-record; pola "ubah S lalu `save()` whole-doc" harus dibongkar. Konkurensi tetap satu `rev` untuk seluruh dokumen (lihat di bawah) |
| `stats` | — (diagnostik) | baca | `GET /stats` | ✅ | `_rev`, `env`, `db` |
| `ping` | — (diagnostik) | baca | — (health) | ✅ | |
| `listModuleRoster` (Office, `account-api-mysql`) | `autoSyncOfficeRoster` (`:378`) | baca | ⚠️ tidak ada di `hr` | ⚠️ | Panggilan **lintas modul** (Office/Account) untuk menarik roster kru ber-grant `hr`. Di Vue identitas/roster datang dari sesi Office; catat di `_lintas-modul.md` |
| `trainingStats` (Akademi, `akademi-api-mysql`) | `loadAkademiStats` (`:352`) | baca | `GET /training-stats` | ✅ | v1 membacanya in-process dari layanan akademi (`docs/api/hr.md:52`); lebih baik dari legacy (legacy sempat dorman) |
| (Ekspor backup) | settings | baca | `GET /state` (klien merakit JSON) | ✅ | `exportJson` `:2660` |
| (Impor backup) | settings | tulis (timpa semua) | ⚠️ tidak ada 1 endpoint | ⚠️ | `importJson` mengganti seluruh `S` lalu `save()` (`:2668`); v1 harus per-record |
| (Reset ke data awal) | settings | tulis (hapus massal) | ⚠️ tidak ada | ⚠️ | `resetAll` → `seed()` + `save()` (`:2682`), lalu logout. Sama seperti hlife. Lihat `_pertanyaan.md` |

Konkurensi: legacy **satu revisi untuk seluruh dokumen** (`S._rev`), `save()` kirim `baseRev`, server balas `{ok:false, error:'conflict', savedBy, savedAt, rev}` → modal "Perubahan Tidak Tersimpan" (`showSaveConflict` `:532`), badge sinkron (`setSyncBadge` `:542`), dan `refreshIfStale()` saat tab aktif kembali (`:555`). v1 **mempertahankan model yang sama** (`meta.rev`, `docs/api/hr.md:14-21`): kirim `If-Match: "<rev>"` atau `?version=<rev>`; `428 version_required` bila tak dikirim, `409 version_conflict` dengan `error.details = {rev, savedBy, savedAt}`. Jadi pola bentrok dapat dipetakan 1:1 (⚠️ hanya bentuk kiriman yang berubah).
Kode error yang wajib ditangani UI: `unauthenticated`, `module_not_granted`, `not_found`, `already_exists`, `validation_failed`, `version_required`, `version_conflict`, dan `403 forbidden` (tulis `employees`/`calendar`, `PUT /settings/{key}`, `GET /audit` butuh admin modul).

## F. Aturan bisnis yang wajib dibawa

1. **Skor People Score dihitung di browser, tidak pernah disimpan** — kenapa: mengubah bobot/aturan langsung berlaku surut — bukti: `:1361`, `:1214`, `hr-mysql/README.md` ("Skor tidak pernah disimpan").
2. **Data absensi Talenta dihitung ulang tiap dibaca; mengubah aturan berlaku surut ke semua bulan** — bukti: `:1191-1193`, `:1290-1292`.
3. **Pencocokan absensi HANYA lewat `talentaId`, tidak pernah menebak dari nama** — kenapa: nama Talenta vs Office sering beda; salah tebak = absensi orang lain masuk ke skor seseorang — bukti: `:1806-1812`, `:1767-1768`.
4. **Kru tanpa satu pun check-in sebulan (`noData`) TIDAK diberi skor** — kenapa: hampir selalu berarti tidak pakai aplikasi absensi, bukan bolos; skor 30 terbaca seperti vonis — bukti: `:1276-1283`, `:1653-1658`.
5. **Kelengkapan data < 40% → tidak diberi ranking & grade, ditandai "data kurang"** — kenapa: skor dari nilai default (~77 = grade B) tidak boleh tampil seolah hasil penilaian — bukti: `:1402`, `:1406-1416`, `:1483-1485`.
6. **Akademi (training asli) menang atas input training manual; manual tetap dipakai bila Akademi belum tersambung** — bukti: `:1308-1324`.
7. **Report Talenta menang atas input manual `monthlyInputs.attendance`** — bukti: `:1368-1369`.
8. **Eskalasi SP hanya SARAN sistem; keputusan tetap HRD/CEO** — bukti: `:2250`, `:2264`.
9. **Manager tanpa divisi tidak jatuh ke filter `divId===''`; ia hanya melihat dirinya sendiri** — kenapa: mencegah semua kru tanpa divisi terkelompok jadi satu — bukti: `:699-706`.
10. **Kehadiran memakai rekap termasuk kru Nonaktif (`scopeAll`), beda dengan `scopeEmps()`** — kenapa: kehadiran itu catatan sejarah; kru nonaktif tetap bekerja bulan yang dilihat — bukti: `:1660-1671`.
11. **Tanggal habis kontrak (& probation) selalu dibatasi `scopeEmps()`** — kenapa: data HR sensitif tidak boleh terlihat kru biasa — bukti: `:1470-1475`.
12. **Login/identitas & PIN dipegang Office (SSO), modul tidak punya login sendiri; "Akses aplikasi" hanya mengatur hak di dalam modul** — bukti: `:713-728`, `:2486`.
13. **Nama panggilan (`CU_SAPAAN`) dari sesi Office hanya untuk menyapa diri sendiri; tabel penilaian/kehadiran/disiplin memakai nama resmi `CU.name`** — bukti: `:684-688`.
14. **Kru hasil login Office dibuat sebagai record BELUM LENGKAP (divisi/jabatan/joinDate kosong) dan ditandai "lengkapi data"** — bukti: `:2428`, `:884-886`.
15. **`reassignEmployeeId` memindahkan seluruh rujukan `empId`/`coachId`/`ownerId`/`monthlyInputs` saat id diganti; `gabungKembarTalenta` menggabungkan record kembar yang `talentaId`-nya sama persis & tidak kosong; `buangYatimRoster` hanya membuang kru tanpa riwayat & bukan diri sendiri** — bukti: `:785-887`.
16. **Nomor sertifikat = maksimum yang pernah terbit + 1 per tahun (`LM-CERT-<thn>-NNN`), bukan `length+1`** — kenapa: `length+1` melompati nomor & bisa terpakai ulang saat record dihapus — bukti: `:2155-2168`.
17. **Audit append-only, di-cap 800 baris di klien** — bukti: `:691-693`; v1 audit juga append-only (`docs/api/hr.md:82-87`).
18. **Mood agregat tidak ditampilkan bila check-in harian < 3** — kenapa: rata-rata 1 orang = membocorkan individu — bukti: `:2325-2330`.
19. **Selalu pakai JSON tanpa assoc (`json_decode` mode objek)** — kenapa: peta kosong (`kpiActuals`, `monthlyInputs`, `reviews.layers`) akan jadi `[]` dan properti bernama hilang — bukti: `hr-mysql/api.php:52-56`, `hr-mysql/README.md`.
20. **`suggestions.empId` boleh `null` (saran anonim)** — bukti: `:2350`, `docs/api/hr.md:67`.
21. **Ubah bobot/target KPI berlaku ke semua bulan (histori dihitung ulang)** — bukti: `:1896`.

## G. Ketergantungan lintas modul

- **Office / Account (SSO & roster).** Gerbang `lm_session` + grant `hr` (`:9-13`); identitas & `adminModules` untuk gate admin (`:714-737`); `autoSyncOfficeRoster` menarik roster ber-grant `hr` via `account-api-mysql` `?action=listModuleRoster{module:'hr'}` (fallback Apps Script `:289`) — `:378-427`. Tidak ada padanan di kontrak v1 `hr`; di Vue ini peran sesi Office.
- **Akademi.** Komponen Training People Score dibaca dari `GET /training-stats` (legacy `akademi-api-mysql?action=trainingStats`, `:352-377`); profil kru menaut balik ke `../akademi/` (`:2502`). Ringkas di `_lintas-modul.md`.
- Tidak ada baca/tulis langsung ke DB modul lain. DB sendiri `lakk5493_db_hr`.

## H. Catatan untuk implementasi Vue

- **Halaman:** `app/pages/hr/index.vue` (Anjungan) + sub-halaman `hr/score.vue`, `hr/kehadiran.vue`, `hr/kpi.vue`, `hr/okr.vue`, `hr/review.vue`, `hr/training.vue`, `hr/comp.vue`, `hr/coach.vue`, `hr/career.vue`, `hr/reward.vue`, `hr/disc.vue`, `hr/engage.vue`, `hr/emp.vue`, `hr/cal.vue`, `hr/settings.vue`, `hr/audit.vue`. `definePageMeta({ access: ['hr'] })`. Halaman admin (`emp`, `cal`, `settings`, `audit`) ditambah cek status admin modul dari sesi; server sudah menegakkannya (`403 forbidden`).
- **Composable `useHr.ts`** (fungsi → endpoint):
  - `useHrState()` → `GET /state`; `useHrStats()` → `GET /stats`; `useTrainingStats()` → `GET /training-stats`.
  - `useHrResource(res, opts)` → `GET /{res}` (res ∈ divisions, employees, kpi-templates, okrs, reviews, competencies, trainings, training-records, coachings, rewards, badges, violations, feedbacks, career-paths, successions, moods, suggestions, calendar).
  - `createRecord(res, body)` → `POST /{res}`; `updateRecord(res, id, body, version)` → `PUT /{res}/{id}`; `patchRecord` → `PATCH`; `deleteRecord(res, id, version)` → `DELETE /{res}/{id}`.
  - `saveKpiActual(divId, month, itemId, value)` → `PUT /kpi-actuals/{divId}/{month}/{itemId}`; `useKpiActuals()` → `GET /kpi-actuals`.
  - `saveMonthlyInput(empId, month, value)` → `PUT /monthly-inputs/{empId}/{month}`; `useMonthlyInputs()` → `GET /monthly-inputs`.
  - `useHrSettings()` → `GET /settings`; `saveSetting(key, value, version)` → `PUT /settings/{key}`.
  - `useAttendance()` → `GET /attendance`; `saveAttendance(month, value, version)` → `PUT /attendance/{YYYY-MM}` (nilai `null` menghapus bulan).
  - `useAudit()` → `GET /audit`; `postAudit(action, detail)` → `POST /audit` (tanpa version, tidak menaikkan rev).
  - Konkurensi: sertakan `If-Match: "<version>"` pada setiap tulis; tangani `409 version_conflict` dengan modal "Perubahan Tidak Tersimpan" (pertahankan pola legacy: `error.details` = `{rev, savedBy, savedAt}`).
- **Pindahkan logika mesin skor ke Vue (tidak ada di API):** `peopleScore`, `gradeOf`/`gradeTag`, `kpiItemScore`/`divKpiScore`/`empKpiScore`, `attendanceDetail`/`attendanceCumulative`, `trainingScore`, `feedbackScore`, `disciplineScore`, `reviewAspectScore`, `activeSP`/`suggestSP`, `nextCertNo`, `calendarItems`, `buildInsights`. Ini inti modul; jangan disederhanakan.
- **Impor Talenta:** parser XLSX tanpa pustaka (`unzipEntries`/`parseTalentaXlsx`) harus dipindah apa adanya (kolom dicari lewat judul, bukan posisi). Boleh tetap di klien.
- **HP vs desktop:** tabel panjang (`score`, `kehadiran`, `review`, `disc`, `emp`, `coach`) → `UTable` di `lg+`, `AppList`/`AppListRow` di HP; podium & grid kartu → `AppList` berkelompok + satu `AppFocus`; form (Kru, KPI, OKR, Review, Competency, Coaching, Program Training, Catat Hasil, Badge, Poin, Pelanggaran, Saran, Track, Suksesi, Agenda, Input Bulanan) → `ResponsiveSheet`.
- **Widget Beranda yang cocok:** "People Score saya bulan ini" (+ grade/kelengkapan), "Insight otomatis" (top 3), "Top 5 People Score", "Kontrak habis ≤45 hari", "Mood tim" (dengan aturan min 3).
- **Elemen lama yang melanggar DESIGN.md → padanannya:**
  - **Grid kartu angka besar** (`kcard`, `:1551`) → `AppList` + satu `AppFocus`.
  - **Gradien** (`linear-gradient` kartu sapaan `:1492`, Employee of the Month `:2205`, `.pod.first` `:175`) → token warna datar.
  - **Emoji sebagai ikon** (`👋`, `🏆`, `🏅`, `🗑`, `✎`, `⬇`, `⬆`, `⚓`, mood 😡…😀) → Lucide (`i-lucide-*`).
  - **Label huruf kapital mono** (`.kpi-card .lbl`, `.tbl th` uppercase `:137`) → label sentence case `text-muted`.
  - **Teks kuning** (`--gold` pada skor `:1496`) & aksen brass/emas → kuning hanya untuk aksi utama.
  - **`window.confirm`/modal kustom & toast kustom** → `ResponsiveSheet` + toast Nuxt UI.
  - **Ikon `★` bintang** di Competency (`:2044`) → komponen rating Lucide.
- **Jangan** bawa tombol "Impor Backup"/"Reset ke data awal" tanpa keputusan (lihat §I & `_pertanyaan.md`); ekspor backup tetap boleh (`GET /state`).

## I. Pertanyaan terbuka
- [ ] **hr / settings — Impor & Reset massal** — v1 tidak punya endpoint "ganti seluruh dokumen" maupun "kosongkan semua". Legacy `importJson` (`:2668`) dan `resetAll` (`:2682`) menimpa/mengosongkan seluruh `S` lalu `saveAll`. Konteks: keduanya operasi whole-document. Opsi: A) buang kedua tombol (paling aman; data PII/SP hilang massal memang berbahaya); B) implementasi loop PUT/DELETE per record; C) minta endpoint khusus. Bukti: `:2668-2688`, `docs/api/hr.md` (tak menyebut impor/reset). (juga disalin ke `_pertanyaan.md`)
- [ ] **hr / autoSyncOfficeRoster** — legacy menarik roster ber-grant `hr` dari `account-api-mysql?action=listModuleRoster` (`:391`). Kontrak v1 `hr` tidak punya padanannya, dan v1 tidak menyebut siapa yang membuat record `employees` saat kru baru masuk lewat Office. Apakah Vue cukup memakai `employees` yang sudah ada (dibuat oleh sinkron Office lain), atau butuh endpoint roster? Opsi: A) Vue hanya CRUD `employees`; B) sediakan endpoint roster di modul Office/Account. Bukti: `:378-427`. (juga disalin ke `_pertanyaan.md`)
- [ ] **hr / audit — cap 800 baris** — legacy membatasi `S.audit` di klien (`.length > 800` → potong, `:692`), UI tampilkan 200. v1 `audit` append-only tanpa batas yang terdokumentasi; apakah UI perlu batas/paginasi sendiri? Bukti: `:692`, `docs/api/hr.md:82-87`. [DUGAAN] tak berbahaya, tapi perlu keputusan retensi.
