import { Badge } from "@/components/ui/badge";

interface ConfidenceBadgeProps {
  level: "high" | "medium" | "low";
}

const config = {
  high: { label: "High Confidence", variant: "default" as const, className: "bg-green-600 hover:bg-green-700" },
  medium: { label: "Medium Confidence", variant: "default" as const, className: "bg-yellow-600 hover:bg-yellow-700" },
  low: { label: "Low Confidence", variant: "default" as const, className: "bg-orange-600 hover:bg-orange-700" },
};

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const c = config[level];
  return (
    <Badge variant={c.variant} className={`text-xs ${c.className}`}>
      {c.label}
    </Badge>
  );
}
