import { Badge } from "@/components/ui/badge";
import { featuredSearches } from "@/lib/featured-searches";

export function FeaturedLinks() {
  return (
    <div className="mt-8 rounded-lg border bg-card p-4">
      <p className="text-sm font-medium mb-3">
        Browse our curated lists while you wait:
      </p>
      <div className="flex flex-wrap gap-2">
        {featuredSearches.map((fs) => (
          <a
            key={fs.slug}
            href={`/lists/${fs.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-accent text-xs"
            >
              {fs.query}
            </Badge>
          </a>
        ))}
      </div>
    </div>
  );
}
