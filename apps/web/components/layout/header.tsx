'use client';

import React from 'react';
import { Bell, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';

interface HeaderProps {
  storeName?: string;
  userName?: string;
  userInitials?: string;
}

export function Header({ storeName = 'Luma House', userName = 'User', userInitials = 'U' }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white px-6">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="font-medium text-text-primary">{storeName}</span>
        <span>/</span>
        <span>Dashboard</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Realtime connected
        </div>

        <Button variant="ghost" size="sm" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] text-white">
            3
          </span>
        </Button>

        <Button variant="ghost" size="sm" className="flex items-center gap-2" aria-label={`User menu: ${userName}`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
            {userInitials}
          </div>
          <ChevronDown className="h-4 w-4 text-text-muted" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
