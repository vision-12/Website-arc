import Image from 'next/image';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaItem } from '../schema';

/** A square preview for library grids: the photo itself, or a document icon. */
export function MediaThumb({ item, className }: { item: MediaItem; className?: string }) {
  if (item.kind === 'document')
    return (
      <div
        className={cn(
          'flex aspect-square w-full flex-col items-center justify-center gap-2 bg-muted p-2',
          className,
        )}
      >
        <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          PDF
        </span>
      </div>
    );
  return (
    <div className={cn('relative aspect-square w-full overflow-hidden bg-muted', className)}>
      <Image
        src={item.url}
        alt=""
        fill
        sizes="(min-width: 1024px) 200px, 45vw"
        className="object-cover"
        {...(item.lqip ? { placeholder: 'blur' as const, blurDataURL: item.lqip } : {})}
      />
    </div>
  );
}
