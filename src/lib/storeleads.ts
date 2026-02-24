/**
 * StoreLeads API client.
 * Docs: https://storeleads.app/api#resources-domains-retrieve
 */

const STORELEADS_BASE = "https://storeleads.app/json/api/v1/all/domain";

export interface StoreLeadsDomain {
  country_code?: string;
  icon?: string;
  platform?: string;
  merchant_name?: string;
  tld1?: string;
  description?: string;
  estimated_sales?: {
    yearly?: number;
  };
  employee_count?: number;
}

interface StoreLeadsResponse {
  domain: StoreLeadsDomain;
}

/**
 * Fetch domain data from the StoreLeads API.
 * @param domain - The domain to look up (e.g. "example.com")
 * @returns The domain data or null if not found / on error.
 */
export async function fetchDomain(
  domain: string,
): Promise<StoreLeadsDomain | null> {
  const apiKey = process.env.STORELEADS_API_KEY;
  if (!apiKey) {
    console.error("[StoreLeads] STORELEADS_API_KEY is not set");
    return null;
  }

  const url = `${STORELEADS_BASE}/${encodeURIComponent(domain)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (res.status === 404) {
    console.warn(`[StoreLeads] Domain not found: ${domain}`);
    return null;
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    console.warn(
      `[StoreLeads] Rate limited. Retry after ${retryAfter ?? "unknown"}s`,
    );
    return null;
  }

  if (!res.ok) {
    console.error(
      `[StoreLeads] API error ${res.status}: ${await res.text()}`,
    );
    return null;
  }

  const data = (await res.json()) as StoreLeadsResponse;
  return data.domain ?? null;
}
