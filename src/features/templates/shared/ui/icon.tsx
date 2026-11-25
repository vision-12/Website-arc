import {
  Award,
  BookOpen,
  Bus,
  Calendar,
  Clock,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  House,
  MapPin,
  Music,
  Phone,
  School,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { IconKey } from '../section-settings';

const ICONS: Record<IconKey, LucideIcon> = {
  'graduation-cap': GraduationCap,
  school: School,
  'book-open': BookOpen,
  users: Users,
  calendar: Calendar,
  clock: Clock,
  'map-pin': MapPin,
  phone: Phone,
  trophy: Trophy,
  award: Award,
  globe: Globe,
  heart: Heart,
  music: Music,
  flask: FlaskConical,
  bus: Bus,
  home: House,
};

/** Decorative icon for quick facts: the text beside it always carries the meaning. */
export function Icon({ name, className }: { name: IconKey; className?: string }) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden="true" className={className} />;
}
