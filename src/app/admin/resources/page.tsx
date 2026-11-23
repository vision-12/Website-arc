import {
  placeholderMetadata,
  SectionPlaceholder,
} from '@/features/admin-shell/components/section-placeholder';

export const metadata = placeholderMetadata('resources');

export default function Page() {
  return <SectionPlaceholder section="resources" />;
}
