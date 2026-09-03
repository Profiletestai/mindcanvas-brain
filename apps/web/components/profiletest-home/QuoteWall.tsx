import type { Quote } from "@/lib/profiletest-home/quotes";
import { quoteWall, wallCiteLine } from "@/lib/profiletest-home/quotes";

type QuoteWallProps = {
  /** Visual ground. Light = breath band; dark = dense proof stage. */
  tone?: "light" | "dark";
  /** Override the default curated list. */
  quotes?: Quote[];
  className?: string;
};

/** Spread quotes across N columns (round-robin) so each lane feels full. */
function splitColumns(quotes: Quote[], columns: number): Quote[][] {
  const cols: Quote[][] = Array.from({ length: columns }, () => []);
  quotes.forEach((q, i) => {
    cols[i % columns].push(q);
  });
  return cols;
}

function QuoteFigure({ quote }: { quote: Quote }) {
  return (
    <figure className="quote-wall__figure">
      <blockquote className="quote-wall__quote">
        <p>&ldquo;{quote.quote}&rdquo;</p>
      </blockquote>
      <figcaption className="quote-wall__person">
        <cite className="quote-wall__cite">{wallCiteLine(quote)}</cite>
      </figcaption>
    </figure>
  );
}

function QuoteLane({
  quotes,
  laneClass,
  readable,
}: {
  quotes: Quote[];
  laneClass: string;
  /** First list stays in the a11y tree when true. */
  readable: boolean;
}) {
  return (
    <div className={`quote-wall__lane ${laneClass}`}>
      <div className="quote-wall__viewport">
        <div className="quote-wall__track">
          <ul className="quote-wall__stack" {...(readable ? {} : { "aria-hidden": true })}>
            {quotes.map((q) => (
              <li key={q.id} className="quote-wall__item">
                <QuoteFigure quote={q} />
              </li>
            ))}
          </ul>
          <ul className="quote-wall__stack" aria-hidden="true">
            {quotes.map((q) => (
              <li key={`${q.id}-dup`} className="quote-wall__item">
                <QuoteFigure quote={q} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Dense credibility band: short quotes, anonymised initials + generic role.
 * Three columns glide downward at different slow speeds (CSS). Reduced motion
 * falls back to a static grid. Text-only (no faces). Shared across home,
 * demo-ged, plan, products, neuroscience, /app.
 */
export default function QuoteWall({
  tone = "light",
  quotes = quoteWall,
  className = "",
}: QuoteWallProps) {
  if (!quotes.length) return null;

  const columns = splitColumns(quotes, 3);
  const classes = ["quote-wall", `quote-wall--${tone}`, className].filter(Boolean).join(" ");

  return (
    <section className={classes} aria-labelledby="quote-wall-title">
      <div className="wrap">
        <header className="quote-wall__head">
          <p className="quote-wall__eyebrow">From the field</p>
          <h2 className="quote-wall__title" id="quote-wall-title">
            What our users&nbsp;say
          </h2>
        </header>

        {/* Mobile: one full lane. Desktop: three staggered speeds. */}
        <div className="quote-wall__lanes quote-wall__lanes--single" aria-label="User quotes">
          <QuoteLane quotes={quotes} laneClass="quote-wall__lane--1" readable />
        </div>

        <div className="quote-wall__lanes quote-wall__lanes--multi" aria-label="User quotes">
          {columns.map((col, colIndex) => (
            <QuoteLane
              key={`lane-${colIndex}`}
              quotes={col}
              laneClass={`quote-wall__lane--${colIndex + 1}`}
              readable
            />
          ))}
        </div>

        {/* Static grid for reduced-motion users. */}
        <ul className="quote-wall__grid quote-wall__grid--static">
          {quotes.map((q) => (
            <li key={`static-${q.id}`} className="quote-wall__item">
              <QuoteFigure quote={q} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
