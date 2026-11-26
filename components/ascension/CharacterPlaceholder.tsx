/** Painted immediately. Home does not wait on sprite assets or gear art. */
export function CharacterPlaceholder({ name }: { name: string }) {
  const initial = (name.trim().slice(0, 1) || 'A').toUpperCase();
  return (
    <div className="character-placeholder" role="img" aria-label={name ? `${name}, character placeholder` : 'Character placeholder'}>
      <span aria-hidden="true">{initial}</span>
    </div>
  );
}
