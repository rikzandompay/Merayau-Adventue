<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined
    folder: 'alat' | 'paket' | 'trip'
    label?: string
    fallbackKind?: string
  }>(),
  {
    label: 'FOTO (JPG / PNG / WEBP · MAKS 2MB)',
    fallbackKind: 'tent',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const lastInfo = ref('')

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  uploadError.value = ''
  if (!file) return

  if (!ALLOWED_MIME.has(file.type)) {
    uploadError.value = 'Format file harus JPG, PNG, atau WEBP.'
    input.value = ''
    return
  }
  if (file.size > MAX_BYTES) {
    uploadError.value = 'Ukuran gambar melebihi batas maksimal 2 MB.'
    input.value = ''
    return
  }

  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('folder', props.folder)
    fd.append('file', file)
    const res = await $fetch<{ url: string; filename: string; sizeBytes: number }>(
      '/api/admin/upload',
      { method: 'POST', body: fd },
    )
    emit('update:modelValue', res.url)
    lastInfo.value = `${res.filename} · ${Math.max(1, Math.round(res.sizeBytes / 1024))} KB`
  } catch (err: unknown) {
    uploadError.value = extractErrorMessage(err, 'Gagal mengunggah gambar.')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function removeImage() {
  uploadError.value = ''
  lastInfo.value = ''
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="space-y-1.5">
    <span class="ed-label">{{ label }}</span>
    <div class="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-2.5"
      style="background-color: var(--srf-raised); border-color: var(--srf-line-strong)">
      <div class="flex h-[56px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded border"
        style="background-color: var(--srf-well); border-color: var(--srf-line)">
        <img v-if="modelValue" :src="modelValue" alt="Preview foto" class="h-full w-full object-cover" />
        <GearArtThumb v-else :kind="fallbackKind" />
      </div>

      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="truncate text-xs font-medium" style="color: var(--srf-ink)">
          {{
            uploading
              ? 'Mengunggah gambar...'
              : lastInfo || (modelValue ? modelValue.split('/').pop() : 'Belum ada foto diunggah')
          }}
        </div>
        <div class="flex items-center gap-2.5">
          <button type="button" class="ed-btn-secondary !px-3 !py-1.5 !text-xs" :disabled="uploading"
            @click="inputEl?.click()">
            {{ uploading ? 'Mengunggah...' : 'Upload / Ganti Foto' }}
          </button>
          <button v-if="modelValue" type="button" class="cursor-pointer text-xs font-medium hover:underline"
            style="color: var(--srf-bad)" @click="removeImage">
            Hapus
          </button>
        </div>
      </div>

      <input ref="inputEl" type="file" accept="image/jpeg,image/png,image/webp" class="hidden"
        @change="handleFileChange" />
    </div>
    <p v-if="uploadError" class="text-xs font-medium" style="color: var(--srf-bad)">
      {{ uploadError }}
    </p>
  </div>
</template>
