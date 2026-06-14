import { Frown, Meh, Smile } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { sentimentLabel, sentimentTone } from "@/components/conversations/shared";

// Server-component safe. Post-call sentiment as a tinted badge with a face icon.
//   positive → money + Smile, neutral → neutral + Meh, negative → danger + Frown
export function SentimentBadge({
  sentiment,
  showLabel = true,
}: {
  sentiment: string;
  showLabel?: boolean;
}) {
  const Icon =
    sentiment === "positive" ? Smile : sentiment === "negative" ? Frown : Meh;
  return (
    <Badge tone={sentimentTone(sentiment)} className={showLabel ? undefined : "px-1.5"}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel ? sentimentLabel(sentiment) : null}
    </Badge>
  );
}
