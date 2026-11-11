/** Cosmetic portrait. It does not affect quests, XP, or combat. */

const SRC = {
  izzy: { webp: '/avatars/izzy.webp', png: '/avatars/izzy.png' },
  connor: { webp: '/avatars/connor.webp', png: '/avatars/connor.png' },
} as const;

export function PixelAvatar({
  who,
  alt,
  size = 72,
}: {
  who: keyof typeof SRC;
  alt: string;
  size?: number;
}) {
  const src = SRC[who];
  return (
    <picture>
      <source srcSet={src.webp} type="image/webp" />
      <img className="pixel-avatar" src={src.png} width={size} height={size} alt={alt} />
    </picture>
  );
}
