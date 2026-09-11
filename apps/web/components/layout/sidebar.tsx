'use client';

import React from 'react';
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

export function Sidebar() {
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
          <SidebarNavItem href="/" icon={LayoutDashboard} label="Dashboard" />
        </SidebarSection>

        <SidebarSection title="Bán hàng">
          <SidebarNavItem href="/orders" icon={ShoppingCart} label="Đơn hàng" badge={12} />
          <SidebarNavItem href="/customers" icon={Users} label="Khách hàng" />
          <SidebarNavItem href="/live-commerce" icon={Video} label="Live Commerce" badge={1} />
        </SidebarSection>

        <SidebarSection title="Sản phẩm">
          <SidebarNavItem href="/products" icon={Package} label="Sản phẩm" />
          <SidebarNavItem href="/categories" icon={Tags} label="Danh mục" />
          <SidebarNavItem href="/inventory" icon={Warehouse} label="Tồn kho" badge={8} />
        </SidebarSection>

        <SidebarSection title="Kênh bán hàng">
          <SidebarNavItem href="/channels" icon={Link2} label="Kênh đã kết nối" />
          <SidebarNavItem href="/sync" icon={RefreshCw} label="Đồng bộ" />
          <SidebarNavItem href="/sync-errors" icon={AlertTriangle} label="Lỗi tích hợp" badge={3} />
        </SidebarSection>

        <SidebarSection title="Phân tích">
          <SidebarNavItem href="/analytics" icon={BarChart3} label="Tổng quan" />
          <SidebarNavItem href="/livestreams" icon={MonitorPlay} label="Livestream" />
        </SidebarSection>

        <SidebarSection title="Quản trị">
          <SidebarNavItem href="/users" icon={UserCog} label="Ngưởi dùng" />
          <SidebarNavItem href="/audit" icon={ClipboardList} label="Nhật ký hoạt động" />
        </SidebarSection>
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-hover p-4 space-y-1">
        <SidebarNavItem href="/settings" icon={Settings} label="Cài đặt" />
        <SidebarNavItem href="/help" icon={HelpCircle} label="Trợ giúp" />
      </div>
    </aside>
  );
}
