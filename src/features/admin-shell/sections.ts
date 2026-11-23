import {
  Activity,
  BookOpen,
  CalendarDays,
  FileText,
  FolderDown,
  GraduationCap,
  Image,
  Images,
  LayoutDashboard,
  Mail,
  Newspaper,
  Palette,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';
import type { MessageKey } from '@/lib/i18n/t';

export const ADMIN_SECTION_KEYS = [
  'overview',
  'pages',
  'news',
  'admissions',
  'academics',
  'events',
  'gallery',
  'staff',
  'resources',
  'enquiries',
  'media',
  'appearance',
  'users',
  'settings',
  'activity',
] as const;
export type AdminSectionKey = (typeof ADMIN_SECTION_KEYS)[number];

export interface AdminSection {
  key: AdminSectionKey;
  labelKey: MessageKey;
  href: Route;
  icon: LucideIcon;
  /** Permission needed to see the section (spec §2). `null` = any signed-in staff member. */
  permission: `${string}.view` | null;
}

/** PRD §6.2 order. */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    key: 'overview',
    labelKey: 'admin.sections.overview',
    href: '/admin/overview',
    icon: LayoutDashboard,
    permission: null,
  },
  {
    key: 'pages',
    labelKey: 'admin.sections.pages',
    href: '/admin/pages',
    icon: FileText,
    permission: 'pages.view',
  },
  {
    key: 'news',
    labelKey: 'admin.sections.news',
    href: '/admin/news',
    icon: Newspaper,
    permission: 'news.view',
  },
  {
    key: 'admissions',
    labelKey: 'admin.sections.admissions',
    href: '/admin/admissions',
    icon: GraduationCap,
    permission: 'admissions.view',
  },
  {
    key: 'academics',
    labelKey: 'admin.sections.academics',
    href: '/admin/academics',
    icon: BookOpen,
    permission: 'academics.view',
  },
  {
    key: 'events',
    labelKey: 'admin.sections.events',
    href: '/admin/events',
    icon: CalendarDays,
    permission: 'events.view',
  },
  {
    key: 'gallery',
    labelKey: 'admin.sections.gallery',
    href: '/admin/gallery',
    icon: Images,
    permission: 'gallery.view',
  },
  {
    key: 'staff',
    labelKey: 'admin.sections.staff',
    href: '/admin/staff',
    icon: UsersRound,
    permission: 'staff.view',
  },
  {
    key: 'resources',
    labelKey: 'admin.sections.resources',
    href: '/admin/resources',
    icon: FolderDown,
    permission: 'resources.view',
  },
  {
    key: 'enquiries',
    labelKey: 'admin.sections.enquiries',
    href: '/admin/enquiries',
    icon: Mail,
    permission: 'enquiries.view',
  },
  {
    key: 'media',
    labelKey: 'admin.sections.media',
    href: '/admin/media',
    icon: Image,
    permission: 'media.view',
  },
  {
    key: 'appearance',
    labelKey: 'admin.sections.appearance',
    href: '/admin/appearance',
    icon: Palette,
    permission: 'appearance.view',
  },
  {
    key: 'users',
    labelKey: 'admin.sections.users',
    href: '/admin/users',
    icon: Users,
    permission: 'users.view',
  },
  {
    key: 'settings',
    labelKey: 'admin.sections.settings',
    href: '/admin/settings',
    icon: Settings,
    permission: 'settings.view',
  },
  {
    key: 'activity',
    labelKey: 'admin.sections.activity',
    href: '/admin/activity',
    icon: Activity,
    permission: 'activity.view',
  },
];

/**
 * The sidebar shows only sections the user may view (PRD §6.2). This is a UI convenience;
 * the server re-checks every permission. Phase 1 has no auth, so callers pass 'all'.
 */
export function visibleSections(granted: 'all' | ReadonlySet<string>): AdminSection[] {
  return ADMIN_SECTIONS.filter(
    (s) => granted === 'all' || s.permission === null || granted.has(s.permission),
  );
}

export function findSection(key: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find((s) => s.key === key);
}
