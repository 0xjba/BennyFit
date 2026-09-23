/**
 * The BennyFit mark: Benny.
 *
 * A tilted head with a flick at the crown and a single slanted eye, set in a rounded
 * badge. The family it belongs to is the angular, one-eyed assistant mascot; the
 * silhouette, the flick and the proportions are drawn here rather than borrowed from
 * any of them.
 *
 * The eye is a hole in the head rather than a shape on top of it, so the glyph carries
 * its own contrast: in the badge the mint shows through, and anywhere else the mark
 * takes the colour it is given and the eye stays legible.
 */

const HEAD =
  'M10.2 7.8 L7.8 3.6 L14.1 5.3 C14.9 5.1 15.7 5 16.5 5 C22 5 26.3 9.3 26.3 15 ' +
  'C26.3 21.5 21.6 26.9 15.5 26.9 C10.1 26.9 6 22.6 6 17 C6 13.4 7.7 10.2 10.2 7.8 Z';

const EYE =
  'M12.1 16.4 L20.9 12.6 C21.5 12.3 22.1 12.6 22.3 13.2 C22.6 13.8 22.3 14.5 21.7 14.7 ' +
  'L12.9 18.5 C12.3 18.8 11.7 18.5 11.4 17.9 C11.2 17.3 11.5 16.6 12.1 16.4 Z';

export function BennyMark({
  size = 28,
  variant = 'badge',
  title,
}: {
  size?: number;
  variant?: 'badge' | 'glyph';
  title?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    role: title ? ('img' as const) : ('presentation' as const),
    'aria-hidden': title ? undefined : true,
    'aria-label': title,
  };

  if (variant === 'glyph') {
    return (
      <svg {...common} fill="currentColor">
        {title && <title>{title}</title>}
        <path d={`${HEAD} ${EYE}`} fillRule="evenodd" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      {title && <title>{title}</title>}
      <rect width="32" height="32" rx="9" fill="var(--mint)" />
      <path d={`${HEAD} ${EYE}`} fillRule="evenodd" fill="var(--ink)" />
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
