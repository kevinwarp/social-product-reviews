import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewLayout } from "@/components/review-layout";
import { getFeaturedSearch, getAllFeaturedSlugs } from "@/lib/featured-searches";
import { prisma } from "@/lib/db";
import { scrapeProductImage } from "@/lib/scraper/product-image";

export const dynamic = "force-dynamic";

// In-memory cache so we don't re-scrape images on every request within the same instance
const imageCache = new Map<string, string | null>();

interface ListPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllFeaturedSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ListPageProps): Promise<Metadata> {
  const { slug } = await params;
  const featured = getFeaturedSearch(slug);

  if (!featured) return { title: "List Not Found" };

  return {
    title: `Best ${featured.data.rawQuery} — Social Product Reviews`,
    description: `We analyzed ${featured.data.candidateCount}+ products to find the best ${featured.data.rawQuery}. Rankings based on Reddit, TikTok, Trustpilot, and review site analysis.`,
    openGraph: {
      title: `Best ${featured.data.rawQuery}`,
      description: `See which products real people recommend for "${featured.data.rawQuery}".`,
    },
  };
}

export default async function FeaturedListPage({ params }: ListPageProps) {
  const { slug } = await params;
  const featured = getFeaturedSearch(slug);

  if (!featured) {
    notFound();
  }

  // Enrich featured products with images and metadata from the database.
  // Wrapped in try-catch so the page still renders if the DB is unavailable
  // (e.g. during static generation at build time).
  let enrichedData = featured.data;
  try {
    const productSlugs = featured.data.top10.map((item) => item.product.slug);
    const dbProducts = await prisma.product.findMany({
      where: { canonicalSlug: { in: productSlugs } },
      select: {
        canonicalSlug: true,
        images: true,
      },
    });

    if (dbProducts.length > 0) {
      const dbProductMap = new Map(
        dbProducts.map((p) => [p.canonicalSlug, p])
      );

      enrichedData = {
        ...featured.data,
        top10: featured.data.top10.map((item) => {
          const dbProduct = dbProductMap.get(item.product.slug);
          if (!dbProduct) return item;

          const images = (dbProduct.images as string[]) ?? [];
          return {
            ...item,
            product: {
              ...item.product,
              imageUrl: item.product.imageUrl ?? (images.length > 0 ? images[0] : undefined),
            },
          };
        }),
      };
    }
  } catch {
    // DB unavailable — continue with static featured data
  }

  // Scrape images for products that still don't have one
  const needsImages = enrichedData.top10
    .filter((item) => !item.product.imageUrl);

  if (needsImages.length > 0) {
    const imageResults = await Promise.all(
      needsImages.map(async (item) => {
        const cacheKey = item.product.slug;
        if (imageCache.has(cacheKey)) return { slug: cacheKey, url: imageCache.get(cacheKey)! };
        try {
          const url = await scrapeProductImage(item.product.brand, item.product.model);
          imageCache.set(cacheKey, url);
          return { slug: cacheKey, url };
        } catch {
          imageCache.set(cacheKey, null);
          return { slug: cacheKey, url: null };
        }
      })
    );

    const scraped = new Map(imageResults.map((r) => [r.slug, r.url]));
    enrichedData = {
      ...enrichedData,
      top10: enrichedData.top10.map((item) => {
        const url = scraped.get(item.product.slug);
        if (!url) return item;
        return { ...item, product: { ...item.product, imageUrl: url } };
      }),
    };
  }

  return <ReviewLayout data={enrichedData} />;
}
