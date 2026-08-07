/**
 * The picture in the hero: three quotes on one job, and the customer picks one.
 *
 * Both the homepage and the customer lander show this, so it lives here rather
 * than being copy-pasted into each — the two copies had already drifted into
 * showing the same shop twice at the same price, which read as a bug.
 */

type Quote = {
  shop: string;
  price: string;
  badge: string;
  className: string;
};

const QUOTES: Quote[] = [
  { shop: "Ramirez Mobile Auto", price: "$118", badge: "Preview", className: "qt-1" },
  { shop: "Kensington Auto Works", price: "$124", badge: "Preview", className: "qt-2" },
  { shop: "Silver Spring Auto Care", price: "$96", badge: "You choose", className: "qt-3 qt-selected" },
];

export function QuoteBoard({ caption }: { caption: string }) {
  return (
    <div
      className="hero-visual"
      aria-label="Preview of the planned Tuveloz service-request experience"
      role="img"
    >
      <div className="quote-board">
        {QUOTES.map((quote) => (
          <article className={`quote-ticket ${quote.className}`} key={quote.shop}>
            <div className="qt-head">
              <span>JOB #4471</span>
              <b>{quote.badge}</b>
            </div>
            <strong>Battery replacement</strong>
            <div className="qt-foot">
              <span className="qt-price">{quote.price}</span>
              <small>{quote.shop}</small>
            </div>
          </article>
        ))}
      </div>
      <p className="hero-visual-caption">{caption}</p>
    </div>
  );
}
