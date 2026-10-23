import Image from "next/image";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-xl shadow-navy/5">
          <div className="cmyk-bar h-1.5" />
          <div className="p-8">
            <Image src="/brand/maxx_logo.webp" alt="" width={367} height={219} className="mx-auto h-24 w-auto" />
            <h1 className="mt-6 text-center font-display text-2xl text-navy">{title}</h1>
            <p className="mb-8 mt-2 text-center text-sm text-ink/60">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
