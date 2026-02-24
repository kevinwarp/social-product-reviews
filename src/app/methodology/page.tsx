import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function MethodologyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">How We Rank</h1>
      <p className="text-muted-foreground mb-8">
        Transparency is at the core of Social Product Reviews. Here&apos;s exactly how we discover, evaluate, and rank products.
      </p>

      <Separator className="mb-8" />

      {/* Step 1 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">1. Query Understanding</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When you enter a query like &quot;headphones good for sleeping,&quot; we use AI to parse your intent — identifying use case,
          constraints (e.g., side-sleeper friendly, low profile), must-haves, and nice-to-haves. We then expand your query
          into 10-15 search terms to maximize discovery.
        </p>
      </section>

      {/* Step 2 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">2. Candidate Discovery (100+ Products)</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We search across Reddit threads, review roundup sites, community forums, TikTok, and Trustpilot to identify
          100+ candidate products. Every product mention is tracked back to its source.
        </p>
      </section>

      {/* Step 3 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">3. Entity Resolution</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Different sources refer to the same product in different ways. We normalize product names and merge
          variants (e.g., &quot;Sony WF-1000XM5&quot; and &quot;Sony XM5&quot;) to get accurate mention counts and evidence.
        </p>
      </section>

      {/* Step 4 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">4. Evidence Extraction</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          For each product, we analyze mentions across platforms to extract sentiment (positive/neutral/negative),
          themes (comfort, durability, sound quality), and specific claims. Every piece of evidence is linked to its source.
        </p>
      </section>

      {/* Step 5: Scoring */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">5. Scoring &amp; Ranking</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Each candidate is scored across multiple dimensions:
        </p>
        <div className="grid gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Query Fit (0-100)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">How well the product matches your specific requirements.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Reddit Endorsement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Mention volume, sentiment, and &quot;I use this for X&quot; statements.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Social Proof Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Volume and diversity of mentions across platforms.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Risk Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Recurrent failure modes — breakage, discomfort, connectivity issues.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Confidence Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Based on source volume, agreement between sources, and recency.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Transparency */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">6. Full Transparency</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every product page includes the complete list of sources used, with URLs, dates accessed, and platform
          attribution. We clearly label when data is limited (e.g., &quot;No TikTok data found&quot;) and mark coverage levels
          for each platform.
        </p>
      </section>
    </div>
  );
}
