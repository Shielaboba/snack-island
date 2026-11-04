<template>
  <div class="sidebar" :class="{ collapsed: isCollapsed }">
    <!-- Header Section -->
    <div class="sidebar-header">
      <div class="brand">
        <img class="brand-logo" :src="logoUrl" alt="Snack Island logo" />
        <div class="brand-text">
          <span class="brand-name">Snack Island</span>
          <span class="brand-tagline">POS & Inventory</span>
        </div>
      </div>
      <button class="menu-toggle" @click="toggleSidebar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'chevron-right': isCollapsed, 'chevron-left': !isCollapsed }">
          <polyline points="9,18 15,12 9,6"></polyline>
        </svg>
      </button>
    </div>

    <!-- Search Section -->
    <div class="search-section">
      <div class="search-container">
        <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input type="text" placeholder="Search..." class="search-input" />
      </div>
    </div>

    <!-- Navigation Section -->
    <nav class="navigation">
      <ul class="nav-list">
        <!-- Admin: All menu items, Staff: Only Order -->
        <li v-if="isAdmin" class="nav-item">
          <router-link to="/dashboard" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span class="nav-text">Dashboard</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>

        <li v-if="isAdmin" class="nav-item">
          <router-link to="/weekly" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="nav-text">Weekly Summary</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>
        <li class="nav-item">
          <router-link to="/order" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <span class="nav-text">Order</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>

        <li v-if="isAdmin" class="nav-item">
          <router-link to="/menu" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
            <span class="nav-text">Menu</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>
        
        <li v-if="isAdmin" class="nav-item">
          <router-link to="/inventory" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="nav-text">Inventory</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>
        
        <li v-if="isAdmin" class="nav-item">
          <router-link to="/expenses" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            <span class="nav-text">Expenses</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>

        <li v-if="isAdminOrAuditor" class="nav-item">
          <router-link to="/ledger" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span class="nav-text">Ledger</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>
        
        <li v-if="isAdmin" class="nav-item">
          <router-link to="/discounts" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span class="nav-text">Discounts</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>
        
        <li v-if="isAdmin" class="nav-item">
          <router-link to="/users" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span class="nav-text">Users</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>

        <li v-if="isAdminOrAuditor" class="nav-item">
          <router-link to="/audit" class="nav-link" @click="closeMobileSidebar">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span class="nav-text">Audit</span>
            <span class="nav-active-indicator"></span>
          </router-link>
        </li>
      </ul>
    </nav>

    <!-- User Profile Section -->
    <div class="user-profile">
      <div class="profile-content">
        <div class="profile-picture">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div class="profile-info">
          <div class="profile-name">{{ userName }}</div>
          <div class="profile-role">{{ userRole }}</div>
        </div>
      </div>
      <button class="logout-button" @click="handleLogout" title="Logout">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/authService'
import logoUrl from '../assets/logo.png'

const emit = defineEmits<{
  closeMobile: []
  toggleCollapse: [boolean]
}>()

const router = useRouter()
const isCollapsed = ref(false)

const currentUser = computed(() => authService.getCurrentUser())
const isAdmin = computed(() => currentUser.value?.roleId === 0)
const isAdminOrAuditor = computed(() => currentUser.value?.roleId === 0 || currentUser.value?.roleId === 2)

const userName = computed(() => currentUser.value?.username || 'Guest')
const userRole = computed(() => {
  if (currentUser.value?.roleId === 0) return 'Administrator'
  if (currentUser.value?.roleId === 1) return 'Staff'
  if (currentUser.value?.roleId === 2) return 'Auditor'
  return 'Unknown'
})

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
  emit('toggleCollapse', isCollapsed.value)
}

const closeMobileSidebar = () => {
  emit('closeMobile')
}

const handleLogout = async () => {
  const { error } = await authService.signOut()
  if (!error) {
    router.push('/login')
  } else {
    console.error('Logout error:', error)
  }
}
</script>

<style scoped>
.sidebar {
  width: 280px;
  height: 100vh;
  background: radial-gradient(800px 400px at -80px -120px, rgba(255, 184, 0, 0.08), rgba(255, 184, 0, 0) 55%), linear-gradient(180deg, #0e3b2e 0%, #114e43 100%);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  border-right: 1px solid rgba(255, 184, 0, 0.12);
  transition: width 0.25s ease;
}

.sidebar.collapsed {
  width: 80px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.collapsed .sidebar-header {
  padding: 16px 12px;
  justify-content: center;
  position: relative;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 10px rgba(0,0,0,0.25);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.collapsed .brand-text {
  display: none;
}

.brand-name {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}

.brand-tagline {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.menu-toggle {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.2s, transform 0.2s;
}

.collapsed .menu-toggle {
  position: absolute;
  right: -20px;
  background-color: rgba(14, 59, 46, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.menu-toggle:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.collapsed .menu-toggle:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.menu-toggle svg {
  transition: transform 0.2s ease;
}

.menu-toggle svg.chevron-right {
  transform: rotate(0deg);
}

.menu-toggle svg.chevron-left {
  transform: rotate(180deg);
}

.search-section {
  padding: 20px;
}

.collapsed .search-section {
  display: none;
}

.search-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.6);
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 12px 12px 12px 40px;
  background-color: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: background-color 0.2s, box-shadow 0.2s;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.search-input:focus {
  background-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.navigation {
  flex: 1;
  padding: 0 20px;
}

.collapsed .navigation {
  padding: 0 12px;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 4px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.8);
}

.collapsed .nav-item {
  justify-content: center;
  padding: 12px;
  margin-bottom: 8px;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.nav-item.active {
  background-color: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
  position: relative;
}

.nav-link:hover {
  color: inherit;
}

.nav-link.router-link-active {
  color: #fff;
}

.nav-item:has(.router-link-active) {
  background-color: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.collapsed .nav-item:has(.router-link-active) {
  background-color: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.nav-icon {
  flex-shrink: 0;
}

.nav-text {
  font-size: 14px;
  font-weight: 500;
}

.collapsed .nav-text,
.collapsed .nav-active-indicator {
  display: none;
}

.nav-active-indicator {
  position: absolute;
  right: 8px;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: transparent;
  transition: background 0.2s;
}

.router-link-active .nav-active-indicator {
  background: #22d3ee; /* cyan-400 */
}

.user-profile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.profile-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.profile-picture {
  width: 40px;
  height: 40px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.logout-button {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.logout-button:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.collapsed .user-profile {
  justify-content: center;
  padding: 16px 12px;
}

.collapsed .profile-content {
  justify-content: center;
}

.collapsed .profile-info,
.collapsed .logout-button {
  display: none;
}

.profile-name {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-role {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Responsive design */
@media (max-width: 480px) {
  .sidebar {
    width: 100%;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    z-index: 1001;
    top: 60px;
    height: calc(100vh - 60px);
  }
  
  .menu-toggle {
    display: none;
  }
  
  .sidebar.mobile-open {
    transform: translateX(0);
  }
  
  .sidebar-header {
    padding: 16px;
  }
  
  .brand-name {
    font-size: 18px;
  }
  
  .search-section {
    padding: 16px;
  }
  
  .search-input {
    font-size: 16px; /* Prevents zoom on iOS */
  }
  
  .navigation {
    padding: 0 16px;
  }
  
  .nav-text {
    font-size: 16px;
  }
  
  .user-profile {
    padding: 16px;
  }
  
  .profile-name {
    font-size: 16px;
  }
  
  .profile-role {
    font-size: 14px;
  }
}
</style>
