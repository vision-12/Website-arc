import {
  placeholderMetadata,
  SectionPlaceholder,
} from '@/features/admin-shell/components/section-placeholder';

export const metadata = placeholderMetadata('admissions');

export default function Page() {
  return <SectionPlaceholder section="admissions" />;
}
