import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { ResultsPageData } from "@/lib/types";

type ComparisonItem = ResultsPageData["top10"][number];

interface ComparisonTableProps {
  items: ComparisonItem[];
}

export function ComparisonTable({ items }: ComparisonTableProps) {
  return (
    <section id="comparison" className="mb-10 scroll-mt-20">
      <h2 className="text-2xl font-bold mb-6">Compare All Picks</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left font-medium p-3 sticky left-0 bg-muted/50 min-w-[50px]">
                #
              </th>
              <th className="text-left font-medium p-3 min-w-[180px]">
                Product
              </th>
              <th className="text-left font-medium p-3 min-w-[100px]">
                Category
              </th>
              <th className="text-left font-medium p-3 min-w-[80px]">
                Price
              </th>
              <th className="text-left font-medium p-3 min-w-[120px]">
                Confidence
              </th>
              <th className="text-left font-medium p-3 min-w-[150px]">
                Key Strengths
              </th>
              <th className="text-right font-medium p-3 min-w-[80px]">
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.rank}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="p-3 font-bold sticky left-0 bg-background">
                  {item.rank}
                </td>
                <td className="p-3">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {item.product.brand}
                    </span>
                    <Link
                      href={`/products/${item.product.slug}`}
                      className="block font-medium hover:underline"
                    >
                      {item.product.model}
                    </Link>
                    {item.rankLabel && (
                      <Badge
                        variant={item.rank === 1 ? "default" : "secondary"}
                        className="text-[10px] mt-1"
                      >
                        {item.rankLabel}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">
                  {item.product.category}
                </td>
                <td className="p-3 font-medium">
                  {item.product.price != null
                    ? `$${item.product.price.toFixed(2)}`
                    : "—"}
                </td>
                <td className="p-3">
                  <ConfidenceBadge level={item.confidenceLevel} />
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {item.fitCriteria.slice(0, 2).map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="text-[10px]"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-right text-muted-foreground">
                  {item.sourceCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
