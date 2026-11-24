import { ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';

export default function AdminForbidden() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="You don't have access to this section"
      description="Your role doesn't include this part of the administration area. Ask your school administrator if you need it."
    />
  );
}
