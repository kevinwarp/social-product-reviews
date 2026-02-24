import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FeaturedLinks } from "@/components/featured-links";

export default function ProductLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Hero */}
      <section className="mb-8">
        <div className="flex items-start gap-6">
          <Skeleton className="h-24 w-24 rounded-lg shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-9 w-72 mb-2" />
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        </div>
      </section>

      <Separator className="mb-8" />

      {/* Verdict */}
      <Skeleton className="h-7 w-24 mb-4" />
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-4 w-full mb-1.5" />
              <Skeleton className="h-4 w-3/4 mb-1.5" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <div>
              <Skeleton className="h-5 w-28 mb-3" />
              <Skeleton className="h-4 w-full mb-1.5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Sentiment */}
      <Skeleton className="h-7 w-40 mb-4" />
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-24" />
            ))}
          </div>
          <Skeleton className="h-4 w-full mb-1.5" />
          <Skeleton className="h-4 w-5/6 mb-1.5" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>

      {/* Platform sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-8">
          <Skeleton className="h-7 w-32 mb-4" />
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Featured search links */}
      <FeaturedLinks />
    </div>
  );
}
