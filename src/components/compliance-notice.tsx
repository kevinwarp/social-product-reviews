import { Info } from "lucide-react";

interface ComplianceNoticeProps {
  capturedRange?: { earliest: string; latest: string };
  sourceCount: number;
  missingPlatforms?: string[];
}

export function ComplianceNotice({
  capturedRange,
  sourceCount,
  missingPlatforms,
}: ComplianceNoticeProps) {
  return (
    <div className="rounded-md border border-muted bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
      <div className="flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div className="space-y-1">
          {capturedRange && (
            <p>
              Data captured: {capturedRange.earliest}
              {capturedRange.earliest !== capturedRange.latest &&
                ` – ${capturedRange.latest}`}
            </p>
          )}
          <p>Based on {sourceCount} source{sourceCount !== 1 ? "s" : ""} analyzed.</p>
          {missingPlatforms && missingPlatforms.length > 0 && (
            <p>
              Limited coverage: No data from{" "}
              {missingPlatforms.join(", ")}. Results may not reflect the full picture.
            </p>
          )}
          <p>
            Recommendations are AI-generated from public social data and may contain inaccuracies.
            Always verify before purchasing.
          </p>
        </div>
      </div>
    </div>
  );
}
