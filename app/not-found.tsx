import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <p className="font-display text-6xl text-navy">404</p>
        <p className="mt-3 text-ink/60">We couldn&apos;t find that page.</p>
        <Link href="/shop" className="btn-primary mt-6">Back to the shop</Link>
      </div>
    </div>
  );
}
