<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { Search, UserPlus, Star, ArrowLeft } from '@lucide/vue'
import BaseModal from './BaseModal.vue'
import { usePos } from '@/stores/pos'
import { toast } from '@/composables'
import { initials } from '@/utils/format'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['update:open', 'select'])
const pos = usePos()
const q = ref('')
const adding = ref(false)
const draft = ref({ name: '', phone: '', email: '' })
const searchEl = ref(null)

const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  return pos.customers
    .filter((c) => !s || c.name.toLowerCase().includes(s) || (c.phone || '').replace(/\s/g, '').includes(s.replace(/\s/g, '')) || (c.email || '').toLowerCase().includes(s))
    .sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0))
    .slice(0, 40)
})

watch(
  () => props.open,
  async (v) => {
    if (!v) return
    q.value = ''
    adding.value = false
    await nextTick()
    searchEl.value?.focus()
  },
)

function choose(c) {
  emit('select', c.id)
  emit('update:open', false)
}
function startAdd() {
  const s = q.value.trim()
  draft.value = /^[+\d\s-]+$/.test(s) && s ? { name: '', phone: s, email: '' } : { name: s, phone: '', email: '' }
  adding.value = true
}
function save() {
  if (!draft.value.name.trim()) return toast('Enter the customer’s name', 'warning')
  const c = pos.saveCustomer({ ...draft.value, name: draft.value.name.trim() })
  toast(`${c.name} added`)
  choose(c)
}
</script>

<template>
  <BaseModal :open="open" size="md" :title="adding ? 'New customer' : 'Attach a customer'" :subtitle="adding ? 'They start earning points with this sale' : 'Search by name, phone or email'" @update:open="(v) => emit('update:open', v)">
    <Transition name="slide" mode="out-in">
      <div v-if="!adding" key="list" class="stack">
        <div class="row">
          <div class="input-icon grow">
            <Search :size="17" />
            <input ref="searchEl" v-model="q" class="input" placeholder="Search customers…" @keydown.enter="list[0] && choose(list[0])" />
          </div>
          <button class="btn btn-soft" @click="startAdd"><UserPlus :size="16" /> New</button>
        </div>
        <TransitionGroup name="list" tag="div" class="clist">
          <button v-for="c in list" :key="c.id" class="crow" @click="choose(c)">
            <div class="avatar" :style="{ '--s': '38px' }">{{ initials(c.name) }}</div>
            <div class="grow">
              <strong>{{ c.name }}</strong>
              <span class="muted small">{{ c.phone || c.email || 'No contact' }}</span>
            </div>
            <span class="badge b-primary"><Star :size="11" /> {{ c.points }} pts</span>
          </button>
        </TransitionGroup>
        <div v-if="!list.length" class="empty">
          <strong>No match for “{{ q }}”</strong>
          <button class="btn btn-primary btn-sm mt" @click="startAdd"><UserPlus :size="15" /> Create customer</button>
        </div>
      </div>
      <div v-else key="add" class="stack">
        <label class="field"><span class="label">Full name *</span><input v-model="draft.name" class="input" placeholder="e.g. Jamie Doe" autofocus /></label>
        <div class="form-grid">
          <label class="field"><span class="label">Phone</span><input v-model="draft.phone" class="input" placeholder="+1 555 …" /></label>
          <label class="field"><span class="label">Email</span><input v-model="draft.email" class="input" type="email" placeholder="name@email.com" /></label>
        </div>
        <div class="row between">
          <button class="btn btn-ghost" @click="adding = false"><ArrowLeft :size="16" /> Back</button>
          <button class="btn btn-primary" @click="save"><UserPlus :size="16" /> Save & attach</button>
        </div>
      </div>
    </Transition>
  </BaseModal>
</template>

<style scoped>
.clist { display: flex; flex-direction: column; gap: 4px; max-height: 50vh; overflow-y: auto; margin: 0 -6px; padding: 0 6px; }
.crow {
  display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 14px; border: 1px solid transparent;
  background: transparent; cursor: pointer; text-align: left; transition: all .25s var(--ease);
}
.crow:hover { background: var(--surface-2); border-color: var(--border); transform: translateX(3px); }
.crow .grow { display: flex; flex-direction: column; line-height: 1.3; }
</style>
