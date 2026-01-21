<template>
  <div class="space-y-6">
    <UPageHero
      title="OTUI Studio"
      description="Editor Nuxt/Pinia para analisar e validar arquivos OTUI (OTCv8)."
    />

    <UContainer>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="text-lg font-semibold">Editor</div>
            <div class="flex items-center gap-2">
              <UButton color="neutral" variant="subtle" icon="i-lucide-upload" @click="onImport">Importar</UButton>
              <input ref="fileInput" type="file" accept=".otui" class="hidden" @change="onFileChange" />
              <UButton :loading="parsing" icon="i-lucide-play" @click="onParse">Parse</UButton>
              <UButton color="neutral" variant="subtle" icon="i-lucide-download" :disabled="!result?.widgets?.length" @click="onExport">Exportar</UButton>
            </div>
          </div>
        </template>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="space-y-3">
            <UFormGroup label="Código OTUI">
              <UTextarea v-model="code" :rows="16" autoresize placeholder="Cole seu .otui aqui..." />
            </UFormGroup>

            <UAlert v-if="error" color="error" icon="i-lucide-triangle-alert" :title="error" />
            <UAlert
              v-else-if="diagnostics.length"
              color="warning"
              icon="i-lucide-info"
              title="Diagnóstico"
            >
              <ul class="list-disc pl-5 mt-2">
                <li v-for="(d, idx) in diagnostics" :key="idx">
                  [{{ d.level }}] L{{ d.line }}: {{ d.message }}
                </li>
              </ul>
            </UAlert>
          </div>

          <div class="space-y-3">
            <UCard>
              <template #header>
                <div class="font-medium">Hierarquia</div>
              </template>
              <WidgetTree v-if="result?.widgets?.length" :nodes="result.widgets" />
              <div v-else class="text-sm text-muted">Sem widgets (faça o parse do código).</div>
            </UCard>

            <UCard>
              <template #header>
                <div class="font-medium">Propriedades</div>
              </template>
              <PropertiesPanel />
            </UCard>

            <UCard>
              <template #header>
                <div class="font-medium">Âncoras</div>
              </template>
              <AnchorPanel />
            </UCard>
          </div>
        </div>
      </UCard>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~~/stores/editor'

const editor = useEditorStore()
const { code, parsing, result, error } = storeToRefs(editor)

const diagnostics = computed(() => result.value?.diagnostics ?? [])

function onParse() {
  editor.parse()
}

const fileInput = ref<HTMLInputElement | null>(null)
function onImport() {
  fileInput.value?.click()
}
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    editor.code = String(reader.result || '')
  }
  reader.readAsText(file)
  input.value = ''
}

async function onExport() {
  if (!result.value?.widgets?.length) return
  const res = await $fetch<{ code: string }>('/api/otui/export', {
    method: 'POST',
    body: { widgets: result.value.widgets }
  })
  await navigator.clipboard.writeText(res.code)
  useToast().add({ title: 'Código OTUI copiado para a área de transferência.' })
}
</script>
