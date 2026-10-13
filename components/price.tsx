import { formatPrice, fromPrice, fromRegularPrice, saleEndLabel, type Product } from "@/lib/catalog";

/** A price, with the regular price crossed out when it's on sale. Works in server and client components. */
export function Price({ price, compareAt, className = "font-semibold text-navy" }: { price: number; compareAt?: number; className?: string }) {
  return (
    <>
      <span className={compareAt !== undefined ? "font-semibold text-magenta" : className}>{formatPrice(price)}</span>
      {compareAt !== undefined && (
        <>
          {" "}
          <s className="text-ink/45 font-normal">{formatPrice(compareAt)}</s>
          <span className="sr-only"> (sale, regular price {formatPrice(compareAt)})</span>
        </>
      )}
    </>
  );
}

/** "From $X" for product cards, with the sale shown. */
export function FromPrice({ product }: { product: Pick<Product, "variants"> }) {
  const from = fromPrice(product);
  if (from === null) return <>Price on request</>;
  const regular = fromRegularPrice(product);
  return (
    <>
      From <Price price={from} compareAt={regular !== null && regular > from ? regular : undefined} />
    </>
  );
}

export function SaleBadge({ endsAt, className = "" }: { endsAt?: string; className?: string }) {
  return (
    <span className={`inline-block rounded-full bg-magenta px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${className}`}>
      Sale{endsAt && <span className="font-medium normal-case tracking-normal"> · ends {saleEndLabel(endsAt)}</span>}
    </span>
  );
}
