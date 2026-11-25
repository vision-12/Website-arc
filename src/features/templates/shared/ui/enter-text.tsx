/**
 * Hero entrance, once on load: each word rises out of its own mask, a few milliseconds after the
 * one before (at most 240ms from first to last). Plain inline text for assistive technology;
 * nothing moves under prefers-reduced-motion.
 */
export function EnterText({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const step = words.length > 1 ? Math.min(30, 240 / (words.length - 1)) : 0;
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          <span className="tpl-enter-line">
            <span style={{ animationDelay: `${Math.round(i * step)}ms` }}>{word}</span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </>
  );
}
