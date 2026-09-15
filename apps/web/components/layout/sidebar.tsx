'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Video,
  Package,
  Tags,
  Warehouse,
  Link2,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  MonitorPlay,
  Settings,
  HelpCircle,
  UserCog,
  ClipboardList,
} from 'lucide-react';
import { SidebarSection } from './sidebar-section';
import { SidebarNavItem } from './sidebar-nav';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar-bg" aria-label="Sidebar navigation">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">
          CC
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">Commerce Center</h1>
          <p className="text-xs text-sidebar-text">Operations workspace</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <SidebarSection title="Dashboard">
          <SidebarNavItem href="/" icon={LayoutDashboard} label="Dashboard" active={isActive(pathname, '/')} />
        </SidebarSection>

        <SidebarSection title="Bán hàng">
          <SidebarNavItem href="/orders" icon={ShoppingCart} label="Đơn hàng" badge={12} active={isActive(pathname, '/orders')} />
          <SidebarNavItem href="/customers" icon={Users} label="Khách hàng" active={isActive(pathname, '/customers')} />
          <SidebarNavItem href="/live-commerce" icon={Video} label="Live Commerce" badge={1} active={isActive(pathname, '/live-commerce')} />
        </SidebarSection>

        <SidebarSection title="Sản phẩm">
          <SidebarNavItem href="/products" icon={Package} label="Sản phẩm" active={isActive(pathname, '/products')} />
          <SidebarNavItem href="/categories" icon={Tags} label="Danh mục" active={isActive(pathname, '/categories')} />
          <SidebarNavItem href="/inventory" icon={Warehouse} label="Tồn kho" badge={8} active={isActive(pathname, '/inventory')} />
        </SidebarSection>

        <SidebarSection title="Kênh bán hàng">
          <SidebarNavItem href="/channels" icon={Link2} label="Kênh đã kết nối" active={isActive(pathname, '/channels')} />
          <SidebarNavItem href="/sync" icon={RefreshCw} label="Đồng bộ" active={isActive(pathname, '/sync')} />
          <SidebarNavItem href="/sync-errors" icon={AlertTriangle} label="Lỗi tích hợp" badge={3} active={isActive(pathname, '/sync-errors')} />
        </SidebarSection>

        <SidebarSection title="Phân tích">
          <SidebarNavItem href="/analytics" icon={BarChart3} label="Tổng quan" active={isActive(pathname, '/analytics')} />
          <SidebarNavItem href="/livestreams" icon={MonitorPlay} label="Livestream" active={isActive(pathname, '/livestreams')} />
        </SidebarSection>

        <SidebarSection title="Quản trị">
          <SidebarNavItem href="/users" icon={UserCog} label="Người dùng" active={isActive(pathname, '/users')} />
          <SidebarNavItem href="/audit" icon={ClipboardList} label="Nhật ký hoạt động" active={isActive(pathname, '/audit')} />
        </SidebarSection>
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-hover p-4 space-y-1">
        <SidebarNavItem href="/settings" icon={Settings} label="Cài đặt" active={isActive(pathname, '/settings')} />
        <SidebarNavItem href="/help" icon={HelpCircle} label="Trợ giúp" active={isActive(pathname, '/help')} />
      </div>
    </aside>
  );
}
