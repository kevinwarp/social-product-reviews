import { Card, CardContent } from "@/components/ui/card";
import { SearchBox } from "@/components/search-box";
import { ReviewHero } from "@/components/review-hero";
import { TopPicksGrid } from "@/components/top-picks-grid";
import { ProductReviewCard } from "@/components/product-review-card";
import { ComparisonTable } from "@/components/comparison-table";
import { TableOfContents } from "@/components/table-of-contents";
import { ComplianceNotice } from "@/components/compliance-notice";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList,
  Lightbulb,
} from "lucide-react";
import type { ResultsPageData } from "@/lib/types";

interface ReviewLayoutProps {
  data: Omit<ResultsPageData, "queryId"> & { queryId?: string };
}

export function ReviewLayout({ data }: ReviewLayoutProps) {
  const totalSources = data.top10.reduce(
    (sum, item) => sum + item.sourceCount,
    0,
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Search refinement */}
      <div className="mb-8 max-w-2xl">
        <SearchBox placeholder="Refine your search..." />
      </div>

      {/* Hero */}
      <ReviewHero
        rawQuery={data.rawQuery}
        candidateCount={data.candidateCount}
        sourceCount={totalSources}
        useCase={data.parsedIntent.useCase}
      />

      {/* Mobile TOC (hidden on desktop where the grid sidebar handles it) */}
      <div className="lg:hidden">
        <TableOfContents items={data.top10} />
      </div>

      {/* 2-column layout on desktop */}
      <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-8">
        {/* Main content */}
        <div className="min-w-0">
          {/* Top Picks Grid */}
          <TopPicksGrid picks={data.top10} />

          {/* Methodology */}
          <section id="methodology" className="mb-10 scroll-mt-20">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              How We Chose
            </h2>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {data.methodology ??
                    `We analyzed ${data.candidateCount}+ products by gathering real user opinions from Reddit, TikTok, Trustpilot, and review sites. Products were scored on query fit, social proof coverage, Reddit endorsement strength, and risk factors.`}
                </p>

                {/* Parsed intent details */}
                {(data.parsedIntent.mustHaves.length > 0 ||
                  data.parsedIntent.constraints.length > 0) && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-4">
                    {data.parsedIntent.mustHaves.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                          Must-Haves
                        </h4>
                        <ul className="space-y-1">
                          {data.parsedIntent.mustHaves.map((item) => (
                            <li
                              key={item}
                              className="text-sm text-muted-foreground flex items-center gap-1.5"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.parsedIntent.constraints.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                          Constraints
                        </h4>
                        <ul className="space-y-1">
                          {data.parsedIntent.constraints.map((item) => (
                            <li
                              key={item}
                              className="text-sm text-muted-foreground flex items-center gap-1.5"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <Separator className="mb-10" />

          {/* Full Reviews */}
          <section id="full-reviews" className="mb-10 scroll-mt-20">
            <h2 className="text-2xl font-bold mb-6">Full Reviews</h2>
            {data.top10.map((item) => (
              <ProductReviewCard
                key={item.rank}
                item={item}
                queryId={data.queryId}
              />
            ))}
          </section>

          {/* Comparison Table */}
          <ComparisonTable items={data.top10} />

          {/* Buying Advice */}
          <section id="buying-advice" className="mb-10 scroll-mt-20">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Buying Advice
            </h2>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {data.buyingAdvice ??
                    `When shopping for ${data.parsedIntent.useCase || data.rawQuery}, consider your specific needs and budget. Our top picks balance real-world user satisfaction with objective performance metrics.`}
                </p>

                {data.parsedIntent.niceToHaves.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      Nice-to-Have Features
                    </h4>
                    <ul className="flex flex-wrap gap-2">
                      {data.parsedIntent.niceToHaves.map((item) => (
                        <li
                          key={item}
                          className="text-xs rounded-full border px-2.5 py-0.5 text-muted-foreground"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Compliance Notice */}
          <ComplianceNotice
            sourceCount={totalSources}
            missingPlatforms={[]}
          />
        </div>

        {/* Desktop sidebar TOC */}
        <div className="hidden lg:block">
          <TableOfContents items={data.top10} />
        </div>
      </div>
    </div>
  );
}
