// Renders the contextSnippet's tiny markdown subset (only **bold**) without
// pulling in a markdown library.
export function Snippet({ markdown, className }: { markdown: string; className?: string }) {
  const parts = markdown.split("**");
  return (
    <p className={className}>
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
