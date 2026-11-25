<script setup lang="ts">
const { login } = useAdminAuth()
const email = ref('admin@merayau.id')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleSubmit() {
  errorMsg.value = ''
  if (!email.value.trim() || !password.value) {
    errorMsg.value = 'Email dan kata sandi wajib diisi.'
    return
  }

  loading.value = true
  try {
    await login(email.value.trim(), password.value)
    await navigateTo('/admin')
  } catch (err: unknown) {
    errorMsg.value = extractErrorMessage(err, 'Gagal masuk. Periksa kembali email dan kata sandi.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center px-4 py-12"
    style="background-color: var(--srf-bg)"
  >
    <div
      class="ed-card w-full max-w-[430px] space-y-6 p-7 sm:p-8"
      style="box-shadow: var(--srf-shadow-md)"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <div
            class="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border bg-white p-0.5 shadow-sm"
            style="border-color: var(--srf-accent-border)"
          >
            <img src="/images/logo.jpeg" alt="Merayau Outdoor" class="h-full w-full object-contain" />
          </div>
          <div>
            <p class="ed-label" style="color: var(--srf-accent)">PORTAL OPERASIONAL BASECAMP</p>
            <h1 class="text-xl font-bold tracking-tight" style="color: var(--srf-ink)">
              Merayau Outdoor
            </h1>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <p class="text-sm leading-relaxed" style="color: var(--srf-ink-2)">
        Masuk dengan akun admin basecamp untuk mengelola inventori alat, paket sewa, transaksi keluar-masuk, serta jadwal open trip.
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-1.5">
          <label class="ed-label" for="login-email">EMAIL ADMIN</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            class="ed-input"
            placeholder="admin@merayau.id"
            autocomplete="email"
            required
          />
        </div>

        <div class="space-y-1.5">
          <label class="ed-label" for="login-pass">KATA SANDI</label>
          <input
            id="login-pass"
            v-model="password"
            type="password"
            class="ed-input"
            placeholder="Masukkan kata sandi admin"
            autocomplete="current-password"
            required
          />
        </div>

        <div
          v-if="errorMsg"
          class="rounded-xl border px-3.5 py-2.5 text-xs font-medium"
          style="
            background-color: var(--srf-bad-soft);
            border-color: var(--srf-bad-border);
            color: var(--srf-bad-ink);
          "
        >
          {{ errorMsg }}
        </div>

        <button type="submit" class="ed-btn-primary w-full !py-2.5" :disabled="loading">
          {{ loading ? 'Memverifikasi sesi...' : 'Masuk ke Portal Admin' }}
        </button>
      </form>
    </div>
  </div>
</template>
