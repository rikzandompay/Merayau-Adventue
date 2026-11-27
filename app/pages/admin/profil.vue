<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface AdminProfileResponse {
  profile: {
    id: number
    nama: string
    email: string
    noTelepon: string
    whatsappNormalized: string
    whatsappDisplay: string
    role: string
    createdAt: string
  }
}

const { fetchMe } = useAdminAuth()

const {
  data: profileRes,
  pending: loading,
  error: loadError,
  refresh: refreshProfile,
} = await useFetch<AdminProfileResponse>('/api/admin/profile')

const profileForm = reactive({
  nama: '',
  email: '',
  noTelepon: '',
})

watch(
  profileRes,
  (val) => {
    if (!val?.profile) return
    profileForm.nama = val.profile.nama
    profileForm.email = val.profile.email
    profileForm.noTelepon = val.profile.noTelepon
  },
  { immediate: true },
)

const savingProfile = ref(false)
const profileErr = ref('')

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const showCurrentPw = ref(false)
const showNewPw = ref(false)
const showConfirmPw = ref(false)
const savingPassword = ref(false)
const passwordErr = ref('')

const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 3200)
}

function normalizeWaPreview(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

function formatWaDisplayPreview(normalized: string): string {
  if (!normalized) return '-'
  if (normalized.startsWith('62') && normalized.length >= 10) {
    const rest = normalized.slice(2)
    const p1 = rest.slice(0, 3)
    const p2 = rest.slice(3, 7)
    const p3 = rest.slice(7)
    return p3 ? `+62 ${p1}-${p2}-${p3}` : `+62 ${p1}-${p2}`
  }
  return `+${normalized}`
}

const normalizedPreview = computed(() => normalizeWaPreview(profileForm.noTelepon))
const isPhoneValidPreview = computed(() => /^\d{10,15}$/.test(normalizedPreview.value))
const displayPhonePreview = computed(() =>
  normalizedPreview.value ? formatWaDisplayPreview(normalizedPreview.value) : '-',
)
const previewWaUrl = computed(() =>
  buildWaLink(
    normalizedPreview.value || '6285156549003',
    'Halo Admin Merayau Adventure, tes koneksi nomor layanan pemesanan.',
  ),
)

async function submitProfile() {
  profileErr.value = ''
  if (profileForm.nama.trim().length < 2) {
    profileErr.value = 'Nama admin minimal 2 karakter.'
    return
  }
  if (!profileForm.email.trim()) {
    profileErr.value = 'Email akun wajib diisi.'
    return
  }
  if (!isPhoneValidPreview.value) {
    profileErr.value = 'Nomor telepon / WhatsApp tidak valid (gunakan 10 hingga 15 digit, misalnya 085156549003).'
    return
  }

  savingProfile.value = true
  try {
    await $fetch('/api/admin/profile', {
      method: 'PUT',
      body: {
        nama: profileForm.nama.trim(),
        email: profileForm.email.trim(),
        noTelepon: profileForm.noTelepon.trim(),
      },
    })
    await Promise.all([refreshProfile(), fetchMe(true)])
    showToast('Profil dan nomor layanan pemesanan berhasil diperbarui.')
  } catch (err: unknown) {
    profileErr.value = extractErrorMessage(err, 'Gagal menyimpan perubahan profil.')
  } finally {
    savingProfile.value = false
  }
}

async function submitPassword() {
  passwordErr.value = ''
  if (!passwordForm.currentPassword) {
    passwordErr.value = 'Kata sandi saat ini wajib diisi.'
    return
  }
  if (passwordForm.newPassword.length < 12) {
    passwordErr.value = 'Kata sandi baru minimal 12 karakter.'
    return
  }
  if (!/[a-zA-Z]/.test(passwordForm.newPassword) || !/\d/.test(passwordForm.newPassword)) {
    passwordErr.value = 'Kata sandi baru wajib mengandung kombinasi huruf dan angka.'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordErr.value = 'Konfirmasi kata sandi baru tidak cocok.'
    return
  }
  if (passwordForm.newPassword === passwordForm.currentPassword) {
    passwordErr.value = 'Kata sandi baru harus berbeda dari kata sandi saat ini.'
    return
  }

  savingPassword.value = true
  try {
    await $fetch('/api/admin/profile/password', {
      method: 'PUT',
      body: {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      },
    })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    showCurrentPw.value = false
    showNewPw.value = false
    showConfirmPw.value = false
    showToast('Kata sandi akun berhasil diperbarui.')
  } catch (err: unknown) {
    passwordErr.value = extractErrorMessage(err, 'Gagal memperbarui kata sandi.')
  } finally {
    savingPassword.value = false
  }
}

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="space-y-5 sm:space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="ed-label">PENGATURAN AKUN</p>
        <h1 class="text-xl font-bold tracking-tight sm:text-2xl" style="color: var(--srf-ink)">
          Pengaturan Profil &amp; Kontak
        </h1>
        <p class="mt-0.5 text-xs sm:text-sm" style="color: var(--srf-ink-3)">
          Kelola akun admin, kata sandi masuk, dan nomor WhatsApp yang tampil di footer serta layanan pemesanan publik.
        </p>
      </div>
    </div>

    <div
      v-if="loadError"
      class="ed-card flex flex-wrap items-center justify-between gap-3 p-5 text-sm"
      style="border-color: var(--srf-bad-border); color: var(--srf-bad-ink)"
    >
      <span>Gagal memuat profil admin: {{ loadError.message }}</span>
      <button type="button" class="ed-btn-secondary !text-xs" @click="refreshProfile()">
        Coba Lagi
      </button>
    </div>

    <div v-else-if="loading && !profileRes" class="ed-card p-8 text-sm" style="color: var(--srf-ink-3)">
      Memuat pengaturan profil admin...
    </div>

    <div v-else class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <!-- Card 1: Profil & Nomor Layanan -->
      <section class="ed-card p-5 sm:p-6 lg:col-span-7">
        <div class="border-b pb-4" style="border-color: var(--srf-line)">
          <h2 class="text-base font-bold" style="color: var(--srf-ink)">
            Profil Admin &amp; Nomor Layanan Pemesanan
          </h2>
          <p class="mt-1 text-xs leading-relaxed" style="color: var(--srf-ink-3)">
            Nomor telepon ini otomatis disinkronkan ke footer website, tombol WhatsApp navbar, keranjang sewa alat, dan booking Open Trip.
          </p>
        </div>

        <form class="mt-5 space-y-4" @submit.prevent="submitProfile">
          <div>
            <label for="admin-nama" class="ed-label mb-1.5">Nama Admin</label>
            <input
              id="admin-nama"
              v-model="profileForm.nama"
              type="text"
              required
              placeholder="Nama pengelola basecamp"
              class="ed-input !min-h-[44px] sm:!min-h-[40px]"
            />
          </div>

          <div>
            <label for="admin-email" class="ed-label mb-1.5">Email Akun</label>
            <input
              id="admin-email"
              v-model="profileForm.email"
              type="email"
              required
              placeholder="admin@domain.id"
              class="ed-input !min-h-[44px] sm:!min-h-[40px]"
            />
            <p class="mt-1 text-[11px]" style="color: var(--srf-ink-3)">
              Dipakai khusus untuk login panel admin (terpisah dari email kontak publik di footer).
            </p>
          </div>

          <div>
            <label for="admin-telepon" class="ed-label mb-1.5">Nomor Telepon / WhatsApp Pemesanan</label>
            <input
              id="admin-telepon"
              v-model="profileForm.noTelepon"
              type="tel"
              inputmode="tel"
              required
              placeholder="085156549003"
              class="ed-input tabular !min-h-[44px] sm:!min-h-[40px]"
            />
            <p class="mt-1 text-[11px]" style="color: var(--srf-ink-3)">
              Boleh diisi awalan 08 atau 62. Sistem otomatis menormalisasi ke format internasional 62.
            </p>
          </div>

          <div class="ed-well space-y-2.5 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="ed-label">Pratinjau Integrasi Publik</span>
              <span
                class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                :style="
                  isPhoneValidPreview
                    ? {
                        backgroundColor: 'var(--srf-good-soft)',
                        borderColor: 'var(--srf-good-border)',
                        color: 'var(--srf-good-ink)',
                      }
                    : {
                        backgroundColor: 'var(--srf-warn-soft)',
                        borderColor: 'var(--srf-warn-border)',
                        color: 'var(--srf-warn-ink)',
                      }
                "
              >
                {{ isPhoneValidPreview ? 'Format Valid' : 'Periksa Nomor' }}
              </span>
            </div>

            <div class="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
              <div class="rounded-lg border px-3 py-2" style="background-color: var(--srf-surface); border-color: var(--srf-line)">
                <div style="color: var(--srf-ink-3)">Tampilan di Footer &amp; Kontak</div>
                <div class="tabular mt-0.5 font-semibold" style="color: var(--srf-ink)">
                  {{ displayPhonePreview }}
                </div>
              </div>
              <div class="rounded-lg border px-3 py-2" style="background-color: var(--srf-surface); border-color: var(--srf-line)">
                <div style="color: var(--srf-ink-3)">Link Layanan Pemesanan</div>
                <div class="tabular mt-0.5 truncate font-semibold" style="color: var(--srf-ink)">
                  {{ normalizedPreview ? `https://wa.me/${normalizedPreview}` : '-' }}
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span class="text-[11px]" style="color: var(--srf-ink-3)">
                Berlaku langsung di halaman beranda, katalog alat, dan booking trip.
              </span>
              <a
                v-if="isPhoneValidPreview"
                :href="previewWaUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="ed-btn-secondary !min-h-[38px] !px-3 !py-1.5 !text-xs"
              >
                Uji Link WhatsApp
              </a>
            </div>
          </div>

          <div
            v-if="profileErr"
            class="rounded-xl border px-3.5 py-2.5 text-xs font-medium"
            style="
              background-color: var(--srf-bad-soft);
              border-color: var(--srf-bad-border);
              color: var(--srf-bad-ink);
            "
            role="alert"
          >
            {{ profileErr }}
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="submit"
              class="ed-btn-primary w-full sm:w-auto !min-h-[44px] sm:!min-h-[40px]"
              :disabled="savingProfile"
            >
              {{ savingProfile ? 'Menyimpan...' : 'Simpan Profil & Kontak' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Card 2: Ganti Password -->
      <section class="ed-card p-5 sm:p-6 lg:col-span-5">
        <div class="border-b pb-4" style="border-color: var(--srf-line)">
          <h2 class="text-base font-bold" style="color: var(--srf-ink)">
            Ganti Kata Sandi Akun
          </h2>
          <p class="mt-1 text-xs leading-relaxed" style="color: var(--srf-ink-3)">
            Gunakan minimal 12 karakter (kombinasi huruf dan angka). Mengganti sandi otomatis mencabut sesi perangkat lain.
          </p>
        </div>

        <form class="mt-5 space-y-4" @submit.prevent="submitPassword">
          <div>
            <label for="pw-current" class="ed-label mb-1.5">Kata Sandi Saat Ini</label>
            <div class="relative">
              <input
                id="pw-current"
                v-model="passwordForm.currentPassword"
                :type="showCurrentPw ? 'text' : 'password'"
                autocomplete="current-password"
                required
                placeholder="Masukkan kata sandi lama"
                class="ed-input !min-h-[44px] !pr-20 sm:!min-h-[40px]"
              />
              <button
                type="button"
                class="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold"
                style="color: var(--srf-ink-2)"
                :aria-label="showCurrentPw ? 'Sembunyikan kata sandi saat ini' : 'Tampilkan kata sandi saat ini'"
                @click="showCurrentPw = !showCurrentPw"
              >
                {{ showCurrentPw ? 'Tutup' : 'Lihat' }}
              </button>
            </div>
          </div>

          <div>
            <label for="pw-new" class="ed-label mb-1.5">Kata Sandi Baru</label>
            <div class="relative">
              <input
                id="pw-new"
                v-model="passwordForm.newPassword"
                :type="showNewPw ? 'text' : 'password'"
                autocomplete="new-password"
                required
                minlength="12"
                placeholder="Minimal 12 karakter (huruf & angka)"
                class="ed-input !min-h-[44px] !pr-20 sm:!min-h-[40px]"
              />
              <button
                type="button"
                class="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold"
                style="color: var(--srf-ink-2)"
                :aria-label="showNewPw ? 'Sembunyikan kata sandi baru' : 'Tampilkan kata sandi baru'"
                @click="showNewPw = !showNewPw"
              >
                {{ showNewPw ? 'Tutup' : 'Lihat' }}
              </button>
            </div>
          </div>

          <div>
            <label for="pw-confirm" class="ed-label mb-1.5">Konfirmasi Kata Sandi Baru</label>
            <div class="relative">
              <input
                id="pw-confirm"
                v-model="passwordForm.confirmPassword"
                :type="showConfirmPw ? 'text' : 'password'"
                autocomplete="new-password"
                required
                minlength="12"
                placeholder="Ulangi kata sandi baru"
                class="ed-input !min-h-[44px] !pr-20 sm:!min-h-[40px]"
              />
              <button
                type="button"
                class="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold"
                style="color: var(--srf-ink-2)"
                :aria-label="showConfirmPw ? 'Sembunyikan konfirmasi kata sandi' : 'Tampilkan konfirmasi kata sandi'"
                @click="showConfirmPw = !showConfirmPw"
              >
                {{ showConfirmPw ? 'Tutup' : 'Lihat' }}
              </button>
            </div>
          </div>

          <div
            v-if="passwordErr"
            class="rounded-xl border px-3.5 py-2.5 text-xs font-medium"
            style="
              background-color: var(--srf-bad-soft);
              border-color: var(--srf-bad-border);
              color: var(--srf-bad-ink);
            "
            role="alert"
          >
            {{ passwordErr }}
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="submit"
              class="ed-btn-primary w-full sm:w-auto !min-h-[44px] sm:!min-h-[40px]"
              :disabled="savingPassword"
            >
              {{ savingPassword ? 'Memperbarui...' : 'Perbarui Kata Sandi' }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="toastMsg"
      role="status"
      aria-live="polite"
      class="fixed right-4 bottom-4 z-50 rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg"
      style="
        background-color: var(--srf-surface);
        border-color: var(--srf-good-border);
        color: var(--srf-good-ink);
      "
    >
      {{ toastMsg }}
    </div>
  </div>
</template>

