// ─── Pipeline Types ───────────────────────────────────────────────────────────

export interface ParsedIntent {
  useCase: string;
  constraints: string[];
  mustHaves: string[];
  niceToHaves: string[];
}

export interface CandidateProduct {
  brand: string;
  model: string;
  variant?: string;
  category: string;
  mentionCount: number;
  sources: string[];
}

export interface ScoringDimensions {
  queryFit: number;       // 0-100
  redditEndorsement: number;
  socialProofCoverage: number;
  riskScore: number;
  confidenceScore: number;
  overall: number;
}

export interface RankedProduct {
  productId: string;
  rank: number;
  scores: ScoringDimensions;
  rationale: string;
  citations: CitationRef[];
}

export interface CitationRef {
  sourceId: string;
  url: string;
  platform: "reddit" | "tiktok" | "trustpilot" | "web" | "amazon" | "sephora";
  title?: string;
  snippet?: string;
  capturedAt: string;
}

// ─── Retriever Types ──────────────────────────────────────────────────────────

export interface RetrievedMention {
  platform: "reddit" | "tiktok" | "trustpilot" | "web" | "amazon" | "sephora";
  url: string;
  title?: string;
  authorHandle?: string;
  createdAt?: string;
  text: string;
  productRef?: string; // raw product reference found in text
}

export interface RedditThread {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  score: number;
  numComments: number;
  createdUtc: number;
  selfText: string;
  comments: RedditComment[];
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  createdUtc: number;
}

export interface TrustpilotData {
  brandName: string;
  rating: number;
  reviewCount: number;
  url: string;
  capturedAt: string;
  scope: "brand" | "product";
}

// ─── Evidence Types ───────────────────────────────────────────────────────────

export interface ExtractedEvidence {
  productRef: string;
  sentiment: "positive" | "neutral" | "negative";
  themes: string[];
  claimTags: string[];
  quote: string;
  sourceUrl: string;
  platform: "reddit" | "tiktok" | "trustpilot" | "web" | "amazon" | "sephora";
}

// ─── Brand Types ──────────────────────────────────────────────────────────────

export interface BrandInfo {
  merchantName: string;
  domain: string;
  description?: string;
  icon?: string;
  countryCode?: string;
  platform?: string;
  estimatedSalesYearly?: number;
  employeeCount?: number;
}

// ─── Page Generation Types

export interface ProductPageData {
  product: {
    brand: string;
    model: string;
    slug: string;
    category: string;
    images: string[];
    specs: Record<string, string>;
    score: number;
    bestForTags: string[];
    brandUrl?: string;
    price?: number;
    buyUrl?: string;
    brandInfo?: BrandInfo;
  };
  verdict: {
    forWhom: string[];
    notForWhom: string[];
  };
  socialSentiment: {
    themes: { name: string; sentiment: string; mentionCount: number }[];
    pros: string[];
    cons: string[];
  };
  tiktok: {
    available: boolean;
    themes: string[];
    topAngles: string[];
    sourcePosts: { url: string; description: string }[];
  };
  reddit: {
    available: boolean;
    threadClusters: { theme: string; threads: { url: string; title: string; quote: string }[] }[];
    commonComplaints: string[];
    defendedBenefits: string[];
  };
  trustpilot: {
    available: boolean;
    rating?: number;
    reviewCount?: number;
    scope?: "brand" | "product";
    capturedAt?: string;
    url?: string;
  };
  sources: CitationRef[];
}

export interface ResultsPageData {
  queryId: string;
  rawQuery: string;
  parsedIntent: ParsedIntent;
  candidateCount: number;
  methodology?: string;
  buyingAdvice?: string;
  top10: {
    rank: number;
    product: {
      brand: string;
      model: string;
      slug: string;
      category: string;
      imageUrl?: string;
      brandUrl?: string;
      price?: number;
      buyUrl?: string;
      brandInfo?: BrandInfo;
    };
    summary: string;
    tagline: string;
    rankLabel?: string;
    pros: string[];
    cons: string[];
    fitCriteria: string[];
    redditEvidence: { quote: string; url: string }[];
    confidenceLevel: "high" | "medium" | "low";
    platformCoverage: Record<string, "high" | "medium" | "low" | "none">;
    sourceCount: number;
    scores: ScoringDimensions;
    sources: CitationRef[];
  }[];
}

// ─── Session Types ────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "USER" | "ADMIN";
}
