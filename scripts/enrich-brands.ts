/**
 * Brand enrichment script.
 *
 * Usage:
 *   npx tsx scripts/enrich-brands.ts [domain ...]
 *
 * When called with one or more domain arguments, only those domains are
 * enriched. Without arguments it scans every Product that has a brandUrl
 * but no linked Brand and enriches them all.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchDomain } from "../src/lib/storeleads";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Extract a bare domain from a URL or return the string as-is. */
function toDomain(input: string): string {
  try {
    const u = new URL(input.startsWith("http") ? input : `https://${input}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^www\./, "");
  }
}

async function enrichDomain(domain: string) {
  console.log(`Fetching StoreLeads data for: ${domain}`);

  const data = await fetchDomain(domain);
  if (!data) {
    console.log(`  ↳ No data returned, skipping.`);
    return null;
  }

  const brand = await prisma.brand.upsert({
    where: { domain },
    update: {
      countryCode: data.country_code ?? null,
      icon: data.icon ?? null,
      platform: data.platform ?? null,
      merchantName: data.merchant_name ?? null,
      tld1: data.tld1 ?? null,
      description: data.description ?? null,
      estimatedSalesYearly: data.estimated_sales?.yearly ?? null,
      employeeCount: data.employee_count ?? null,
    },
    create: {
      domain,
      countryCode: data.country_code ?? null,
      icon: data.icon ?? null,
      platform: data.platform ?? null,
      merchantName: data.merchant_name ?? null,
      tld1: data.tld1 ?? null,
      description: data.description ?? null,
      estimatedSalesYearly: data.estimated_sales?.yearly ?? null,
      employeeCount: data.employee_count ?? null,
    },
  });

  console.log(
    `  ↳ Upserted Brand "${brand.merchantName ?? domain}" (${brand.id})`,
  );
  return brand;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Enrich specific domains passed as arguments
    for (const raw of args) {
      const domain = toDomain(raw);
      const brand = await enrichDomain(domain);
      if (brand) {
        // Link any products whose brandUrl matches this domain
        await prisma.product.updateMany({
          where: {
            brandUrl: { contains: domain },
            brandId: null,
          },
          data: { brandId: brand.id },
        });
      }
    }
  } else {
    // Auto-discover: find products with a brandUrl but no linked brand
    const products = await prisma.product.findMany({
      where: {
        brandUrl: { not: null },
        brandId: null,
      },
      select: { id: true, brandUrl: true, brand: true },
    });

    const seen = new Set<string>();
    for (const product of products) {
      if (!product.brandUrl) continue;
      const domain = toDomain(product.brandUrl);
      if (seen.has(domain)) continue;
      seen.add(domain);

      const brand = await enrichDomain(domain);
      if (brand) {
        await prisma.product.updateMany({
          where: {
            brandUrl: { contains: domain },
            brandId: null,
          },
          data: { brandId: brand.id },
        });
      }

      // Respect rate limits — 200 ms between calls
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
