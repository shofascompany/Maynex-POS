import './admin-path' // must stay first: see the file
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import { registerServiceWorker } from './composables/pwa'
import { autoLabelTables } from './utils/responsiveTables'

registerServiceWorker()
autoLabelTables()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
