/**
 * The BennyFit mark.
 *
 * An original angular composition: two bold parallel shards rising to the right with a
 * small detached shard above, set in a rounded badge. The angular, slashed geometry is
 * the influence; the shapes are drawn here rather than borrowed.
 *
 * Sharp inside a soft container is the whole idea — a friendly surface over rules that
 * are anything but. The badge carries the mint; the glyph is cut out of it in ink,
 * because mint on white is far too light to read as type.
 */

export function BennyMark({
  size = 28,
  variant = 'badge',
  title,
}: {
  size?: number;
  variant?: 'badge' | 'glyph';
  title?: string;
}) {
  const shards = (
    <>
      <path d="M5 26.5 L15.2 7 L21 7 L10.8 26.5 Z" />
      <path d="M14.2 26.5 L24.4 7 L30 7 L19.8 26.5 Z" opacity="0.58" />
      <path d="M24.5 1.5 L30 1.5 L27.8 5.6 L22.3 5.6 Z" />
    </>
  );

  if (variant === 'glyph') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="currentColor"
        role={title ? 'img' : 'presentation'}
        aria-hidden={title ? undefined : true}
        aria-label={title}
      >
        {title && <title>{title}</title>}
        {shards}
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <rect width="32" height="32" rx="9" fill="var(--mint)" />
      <g fill="var(--ink)" transform="translate(16 16) scale(0.74) translate(-16 -16)">
        {shards}
      </g>
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <>
      <BennyMark size={size} title="BennyFit" />
      <span>
        Benny<span style={{ color: 'var(--mint-deep)' }}>Fit</span>
      </span>
    </>
  );
}

/** Benny's avatar, for the places Benny speaks. */
export function BennyAvatar({ size = 26 }: { size?: number }) {
  return <BennyMark size={size} variant="badge" />;
}
