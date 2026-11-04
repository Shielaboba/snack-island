import { createRouter, createWebHistory } from 'vue-router'
import OrderPage from '../components/OrderPage.vue'
import Dashboard from '../components/Dashboard.vue'
import Inventory from '../components/Inventory.vue'
import Sales from '../components/Sales.vue'
import Expenses from '../components/Expenses.vue'
import Discounts from '../components/Discounts.vue'
import Users from '../components/Users.vue'
import Menu from '../components/Menu.vue'
import Login from '../components/Login.vue'
import SignUp from '../components/SignUp.vue'
import { authService } from '../services/authService'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false, hideForAuth: true }
  },
  {
    path: '/signup',
    name: 'SignUp',
    component: SignUp,
    meta: { requiresAuth: false, hideForAuth: true }
  },
  {
    path: '/',
    redirect: () => {
      const user = authService.getCurrentUser()
      if (!user) {
        return '/login'
      }
      // Redirect based on role
      if (user.roleId === 1) return '/order'
      if (user.roleId === 2) return '/audit'
      return '/dashboard'
    }
  },
  {
    path: '/menu',
    name: 'Menu',
    component: Menu,
    meta: { requiresAuth: true, allowedRoles: [0] } // Admin only
  },
  {
    path: '/order',
    name: 'Order',
    component: OrderPage,
    meta: { requiresAuth: true, allowedRoles: [0, 1] } // Admin and Staff
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, allowedRoles: [0] } // Admin only
  },
  {
    path: '/weekly',
    name: 'WeeklySummary',
    component: () => import('../components/WeeklySummary.vue'),
    meta: { requiresAuth: true, allowedRoles: [0] } // Admin only
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: Inventory,
    meta: { requiresAuth: true, allowedRoles: [0] } // Admin only
  },
  {
    path: '/sales',
    name: 'Sales',
    component: Sales,
    meta: { requiresAuth: true, allowedRoles: [0] } // Admin only
  },
  {
    path: '/expenses',
    name: 'Expenses',
    component: Expenses,
    meta: { requiresAuth: true, allowedRoles: [0] } // Admin only
  },
  {
    path: '/discounts',
    name: 'Discounts',
    component: Discounts,
    meta: { requiresAuth: true, allowedRoles: [0] } // Admin only
  },
  {
    path: '/users',
    name: 'Users',
    component: Users,
    meta: { requiresAuth: true, allowedRoles: [0] } // Admin only
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('../components/AuditPage.vue'),
    meta: { requiresAuth: true, allowedRoles: [0, 2] } // Admin and Auditor
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard for authentication and role-based access
router.beforeEach((to, _from, next) => {
  const user = authService.getCurrentUser()
  const isAuthenticated = user !== null
  const requiresAuth = to.meta.requiresAuth !== false
  const hideForAuth = to.meta.hideForAuth === true
  const allowedRoles = to.meta.allowedRoles as number[] | undefined

  // If route is login/signup and user is already authenticated, redirect to appropriate page
  if (hideForAuth && isAuthenticated) {
    if (user.roleId === 1) {
      next('/order')
    } else if (user.roleId === 2) {
      next('/audit')
    } else {
      next('/dashboard')
    }
    return
  }

  // If route requires auth and user is not authenticated, redirect to login
  if (requiresAuth && !isAuthenticated) {
    next('/login')
    return
  }

  // Check role-based access
  if (requiresAuth && isAuthenticated && allowedRoles && user) {
    if (!allowedRoles.includes(user.roleId)) {
      // User doesn't have permission, redirect to appropriate page
      if (user.roleId === 1) {
        next('/order')
      } else if (user.roleId === 2) {
        next('/audit')
      } else {
        next('/dashboard')
      }
      return
    }
  }

  next()
})

export default router
