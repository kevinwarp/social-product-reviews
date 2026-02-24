import type { Metadata } from "next";
import { PipelineStatus } from "@/components/pipeline-status";
import { SearchBox } from "@/components/search-box";
import { ReviewLayout } from "@/components/review-layout";
import { generateResultsPageData } from "@/lib/generators/results-page";
import { prisma } from "@/lib/db";

interface ResultsPageProps {
  params: Promise<{ queryId: string }>;
}

export async function generateMetadata({ params }: ResultsPageProps): Promise<Metadata> {
  const { queryId } = await params;
  const query = await prisma.query.findUnique({
    where: { id: queryId },
    select: { rawQuery: true, status: true },
  });

  if (!query) return { title: "Results Not Found" };

  return {
    title: `Best ${query.rawQuery} — Social Product Reviews`,
    description: `We analyzed 100+ products to find the best ${query.rawQuery}. Rankings based on Reddit, TikTok, Trustpilot, and review site analysis.`,
    openGraph: {
      title: `Best ${query.rawQuery}`,
      description: `See which products real people recommend for "${query.rawQuery}".`,
    },
  };
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { queryId } = await params;

  // Check query status
  const query = await prisma.query.findUnique({
    where: { id: queryId },
    select: { status: true, rawQuery: true },
  });

  if (!query) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Query not found</h1>
        <p className="text-muted-foreground mt-2">This search doesn&apos;t exist or has been removed.</p>
      </div>
    );
  }

  // If still processing, show polling status
  if (query.status === "PENDING" || query.status === "PROCESSING") {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Searching: &quot;{query.rawQuery}&quot;</h1>
        </div>
        <PipelineStatus queryId={queryId} />
      </div>
    );
  }

  // Fetch completed results
  const data = await generateResultsPageData(queryId);

  if (!data || data.top10.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <SearchBox placeholder="Try a different search..." />
        </div>
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold">No results found</h1>
          <p className="text-muted-foreground mt-2">
            We couldn&apos;t find enough products for &quot;{query.rawQuery}&quot;. Try a broader search.
          </p>
        </div>
      </div>
    );
  }

  return <ReviewLayout data={data} />;
}
