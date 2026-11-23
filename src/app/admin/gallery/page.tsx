import {
  placeholderMetadata,
  SectionPlaceholder,
} from '@/features/admin-shell/components/section-placeholder';

export const metadata = placeholderMetadata('gallery');

export default function Page() {
  return <SectionPlaceholder section="gallery" />;
}
