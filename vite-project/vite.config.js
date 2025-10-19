import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'home.html'),
        login: resolve(__dirname, 'index.html'),
        alertDetail: resolve(__dirname, 'alert-detail.html'),
        iotFleetManager: resolve(__dirname, 'iot-fleet-manager.html'),
        ownerDashboard: resolve(__dirname, 'owner-dashboard.html'),
        adminDashboard: resolve(__dirname, 'admin-dashboard.html'),
      },
    },
  },
})
