// apps/web/components/visibility/report/VisibilityInsightCards.tsx
import { OuterCard } from "./VisibilityReportPrimitives";
import { BRAND } from "./VisibilityReportUtils";

function InsightCard({
  title,
  content,
  bullets,
  iconSrc,
}: {
  title: string;
  content?: string;
  bullets?: string[];
  iconSrc?: string;
}) {
  return (
    <OuterCard className="p-4 h-full">
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className="h-14 w-14 object-contain"
          onError={(e: any) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}

      <div className="mt-3 text-[15px] font-semibold">{title}</div>

      {content ? (
        <div className="mt-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {content}
        </div>
      ) : null}

      {bullets && bullets.length ? (
        <ul className="mt-3 space-y-2 text-[13px] leading-7" style={{ color: BRAND.text }}>
          {bullets.map((item, idx) => (
            <li key={idx} className="flex gap-2">
              <span style={{ color: BRAND.teal }}>+</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </OuterCard>
  );
}

export default function VisibilityInsightCards({
  marketReality,
  opportunity,
  nextMove,
}: {
  marketReality: {
    title: string;
    content?: string;
    bullets?: string[];
    iconSrc?: string;
  };
  opportunity: {
    title: string;
    content?: string;
    bullets?: string[];
    iconSrc?: string;
  };
  nextMove: {
    title: string;
    content?: string;
    bullets?: string[];
    iconSrc?: string;
  };
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 items-stretch">
      <InsightCard {...marketReality} />
      <InsightCard {...opportunity} />
      <InsightCard {...nextMove} />
    </div>
  );
}