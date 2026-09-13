export const PERMISSION_CODES = [
  'dashboard.read', 'dashboard.financial.read', 'dashboard.livestream.read', 'analytics.read',
  'orders.read', 'orders.update', 'orders.cancel',
  'customers.read', 'customers.merge',
  'products.read', 'products.manage',
  'inventory.read', 'inventory.adjust',
  'channels.read', 'channels.connect', 'channels.sync',
  'livestream.read', 'livestream.control',
  'members.read', 'members.invite', 'members.manage',
  'roles.read', 'audit.read', 'store.settings', 'store.deactivate',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const ROLE_CODES = ['OWNER', 'ADMIN', 'STAFF', 'WAREHOUSE', 'CUSTOMER_SUPPORT', 'ANALYST'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_PERMISSIONS: Readonly<Record<RoleCode, readonly PermissionCode[]>> = {
  OWNER: PERMISSION_CODES,
  ADMIN: [
    'dashboard.read', 'analytics.read', 'orders.read', 'orders.update', 'orders.cancel',
    'customers.read', 'customers.merge', 'products.read', 'products.manage', 'inventory.read', 'inventory.adjust',
    'channels.read', 'channels.connect', 'channels.sync',
    'members.read', 'members.invite', 'members.manage', 'audit.read', 'store.settings',
  ],
  STAFF: ['dashboard.read', 'orders.read', 'orders.update', 'products.read', 'customers.read'],
  WAREHOUSE: ['orders.read', 'orders.update', 'inventory.read', 'inventory.adjust'],
  CUSTOMER_SUPPORT: ['orders.read', 'orders.update', 'customers.read'],
  ANALYST: ['dashboard.read', 'dashboard.financial.read', 'analytics.read'],
};
