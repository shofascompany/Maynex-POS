<script setup>
import { ref, computed, watch } from 'vue'
import { Search, Plus, Pencil, Trash2, RefreshCw } from '@lucide/vue'
import { useAdmin } from '@/stores/admin'
import { toast, confirm } from '@/composables'
import { formatDateTime } from '@/utils/format'
import BaseModal from '@/components/BaseModal.vue'

/**
 * Lists, searches, adds, edits and deletes the rows of one shop table for the platform admin.
 * fields: [{ key, label, type: text|number|bool|select|textarea|datetime|json, options, readonly, list, required, format }]
 */
const props = defineProps({
  title: { type: String, required: true },
  table: { type: String, required: true },
  bid: { type: String, required: true },
  fields: { type: Array, required: true },
  orderBy: { type: String, default: 'created_at' },
  canAdd: { type: Boolean, default: true },
  idPrefix: { type: String, default: 'x_' },
  defaults: { type: Object, default: () => ({}) },
  emptyText: { type: String, default: 'Nothing here yet.' },
})
const emit = defineEmits(['changed'])
const admin = useAdmin()

const list = ref([])
const loading = ref(false)
const q = ref('')
const limit = ref(50)

async function load() {
  loading.value = true
  try {
    list.value = await admin.rows(props.table, props.bid, props.orderBy)
  } catch (e) {
    toast(e.message, 'error', 5000)
  } finally {
    loading.value = false
  }
}
watch(() => [props.table, props.bid], load, { immediate: true })

const columns = computed(() => props.fields.filter((f) => f.list))
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return list.value
  return list.value.filter((r) => props.fields.some((f) => String(r[f.key] ?? '').toLowerCase().includes(s)))
})
const shown = computed(() => filtered.value.slice(0, limit.value))
watch(q, () => (limit.value = 50))

function cell(f, r) {
  const v = r[f.key]
  if (f.format) return f.format(v, r)
  if (v === null || v === undefined || v === '') return '—'
  if (f.type === 'bool') return v ? 'Yes' : 'No'
  if (f.type === 'datetime') return formatDateTime(v)
  if (f.type === 'select') return f.options?.find((o) => o.value === v)?.label ?? v
  if (f.type === 'json') return Array.isArray(v) ? `${v.length} item${v.length === 1 ? '' : 's'}` : '{…}'
  return v
}

// editor
const show = ref(false)
const draft = ref({})
const isNew = ref(false)
const saving = ref(false)
function open(r) {
  isNew.value = !r
  draft.value = r ? JSON.parse(JSON.stringify(r)) : { ...props.defaults }
  show.value = true
}
async function save() {
  for (const f of props.fields) {
    if (f.required && !f.readonly && (draft.value[f.key] === '' || draft.value[f.key] == null)) return toast(`${f.label} is required`, 'warning')
  }
  const row = { ...draft.value, business_id: props.bid }
  if (isNew.value) row.id = props.idPrefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
  for (const f of props.fields) {
    if (f.type === 'number' && row[f.key] !== '' && row[f.key] != null) row[f.key] = Number(row[f.key])
    if (f.type === 'number' && row[f.key] === '') row[f.key] = null
  }
  delete row.updated_at
  saving.value = true
  try {
    const saved = await admin.saveRow(props.table, row)
    const i = list.value.findIndex((x) => x.id === saved.id)
    if (i > -1) list.value[i] = saved
    else list.value.unshift(saved)
    toast(isNew.value ? 'Added' : 'Saved')
    show.value = false
    emit('changed')
  } catch (e) {
    toast(e.message, 'error', 6000)
  } finally {
    saving.value = false
  }
}
async function remove(r) {
  const label = r.name || (r.number ? `#${r.number}` : r.id)
  if (!(await confirm({ title: `Delete ${label}?`, message: 'It is removed for this business on every device. This cannot be undone.', confirmText: 'Delete', danger: true }))) return
  try {
    await admin.deleteRow(props.table, r.id, props.bid)
    list.value = list.value.filter((x) => x.id !== r.id)
    show.value = false
    toast('Deleted', 'info')
    emit('changed')
  } catch (e) {
    toast(e.message, 'error', 6000)
  }
}
defineExpose({ load })
</script>

<template>
  <section class="rt card">
    <header class="rt-head">
      <div>
        <div class="card-title">{{ title }}</div>
        <div class="card-sub">{{ list.length }} total</div>
      </div>
      <div class="row wrap">
        <div class="input-icon"><Search :size="15" /><input v-model="q" class="input" placeholder="Search…" /></div>
        <button class="icon-btn" title="Reload" :disabled="loading" @click="load"><RefreshCw :size="15" :class="{ spinning: loading }" /></button>
        <button v-if="canAdd" class="btn btn-primary btn-sm" @click="open()"><Plus :size="15" /> Add</button>
      </div>
    </header>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th v-for="f in columns" :key="f.key">{{ f.label }}</th><th class="right">Actions</th></tr></thead>
        <tbody>
          <tr v-for="r in shown" :key="r.id" class="clickable" @click="open(r)">
            <td v-for="f in columns" :key="f.key" :class="{ num: f.type === 'number' }">{{ cell(f, r) }}</td>
            <td class="right" @click.stop>
              <div class="row end" style="gap: 6px">
                <button class="icon-btn sm" title="Edit" @click="open(r)"><Pencil :size="14" /></button>
                <button class="icon-btn sm danger" title="Delete" @click="remove(r)"><Trash2 :size="14" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !filtered.length" class="empty small">{{ q ? 'No matches.' : emptyText }}</div>
      <div v-if="loading && !list.length" class="empty small">Loading…</div>
    </div>
    <div v-if="filtered.length > limit" class="more"><button class="btn btn-soft btn-sm" @click="limit += 50">Show more · {{ filtered.length - limit }} remaining</button></div>

    <BaseModal v-model:open="show" size="md" :title="isNew ? `Add to ${title}` : `Edit ${title.replace(/s$/, '').toLowerCase()}`" :subtitle="isNew ? '' : draft.id">
      <div class="form-grid">
        <template v-for="f in fields" :key="f.key">
          <label v-if="f.type === 'bool'" class="switch span-2"><input v-model="draft[f.key]" type="checkbox" :disabled="f.readonly" /><span class="track"></span> {{ f.label }}</label>
          <label v-else class="field" :class="{ 'span-2': ['textarea', 'json'].includes(f.type) }">
            <span class="label">{{ f.label }}{{ f.required ? ' *' : '' }}</span>
            <select v-if="f.type === 'select'" v-model="draft[f.key]" class="select" :disabled="f.readonly">
              <option v-for="o in f.options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
            </select>
            <textarea v-else-if="f.type === 'textarea'" v-model="draft[f.key]" class="textarea" :readonly="f.readonly"></textarea>
            <pre v-else-if="f.type === 'json'" class="json">{{ JSON.stringify(draft[f.key], null, 2) }}</pre>
            <input v-else-if="f.type === 'datetime'" class="input" :value="draft[f.key] ? formatDateTime(draft[f.key]) : '—'" readonly />
            <input v-else v-model="draft[f.key]" class="input" :type="f.type === 'number' ? 'number' : 'text'" :step="f.step || 'any'" :readonly="f.readonly" :maxlength="f.maxlength" />
          </label>
        </template>
      </div>
      <template #footer>
        <button v-if="!isNew" class="btn btn-danger" @click="remove(draft)"><Trash2 :size="15" /> Delete</button>
        <span class="grow"></span>
        <button class="btn" @click="show = false">Cancel</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : isNew ? 'Add' : 'Save changes' }}</button>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.rt-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.rt-head .input { height: 36px; width: 220px; }
.table-wrap { max-height: 560px; }
.more { display: flex; justify-content: center; padding: 12px; border-top: 1px solid var(--border); }
.json { margin: 0; max-height: 260px; overflow: auto; padding: 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border); font: 500 12px/1.5 var(--mono); white-space: pre-wrap; }
.spinning { animation: spin 1s linear infinite; }
</style>
