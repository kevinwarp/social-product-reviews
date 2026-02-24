import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { ExampleQueries } from "@/components/example-queries";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { featuredSearches } from "@/lib/featured-searches";
import { ArrowRight, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const featuredQueries = featuredSearches.map((fs) => ({
  slug: fs.slug,
  query: fs.query,
}));

async function getRecentLists() {
  try {
    return await prisma.query.findMany({
      where: { status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        rawQuery: true,
        createdAt: true,
        rankingResults: {
          select: { candidateCount: true },
          take: 1,
        },
      },
    });
  } catch {
    return [];
  }
}

export default async function Home() {
  const recentLists = await getRecentLists();

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full max-w-4xl px-4 pt-24 pb-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Product Reviews Powered by{" "}
          <span className="text-primary">Real People</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          We analyze Reddit, TikTok, Trustpilot, and 100+ sources to find the best products
          for your specific needs. Every recommendation is backed by transparent social proof.
        </p>

        <div className="mt-10 max-w-2xl mx-auto">
          <SearchBox size="large" placeholder="e.g. headphones that are good for sleeping" />
        </div>

        <ExampleQueries queries={featuredQueries} />
      </section>

      {/* How it works */}
      <section className="w-full max-w-4xl px-4 py-16 border-t">
        <h2 className="text-2xl font-semibold text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg mb-3">1</div>
            <h3 className="font-medium mb-1">Describe What You Need</h3>
            <p className="text-sm text-muted-foreground">Enter a natural language query about the product you&apos;re looking for.</p>
          </div>
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg mb-3">2</div>
            <h3 className="font-medium mb-1">We Analyze 100+ Products</h3>
            <p className="text-sm text-muted-foreground">Our system discovers candidates from Reddit, TikTok, Trustpilot, and review sites.</p>
          </div>
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg mb-3">3</div>
            <h3 className="font-medium mb-1">Get a Transparent Top 10</h3>
            <p className="text-sm text-muted-foreground">Every recommendation includes sources, sentiment analysis, and social proof.</p>
          </div>
        </div>
      </section>

      {/* Recent Lists */}
      <section className="w-full max-w-4xl px-4 py-16 border-t">
        <h2 className="text-2xl font-semibold text-center mb-8">Recently Generated Lists</h2>
        {recentLists.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {recentLists.map((q) => (
              <Link key={q.id} href={`/results/${q.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardContent className="pt-4 pb-4">
                    <p className="font-medium line-clamp-1">{q.rawQuery}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {q.createdAt.toLocaleDateString()}
                      </span>
                      {q.rankingResults[0] && (
                        <span>{q.rankingResults[0].candidateCount}+ candidates</span>
                      )}
                      <ArrowRight className="h-3 w-3 ml-auto" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">No lists generated yet. Try searching for something above!</p>
        )}
      </section>
    </div>
  );
}
