import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ReviewHeroProps {
  rawQuery: string;
  candidateCount: number;
  sourceCount: number;
  useCase?: string;
}

export function ReviewHero({
  rawQuery,
  candidateCount,
  sourceCount,
  useCase,
}: ReviewHeroProps) {
  const sectionLinks = [
    { label: "Top Picks", href: "#top-picks" },
    { label: "How We Chose", href: "#methodology" },
    { label: "Full Reviews", href: "#full-reviews" },
    { label: "Compare", href: "#comparison" },
    { label: "Buying Advice", href: "#buying-advice" },
  ];

  return (
    <section className="mb-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Best {rawQuery}
      </h1>
      <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
        We analyzed {candidateCount}+ products and {sourceCount}+ sources from
        Reddit, TikTok, Trustpilot, and review sites to find the best options
        {useCase ? ` for ${useCase}` : ""}.
      </p>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Badge variant="secondary">{candidateCount}+ candidates</Badge>
        <Badge variant="secondary">{sourceCount}+ sources analyzed</Badge>
        <Badge variant="outline">Reddit · TikTok · Trustpilot · Web</Badge>
      </div>

      <Separator className="my-6" />

      {/* Jump-to navigation */}
      <nav className="flex flex-wrap gap-4 text-sm">
        {sectionLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </section>
  );
}
