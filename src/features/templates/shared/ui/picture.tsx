import Image from 'next/image';
import type { ImageRef } from '../../types';

/**
 * Every template image goes through next/image with explicit `sizes` (MP §10), so phones get
 * small AVIF/WebP files. A blurred preview fills the space until the image arrives (no layout shift).
 */
export function Picture({
  image,
  sizes,
  className,
  priority = false,
  fill = false,
}: {
  image: ImageRef;
  sizes: string;
  className?: string;
  priority?: boolean;
  fill?: boolean;
}) {
  const shared = {
    src: image.src,
    sizes,
    ...(className ? { className } : {}),
    ...(priority ? { priority: true } : { loading: 'lazy' as const }),
    ...(image.lqip ? { placeholder: 'blur' as const, blurDataURL: image.lqip } : {}),
  };
  return fill ? (
    <Image {...shared} alt={image.alt} fill />
  ) : (
    <Image {...shared} alt={image.alt} width={image.width} height={image.height} />
  );
}
