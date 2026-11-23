import {
  placeholderMetadata,
  SectionPlaceholder,
} from '@/features/admin-shell/components/section-placeholder';

export const metadata = placeholderMetadata('events');

export default function Page() {
  return <SectionPlaceholder section="events" />;
}
