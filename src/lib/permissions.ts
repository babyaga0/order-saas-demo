import { UserRole } from '@/types';

/**
 * Permission utilities for role-based access control
 *
 * Role Hierarchy:
 * - SUPER_ADMIN: Developers/Software creators (full system access)
 * - ADMIN: Business owner/manager (business operations)
 * - STAFF: Workers (basic order operations)
 */

// ==========================================
// ROLE CHECKS
// ==========================================

/**
 * Check if user is SUPER_ADMIN (developers)
 */
export function isSuperAdmin(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

/**
 * Check if user is ADMIN (business owner)
 */
export function isBusinessAdmin(role: UserRole): boolean {
  return role === 'ADMIN';
}

/**
 * Check if user has admin privileges (ADMIN or SUPER_ADMIN)
 */
export function isAdmin(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

/**
 * Check if user is STAFF (regular worker)
 */
export function isStaff(role: UserRole): boolean {
  return role === 'STAFF';
}

// ==========================================
// PAGE ACCESS PERMISSIONS
// ==========================================

/**
 * Check if user can access dashboard
 */
export function canAccessDashboard(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

/**
 * Check if user can access analytics
 */
export function canAccessAnalytics(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

/**
 * Check if user can access stock/inventory
 */
export function canAccessStock(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

/**
 * Check if user can access user management
 */
export function canAccessUserManagement(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

// ==========================================
// SETTINGS PERMISSIONS
// ==========================================

/**
 * Check if user can access any settings
 */
export function canAccessSettings(role: UserRole): boolean {
  return true; // All users can access settings (but see different sections)
}

/**
 * Check if user can access system/developer settings
 * (API keys, webhooks, integrations, system config)
 */
export function canAccessSystemSettings(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

/**
 * Check if user can access business settings
 * (WooCommerce settings, delivery settings, etc.)
 */
export function canAccessBusinessSettings(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

/**
 * Check if user can only access profile settings
 * (Password change, personal info)
 */
export function canOnlyAccessProfileSettings(role: UserRole): boolean {
  return role === 'STAFF';
}

// ==========================================
// ORDER PERMISSIONS
// ==========================================

/**
 * Check if user can create orders
 */
export function canCreateOrders(role: UserRole): boolean {
  return true; // All roles can create orders
}

/**
 * Check if user can view orders (they can see their own)
 */
export function canViewOrders(role: UserRole): boolean {
  return true; // All roles can view orders (filtered by backend)
}

/**
 * Check if user can edit any order
 */
export function canEditAnyOrder(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

/**
 * Check if user can delete orders
 */
export function canDeleteOrders(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

/**
 * Check if user can bulk update orders
 */
export function canBulkUpdateOrders(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}
