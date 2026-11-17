<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Search, Pencil, Trash2, Package, Boxes, TriangleAlert, PackageX, Wallet, RefreshCw, Layers, Minus } from '@lucide/vue'
import { usePos } from '@/stores/pos'
import { useMoney, toast, confirm } from '@/composables'
import { round2, randomBarcode } from '@/utils/format'
import { SWATCHES } from '@/utils/constants'
import BaseModal from '@/components/BaseModal.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import IconPicker from '@/components/IconPicker.vue'
import StatCard from '@/components/StatCard.vue'

const pos = usePos()
const money = useMoney()
const route = useRoute()
const router = useRouter()

const tab = ref('products')
const q = ref('')
const catF = ref('all')
const stockF = ref(route.query.stock || 'all')
watch(() => route.query.stock, (v) => v && (stockF.value = v))

const threshold = computed(() => pos.settings.lowStockThreshold)
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  return pos.products.filter((p) => {
    if (catF.value !== 'all' && p.categoryId !== catF.value) return false
    if (stockF.value === 'low' && !(p.trackStock && p.stock <= threshold.value)) return false
    if (stockF.value === 'out' && !(p.trackStock && p.stock <= 0)) return false
    if (stockF.value === 'inactive' && p.active) return false
    return !s || p.name.toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s) || (p.barcode || '').includes(s)
  })
})
const stats = computed(() => {
  let cost = 0, retail = 0
  for (const p of pos.products) if (p.trackStock) { cost += p.cost * p.stock; retail += p.price * p.stock }
  return {
    count: pos.products.length,
    cost: round2(cost), retail: round2(retail),
    low: pos.products.filter((p) => p.trackStock && p.stock > 0 && p.stock <= threshold.value).length,
    out: pos.products.filter((p) => p.trackStock && p.stock <= 0).length,
  }
})
const margin = (p) => (p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0)
const stockTone = (p) => (!p.trackStock ? '' : p.stock <= 0 ? 'b-danger' : p.stock <= threshold.value ? 'b-warning' : 'b-success')

const showForm = ref(false)
const draft = ref({})
const blank = () => ({ name: '', icon: pos.categories[0]?.icon || '', categoryId: pos.categories[0]?.id || null, price: '', cost: '', sku: '', barcode: '', stock: 0, trackStock: true, active: true })
function openForm(p) {
  draft.value = p ? { ...p } : blank()
  showForm.value = true
}
const draftMargin = computed(() => {
  const price = Number(draft.value.price) || 0
  const cost = Number(draft.value.cost) || 0
  return price ? ((price - cost) / price) * 100 : 0
})
function genSku() {
  const c = pos.categoryMap[draft.value.categoryId]
  const prefix = (c?.name || 'GEN').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
  draft.value.sku = `${prefix}-${String(pos.products.length + 1).padStart(3, '0')}`
}
function saveProduct() {
  const d = draft.value
  if (!d.name?.trim()) return toast('Give the product a name', 'warning')
  const price = Number(d.price)
  if (!(price >= 0) || d.price === '') return toast('Enter a valid price', 'warning')
  if (d.barcode && pos.products.some((p) => p.barcode === d.barcode && p.id !== d.id)) return toast('Another product already uses that barcode', 'warning')
  pos.saveProduct({ ...d, name: d.name.trim(), price: round2(price), cost: round2(Number(d.cost) || 0), stock: Math.max(0, parseInt(d.stock) || 0) })
  toast(d.id ? 'Product updated' : `${d.name} added`)
  showForm.value = false
}
async function removeProduct(p) {
  if (await confirm({ title: `Delete ${p.name}?`, message: 'Past orders keep their history. This cannot be undone.', confirmText: 'Delete', danger: true })) {
    pos.deleteProduct(p.id)
    toast('Product deleted', 'info')
  }
}

const showStock = ref(false)
const stockTarget = ref(null)
const stockMode = ref('add')
const stockQty = ref(1)
function openStock(p) {
  stockTarget.value = p
  stockMode.value = 'add'
  stockQty.value = p.stock <= threshold.value ? 24 : 1
  showStock.value = true
}
const stockPreview = computed(() => {
  const p = stockTarget.value
  if (!p) return 0
  const n = Math.max(0, parseInt(stockQty.value) || 0)
  return stockMode.value === 'add' ? p.stock + n : stockMode.value === 'remove' ? Math.max(0, p.stock - n) : n
})
function applyStock() {
  const p = stockTarget.value
  pos.adjustStock(p.id, stockPreview.value - p.stock)
  toast(`${p.name}: stock now ${stockPreview.value}`)
  showStock.value = false
}

const showCat = ref(false)
const catDraft = ref({})
function openCat(c) {
  catDraft.value = c ? { ...c } : { name: '', icon: '', color: SWATCHES[pos.categories.length % SWATCHES.length] }
  showCat.value = true
}
function saveCat() {
  if (!catDraft.value.name?.trim()) return toast('Name the category', 'warning')
  pos.saveCategory({ ...catDraft.value, name: catDraft.value.name.trim() })
  toast(catDraft.value.id ? 'Category updated' : 'Category created')
  showCat.value = false
}
async function removeCat(c) {
  const n = pos.products.filter((p) => p.categoryId === c.id).length
  if (await confirm({ title: `Delete “${c.name}”?`, message: n ? `${n} products will become uncategorized.` : 'This category is empty.', confirmText: 'Delete', danger: true })) {
    pos.deleteCategory(c.id)
    toast('Category deleted', 'info')
  }
}

onMounted(() => {
  if (route.query.new) {
    openForm()
    router.replace({ query: {} })
  }
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Inventory</h1>
        <p>Products, pricing, stock levels and categories.</p>
      </div>
      <div class="row wrap">
        <div class="segmented">
          <button :class="{ active: tab === 'products' }" @click="tab = 'products'">Products</button>
          <button :class="{ active: tab === 'categories' }" @click="tab = 'categories'">Categories</button>
        </div>
        <button class="btn btn-primary" @click="tab === 'products' ? openForm() : openCat()"><Plus :size="16" /> {{ tab === 'products' ? 'New product' : 'New category' }}</button>
      </div>
    </div>

    <div class="kpis">
      <StatCard label="Products" :value="stats.count" :icon="Package" tone="#8b5cf6" :hint="`${pos.categories.length} categories`" :index="0" />
      <StatCard label="Stock value (cost)" :value="stats.cost" :format="money" :icon="Boxes" tone="#22d3ee" :hint="`${money(stats.retail)} at retail`" :index="1" />
      <StatCard label="Low stock" :value="stats.low" :icon="TriangleAlert" tone="#f59e0b" :hint="`≤ ${threshold} units`" :index="2" />
      <StatCard label="Sold out" :value="stats.out" :icon="PackageX" tone="#f43f5e" hint="need restocking" :index="3" />
    </div>

    <Transition name="slide" mode="out-in">
      <section v-if="tab === 'products'" key="p" class="card mt">
        <div class="filters">
          <div class="input-icon grow" style="min-width: 220px">
            <Search :size="17" />
            <input v-model="q" class="input" placeholder="Search name, SKU or barcode…" />
          </div>
          <select v-model="catF" class="select" style="width: 170px">
            <option value="all">All categories</option>
            <option v-for="c in pos.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <div class="segmented">
            <button v-for="s in [['all', 'All'], ['low', 'Low'], ['out', 'Sold out'], ['inactive', 'Hidden']]" :key="s[0]" :class="{ active: stockF === s[0] }" @click="stockF = s[0]">{{ s[1] }}</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Product</th><th class="hide-sm">Category</th><th class="right">Price</th><th class="right hide-sm">Cost</th><th class="right hide-sm">Margin</th><th>Stock</th><th class="hide-sm">On sale</th><th class="right">Actions</th></tr>
            </thead>
            <TransitionGroup tag="tbody" name="fade">
              <tr v-for="p in filtered" :key="p.id" :class="{ inactive: !p.active }">
                <td>
                  <div class="row">
                    <span class="p-icon" :style="{ '--cat': pos.categoryMap[p.categoryId]?.color || '#8b5cf6' }"><ItemIcon :name="p.icon" :label="p.name" :size="18" /></span>
                    <div style="min-width: 0">
                      <strong class="ellipsis" style="display: block">{{ p.name }}</strong>
                      <span class="muted tiny mono">{{ p.sku || '—' }} · {{ p.barcode || 'no barcode' }}</span>
                    </div>
                  </div>
                </td>
                <td class="hide-sm">
                  <span v-if="pos.categoryMap[p.categoryId]" class="badge" :style="{ color: pos.categoryMap[p.categoryId].color, background: pos.categoryMap[p.categoryId].color + '22' }">{{ pos.categoryMap[p.categoryId].name }}</span>
                  <span v-else class="muted small">Uncategorized</span>
                </td>
                <td class="right bold num">{{ money(p.price) }}</td>
                <td class="right num muted hide-sm">{{ money(p.cost) }}</td>
                <td class="right hide-sm"><span class="num" :class="margin(p) >= 60 ? 'c-success' : margin(p) < 30 ? 'c-warning' : ''">{{ margin(p).toFixed(0) }}%</span></td>
                <td>
                  <button v-if="p.trackStock" class="stock-btn" title="Adjust stock" @click="openStock(p)">
                    <span class="badge" :class="stockTone(p)">{{ p.stock <= 0 ? 'Sold out' : p.stock }}</span>
                    <RefreshCw :size="13" class="muted" />
                  </button>
                  <span v-else class="muted small">Not tracked</span>
                </td>
                <td class="hide-sm"><label class="switch"><input v-model="p.active" type="checkbox" /><span class="track"></span></label></td>
                <td class="right">
                  <div class="row end" style="gap: 6px">
                    <button class="icon-btn sm" title="Edit" @click="openForm(p)"><Pencil :size="14" /></button>
                    <button class="icon-btn sm danger" title="Delete" @click="removeProduct(p)"><Trash2 :size="14" /></button>
                  </div>
                </td>
              </tr>
            </TransitionGroup>
          </table>
          <div v-if="!filtered.length" class="empty">
            <div class="empty-icon"><Package :size="26" /></div>
            <strong>No products here</strong>
            <span class="small">Adjust filters or add your first product.</span>
            <button class="btn btn-primary btn-sm mt" @click="openForm()"><Plus :size="15" /> New product</button>
          </div>
        </div>
      </section>

      <section v-else key="c" class="cat-grid mt">
        <TransitionGroup name="list">
          <div v-for="(c, i) in pos.categories" :key="c.id" class="cat card rise" :style="{ '--cat': c.color, '--i': i }">
            <div class="cat-icon"><ItemIcon :name="c.icon" :label="c.name" :size="22" /></div>
            <div class="grow">
              <strong>{{ c.name }}</strong>
              <span class="muted small">{{ pos.products.filter((p) => p.categoryId === c.id).length }} products</span>
            </div>
            <button class="icon-btn sm" title="Edit" @click="openCat(c)"><Pencil :size="14" /></button>
            <button class="icon-btn sm danger" title="Delete" @click="removeCat(c)"><Trash2 :size="14" /></button>
          </div>
        </TransitionGroup>
        <button class="cat add-cat" @click="openCat()"><Layers :size="20" /> Add category</button>
      </section>
    </Transition>

    <BaseModal v-model:open="showForm" size="lg" :title="draft.id ? 'Edit product' : 'New product'" :subtitle="draft.id ? draft.name : 'Add something new to sell'">
      <div class="pform">
        <div class="preview-col">
          <div class="preview" :style="{ '--cat': pos.categoryMap[draft.categoryId]?.color || '#8b5cf6' }">
            <span class="pv-icon"><ItemIcon :name="draft.icon" :label="draft.name || 'New'" :size="28" /></span>
            <strong>{{ draft.name || 'Product name' }}</strong>
            <span class="pv-price">{{ money(Number(draft.price) || 0) }}</span>
          </div>
          <span class="label">Icon</span>
          <IconPicker v-model="draft.icon" :label="draft.name" />
        </div>
        <div class="form-grid">
          <label class="field span-2"><span class="label">Name *</span><input v-model="draft.name" class="input" placeholder="e.g. Oat Flat White" /></label>
          <label class="field span-2"><span class="label">Category</span>
            <select v-model="draft.categoryId" class="select">
              <option :value="null">Uncategorized</option>
              <option v-for="c in pos.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>          <label class="field"><span class="label">Selling price *</span><input v-model="draft.price" class="input" type="number" min="0" step="0.01" placeholder="0.00" /></label>
          <label class="field"><span class="label">Unit cost</span><input v-model="draft.cost" class="input" type="number" min="0" step="0.01" placeholder="0.00" /></label>
          <div class="margin-bar span-2">
            <span class="muted small">Margin</span>
            <div class="mb-track"><i :style="{ width: Math.max(0, Math.min(100, draftMargin)) + '%' }"></i></div>
            <b class="num" :class="draftMargin < 0 ? 'c-danger' : ''">{{ draftMargin.toFixed(1) }}%</b>
            <span class="muted small num">{{ money((Number(draft.price) || 0) - (Number(draft.cost) || 0)) }} / unit</span>
          </div>
          <label class="field"><span class="label">SKU</span>
            <div class="row"><input v-model="draft.sku" class="input" placeholder="ABC-001" /><button class="btn btn-sm" type="button" @click="genSku">Auto</button></div>
          </label>
          <label class="field"><span class="label">Barcode</span>
            <div class="row"><input v-model="draft.barcode" class="input mono" placeholder="Scan or type" /><button class="btn btn-sm" type="button" @click="draft.barcode = randomBarcode()">New</button></div>
          </label>
          <div class="field span-2 toggles">
            <label class="switch"><input v-model="draft.trackStock" type="checkbox" /><span class="track"></span> Track stock</label>
            <label class="switch"><input v-model="draft.active" type="checkbox" /><span class="track"></span> Show on register</label>
          </div>
          <Transition name="fade">
            <label v-if="draft.trackStock" class="field"><span class="label">{{ draft.id ? 'Units in stock' : 'Opening stock' }}</span><input v-model="draft.stock" class="input" type="number" min="0" /></label>
          </Transition>
        </div>
      </div>
      <template #footer>
        <button class="btn" @click="showForm = false">Cancel</button>
        <button class="btn btn-primary" @click="saveProduct">{{ draft.id ? 'Save changes' : 'Add product' }}</button>
      </template>
    </BaseModal>

    <BaseModal v-model:open="showStock" size="sm" title="Adjust stock" :subtitle="stockTarget ? `${stockTarget.name} · ${stockTarget.stock} on hand` : ''">
      <div class="stack">
        <div class="segmented" style="align-self: flex-start">
          <button :class="{ active: stockMode === 'add' }" @click="stockMode = 'add'">Receive</button>
          <button :class="{ active: stockMode === 'remove' }" @click="stockMode = 'remove'">Remove</button>
          <button :class="{ active: stockMode === 'set' }" @click="stockMode = 'set'">Set count</button>
        </div>
        <div class="big-stepper">
          <button class="icon-btn" @click="stockQty = Math.max(0, (parseInt(stockQty) || 0) - 1)"><Minus :size="16" /></button>
          <input v-model="stockQty" class="input input-lg center num" type="number" min="0" @keydown.enter="applyStock" />
          <button class="icon-btn" @click="stockQty = (parseInt(stockQty) || 0) + 1"><Plus :size="16" /></button>
        </div>
        <div class="row wrap"><button v-for="n in [6, 12, 24, 48]" :key="n" class="chip" @click="stockQty = n">{{ n }}</button></div>
        <div class="stock-preview">
          <span class="muted">New stock level</span>
          <strong class="num">{{ stockTarget?.stock }} → <span class="gradient-text">{{ stockPreview }}</span></strong>
        </div>
      </div>
      <template #footer>
        <button class="btn" @click="showStock = false">Cancel</button>
        <button class="btn btn-primary" @click="applyStock">Update stock</button>
      </template>
    </BaseModal>

    <BaseModal v-model:open="showCat" size="sm" :title="catDraft.id ? 'Edit category' : 'New category'">
      <div class="stack">
        <div class="row">
          <span class="cat-icon" :style="{ '--cat': catDraft.color }"><ItemIcon :name="catDraft.icon" :label="catDraft.name || 'New'" :size="22" /></span>
          <input v-model="catDraft.name" class="input" placeholder="Category name" @keydown.enter="saveCat" />
        </div>
        <div class="field">
          <span class="label">Icon</span>
          <IconPicker v-model="catDraft.icon" :label="catDraft.name" />
        </div>
        <div class="field">
          <span class="label">Colour</span>
          <div class="swatches">
            <button v-for="s in SWATCHES" :key="s" :style="{ background: s }" :class="{ on: catDraft.color === s }" :aria-label="s" @click="catDraft.color = s"></button>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn" @click="showCat = false">Cancel</button>
        <button class="btn btn-primary" @click="saveCat">Save category</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 16px; border-bottom: 1px solid var(--border); }
.table-wrap { max-height: calc(100vh - 400px); min-height: 300px; }
tr.inactive td { opacity: .5; }
.p-icon { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; color: color-mix(in srgb, var(--cat) 80%, var(--text)); background: color-mix(in srgb, var(--cat) 16%, transparent); border: 1px solid color-mix(in srgb, var(--cat) 25%, transparent); }
.stock-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; padding: 4px; border-radius: 8px; cursor: pointer; }
.stock-btn:hover { background: var(--surface-2); }

.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.cat { display: flex; align-items: center; gap: 12px; padding: 16px; transition: transform .35s var(--ease), border-color .3s; }
.cat:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--cat) 50%, transparent); }
.cat .grow { display: flex; flex-direction: column; }
.cat-icon { width: 48px; height: 48px; flex-shrink: 0; border-radius: 15px; display: grid; place-items: center; color: color-mix(in srgb, var(--cat, var(--c1)) 80%, var(--text)); background: color-mix(in srgb, var(--cat) 18%, transparent); border: 1px solid color-mix(in srgb, var(--cat) 35%, transparent); }
.add-cat { justify-content: center; border: 1.5px dashed var(--border-2); border-radius: var(--r-lg); background: transparent; color: var(--muted); font: 650 14px var(--font); cursor: pointer; min-height: 82px; }
.add-cat:hover { color: var(--accent-ink); border-color: color-mix(in srgb, var(--c1) 50%, transparent); background: var(--grad-soft); }

.pform { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 22px; }
.preview-col { display: flex; flex-direction: column; gap: 12px; }
.preview {
  display: flex; flex-direction: column; gap: 8px; padding: 18px; border-radius: 20px; min-height: 170px;
  background: radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, var(--cat) 26%, transparent), transparent 62%), var(--surface);
  border: 1px solid color-mix(in srgb, var(--cat) 35%, transparent); transition: all .3s;
}
.pv-icon { width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; color: color-mix(in srgb, var(--cat) 80%, var(--text)); background: color-mix(in srgb, var(--cat) 18%, transparent); animation: floaty 4s ease-in-out infinite; }
.pv-price { margin-top: auto; font-weight: 800; font-size: 17px; }
.margin-bar { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 14px; background: var(--surface-2); }
.mb-track { flex: 1; height: 7px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.mb-track i { display: block; height: 100%; background: var(--grad); border-radius: inherit; transition: width .5s var(--ease); }
.toggles { flex-direction: row; gap: 22px; flex-wrap: wrap; }
.big-stepper { display: grid; grid-template-columns: 50px 1fr 50px; gap: 8px; }
.big-stepper .icon-btn { width: 50px; height: 50px; }
.stock-preview { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-radius: 14px; background: var(--surface-2); }
.stock-preview strong { font-size: 18px; }
.swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.swatches button { width: 30px; height: 30px; border-radius: 10px; border: 2px solid transparent; cursor: pointer; transition: transform .25s var(--spring); }
.swatches button:hover { transform: scale(1.12); }
.swatches button.on { border-color: var(--text); transform: scale(1.12); box-shadow: 0 0 0 3px var(--bg-2) inset; }
@media (max-width: 760px) {
  .pform { grid-template-columns: 1fr; }
}
</style>
