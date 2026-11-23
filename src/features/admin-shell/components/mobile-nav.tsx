'use client';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { t } from '@/lib/i18n/t';
import type { AdminSectionKey } from '../sections';
import { SidebarNav } from './sidebar-nav';

export function MobileNav({ keys }: { keys: readonly AdminSectionKey[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('common.openMenu')}>
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        closeLabel={t('common.close')}
        className="admin-sidebar bg-[var(--admin-sidebar)] p-4 text-[var(--admin-sidebar-foreground)] [&>button]:text-white"
      >
        <SheetTitle className="px-3 pt-2 pb-4 text-white">{t('admin.title')}</SheetTitle>
        <SheetDescription className="sr-only">{t('admin.navLabel')}</SheetDescription>
        <nav aria-label={t('admin.navLabel')} className="overflow-y-auto">
          <SidebarNav keys={keys} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
