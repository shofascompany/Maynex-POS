<script setup>
defineProps({ size: { type: Number, default: 40 } })
</script>

<template>
  <span class="brand-mark" :style="{ width: size + 'px', height: size + 'px' }">
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <!-- Maynex mark: an M whose middle stroke is a checkmark rising past the letter (sale complete, business growing) -->
      <path d="M7.5 24V12l6.2 7 10.8-11.5M21.5 17.5V24" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>
</template>

<style scoped>
.brand-mark {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 30%;
  background: var(--grad);
  background-size: 220% 220%;
  animation: gradientShift 8s ease infinite;
  box-shadow: 0 10px 26px -8px color-mix(in srgb, var(--c1) 75%, transparent), inset 0 1px 0 rgba(255, 255, 255, .35);
}
.brand-mark svg { width: 62%; height: 62%; }
</style>
