<script setup>
import { ref, computed } from 'vue'
import { UserPlus, Pencil, Trash2, Check, X, KeyRound, ShieldCheck, Eye, EyeOff, AtSign, Info, Crown } from '@lucide/vue'
import { usePos, makeUsername } from '@/stores/pos'
import { useMoney, toast, confirm } from '@/composables'
import { ROLES, ROLE_ORDER, PERMISSIONS, SWATCHES } from '@/utils/constants'
import { initials, startOfDay, addDays, timeAgo } from '@/utils/format'
import { inRange, summarize } from '@/utils/analytics'
import BaseModal from '@/components/BaseModal.vue'

const pos = usePos()
const money = useMoney()

const since = addDays(startOfDay(), -29)
const recent = computed(() => inRange(pos.orders, since, Date.now() + 1))
const statsFor = (id) => summarize(recent.value.filter((o) => o.staffId === id))
const lastSale = (id) => pos.orders.find((o) => o.staffId === id)?.createdAt

const showForm = ref(false)
const showPin = ref(false)
const draft = ref({})
const userTouched = ref(false)
function openForm(s) {
  draft.value = s ? { ...s } : { name: '', username: '', role: 'cashier', pin: '', color: SWATCHES[pos.staff.length % SWATCHES.length], active: true, owner: false }
  userTouched.value = !!s
  showPin.value = !s
  showForm.value = true
}
// suggest a username from the name until the manager types their own
function onName() {
  if (!userTouched.value) draft.value.username = makeUsername(draft.value.name, pos.staff.filter((x) => x.id !== draft.value.id).map((x) => x.username))
}
function onUsername() {
  userTouched.value = true
  draft.value.username = draft.value.username.toLowerCase().replace(/[^a-z0-9._-]/g, '')
}
const orderedStaff = computed(() =>
  [...pos.staff].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name)),
)
function randomPin() {
  let p
  do p = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  while (pos.staff.some((s) => s.pin === p))
  draft.value.pin = p
  showPin.value = true
}
function save() {
  if (!draft.value.name?.trim()) return toast('Name is required', 'warning')
  const r = pos.saveStaff({ ...draft.value, name: draft.value.name.trim() })
  if (!r.ok) return toast(r.message, 'warning')
  toast(draft.value.id ? 'Team member updated' : `${r.item.name} can now sign in as “${r.item.username}” with their PIN`, 'success', 4500)
  showForm.value = false
}
async function remove(s) {
  if (!(await confirm({ title: `Remove ${s.name}?`, message: 'Their past sales stay in reports.', confirmText: 'Remove', danger: true }))) return
  const r = pos.deleteStaff(s.id)
  toast(r.ok ? 'Team member removed' : r.message, r.ok ? 'info' : 'warning')
}
function toggleActive(s) {
  if (s.id === pos.currentUser?.id) return toast("You can't disable your own account", 'warning')
  const r = pos.saveStaff({ ...s, active: !s.active })
  if (!r.ok) toast(r.message, 'warning')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Team</h1>
        <p>Add your workers, give each a role, and they only see the work that role needs.</p>
      </div>
      <button class="btn btn-primary" @click="openForm()"><UserPlus :size="16" /> Add member</button>
    </div>

    <div class="howto card rise">
      <Info :size="17" />
      <span>Staff sign in on this business’s devices with their <b>username</b> and <b>4-digit PIN</b>, on the same login screen the owner uses.</span>
    </div>

    <TransitionGroup tag="div" name="list" class="sgrid mt">
      <div v-for="(s, i) in orderedStaff" :key="s.id" class="scard card rise" :class="{ off: !s.active }" :style="{ '--i': i, '--a': s.color }">
        <div class="s-banner"></div>
        <div class="avatar" :style="{ '--a': s.color, '--s': '64px' }">{{ initials(s.name) }}</div>
        <strong class="s-name">{{ s.name }} <span v-if="s.id === pos.currentUser?.id" class="badge b-primary">You</span></strong>
        <span class="uname mono"><AtSign :size="12" />{{ s.username }}</span>
        <span class="badge" :style="{ color: ROLES[s.role].color, background: ROLES[s.role].color + '1f' }"><Crown v-if="s.owner" :size="12" /><ShieldCheck v-else :size="12" /> {{ s.owner ? 'Owner · ' : '' }}{{ ROLES[s.role].label }}</span>
        <span class="duty muted tiny">{{ ROLES[s.role].duty }}</span>
        <div class="s-stats">
          <div><span>30-day sales</span><b class="num">{{ money(statsFor(s.id).revenue) }}</b></div>
          <div><span>Orders</span><b class="num">{{ statsFor(s.id).count }}</b></div>
        </div>
        <span class="muted tiny">{{ lastSale(s.id) ? 'Last sale ' + timeAgo(lastSale(s.id)) : 'No sales yet' }}</span>
        <div class="s-actions">
          <label class="switch" :title="s.active ? 'Can sign in' : 'Disabled'"><input :checked="s.active" type="checkbox" @change="toggleActive(s)" /><span class="track"></span><span class="small">{{ s.active ? 'Active' : 'Disabled' }}</span></label>
          <span class="grow"></span>
          <button class="icon-btn sm" title="Edit" @click="openForm(s)"><Pencil :size="14" /></button>
          <button class="icon-btn sm danger" title="Remove" :disabled="s.id === pos.currentUser?.id" @click="remove(s)"><Trash2 :size="14" /></button>
        </div>
      </div>
    </TransitionGroup>

    <section class="card mt rise" style="--i: 4">
      <div class="card-head card-pad" style="margin-bottom: 0; padding-bottom: 6px">
        <div><div class="card-title">Role permissions</div><div class="card-sub">What each role can access</div></div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Permission</th><th v-for="k in ROLE_ORDER" :key="k" class="center">{{ ROLES[k].label }}</th></tr></thead>
          <tbody>
            <tr v-for="p in PERMISSIONS" :key="p.id">
              <td>{{ p.label }}</td>
              <td v-for="k in ROLE_ORDER" :key="k" class="center">
                <span class="perm" :class="{ yes: ROLES[k].perms.includes(p.id) }"><Check v-if="ROLES[k].perms.includes(p.id)" :size="14" /><X v-else :size="14" /></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <BaseModal v-model:open="showForm" size="md" :title="draft.id ? 'Edit team member' : 'Add team member'">
      <div class="stack">
        <div class="row">
          <div class="avatar" :style="{ '--a': draft.color, '--s': '56px' }">{{ initials(draft.name || '?') }}</div>
          <label class="field grow"><span class="label">Full name *</span><input v-model="draft.name" class="input" placeholder="e.g. Riley Park" @input="onName" /></label>
        </div>
        <label class="field">
          <span class="label">Username * <span class="muted">(used to sign in)</span></span>
          <div class="input-icon"><AtSign :size="16" /><input v-model="draft.username" class="input mono" maxlength="24" autocapitalize="none" spellcheck="false" placeholder="e.g. riley" @input="onUsername" /></div>
        </label>
        <div class="field">
          <span class="label">Role</span>
          <div class="roles">
            <button v-for="k in ROLE_ORDER" :key="k" type="button" class="role" :class="{ on: draft.role === k }" :style="{ '--rc': ROLES[k].color }" @click="draft.role = k">
              <strong>{{ ROLES[k].label }}</strong>
              <span class="muted tiny">{{ ROLES[k].duty }}</span>
            </button>
          </div>
        </div>
        <label class="field">
          <span class="label">4-digit PIN</span>
          <div class="row">
            <div class="input-icon grow">
              <KeyRound :size="16" />
              <input v-model="draft.pin" class="input mono" :type="showPin ? 'text' : 'password'" inputmode="numeric" maxlength="4" placeholder="••••" />
            </div>
            <button class="icon-btn" type="button" :title="showPin ? 'Hide' : 'Show'" @click="showPin = !showPin"><EyeOff v-if="showPin" :size="16" /><Eye v-else :size="16" /></button>
            <button class="btn" type="button" @click="randomPin">Generate</button>
          </div>
        </label>
        <div class="field">
          <span class="label">Colour</span>
          <div class="swatches">
            <button v-for="c in SWATCHES" :key="c" :style="{ background: c }" :class="{ on: draft.color === c }" :aria-label="c" @click="draft.color = c"></button>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn" @click="showForm = false">Cancel</button>
        <button class="btn btn-primary" @click="save">{{ draft.id ? 'Save changes' : 'Add member' }}</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.sgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.scard { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 28px 18px 16px; transition: transform .4s var(--ease), box-shadow .4s, opacity .3s; }
.scard:hover { transform: translateY(-4px); box-shadow: 0 26px 44px -26px color-mix(in srgb, var(--a) 70%, transparent); }
.scard.off { opacity: .55; }
.s-banner { position: absolute; inset: 0 0 auto; height: 70px; background: linear-gradient(135deg, color-mix(in srgb, var(--a) 45%, transparent), transparent); }
.scard .avatar { position: relative; box-shadow: 0 0 0 4px var(--bg-2), 0 12px 24px -10px var(--a); }
.s-name { font-size: 16px; display: flex; align-items: center; gap: 6px; }
.s-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; margin-top: 6px; }
.s-stats div { display: flex; flex-direction: column; padding: 10px; border-radius: 12px; background: var(--surface-2); }
.s-stats span { font-size: 11px; color: var(--muted); font-weight: 650; }
.s-actions { display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--border); }
.perm { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 9px; color: var(--muted); background: var(--surface-2); }
.perm.yes { color: #fff; background: var(--grad); }
.howto { display: flex; align-items: center; gap: 10px; padding: 12px 16px; font-size: 13.5px; color: var(--text-2); }
.howto svg { flex-shrink: 0; color: var(--accent-ink); }
.uname { display: inline-flex; align-items: center; gap: 2px; font-size: 12.5px; color: var(--text-2); }
.duty { max-width: 220px; line-height: 1.4; min-height: 2.8em; }
.roles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.role { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 12px; border-radius: 14px; line-height: 1.35; border: 1.5px solid var(--border); background: var(--surface-2); cursor: pointer; text-align: left; transition: all .25s var(--ease); }
.role:hover { border-color: var(--border-2); }
.role.on { border-color: var(--rc); background: color-mix(in srgb, var(--rc) 14%, transparent); box-shadow: 0 10px 20px -14px var(--rc); }
.role.on strong { color: var(--rc); }
.swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.swatches button { width: 30px; height: 30px; border-radius: 10px; border: 2px solid transparent; cursor: pointer; transition: transform .25s var(--spring); }
.swatches button:hover, .swatches button.on { transform: scale(1.12); }
.swatches button.on { border-color: var(--text); }
@media (max-width: 640px) { .roles { grid-template-columns: 1fr 1fr; } }
</style>
