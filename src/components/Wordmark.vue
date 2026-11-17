<script setup>
// "Maynex POS" set for legibility: normal letter spacing, the product word bold and
// "POS" in the brand gradient so the name says what it is. Optional small line underneath.
defineProps({
  size: { type: Number, default: 20 },
  tagline: { type: String, default: '' },
})
</script>

<template>
  <span class="wordmark" :style="{ '--fs': size + 'px' }">
    <span class="wm-name">Maynex <span class="wm-pos">POS</span></span>
    <span v-if="tagline" class="wm-tag">{{ tagline }}</span>
  </span>
</template>

<style scoped>
.wordmark { display: inline-flex; flex-direction: column; line-height: 1.05; min-width: 0; }
.wm-name { font-size: var(--fs); font-weight: 800; letter-spacing: -.005em; white-space: nowrap; }
.wm-pos {
  font-weight: 800; letter-spacing: .04em;
  background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.wm-tag {
  margin-top: 3px; font-size: max(9.5px, calc(var(--fs) * .4)); font-weight: 700;
  letter-spacing: .14em; text-transform: uppercase; color: var(--muted); white-space: nowrap;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis;
}
</style>
