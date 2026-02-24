import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface FeaturedQuery {
  slug: string;
  query: string;
}

interface ExampleQueriesProps {
  queries: FeaturedQuery[];
}

export function ExampleQueries({ queries }: ExampleQueriesProps) {
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      <span className="text-sm text-muted-foreground mr-1">Try:</span>
      {queries.map((q) => (
        <Link key={q.slug} href={`/lists/${q.slug}`}>
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-accent text-xs"
          >
            {q.query}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
