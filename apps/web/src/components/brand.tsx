import Image from 'next/image';
import { cn } from '@/lib/utils';

/** The round ONYX emblem: gem, road and gold ring. */
export function Emblem({ size = 32, className, priority }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/emblem.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={cn('shrink-0 rounded-full', className)}
    />
  );
}

/**
 * The full wordmark from the brand artwork. It sits on black in the source file, so
 * `lighten` blending lets it float on any dark surface.
 */
export function Wordmark({ height = 28, className, priority }: { height?: number; className?: string; priority?: boolean }) {
  const width = Math.round(height * (480 / 138));
  return (
    <Image
      src="/brand/wordmark.png"
      alt="ONYX"
      width={width}
      height={height}
      priority={priority}
      className={cn('mix-blend-lighten', className)}
      style={{ height, width: 'auto' }}
    />
  );
}
