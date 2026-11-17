<script>
import {
  Coffee, CupSoda, Croissant, Sandwich, Salad, Soup, Pizza, Cookie, CakeSlice, Cake, IceCreamCone, Donut,
  Apple, Citrus, Cherry, Grape, Banana, Carrot, Milk, GlassWater, Wine, Beer, Martini, Egg, EggFried, Wheat,
  Beef, Fish, Drumstick, Ham, Popcorn, Candy, Lollipop, Leaf, Bean, Nut, Utensils, ChefHat, CookingPot,
  Package, ShoppingBag, Shirt, Gift, Tag, Pill, Book, Pen, Plug, Smartphone, Watch, Gem, Flower2, Baby,
  Dog, Backpack, Umbrella, Battery, Lightbulb, Wrench, Scissors, Glasses, Sparkles, Box, Layers,
} from '@lucide/vue'

/** Icons offered in product/category pickers, grouped loosely by trade. */
export const ITEM_ICONS = {
  coffee: Coffee, soda: CupSoda, croissant: Croissant, sandwich: Sandwich, salad: Salad, soup: Soup,
  pizza: Pizza, cookie: Cookie, 'cake-slice': CakeSlice, cake: Cake, 'ice-cream': IceCreamCone, donut: Donut,
  apple: Apple, citrus: Citrus, cherry: Cherry, grape: Grape, banana: Banana, carrot: Carrot, milk: Milk,
  water: GlassWater, wine: Wine, beer: Beer, cocktail: Martini, egg: Egg, 'egg-fried': EggFried, wheat: Wheat,
  beef: Beef, fish: Fish, chicken: Drumstick, ham: Ham, popcorn: Popcorn, candy: Candy, lollipop: Lollipop,
  leaf: Leaf, bean: Bean, nut: Nut, meal: Utensils, chef: ChefHat, pot: CookingPot,
  package: Package, bag: ShoppingBag, shirt: Shirt, gift: Gift, tag: Tag, pharmacy: Pill, book: Book,
  stationery: Pen, electrical: Plug, phone: Smartphone, watch: Watch, jewellery: Gem, flower: Flower2,
  baby: Baby, pet: Dog, backpack: Backpack, umbrella: Umbrella, battery: Battery, lighting: Lightbulb,
  hardware: Wrench, beauty: Scissors, eyewear: Glasses, special: Sparkles, box: Box, other: Layers,
}
export const ITEM_ICON_NAMES = Object.keys(ITEM_ICONS)
</script>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  label: { type: String, default: '' },
  size: { type: Number, default: 20 },
})
const component = computed(() => ITEM_ICONS[props.name] || null)
const monogram = computed(() =>
  (props.label || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?',
)
</script>

<template>
  <component :is="component" v-if="component" :size="size" :stroke-width="1.9" aria-hidden="true" />
  <span v-else class="monogram" :style="{ fontSize: Math.round(size * 0.62) + 'px' }" aria-hidden="true">{{ monogram }}</span>
</template>

<style scoped>
.monogram { font-weight: 800; letter-spacing: -.03em; line-height: 1; }
</style>
