import assert from 'node:assert/strict'
import { readFile, stat, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import mysql from 'mysql2/promise'

const BASE = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:3456'

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts)
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json() : await res.text()
  return { res, data }
}

async function run() {
  const created = {
    uploadPath: '',
    paketId: 0,
    sewaId: 0,
    tripId: 0,
    pesertaId: 0,
  }

  try {
    // 1. Health check
    const health = await req('/api/health')
    assert.equal(health.res.status, 200, 'health status should be 200')
    assert.equal(health.data.ok, true)
    assert.equal(health.data.database, 'connected')

    // 2. Auth enforcement
    const unauth = await req('/api/admin/dashboard')
    assert.equal(unauth.res.status, 401, 'unauthenticated admin dashboard should return 401')

    // 3. Login + capture HttpOnly cookie
    const login = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_SEED_EMAIL || 'admin@merayau.id',
        password: process.env.ADMIN_SEED_PASSWORD || 'merayau123',
      }),
    })
    assert.equal(login.res.status, 200, 'login should succeed')
    const setCookie = login.res.headers.get('set-cookie') || ''
    assert.ok(setCookie.toLowerCase().includes('httponly'), 'cookie must be HttpOnly')
    const cookie = setCookie.split(';')[0]
    const authHeaders = { cookie }

    // 4. Seeded GET endpoints
    const dash = await req('/api/admin/dashboard?period=30d', { headers: authHeaders })
    assert.equal(dash.res.status, 200)
    assert.ok(dash.data.stokAlatPanel.length >= 5, 'stokAlatPanel populated')

    const alatRes = await req('/api/admin/alat', { headers: authHeaders })
    assert.equal(alatRes.res.status, 200)
    assert.ok(alatRes.data.items.length >= 6, 'master_alat populated')
    const activeTools = alatRes.data.items.filter((a) => a.statusAktif && a.stokTersedia >= 2)
    assert.ok(activeTools.length >= 2, 'need at least 2 active tools with >=2 stock')

    const disewaRes = await req('/api/admin/alat-disewa', { headers: authHeaders })
    assert.equal(disewaRes.res.status, 200)
    assert.ok(disewaRes.data.length >= 1, 'alat-disewa has active seeded rows')
    assert.ok('namaPenyewa' in disewaRes.data[0] && 'kontakWa' in disewaRes.data[0])

    const penyewaRes = await req('/api/admin/penyewa', { headers: authHeaders })
    assert.equal(penyewaRes.res.status, 200)
    assert.ok(penyewaRes.data.length >= 1, 'penyewa populated')

    // 5. Upload validation & serving
    const badFd = new FormData()
    badFd.append('folder', 'paket')
    badFd.append('file', new Blob(['not an image'], { type: 'text/plain' }), 'bad.txt')
    const badUpload = await req('/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: badFd,
    })
    assert.equal(badUpload.res.status, 400, 'non-image upload must be rejected')

    const logoPath = resolve(process.cwd(), 'Asset.Gambar/Logo.jpeg')
    const logoBytes = await readFile(logoPath)
    const logoStat = await stat(logoPath)
    const goodFd = new FormData()
    goodFd.append('folder', 'paket')
    goodFd.append('file', new Blob([logoBytes], { type: 'image/jpeg' }), 'logo-test.jpg')
    const goodUpload = await req('/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: goodFd,
    })
    assert.equal(goodUpload.res.status, 200, 'valid jpeg upload should succeed')
    assert.equal(goodUpload.data.sizeBytes, logoStat.size)
    created.uploadPath = resolve(process.cwd(), 'public', goodUpload.data.url.replace(/^\//, ''))

    const servedImg = await fetch(`${BASE}${goodUpload.data.url}`)
    assert.equal(servedImg.status, 200, 'uploaded file must be servable at runtime')
    const servedBuf = Buffer.from(await servedImg.arrayBuffer())
    assert.equal(servedBuf.length, logoStat.size)

    // 6. Create package with automatic 30% discount
    const t1 = activeTools[0]
    const t2 = activeTools[1]
    const expectedDaily = t1.hargaHarian * 1 + t2.hargaHarian * 2
    const expectedTarif = Math.round(expectedDaily * 0.7)
    const createPkg = await req('/api/admin/paket-alat', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        namaPaket: 'Paket Uji Otomatis',
        foto: goodUpload.data.url,
        statusAktif: true,
        items: [
          { idAlat: t1.id, jumlah: 1 },
          { idAlat: t2.id, jumlah: 2 },
        ],
      }),
    })
    assert.equal(createPkg.res.status, 201)
    assert.equal(createPkg.data.tarifPaket, expectedTarif, 'server must enforce 30% discount')
    created.paketId = createPkg.data.id

    // 7. Transactional rental validation, stock decrement, return & double-return guard
    const startIso = new Date().toISOString()
    const endIso = new Date(Date.now() + 2 * 86_400_000).toISOString()

    const badJaminan = await req('/api/admin/transaksi', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        idPenyewa: penyewaRes.data[0].id,
        jenisJaminan: 'Paspor',
        tanggalPinjam: startIso,
        tanggalKembaliRencana: endIso,
        items: [{ idAlat: t1.id, jumlah: 1 }],
      }),
    })
    assert.equal(badJaminan.res.status, 400, 'invalid jenisJaminan must fail with 400')

    const oversell = await req('/api/admin/transaksi', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        idPenyewa: penyewaRes.data[0].id,
        jenisJaminan: 'KTP',
        tanggalPinjam: startIso,
        tanggalKembaliRencana: endIso,
        items: [{ idAlat: t1.id, jumlah: t1.stokTersedia + 5 }],
      }),
    })
    assert.equal(oversell.res.status, 409, 'overselling must be rejected with 409')

    const validRental = await req('/api/admin/transaksi', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        idPenyewa: penyewaRes.data[0].id,
        jenisJaminan: 'Kartu Pelajar',
        tanggalPinjam: startIso,
        tanggalKembaliRencana: endIso,
        paketItems: [{ idPaket: created.paketId, qtyPaket: 1 }],
      }),
    })
    assert.equal(validRental.res.status, 201, 'valid package rental should succeed')
    created.sewaId = validRental.data.id

    const alatAfterRent = await req('/api/admin/alat', { headers: authHeaders })
    const t1After = alatAfterRent.data.items.find((a) => a.id === t1.id)
    assert.equal(t1After.stokTersedia, t1.stokTersedia - 1, 'stock must decrement atomically')

    const doReturn = await req(`/api/admin/transaksi/${created.sewaId}/kembali`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ dendaRusak: 0, kondisiKembali: 'Baik & Lengkap' }),
    })
    assert.equal(doReturn.res.status, 200, 'return should succeed')
    assert.equal(doReturn.data.statusSewa, 'Selesai')

    const riwayatRes = await req('/api/admin/riwayat-penyewa', { headers: authHeaders })
    assert.equal(riwayatRes.res.status, 200, 'riwayat-penyewa list should return 200')
    assert.ok(
      riwayatRes.data.items.some((r) => r.idSewa === created.sewaId),
      'completed rental must be archived into riwayat_penyewa automatically',
    )

    const dupReturn = await req(`/api/admin/transaksi/${created.sewaId}/kembali`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ dendaRusak: 0 }),
    })
    assert.equal(dupReturn.res.status, 409, 'duplicate return must reject with 409')

    const alatAfterReturn = await req('/api/admin/alat', { headers: authHeaders })
    const t1Restored = alatAfterReturn.data.items.find((a) => a.id === t1.id)
    assert.equal(t1Restored.stokTersedia, t1.stokTersedia, 'stock must restore after return')

    // 8. Trips (Paket A/B/C + multi-mepo) & Peserta Trip (DP 50% + custom mepo)
    const tripCreate = await req('/api/admin/trips', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        judul: 'Uji Trip Sindoro',
        lokasi: 'Temanggung, Jawa Tengah',
        tanggalBerangkat: '20-22 Des 2026',
        durasi: '2D1N',
        kuota: 12,
        itinerary: '03:00 Start pendakian',
        statusPublish: 'Published',
        pakets: [
          { kodePaket: 'Paket A', deskripsiFasilitas: 'Reguler', harga: 350000 },
          { kodePaket: 'Paket B', deskripsiFasilitas: 'Plus Tenda', harga: 450000 },
          { kodePaket: 'Paket C', deskripsiFasilitas: 'VIP Full', harga: 600000 },
        ],
        meetingPoints: [
          { namaLokasi: 'Jakarta - Halim', isCustom: false },
          { namaLokasi: 'Lainnya (atur lokasi sendiri)', isCustom: true },
        ],
      }),
    })
    assert.equal(tripCreate.res.status, 201)
    created.tripId = tripCreate.data.id

    const tripsList = await req('/api/admin/trips', { headers: authHeaders })
    const createdTrip = tripsList.data.trips.find((t) => t.id === created.tripId)
    assert.equal(createdTrip.pakets.length, 3)
    assert.equal(createdTrip.meetingPoints.length, 2)
    const customMepo = createdTrip.meetingPoints.find((m) => m.isCustom)

    const pesertaCreate = await req('/api/admin/peserta-trip', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        idTrip: created.tripId,
        idTripPaket: createdTrip.pakets[1].id,
        idMeetingPoint: customMepo.id,
        mepoCustom: 'Rest Area Subang',
        nama: 'Peserta Uji E2E',
        noIdentitas: '3301010101010099',
        noWa: '081200009999',
        kontakDarurat: 'Ibu (081211112222)',
        statusBayar: 'DP 50%',
        nominalBayar: 225000,
        sewaAlatTambahan: 'Headlamp',
      }),
    })
    assert.equal(pesertaCreate.res.status, 201)
    created.pesertaId = pesertaCreate.data.id

    const pesertaList = await req(`/api/admin/peserta-trip?idTrip=${created.tripId}`, {
      headers: authHeaders,
    })
    assert.equal(pesertaList.data.kpis.dp50, 1)
    assert.equal(pesertaList.data.items[0].lokasiMepoFinal, 'Rest Area Subang')

    // 9. SSR HTML checks
    const loginHtml = await req('/admin/login')
    assert.equal(loginHtml.res.status, 200)
    assert.ok(String(loginHtml.data).includes('Merayau Outdoor'))

    const dashHtml = await req('/admin', { headers: authHeaders })
    assert.equal(dashHtml.res.status, 200)
    assert.ok(String(dashHtml.data).includes('Basecamp Merayau Outdoor'))

    console.log('ALL E2E CHECKS PASSED:', {
      health: '200',
      authGuard: '401/200',
      uploadVerified: goodUpload.data.url,
      tarifPaketDiskon30: expectedTarif,
      transaksiStockRoundTrip: 'ok',
      tripsAndPeserta: 'ok',
      ssrHtml: '200',
    })
  } finally {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'merayau',
      password: process.env.DB_PASSWORD || 'merayau_dev',
      database: process.env.DB_NAME || 'merayau_outdoor',
    })
    try {
      if (created.pesertaId) await conn.query('DELETE FROM peserta_trip WHERE id = ?', [created.pesertaId])
      if (created.tripId) await conn.query('DELETE FROM info_trip WHERE id = ?', [created.tripId])
      if (created.sewaId) await conn.query('DELETE FROM riwayat_penyewa WHERE id_sewa = ?', [created.sewaId])
      if (created.sewaId) await conn.query('DELETE FROM transaksi_sewa WHERE id = ?', [created.sewaId])
      if (created.paketId) await conn.query('DELETE FROM paket_alat WHERE id = ?', [created.paketId])
    } finally {
      await conn.end()
    }
    if (created.uploadPath) {
      await unlink(created.uploadPath).catch(() => {})
    }
  }
}

run().catch((err) => {
  console.error('VERIFY FAILED:', err)
  process.exit(1)
})
