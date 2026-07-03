// Renders the contextSnippet's tiny markdown subset (only **bold**) without
// pulling in a markdown library. Takes a ref so the swipe screen can detect
// clamping and show the expand affordance.
export function Snippet({
  markdown,
  className,
  ref,
}: {
  markdown: string;
  className?: string;
  ref?: React.Ref<HTMLParagraphElement>;
}) {
  const parts = markdown.split("**");
  return (
    <p ref={ref} className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}
