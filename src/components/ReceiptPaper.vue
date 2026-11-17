<script setup>
import { computed } from 'vue'
import { usePos } from '@/stores/pos'
import { useMoney } from '@/composables'
import { formatDateTime } from '@/utils/format'
import { paymentLabel } from '@/utils/constants'

const props = defineProps({ order: { type: Object, required: true } })
const pos = usePos()
const money = useMoney()
const s = computed(() => pos.settings)
const cashier = computed(() => pos.staffMap[props.order.staffId]?.name || '—')
const customer = computed(() => pos.customerMap[props.order.customerId] || null)
const contact = computed(() => [s.value.phone, s.value.email].filter(Boolean).join(' · '))
</script>

<template>
  <div class="receipt-paper">
    <div v-if="order.status === 'refunded'" class="stamp">Refunded</div>
    <div class="r-head">
      <div v-if="s.storeName" class="r-logo">{{ s.storeName.slice(0, 1).toUpperCase() }}</div>
      <h4>{{ s.storeName }}</h4>
      <p v-if="s.address">{{ s.address }}</p>
      <p v-if="contact">{{ contact }}</p>
      <p v-if="s.taxId">Tax ID {{ s.taxId }}</p>
    </div>
    <div class="r-sep"></div>
    <div class="r-meta">
      <div><span>Receipt</span><b>#{{ order.number }}</b></div>
      <div><span>Date</span><b>{{ formatDateTime(order.createdAt) }}</b></div>
      <div><span>Served by</span><b>{{ cashier }}</b></div>
      <div v-if="customer"><span>Customer</span><b>{{ customer.name }}</b></div>
    </div>
    <div class="r-sep"></div>
    <div v-for="(it, i) in order.items" :key="i" class="r-item">
      <div class="r-line"><span>{{ it.qty }} × {{ it.name }}</span><b>{{ money(it.total) }}</b></div>
      <div class="r-sub">@ {{ money(it.price) }}<template v-if="it.discount"> · −{{ it.discount }}%</template></div>
    </div>
    <div class="r-sep"></div>
    <div class="r-line"><span>Subtotal</span><span>{{ money(order.subtotal) }}</span></div>
    <div v-if="order.discount" class="r-line"><span>Discounts</span><span>−{{ money(order.discount) }}</span></div>
    <div class="r-line"><span>Tax {{ order.taxRate ?? s.taxRate }}%{{ order.taxInclusive ? ' (incl.)' : '' }}</span><span>{{ money(order.tax) }}</span></div>
    <div class="r-line r-total"><span>TOTAL</span><span>{{ money(order.total) }}</span></div>
    <div class="r-sep"></div>
    <div v-for="(p, i) in order.payments" :key="'p' + i" class="r-line"><span>{{ paymentLabel(p.method) }}</span><span>{{ money(p.amount) }}</span></div>
    <div v-if="order.change > 0" class="r-line"><span>Change</span><span>{{ money(order.change) }}</span></div>
    <template v-if="order.pointsEarned || order.pointsRedeemed">
      <div class="r-sep"></div>
      <div v-if="order.pointsRedeemed" class="r-line"><span>Points redeemed</span><span>−{{ order.pointsRedeemed }}</span></div>
      <div v-if="order.pointsEarned" class="r-line"><span>Points earned</span><span>+{{ order.pointsEarned }}</span></div>
      <div v-if="customer" class="r-line"><span>Points balance</span><span>{{ customer.points }}</span></div>
    </template>
    <p v-if="order.note" class="r-note">Note: {{ order.note }}</p>
    <div class="r-foot">
      <strong v-if="s.receiptHeader">{{ s.receiptHeader }}</strong>
      <span class="mono r-num">Receipt #{{ order.number }}</span>
      <p v-if="s.receiptFooter">{{ s.receiptFooter }}</p>
      <p class="powered">Powered by Maynex POS</p>
    </div>
  </div>
</template>

<style scoped>
.receipt-paper {
  position: relative; width: 100%; max-width: 320px; margin: 0 auto 12px;
  padding: 22px 20px 26px; background: #fffef9; color: #1d1d29;
  font-family: var(--mono); font-size: 11.5px; line-height: 1.55;
  border-radius: 6px 6px 0 0;
  box-shadow: 0 30px 50px -28px rgba(0, 0, 0, .5);
}
.receipt-paper::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -9px; height: 10px;
  background: linear-gradient(135deg, #fffef9 50%, transparent 50%) 0 0 / 12px 12px repeat-x,
              linear-gradient(-135deg, #fffef9 50%, transparent 50%) 0 0 / 12px 12px repeat-x;
}
.stamp {
  position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-16deg);
  padding: 6px 18px; border: 3px solid #e11d48; color: #e11d48; border-radius: 8px;
  font: 800 22px var(--font); letter-spacing: .15em; text-transform: uppercase; opacity: .7;
}
.r-head { text-align: center; }
.r-logo {
  width: 38px; height: 38px; margin: 0 auto 6px; border-radius: 12px; display: grid; place-items: center;
  background: #1d1d29; color: #fff; font: 800 18px var(--font);
}
.r-head h4 { font: 800 15px var(--font); margin-bottom: 2px; }
.r-head p { color: #5d5d70; font-size: 10.5px; }
.r-sep { border-top: 1.5px dashed #c9c9d4; margin: 11px 0; }
.r-meta div, .r-line { display: flex; justify-content: space-between; gap: 10px; }
.r-meta span { color: #6a6a7c; }
.r-item { margin-bottom: 4px; }
.r-line span:first-child { min-width: 0; }
.r-sub { color: #77778a; font-size: 10.5px; }
.r-total { font-size: 15px; font-weight: 800; margin-top: 6px; }
.r-note { margin-top: 10px; color: #5d5d70; font-style: italic; }
.r-foot { margin-top: 14px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.r-foot strong { font-family: var(--font); font-size: 12.5px; }
.r-foot p { color: #6a6a7c; font-size: 10.5px; }
.r-num { font-size: 12px; font-weight: 700; letter-spacing: .08em; padding: 4px 10px; border: 1.5px dashed #c9c9d4; border-radius: 6px; }
.powered { opacity: .6; }
</style>
