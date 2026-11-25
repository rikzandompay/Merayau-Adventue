<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface PenyewaRow {
  id: number
  nama: string
  noIdentitas: string
  noWa: string
  alamat: string
  catatan: string | null
  totalTransaksi: number
  standing: 'Telat Aktif' | 'Sedang Sewa' | 'Tepat Waktu'
}

const search = ref('')
const { data, refresh } = await useFetch<PenyewaRow[]>('/api/admin/penyewa')

const filtered = computed(() => {
  const list = data.value ?? []
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(
    (c) =>
      c.nama.toLowerCase().includes(q) ||
      c.noIdentitas.toLowerCase().includes(q) ||
      c.noWa.includes(q),
  )
})

const isNew = ref(false)
const selected = ref<PenyewaRow | null>(data.value?.[0] ?? null)
const form = reactive({
  nama: '',
  noIdentitas: '',
  noWa: '',
  alamat: '',
  catatan: '',
})
const saving = ref(false)
const feedback = ref<{ type: 'ok' | 'err'; msg: string } | null>(null)

function pickRow(row: PenyewaRow) {
  isNew.value = false
  selected.value = row
  form.nama = row.nama
  form.noIdentitas = row.noIdentitas
  form.noWa = row.noWa
  form.alamat = row.alamat
  form.catatan = row.catatan || ''
}

if (data.value?.[0]) pickRow(data.value[0])

function startCreate() {
  isNew.value = true
  selected.value = null
  form.nama = ''
  form.noIdentitas = ''
  form.noWa = ''
  form.alamat = ''
  form.catatan = ''
}

async function saveCustomer() {
  feedback.value = null
  saving.value = true
  try {
    if (isNew.value) {
      const created = await $fetch<PenyewaRow>('/api/admin/penyewa', { method: 'POST', body: form })
      feedback.value = { type: 'ok', msg: `${created.nama} berhasil ditambahkan.` }
      await refresh()
      const found = data.value?.find((r) => r.id === created.id)
      if (found) pickRow(found)
    } else if (selected.value) {
      await $fetch(`/api/admin/penyewa/${selected.value.id}`, { method: 'PUT', body: form })
      feedback.value = { type: 'ok', msg: 'Data penyewa diperbarui.' }
      await refresh()
      const found = data.value?.find((r) => r.id === selected.value?.id)
      if (found) pickRow(found)
    }
  } catch (err: unknown) {
    feedback.value = {
      type: 'err',
      msg: extractErrorMessage(err, 'Gagal menyimpan data penyewa.'),
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ed-label" style="color: var(--srf-accent)">DIREKTORI PELANGGAN BASECAMP</p>
        <h1 class="font-serif-display text-3xl font-bold tracking-tight">
          Data Penyewa
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2)">
          Daftar pelanggan terverifikasi nomor identitas unik (KTP/SIM).
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <input
          v-model="search"
          type="search"
          class="ed-input !w-56 !py-2 !text-xs"
          placeholder="Cari nama, NIK, atau WA..."
        />
        <NuxtLink to="/admin/riwayat-penyewa" class="ed-btn-secondary !text-xs">
          Riwayat Penyewa
        </NuxtLink>
        <button type="button" class="ed-btn-primary" @click="startCreate">+ Tambah Penyewa</button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div class="ed-card overflow-hidden lg:col-span-8">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-sm">
            <thead>
              <tr
                class="border-b text-xs font-semibold"
                style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-2)"
              >
                <th class="px-4 py-2.5">Nama Penyewa</th>
                <th class="px-4 py-2.5">No. Identitas (NIK)</th>
                <th class="px-4 py-2.5">No. WhatsApp</th>
                <th class="px-4 py-2.5">Transaksi</th>
                <th class="px-4 py-2.5">Standing</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="cust in filtered"
                :key="cust.id"
                class="cursor-pointer border-b last:border-b-0"
                :style="{
                  borderColor: 'var(--srf-line)',
                  backgroundColor:
                    !isNew && selected?.id === cust.id ? 'var(--srf-hover)' : undefined,
                }"
                @click="pickRow(cust)"
              >
                <td class="px-4 py-3 font-semibold">{{ cust.nama }}</td>
                <td class="px-4 py-3 tabular text-xs" style="color: var(--srf-ink-2)">
                  {{ cust.noIdentitas }}
                </td>
                <td class="px-4 py-3 tabular text-xs">{{ cust.noWa }}</td>
                <td class="px-4 py-3 tabular text-xs">{{ cust.totalTransaksi }} transaksi</td>
                <td class="px-4 py-3">
                  <StatusBadge
                    :label="cust.standing"
                    :tone="
                      cust.standing === 'Telat Aktif'
                        ? 'bad'
                        : cust.standing === 'Sedang Sewa'
                          ? 'accent'
                          : 'good'
                    "
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="ed-card p-5 space-y-4 lg:col-span-4">
        <div>
          <p class="ed-label" style="color: var(--srf-accent)">
            {{ isNew ? 'PENYEWA BARU' : 'DETAIL PENYEWA TERPILIH' }}
          </p>
          <h2 class="font-serif-display text-xl font-bold">
            {{ isNew ? 'Tambah Pelanggan' : form.nama }}
          </h2>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="ed-label mb-1">NAMA LENGKAP</label>
            <input v-model="form.nama" type="text" class="ed-input" />
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="ed-label mb-1">NIK / SIM</label>
              <input v-model="form.noIdentitas" type="text" class="ed-input tabular" />
            </div>
            <div>
              <label class="ed-label mb-1">NO. WHATSAPP</label>
              <input v-model="form.noWa" type="text" class="ed-input tabular" />
            </div>
          </div>
          <div>
            <label class="ed-label mb-1">ALAMAT</label>
            <textarea v-model="form.alamat" rows="2" class="ed-textarea" />
          </div>
          <div>
            <label class="ed-label mb-1">CATATAN</label>
            <input v-model="form.catatan" type="text" class="ed-input" />
          </div>
        </div>

        <div
          v-if="feedback"
          class="rounded-md border px-3 py-2 text-xs font-medium"
          :style="{
            backgroundColor: 'var(--srf-well)',
            borderColor: feedback.type === 'ok' ? 'var(--srf-good)' : 'var(--srf-bad)',
            color: feedback.type === 'ok' ? 'var(--srf-good)' : 'var(--srf-bad)',
          }"
        >
          {{ feedback.msg }}
        </div>

        <div class="space-y-2">
          <button type="button" class="ed-btn-primary w-full" :disabled="saving" @click="saveCustomer">
            {{ saving ? 'Menyimpan...' : isNew ? 'Simpan Penyewa Baru' : 'Simpan Perubahan' }}
          </button>
          <a
            v-if="!isNew && form.noWa"
            :href="buildWaLink(form.noWa, `Halo ${form.nama}, ini Admin Merayau Outdoor Basecamp.`)"
            target="_blank"
            rel="noopener noreferrer"
            class="ed-btn-wa w-full"
          >
            <WaIcon :size="16" />
            <span>Kirim Pesan WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
