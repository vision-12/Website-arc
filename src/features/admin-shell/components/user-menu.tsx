'use client';
import Link from 'next/link';
import { CircleUser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logout } from '@/features/auth/actions';
import { t } from '@/lib/i18n/t';

export function UserMenu({ name, email, roles }: { name: string; email: string; roles: string[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 px-2"
          aria-label={`${t('common.account')}: ${name}`}
        >
          <CircleUser className="size-5" aria-hidden="true" />
          <span className="hidden max-w-40 truncate text-sm sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate">{name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {roles.join(', ')}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/account">Your account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <form action={logout} className="w-full">
            <button type="submit" className="w-full text-left">
              {t('common.signOut')}
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
