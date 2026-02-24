import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface PlatformSectionProps {
  platform: string;
  available: boolean;
  children: React.ReactNode;
}

export function PlatformSection({ platform, available, children }: PlatformSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        {platform}
        <Badge variant="outline" className="text-xs">Social</Badge>
      </h2>
      <Card>
        {available ? (
          <CardContent className="pt-6">{children}</CardContent>
        ) : (
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">No {platform} data found for this product.</p>
            </div>
          </CardContent>
        )}
      </Card>
    </section>
  );
}
