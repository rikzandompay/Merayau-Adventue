<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <span class="ed-label" style="color: var(--srf-accent);">{{ copy.eyebrow }}</span>
        <h1 class="mt-0.5 text-2xl font-bold tracking-tight" style="color: var(--srf-ink);">
          {{ copy.title }}
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2);">{{ copy.subtitle }}</p>
      </div>
      <NuxtLink :to="copy.createTo" class="ed-btn-primary">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>{{ copy.createLabel }}</span>
      </NuxtLink>
    </div>

    <div class="ed-card overflow-hidden">
      <div
        class="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        style="border-bottom: 1px solid var(--srf-line);"
      >
        <div class="flex flex-wrap items-center gap-2">
          <div class="w-full sm:w-48">
            <label :for="`${mode}-status-filter`" class="sr-only">Filter Status {{ copy.nounTitle }}</label>
            <select
              :id="`${mode}-status-filter`"
              v-model="statusTab"
              class="ed-select !min-h-[44px] sm:!min-h-[38px] sm:!w-48 !py-1.5 !text-xs font-medium"
            >
              <option value="semua">Semua {{ copy.nounTitle }} ({{ rows.length }})</option>
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
            :placeholder="copy.searchPlaceholder"
            class="ed-input !min-h-[44px] sm:!min-h-[38px] !pl-9 !pr-3 !py-1.5 !text-xs"
          />
        </div>
      </div>

      <div
        v-if="pending && !rows.length"
        class="p-10 text-center text-sm"
        style="color: var(--srf-ink-3);"
      >
        {{ copy.loadingText }}
      </div>

      <div v-else-if="error && !rows.length" class="p-10 text-center space-y-3">
        <p class="text-sm font-medium" style="color: var(--srf-bad-ink);">
          {{ copy.errorText }}
        </p>
        <button type="button" class="ed-btn-secondary" @click="refresh()">
          Coba Lagi
        </button>
      </div>

      <div v-else-if="!filteredList.length" class="p-12 text-center">
        <p class="text-sm font-medium" style="color: var(--srf-ink-2);">
          {{ hasActiveFilter ? copy.emptyFiltered : copy.emptyAll }}
        </p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button v-if="hasActiveFilter" type="button" class="ed-btn-secondary" @click="resetFilters">
            Reset Filter
          </button>
          <NuxtLink :to="copy.createTo" class="ed-btn-primary">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>{{ copy.createLabel }}</span>
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
                <th class="px-4 py-3 whitespace-nowrap">{{ copy.nounTitle }}</th>
                <th class="px-4 py-3 whitespace-nowrap">{{ copy.colItems }}</th>
                <th class="px-4 py-3 text-right whitespace-nowrap">{{ copy.colTarif }}</th>
                <th class="px-4 py-3 text-right whitespace-nowrap">Kuota</th>
                <th class="px-4 py-3 whitespace-nowrap">Status</th>
                <th class="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredList"
                :key="row.id"
                class="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-[var(--srf-hover)]"
                :style="{
                  borderColor: 'var(--srf-line)',
                  backgroundColor: detailTarget?.id === row.id ? 'var(--srf-accent-soft)' : undefined,
                }"
                @click="detailTarget = row"
              >
                <td class="px-4 py-3.5 align-middle">
                  <div class="flex items-center gap-3">
                    <div
                      class="h-10 w-12 shrink-0 overflow-hidden rounded-[8px] border"
                      style="border-color: var(--srf-line); background-color: var(--srf-well);"
                    >
                      <img v-if="row.foto" :src="row.foto" :alt="row.namaPaket" class="h-full w-full object-cover" />
                      <GearArtThumb v-else kind="tent" />
                    </div>
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <p class="text-sm font-semibold whitespace-nowrap" style="color: var(--srf-ink);">
                          {{ row.namaPaket }}
                        </p>
                        <StatusBadge
                          v-if="isBundle && row.labelPromo"
                          variant="light"
                          tone="good"
                          :label="row.labelPromo"
                        />
                      </div>
                      <p class="mt-0.5 text-xs tabular whitespace-nowrap" style="color: var(--srf-ink-3);">
                        {{ row.kodePaket }} · Normal {{ formatRupiah(row.totalNormal) }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3.5 align-middle min-w-[220px]">
                  <p class="text-xs font-medium" style="color: var(--srf-ink);">{{ row.items.length }} alat</p>
                  <p class="mt-0.5 line-clamp-2 text-xs leading-relaxed" style="color: var(--srf-ink-3);">
                    {{ formatItemsSummary(row.items) }}
                  </p>
                </td>
                <td class="px-4 py-3.5 align-middle text-right whitespace-nowrap tabular">
                  <p class="text-sm font-semibold" style="color: var(--srf-ink);">
                    {{ formatRupiah(row.tarifPaket) }}
                  </p>
                  <p
                    v-if="isBundle && row.totalNormal > row.tarifPaket"
                    class="mt-0.5 text-[11px] font-medium"
                    style="color: var(--srf-good-ink);"
                  >
                    Hemat {{ formatRupiah(row.totalNormal - row.tarifPaket) }}
                    <span v-if="row.diskonPersen > 0">(-{{ row.diskonPersen }}%)</span>
                  </p>
                  <p v-else class="mt-0.5 text-[11px]" style="color: var(--srf-ink-3);">/ 24 jam</p>
                </td>
                <td class="px-4 py-3.5 align-middle text-right whitespace-nowrap tabular">
                  <span
                    class="text-xs font-semibold"
                    :style="{ color: row.kuotaTersedia <= 2 ? 'var(--srf-warn-ink)' : 'var(--srf-ink)' }"
                  >
                    {{ row.kuotaTersedia }} {{ copy.unitWord }}
                  </span>
                </td>
                <td class="px-4 py-3.5 align-middle whitespace-nowrap">
                  <button
                    type="button"
                    class="inline-flex cursor-pointer items-center rounded-full focus-visible:outline-2"
                    :disabled="togglingId === row.id"
                    :title="row.statusAktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'"
                    @click.stop="toggleActive(row)"
                  >
                    <StatusBadge
                      variant="outline"
                      :label="togglingId === row.id ? 'Menyimpan...' : (row.statusAktif ? 'Aktif' : 'Nonaktif')"
                      :tone="row.statusAktif ? 'good' : 'bad'"
                    />
                  </button>
                </td>
                <td class="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                  <div class="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                      :title="`Lihat detail ${copy.unitWord}`"
                      :aria-label="`Lihat detail ${copy.unitWord}`"
                      @click.stop="detailTarget = row"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <NuxtLink
                      :to="`${copy.createTo}?edit=${row.id}`"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                      :title="`Edit ${copy.unitWord}`"
                      :aria-label="`Edit ${copy.unitWord}`"
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
                      :disabled="deletingId === row.id"
                      :title="`Hapus ${copy.unitWord}`"
                      :aria-label="`Hapus ${copy.unitWord}`"
                      @click.stop="deleteTarget = row"
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
            v-for="row in filteredList"
            :key="`mob-${row.id}`"
            class="space-y-3 p-4"
            @click="detailTarget = row"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <img
                  v-if="row.foto"
                  :src="row.foto"
                  :alt="row.namaPaket"
                  class="h-12 w-14 shrink-0 rounded-[10px] object-cover"
                  style="border: 1px solid var(--srf-line);"
                />
                <GearArtThumb v-else kind="tent" size="sm" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold" style="color: var(--srf-ink);">{{ row.namaPaket }}</p>
                  <p class="text-xs tabular" style="color: var(--srf-ink-3);">
                    {{ row.kodePaket }} · {{ row.items.length }} alat
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="inline-flex min-h-[44px] shrink-0 items-center px-1"
                :disabled="togglingId === row.id"
                @click.stop="toggleActive(row)"
              >
                <StatusBadge
                  variant="outline"
                  :label="row.statusAktif ? 'Aktif' : 'Nonaktif'"
                  :tone="row.statusAktif ? 'good' : 'bad'"
                />
              </button>
            </div>

            <div v-if="isBundle && row.labelPromo">
              <StatusBadge variant="light" tone="good" :label="row.labelPromo" />
            </div>

            <p class="truncate text-xs" style="color: var(--srf-ink-2);">{{ formatItemsSummary(row.items) }}</p>

            <div class="flex items-center justify-between text-xs tabular">
              <div>
                <span class="text-sm font-bold" style="color: var(--srf-ink);">{{ formatRupiah(row.tarifPaket) }}</span>
                <span style="color: var(--srf-ink-3);"> / 24j</span>
                <span
                  v-if="isBundle && row.totalNormal > row.tarifPaket"
                  class="ml-1.5 font-medium"
                  style="color: var(--srf-good-ink);"
                >
                  Hemat {{ formatRupiah(row.totalNormal - row.tarifPaket) }}
                </span>
              </div>
              <span
                class="font-semibold"
                :style="{ color: row.kuotaTersedia <= 2 ? 'var(--srf-warn-ink)' : 'var(--srf-ink)' }"
              >
                Kuota {{ row.kuotaTersedia }} {{ copy.unitWord }}
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-1">
              <button type="button" class="ed-btn-secondary h-11 justify-center text-xs" @click.stop="detailTarget = row">
                Detail
              </button>
              <NuxtLink :to="`${copy.createTo}?edit=${row.id}`" class="ed-btn-secondary h-11 justify-center text-xs" @click.stop>
                Edit
              </NuxtLink>
              <button
                type="button"
                class="inline-flex h-11 items-center justify-center rounded-[10px] text-xs font-medium disabled:opacity-50"
                style="border: 1px solid var(--srf-bad-border); background: var(--srf-bad-soft); color: var(--srf-bad-ink);"
                :disabled="deletingId === row.id"
                @click.stop="deleteTarget = row"
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
          <span>Menampilkan {{ filteredList.length }} dari {{ rows.length }} {{ copy.nounCount }}</span>
          <span>Klik baris untuk lihat rincian isi {{ copy.unitWord }}</span>
        </div>
      </template>
    </div>

    <!-- Detail Modal -->
    <div
      v-if="detailTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="detailTarget = null"
    >
      <div
        class="ed-card max-h-[90vh] w-full max-w-lg overflow-y-auto"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`modal-detail-${mode}-title`"
      >
        <div
          class="flex items-start justify-between gap-3 px-5 py-4"
          style="border-bottom: 1px solid var(--srf-line);"
        >
          <div class="min-w-0">
            <span class="ed-label" style="color: var(--srf-accent);">
              {{ copy.inspectorLabel }} · {{ detailTarget.kodePaket }}
            </span>
            <h2 :id="`modal-detail-${mode}-title`" class="mt-0.5 text-lg font-bold" style="color: var(--srf-ink);">
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
              <p v-if="isBundle" class="text-xs font-medium" style="color: var(--srf-ink);">
                {{ detailTarget.deskripsi || 'Bundle promo perlengkapan basecamp.' }}
              </p>
              <p v-else class="text-xs font-medium" style="color: var(--srf-ink);">
                {{ detailTarget.items.length }} jenis perlengkapan · {{ formatItemsSummary(detailTarget.items) }}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <StatusBadge
                  v-if="isBundle && detailTarget.labelPromo"
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
            <span class="ed-label">{{ copy.compLabel }}</span>
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

          <div class="space-y-1.5 pt-3 text-xs tabular" style="border-top: 1px dashed var(--srf-line);">
            <div class="flex justify-between" style="color: var(--srf-ink-2);">
              <span>Total harga satuan / 24 jam</span>
              <span>{{ formatRupiah(detailTarget.totalNormal) }}</span>
            </div>
            <div
              v-if="isBundle && detailTarget.totalNormal > detailTarget.tarifPaket"
              class="flex justify-between"
              style="color: var(--srf-good-ink);"
            >
              <span>Hemat bundle</span>
              <span>-{{ formatRupiah(detailTarget.totalNormal - detailTarget.tarifPaket) }}</span>
            </div>
            <div class="flex justify-between pt-1 text-base font-bold" style="color: var(--srf-ink);">
              <span>{{ copy.tarifLabel }} / 24 jam</span>
              <span>{{ formatRupiah(detailTarget.tarifPaket) }}</span>
            </div>
            <div class="flex items-center justify-between pt-1" style="color: var(--srf-ink-2);">
              <span>Kuota tersedia otomatis</span>
              <StatusBadge
                variant="light"
                :label="`${detailTarget.kuotaTersedia} ${copy.unitWord}`"
                :tone="detailTarget.kuotaTersedia > 2 ? 'good' : 'warn'"
              />
            </div>
          </div>

          <div class="flex flex-wrap gap-2 pt-3" style="border-top: 1px solid var(--srf-line);">
            <NuxtLink :to="`${copy.createTo}?edit=${detailTarget.id}`" class="ed-btn-primary flex-1 justify-center">
              {{ copy.detailEditLabel }}
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

    <!-- Delete Confirm Modal -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeDeleteModal"
    >
      <div
        class="ed-card w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`modal-hapus-${mode}-title`"
      >
        <div class="p-5">
          <span class="ed-label" style="color: var(--srf-bad-ink);">KONFIRMASI HAPUS</span>
          <h2 :id="`modal-hapus-${mode}-title`" class="mt-1 text-lg font-bold" style="color: var(--srf-ink);">
            Hapus "{{ deleteTarget.namaPaket }}"?
          </h2>
          <p class="mt-2 text-sm leading-relaxed" style="color: var(--srf-ink-2);">{{ copy.deleteConfirmDesc }}</p>
        </div>
        <div
          class="flex justify-end gap-2 px-5 py-3.5"
          style="background: var(--srf-well); border-top: 1px solid var(--srf-line);"
        >
          <button type="button" class="ed-btn-secondary" :disabled="Boolean(deletingId)" @click="closeDeleteModal">
            Batal
          </button>
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-4 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style="background: var(--srf-bad);"
            :disabled="Boolean(deletingId)"
            @click="confirmDelete"
          >
            {{ deletingId ? 'Menghapus...' : copy.deleteBtnLabel }}
          </button>
        </div>
      </div>
    </div>

    <!-- Floating Feedback Toast -->
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
interface CatalogItem {
  idAlat: number
  idKategori: number
  namaKategori: string
  kodeAlat: string
  namaAlat: string
  hargaHarian: number
  jumlah: number
  stokTersedia: number
}

interface CatalogRow {
  id: number
  kodePaket: string
  namaPaket: string
  tipePaket?: 'paket' | 'bundle'
  deskripsi?: string
  labelPromo?: string
  foto: string | null
  diskonPersen: number
  tarifPaket: number
  totalNormal: number
  kuotaTersedia: number
  statusAktif: boolean
  items: CatalogItem[]
}

const props = defineProps<{
  mode: 'paket' | 'bundle'
}>()

const isBundle = computed(() => props.mode === 'bundle')

const COPY_MAP = {
  paket: {
    eyebrow: 'INVENTORI PAKET BUNDEL',
    title: 'Manajemen Paket Alat',
    subtitle: 'Kelola paket sewa alat lintas kategori, foto katalog, dan tarif paket per 24 jam.',
    createTo: '/admin/paket-alat/tambah',
    createLabel: 'Tambah Paket Baru',
    nounTitle: 'Paket',
    nounCount: 'paket',
    unitWord: 'paket',
    searchPlaceholder: 'Cari nama paket atau isi alat...',
    loadingText: 'Memuat daftar paket alat...',
    errorText: 'Gagal memuat data paket alat.',
    emptyFiltered: 'Belum ada paket alat yang cocok dengan filter ini.',
    emptyAll: 'Belum ada paket alat yang dibuat.',
    colItems: 'Isi Paket',
    colTarif: 'Tarif / 24j',
    inspectorLabel: 'INSPEKTOR PAKET',
    compLabel: 'KOMPOSISI ALAT PAKET',
    tarifLabel: 'Tarif Paket',
    detailEditLabel: 'Edit Isi & Foto Paket',
    deleteConfirmDesc: 'Jika paket belum pernah dipakai dalam transaksi sewa, paket akan dihapus permanen. Jika sudah pernah dipakai di riwayat sewa, paket otomatis dinonaktifkan agar riwayat tetap utuh.',
    deleteBtnLabel: 'Hapus Paket',
  },
  bundle: {
    eyebrow: 'BUNDLE PROMO ALAT',
    title: 'Manajemen Item Bundle',
    subtitle: 'Gabungkan beberapa alat menjadi bundle promo dengan potongan persen, nominal, atau harga bundle khusus.',
    createTo: '/admin/item-bundle/tambah',
    createLabel: 'Tambah Bundle Baru',
    nounTitle: 'Bundle',
    nounCount: 'item bundle',
    unitWord: 'bundle',
    searchPlaceholder: 'Cari nama bundle, label, atau alat...',
    loadingText: 'Memuat daftar item bundle...',
    errorText: 'Gagal memuat data item bundle.',
    emptyFiltered: 'Belum ada item bundle yang cocok dengan filter ini.',
    emptyAll: 'Belum ada item bundle promo yang dibuat.',
    colItems: 'Isi Alat',
    colTarif: 'Tarif Bundle / 24j',
    inspectorLabel: 'INSPEKTOR BUNDLE',
    compLabel: 'KOMPOSISI ALAT BUNDLE',
    tarifLabel: 'Tarif Bundle',
    detailEditLabel: 'Edit Item Bundle',
    deleteConfirmDesc: 'Jika bundle belum pernah dipakai dalam transaksi sewa, data akan dihapus permanen. Jika sudah tercatat di riwayat sewa, bundle otomatis dinonaktifkan.',
    deleteBtnLabel: 'Hapus Bundle',
  },
} as const

const copy = computed(() => COPY_MAP[props.mode])

const { data, pending, error, refresh } = await useFetch<CatalogRow[]>(
  () => `/api/admin/paket-alat?tipe=${props.mode}`,
)

const statusTab = ref<'semua' | 'aktif' | 'menipis' | 'nonaktif'>('semua')
const search = ref('')
const detailTarget = ref<CatalogRow | null>(null)
const deleteTarget = ref<CatalogRow | null>(null)
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

const rows = computed(() => data.value ?? [])
const aktifCount = computed(() => rows.value.filter((p) => p.statusAktif).length)
const menipisCount = computed(() => rows.value.filter((p) => p.kuotaTersedia <= 2).length)
const nonaktifCount = computed(() => rows.value.filter((p) => !p.statusAktif).length)
const hasActiveFilter = computed(() => statusTab.value !== 'semua' || search.value.trim().length > 0)

const filteredList = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value.filter((item) => {
    if (statusTab.value === 'aktif' && !item.statusAktif) return false
    if (statusTab.value === 'menipis' && item.kuotaTersedia > 2) return false
    if (statusTab.value === 'nonaktif' && item.statusAktif) return false
    if (!q) return true
    const itemText = item.items.map((i) => i.namaAlat).join(' ').toLowerCase()
    return (
      item.namaPaket.toLowerCase().includes(q)
      || item.kodePaket.toLowerCase().includes(q)
      || (item.labelPromo ?? '').toLowerCase().includes(q)
      || itemText.includes(q)
    )
  })
})

function formatItemsSummary(items: CatalogItem[]) {
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

async function toggleActive(item: CatalogRow) {
  togglingId.value = item.id
  const nextStatus = !item.statusAktif
  const labelCap = isBundle.value ? 'Item bundle' : 'Paket'
  try {
    await $fetch(`/api/admin/paket-alat/${item.id}`, {
      method: 'PUT',
      body: { statusAktif: nextStatus },
    })
    await refresh()
    if (detailTarget.value?.id === item.id) {
      detailTarget.value = rows.value.find((p) => p.id === item.id) ?? null
    }
    showToast(nextStatus ? `${labelCap} diaktifkan.` : `${labelCap} dinonaktifkan.`)
  } catch (err: unknown) {
    showToast(extractErrorMessage(err, `Gagal mengubah status ${copy.value.unitWord}.`), 'bad')
  } finally {
    togglingId.value = null
  }
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  deletingId.value = target.id
  const labelCap = isBundle.value ? 'Item bundle' : 'Paket'
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
        ? (res.message || `${labelCap} terhubung ke transaksi sehingga dinonaktifkan.`)
        : `${labelCap} "${target.namaPaket}" berhasil dihapus.`,
    )
  } catch (err: unknown) {
    showToast(extractErrorMessage(err, `Gagal menghapus ${copy.value.unitWord}.`), 'bad')
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

