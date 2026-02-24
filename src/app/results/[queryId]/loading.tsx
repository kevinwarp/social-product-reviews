import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FeaturedLinks } from "@/components/featured-links";

export default function ResultsLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Search bar skeleton */}
      <Skeleton className="h-10 w-full mb-8" />

      {/* Query info */}
      <Skeleton className="h-8 w-96 mb-2" />
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-56" />
      </div>

      {/* Product cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-28 ml-auto" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-3" />
            <div className="flex gap-1.5 mb-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-16 w-full rounded-md mb-3" />
            <div className="flex gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Featured search links */}
      <FeaturedLinks />
    </div>
  );
}
