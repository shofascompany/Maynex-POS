<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { UserRound, KeyRound, Check } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { toast } from '@/composables'
import AuthShell from '@/components/AuthShell.vue'

// Shown when a signed-in business has no active manager (e.g. the last one was removed).
const pos = usePos()
const router = useRouter()
const form = ref({ name: '', pin: '', pin2: '' })
const ok = computed(() => form.value.name.trim() && /^\d{4}$/.test(form.value.pin) && form.value.pin === form.value.pin2)
const digits = (k) => (form.value[k] = form.value[k].replace(/\D/g, '').slice(0, 4))

function save() {
  if (!ok.value) return toast('Enter your name and the same 4-digit PIN twice', 'warning')
  const r = pos.createManager({ name: form.value.name, pin: form.value.pin })
  if (!r.ok) return toast(r.message, 'warning')
  toast(`Your username is “${r.user.username}”. Use it with your PIN to sign in.`, 'success', 5000)
  router.replace('/')
}
</script>

<template>
  <AuthShell :title="`Add a manager for ${pos.business?.name || 'your business'}`" subtitle="Every business needs at least one manager to run the team and settings.">
    <form class="stack" @submit.prevent="save">
      <label class="field"><span class="label">Your full name *</span>
        <div class="input-icon"><UserRound :size="16" /><input v-model="form.name" class="input input-lg" maxlength="60" autocomplete="name" autofocus /></div>
      </label>
      <div class="two">
        <label class="field"><span class="label">4-digit PIN *</span>
          <div class="input-icon"><KeyRound :size="16" /><input v-model="form.pin" class="input mono" type="password" inputmode="numeric" maxlength="4" @input="digits('pin')" /></div>
        </label>
        <label class="field"><span class="label">Repeat PIN *</span>
          <div class="input-icon"><KeyRound :size="16" /><input v-model="form.pin2" class="input mono" type="password" inputmode="numeric" maxlength="4" @input="digits('pin2')" /></div>
          <span v-if="form.pin2.length === 4 && form.pin !== form.pin2" class="hint c-danger">PINs don’t match</span>
        </label>
      </div>
      <button class="btn btn-primary btn-lg btn-block" type="submit" :disabled="!ok"><Check :size="17" /> Create manager</button>
    </form>
  </AuthShell>
</template>

<style scoped>
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .two { grid-template-columns: 1fr; } }
</style>
