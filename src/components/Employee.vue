<template>
  <div class="employee-page">
    <header class="page-header">
      <h1>Employee</h1>
      <p>{{ isAdmin ? 'Open attendance or the staff list.' : 'Open attendance.' }}</p>
    </header>
    <nav class="employee-tabs" aria-label="Employee">
      <router-link to="/employee/attendance" data-testid="open-attendance">Attendance</router-link>
      <router-link v-if="isAdmin" to="/employee/staff" data-testid="open-staff">Staff</router-link>
    </nav>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { authService } from '../services/authService'

const isAdmin = computed(() => authService.getCurrentUser()?.roleId === 0)
</script>

<style scoped>
.employee-page { color: #212529; }
.page-header { margin-bottom: 1rem; }
.page-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}
.page-header p { margin: 0.25rem 0 0; color: #6c757d; font-size: 0.95rem; }
.employee-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 1.5rem;
}
.employee-tabs a {
  padding: 8px 14px;
  border-radius: 999px;
  background: #e9ecef;
  color: #495057;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
}
.employee-tabs a.router-link-active {
  background: #5a67d8;
  color: #fff;
}
</style>
