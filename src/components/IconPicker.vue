<script setup>
import { ITEM_ICON_NAMES } from './ItemIcon.vue'
import ItemIcon from './ItemIcon.vue'

defineProps({ modelValue: { type: String, default: '' }, label: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="icon-grid" role="listbox" aria-label="Icon">
    <button
      type="button"
      class="none"
      :class="{ on: !modelValue }"
      title="Initials"
      @click="emit('update:modelValue', '')"
    >
      <ItemIcon name="" :label="label || 'Aa'" :size="16" />
    </button>
    <button
      v-for="name in ITEM_ICON_NAMES"
      :key="name"
      type="button"
      :class="{ on: modelValue === name }"
      :title="name.replace('-', ' ')"
      @click="emit('update:modelValue', name)"
    >
      <ItemIcon :name="name" :size="17" />
    </button>
  </div>
</template>

<style scoped>
.icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(34px, 1fr)); gap: 4px; max-height: 168px; overflow-y: auto; padding: 6px; border-radius: 14px; background: var(--surface-2); }
.icon-grid button {
  aspect-ratio: 1; display: grid; place-items: center; border: 0; border-radius: 9px;
  background: transparent; color: var(--text-2); cursor: pointer; transition: background .2s, color .2s, transform .2s var(--spring);
}
.icon-grid button:hover { background: var(--surface-3); color: var(--text); transform: scale(1.08); }
.icon-grid button.on { background: var(--grad); color: #fff; }
</style>
