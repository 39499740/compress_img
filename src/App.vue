<script setup lang="ts">
import ImageCompressor from './components/ImageCompressor.vue'
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>图片压缩工具</h1>
    </header>
    <main class="app-content">
      <ImageCompressor />
    </main>
    <footer class="app-footer">
      <p>© 2024 图片压缩工具</p>
    </footer>
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f5f5f5;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background-color: #2196f3;
  color: white;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.app-content {
  flex: 1;
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.app-footer {
  background-color: #f0f0f0;
  padding: 1rem;
  text-align: center;
  font-size: 0.8rem;
  color: #666;
  border-top: 1px solid #ddd;
}
</style>
