import { defineConfig } from 'vite'
import { execSync } from 'child_process'

const commitSha = execSync('git rev-parse --short HEAD').toString().trim()

export default defineConfig({
  root: '.',
  base: '/mentor-g/',
  build: {
    outDir: 'dist',
  },
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha),
  },
})
