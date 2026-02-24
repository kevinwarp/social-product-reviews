import Link from "next/link";
import { Search } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-sm mb-3">
              <Search className="h-4 w-4" />
              Social Product Reviews
            </Link>
            <p className="text-xs text-muted-foreground">
              Discover the best products through real social proof.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Search
                </Link>
              </li>
              <li>
                <Link href="/methodology" className="hover:text-foreground transition-colors">
                  How We Rank
                </Link>
              </li>
            </ul>
          </div>

          {/* Data Sources */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Data Sources</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Reddit</li>
              <li>Trustpilot</li>
              <li>TikTok</li>
              <li>Review Sites</li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold mb-3">About</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/methodology" className="hover:text-foreground transition-colors">
                  Methodology
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Social Product Reviews.
            Recommendations are AI-generated from public social data and may contain inaccuracies.
          </p>
        </div>
      </div>
    </footer>
  );
}
