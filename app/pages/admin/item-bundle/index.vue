<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <span class="ed-label" style="color: var(--srf-accent);">BUNDLE PROMO ALAT</span>
        <h1 class="mt-0.5 text-2xl font-bold tracking-tight" style="color: var(--srf-ink);">
          Manajemen Item Bundle
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2);">
          Gabungkan beberapa alat menjadi bundle promo dengan potongan persen, nominal, atau harga bundle khusus.
        </p>
      </div>
      <NuxtLink to="/admin/item-bundle/tambah" class="ed-btn-primary">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>Tambah Bundle Baru</span>
      </NuxtLink>
    </div>

    <div class="ed-card overflow-hidden">
      <div
        class="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        style="border-bottom: 1px solid var(--srf-line);"
      >
        <div class="flex flex-wrap items-center gap-2">
          <div class="w-full sm:w-48">
            <label for="bundle-status-filter" class="sr-only">Filter Status Bundle</label>
            <select
              id="bundle-status-filter"
              v-model="statusTab"
              class="ed-select !min-h-[44px] sm:!min-h-[38px] sm:!w-48 !py-1.5 !text-xs font-medium"
            >
              <option value="semua">Semua Bundle ({{ bundleList.length }})</option>
              <option value="aktif">Aktif ({{ aktifCount }})</option>
              <option value="menipis">Stok Menipis ({{ menipisCount }})</option>
              <option value="nonaktif">Nonaktif ({{ nonaktifCount }})</option>
            </select>
          </div>
          <button
            v-if="hasActiveFilter"
            type="button"
            class="ed-btn-ghost !min-h-[44px] sm:!min-h-[38px] !px-3 !text-xs"
            @click="resetFilters"
          >
            Reset
          </button>
        </div>

        <div class="relative w-full sm:w-72">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style="color: var(--srf-ink-3);"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            v-model="search"
            type="search"
            placeholder="Cari nama bundle, label, atau alat..."
            class="ed-input !min-h-[44px] sm:!min-h-[38px] !pl-9 !pr-3 !py-1.5 !text-xs"
          />
        </div>
      </div>

      <div
        v-if="pending && !bundleList.length"
        class="p-10 text-center text-sm"
        style="color: var(--srf-ink-3);"
      >
        Memuat daftar item bundle...
      </div>

      <div v-else-if="error && !bundleList.length" class="p-10 text-center space-y-3">
        <p class="text-sm font-medium" style="color: var(--srf-bad-ink);">
          Gagal memuat data item bundle.
        </p>
        <button type="button" class="ed-btn-secondary" @click="refresh()">
          Coba Lagi
        </button>
      </div>

      <div v-else-if="!filteredList.length" class="p-12 text-center">
        <p class="text-sm font-medium" style="color: var(--srf-ink-2);">
          {{ hasActiveFilter ? 'Belum ada item bundle yang cocok dengan filter ini.' : 'Belum ada item bundle promo yang dibuat.' }}
        </p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button v-if="hasActiveFilter" type="button" class="ed-btn-secondary" @click="resetFilters">
            Reset Filter
          </button>
          <NuxtLink to="/admin/item-bundle/tambah" class="ed-btn-primary">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Tambah Bundle Baru</span>
          </NuxtLink>
        </div>
      </div>

      <template v-else>
        <!-- Desktop Table -->
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full border-collapse text-left text-sm">
            <thead>
              <tr
                class="border-b text-[11px] font-semibold uppercase tracking-wider"
                style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-3);"
              >
                <th class="px-4 py-3 whitespace-nowrap">Bundle</th>
                <th class="px-4 py-3 whitespace-nowrap">Isi Alat</th>
                <th class="px-4 py-3 text-right whitespace-nowrap">Tarif Bundle / 24j</th>
                <th class="px-4 py-3 text-right whitespace-nowrap">Kuota</th>
                <th class="px-4 py-3 whitespace-nowrap">Status</th>
                <th class="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="bundle in filteredList"
                :key="bundle.id"
                class="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-[var(--srf-hover)]"
                :style="{
                  borderColor: 'var(--srf-line)',
                  backgroundColor: detailTarget?.id === bundle.id ? 'var(--srf-accent-soft)' : undefined,
                }"
                @click="detailTarget = bundle"
              >
                <td class="px-4 py-3.5 align-middle">
                  <div class="flex items-center gap-3">
                    <div
                      class="h-10 w-12 shrink-0 overflow-hidden rounded-[8px] border"
                      style="border-color: var(--srf-line); background-color: var(--srf-well);"
                    >
                      <img
                        v-if="bundle.foto"
                        :src="bundle.foto"
                        :alt="bundle.namaPaket"
                        class="h-full w-full object-cover"
                      />
                      <GearArtThumb v-else kind="tent" />
                    </div>
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <p class="text-sm font-semibold whitespace-nowrap" style="color: var(--srf-ink);">
                          {{ bundle.namaPaket }}
                        </p>
                        <StatusBadge
                          v-if="bundle.labelPromo"
                          variant="light"
                          tone="good"
                          :label="bundle.labelPromo"
                        />
                      </div>
                      <p class="mt-0.5 text-xs tabular whitespace-nowrap" style="color: var(--srf-ink-3);">
                        {{ bundle.kodePaket }} · Normal {{ formatRupiah(bundle.totalNormal) }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3.5 align-middle min-w-[220px]">
                  <p class="text-xs font-medium" style="color: var(--srf-ink);">
                    {{ bundle.items.length }} alat
                  </p>
                  <p class="mt-0.5 line-clamp-2 text-xs leading-relaxed" style="color: var(--srf-ink-3);">
                    {{ formatItemsSummary(bundle.items) }}
                  </p>
                </td>
                <td class="px-4 py-3.5 align-middle text-right whitespace-nowrap tabular">
                  <p class="text-sm font-semibold" style="color: var(--srf-ink);">
                    {{ formatRupiah(bundle.tarifPaket) }}
                  </p>
                  <p
                    v-if="bundle.totalNormal > bundle.tarifPaket"
                    class="mt-0.5 text-[11px] font-medium"
                    style="color: var(--srf-good-ink);"
                  >
                    Hemat {{ formatRupiah(bundle.totalNormal - bundle.tarifPaket) }}
                    <span v-if="bundle.diskonPersen > 0">(-{{ bundle.diskonPersen }}%)</span>
                  </p>
                  <p v-else class="mt-0.5 text-[11px]" style="color: var(--srf-ink-3);">
                    / 24 jam
                  </p>
                </td>
                <td class="px-4 py-3.5 align-middle text-right whitespace-nowrap tabular">
                  <span
                    class="text-xs font-semibold"
                    :style="{
                      color: bundle.kuotaTersedia <= 2 ? 'var(--srf-warn-ink)' : 'var(--srf-ink)',
                    }"
                  >
                    {{ bundle.kuotaTersedia }} bundle
                  </span>
                </td>
                <td class="px-4 py-3.5 align-middle whitespace-nowrap">
                  <button
                    type="button"
                    class="inline-flex cursor-pointer items-center rounded-full focus-visible:outline-2"
                    :disabled="togglingId === bundle.id"
                    :title="bundle.statusAktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'"
                    @click.stop="toggleActive(bundle)"
                  >
                    <StatusBadge
                      variant="outline"
                      :label="togglingId === bundle.id ? 'Menyimpan...' : (bundle.statusAktif ? 'Aktif' : 'Nonaktif')"
                      :tone="bundle.statusAktif ? 'good' : 'bad'"
                    />
                  </button>
                </td>
                <td class="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                  <div class="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                      title="Lihat detail bundle"
                      aria-label="Lihat detail bundle"
                      @click.stop="detailTarget = bundle"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <NuxtLink
                      :to="`/admin/item-bundle/tambah?edit=${bundle.id}`"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                      title="Edit bundle"
                      aria-label="Edit bundle"
                      @click.stop
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </NuxtLink>
                    <button
                      type="button"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                      style="color: var(--srf-bad-ink); border-color: var(--srf-bad-border); background-color: var(--srf-bad-soft);"
                      :disabled="deletingId === bundle.id"
                      title="Hapus bundle"
                      aria-label="Hapus bundle"
                      @click.stop="deleteTarget = bundle"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Cards -->
        <div class="divide-y md:hidden" style="border-color: var(--srf-line);">
          <div
            v-for="bundle in filteredList"
            :key="`mob-${bundle.id}`"
            class="space-y-3 p-4"
            @click="detailTarget = bundle"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <img
                  v-if="bundle.foto"
                  :src="bundle.foto"
                  :alt="bundle.namaPaket"
                  class="h-12 w-14 shrink-0 rounded-[10px] object-cover"
                  style="border: 1px solid var(--srf-line);"
                />
                <GearArtThumb v-else kind="tent" size="sm" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold" style="color: var(--srf-ink);">
                    {{ bundle.namaPaket }}
                  </p>
                  <p class="text-xs tabular" style="color: var(--srf-ink-3);">
                    {{ bundle.kodePaket }} · {{ bundle.items.length }} alat
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="inline-flex min-h-[44px] shrink-0 items-center px-1"
                :disabled="togglingId === bundle.id"
                @click.stop="toggleActive(bundle)"
              >
                <StatusBadge
                  variant="outline"
                  :label="bundle.statusAktif ? 'Aktif' : 'Nonaktif'"
                  :tone="bundle.statusAktif ? 'good' : 'bad'"
                />
              </button>
            </div>

            <div v-if="bundle.labelPromo">
              <StatusBadge variant="light" tone="good" :label="bundle.labelPromo" />
            </div>

            <p class="truncate text-xs" style="color: var(--srf-ink-2);">
              {{ formatItemsSummary(bundle.items) }}
            </p>

            <div class="flex items-center justify-between text-xs tabular">
              <div>
                <span class="text-sm font-bold" style="color: var(--srf-ink);">
                  {{ formatRupiah(bundle.tarifPaket) }}
                </span>
                <span style="color: var(--srf-ink-3);"> / 24j</span>
                <span
                  v-if="bundle.totalNormal > bundle.tarifPaket"
                  class="ml-1.5 font-medium"
                  style="color: var(--srf-good-ink);"
                >
                  Hemat {{ formatRupiah(bundle.totalNormal - bundle.tarifPaket) }}
                </span>
              </div>
              <span
                class="font-semibold"
                :style="{ color: bundle.kuotaTersedia <= 2 ? 'var(--srf-warn-ink)' : 'var(--srf-ink)' }"
              >
                Kuota {{ bundle.kuotaTersedia }} bundle
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                class="ed-btn-secondary h-11 justify-center text-xs"
                @click.stop="detailTarget = bundle"
              >
                Detail
              </button>
              <NuxtLink
                :to="`/admin/item-bundle/tambah?edit=${bundle.id}`"
                class="ed-btn-secondary h-11 justify-center text-xs"
                @click.stop
              >
                Edit
              </NuxtLink>
              <button
                type="button"
                class="inline-flex h-11 items-center justify-center rounded-[10px] text-xs font-medium disabled:opacity-50"
                style="border: 1px solid var(--srf-bad-border); background: var(--srf-bad-soft); color: var(--srf-bad-ink);"
                :disabled="deletingId === bundle.id"
                @click.stop="deleteTarget = bundle"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>

        <div
          class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs"
          style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-3);"
        >
          <span>Menampilkan {{ filteredList.length }} dari {{ bundleList.length }} item bundle</span>
          <span>Klik baris untuk lihat rincian isi bundle</span>
        </div>
      </template>
    </div>

    <!-- Modal Detail Bundle -->
    <div
      v-if="detailTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="detailTarget = null"
    >
      <div
        class="ed-card max-h-[90vh] w-full max-w-lg overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-detail-bundle-title"
      >
        <div
          class="flex items-start justify-between gap-3 px-5 py-4"
          style="border-bottom: 1px solid var(--srf-line);"
        >
          <div class="min-w-0">
            <span class="ed-label" style="color: var(--srf-accent);">
              INSPEKTOR BUNDLE · {{ detailTarget.kodePaket }}
            </span>
            <h2 id="modal-detail-bundle-title" class="mt-0.5 text-lg font-bold" style="color: var(--srf-ink);">
              {{ detailTarget.namaPaket }}
            </h2>
          </div>
          <button
            type="button"
            class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
            aria-label="Tutup modal detail"
            @click="detailTarget = null"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-4 p-5">
          <div class="ed-well flex items-center gap-3 p-3">
            <img
              v-if="detailTarget.foto"
              :src="detailTarget.foto"
              :alt="detailTarget.namaPaket"
              class="h-14 w-16 shrink-0 rounded-[10px] object-cover"
              style="border: 1px solid var(--srf-line);"
            />
            <GearArtThumb v-else kind="tent" size="md" />
            <div class="min-w-0 flex-1 space-y-1">
              <p class="text-xs font-medium" style="color: var(--srf-ink);">
                {{ detailTarget.deskripsi || 'Bundle promo perlengkapan basecamp.' }}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <StatusBadge
                  v-if="detailTarget.labelPromo"
                  variant="light"
                  tone="good"
                  :label="detailTarget.labelPromo"
                />
                <StatusBadge
                  variant="outline"
                  :label="detailTarget.statusAktif ? 'Aktif' : 'Nonaktif'"
                  :tone="detailTarget.statusAktif ? 'good' : 'bad'"
                />
              </div>
            </div>
          </div>

          <div>
            <span class="ed-label">KOMPOSISI ALAT BUNDLE</span>
            <ul class="mt-2 space-y-1.5">
              <li
                v-for="item in detailTarget.items"
                :key="item.idAlat"
                class="flex items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-xs"
                style="background: var(--srf-well); border: 1px solid var(--srf-line);"
              >
                <span class="min-w-0 truncate" style="color: var(--srf-ink);">
                  <span style="color: var(--srf-ink-3);">{{ item.namaKategori }} ·</span>
                  <strong class="ml-1">{{ item.jumlah }}x {{ item.namaAlat }}</strong>
                </span>
                <span class="shrink-0 tabular" style="color: var(--srf-ink-2);">
                  {{ formatRupiah(item.hargaHarian * item.jumlah) }}
                </span>
              </li>
            </ul>
          </div>

          <div
            class="space-y-1.5 pt-3 text-xs tabular"
            style="border-top: 1px dashed var(--srf-line);"
          >
            <div class="flex justify-between" style="color: var(--srf-ink-2);">
              <span>Total harga satuan / 24 jam</span>
              <span>{{ formatRupiah(detailTarget.totalNormal) }}</span>
            </div>
            <div
              v-if="detailTarget.totalNormal > detailTarget.tarifPaket"
              class="flex justify-between"
              style="color: var(--srf-good-ink);"
            >
              <span>Hemat bundle</span>
              <span>-{{ formatRupiah(detailTarget.totalNormal - detailTarget.tarifPaket) }}</span>
            </div>
            <div class="flex justify-between pt-1 text-base font-bold" style="color: var(--srf-ink);">
              <span>Tarif Bundle / 24 jam</span>
              <span>{{ formatRupiah(detailTarget.tarifPaket) }}</span>
            </div>
            <div class="flex items-center justify-between pt-1" style="color: var(--srf-ink-2);">
              <span>Kuota tersedia otomatis</span>
              <StatusBadge
                variant="light"
                :label="`${detailTarget.kuotaTersedia} bundle`"
                :tone="detailTarget.kuotaTersedia > 2 ? 'good' : 'warn'"
              />
            </div>
          </div>

          <div
            class="flex flex-wrap gap-2 pt-3"
            style="border-top: 1px solid var(--srf-line);"
          >
            <NuxtLink
              :to="`/admin/item-bundle/tambah?edit=${detailTarget.id}`"
              class="ed-btn-primary flex-1 justify-center"
            >
              Edit Item Bundle
            </NuxtLink>
            <button
              type="button"
              class="ed-btn-secondary"
              :disabled="togglingId === detailTarget.id"
              @click="toggleActive(detailTarget)"
            >
              {{ detailTarget.statusAktif ? 'Nonaktifkan' : 'Aktifkan' }}
            </button>
            <button
              type="button"
              class="inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-3.5 text-sm font-medium transition-colors disabled:opacity-50"
              style="border: 1px solid var(--srf-bad-border); background: var(--srf-bad-soft); color: var(--srf-bad-ink);"
              :disabled="deletingId === detailTarget.id"
              @click="openDeleteFromDetail"
            >
              Hapus
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Hapus -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeDeleteModal"
    >
      <div
        class="ed-card w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-hapus-bundle-title"
      >
        <div class="p-5">
          <span class="ed-label" style="color: var(--srf-bad-ink);">KONFIRMASI HAPUS</span>
          <h2 id="modal-hapus-bundle-title" class="mt-1 text-lg font-bold" style="color: var(--srf-ink);">
            Hapus "{{ deleteTarget.namaPaket }}"?
          </h2>
          <p class="mt-2 text-sm leading-relaxed" style="color: var(--srf-ink-2);">
            Jika bundle belum pernah dipakai dalam transaksi sewa, data akan dihapus permanen. Jika sudah tercatat di riwayat sewa, bundle otomatis dinonaktifkan.
          </p>
        </div>
        <div
          class="flex justify-end gap-2 px-5 py-3.5"
          style="background: var(--srf-well); border-top: 1px solid var(--srf-line);"
        >
          <button
            type="button"
            class="ed-btn-secondary"
            :disabled="Boolean(deletingId)"
            @click="closeDeleteModal"
          >
            Batal
          </button>
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-4 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style="background: var(--srf-bad);"
            :disabled="Boolean(deletingId)"
            @click="confirmDelete"
          >
            {{ deletingId ? 'Menghapus...' : 'Hapus Bundle' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="toastMsg"
      class="fixed bottom-5 right-5 z-50 rounded-[12px] px-4 py-3 text-xs font-medium shadow-lg"
      :style="
        toastMsg.tone === 'bad'
          ? { background: 'var(--srf-bad-soft)', border: '1px solid var(--srf-bad-border)', color: 'var(--srf-bad-ink)' }
          : { background: 'var(--srf-good-soft)', border: '1px solid var(--srf-good-border)', color: 'var(--srf-good-ink)' }
      "
    >
      {{ toastMsg.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface BundleItem {
  idAlat: number
  idKategori: number
  namaKategori: string
  kodeAlat: string
  namaAlat: string
  hargaHarian: number
  jumlah: number
  stokTersedia: number
}

interface BundleRow {
  id: number
  kodePaket: string
  namaPaket: string
  tipePaket: 'paket' | 'bundle'
  deskripsi: string
  labelPromo: string
  foto: string | null
  diskonPersen: number
  tarifPaket: number
  totalNormal: number
  kuotaTersedia: number
  statusAktif: boolean
  items: BundleItem[]
}

const { data, pending, error, refresh } = await useFetch<BundleRow[]>('/api/admin/paket-alat?tipe=bundle')

const statusTab = ref<'semua' | 'aktif' | 'menipis' | 'nonaktif'>('semua')
const search = ref('')
const detailTarget = ref<BundleRow | null>(null)
const deleteTarget = ref<BundleRow | null>(null)
const togglingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const toastMsg = ref<{ text: string; tone: 'good' | 'bad' } | null>(null)

let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(text: string, tone: 'good' | 'bad' = 'good') {
  toastMsg.value = { text, tone }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = null
  }, 3000)
}

const bundleList = computed(() => data.value ?? [])
const aktifCount = computed(() => bundleList.value.filter((p) => p.statusAktif).length)
const menipisCount = computed(() => bundleList.value.filter((p) => p.kuotaTersedia <= 2).length)
const nonaktifCount = computed(() => bundleList.value.filter((p) => !p.statusAktif).length)
const hasActiveFilter = computed(() => statusTab.value !== 'semua' || search.value.trim().length > 0)

const filteredList = computed(() => {
  const q = search.value.trim().toLowerCase()
  return bundleList.value.filter((b) => {
    if (statusTab.value === 'aktif' && !b.statusAktif) return false
    if (statusTab.value === 'menipis' && b.kuotaTersedia > 2) return false
    if (statusTab.value === 'nonaktif' && b.statusAktif) return false
    if (!q) return true
    const itemText = b.items.map((i) => i.namaAlat).join(' ').toLowerCase()
    return (
      b.namaPaket.toLowerCase().includes(q) ||
      b.kodePaket.toLowerCase().includes(q) ||
      b.labelPromo.toLowerCase().includes(q) ||
      itemText.includes(q)
    )
  })
})

function formatItemsSummary(items: BundleItem[]) {
  return items.map((i) => `${i.namaAlat} (${i.jumlah})`).join(', ')
}

function resetFilters() {
  statusTab.value = 'semua'
  search.value = ''
}

function openDeleteFromDetail() {
  if (!detailTarget.value) return
  deleteTarget.value = detailTarget.value
  detailTarget.value = null
}

function closeDeleteModal() {
  if (deletingId.value) return
  deleteTarget.value = null
}

async function toggleActive(bundle: BundleRow) {
  togglingId.value = bundle.id
  const nextStatus = !bundle.statusAktif
  try {
    await $fetch(`/api/admin/paket-alat/${bundle.id}`, {
      method: 'PUT',
      body: { statusAktif: nextStatus },
    })
    await refresh()
    if (detailTarget.value?.id === bundle.id) {
      detailTarget.value = bundleList.value.find((p) => p.id === bundle.id) ?? null
    }
    showToast(nextStatus ? 'Item bundle diaktifkan.' : 'Item bundle dinonaktifkan.')
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string } }
    showToast(e?.data?.statusMessage || 'Gagal mengubah status item bundle.', 'bad')
  } finally {
    togglingId.value = null
  }
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  deletingId.value = target.id
  try {
    const res = await $fetch<{ ok: boolean; softDisabled: boolean; message?: string }>(
      `/api/admin/paket-alat/${target.id}`,
      { method: 'DELETE' },
    )
    deleteTarget.value = null
    if (detailTarget.value?.id === target.id) {
      detailTarget.value = null
    }
    await refresh()
    showToast(
      res.softDisabled
        ? (res.message || 'Item bundle terhubung ke transaksi sehingga dinonaktifkan.')
        : `Item bundle "${target.namaPaket}" berhasil dihapus.`,
    )
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string } }
    showToast(e?.data?.statusMessage || 'Gagal menghapus item bundle.', 'bad')
  } finally {
    deletingId.value = null
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (deleteTarget.value && !deletingId.value) {
    deleteTarget.value = null
  } else if (detailTarget.value) {
    detailTarget.value = null
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

