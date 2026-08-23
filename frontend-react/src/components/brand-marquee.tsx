const brands = [
  { name: "Google", logo: "/google.png" },
  { name: "Microsoft", logo: "/icons8-microsoft-48.png" },
  { name: "Amazon", logo: "/amazon.png" },
  { name: "Meta", logo: "/meta.png" },
  { name: "Netflix", logo: "/netflix.png" },
];

function BrandItem({ brand }: { brand: typeof brands[number] }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <img
        src={brand.logo}
        alt={brand.name}
        className="h-6 w-auto object-contain"
      />
      <span className="text-base font-medium text-neutral-600 whitespace-nowrap">
        {brand.name}
      </span>
    </div>
  );
}

export function BrandMarquee() {
  const allBrands = [...brands, ...brands, ...brands, ...brands];

  return (
    <section className="overflow-hidden py-12 md:py-16">
      <div className="brand-marquee-track flex w-max items-center">
        {allBrands.map((brand, i) => (
          <div key={i} className="flex shrink-0 items-center gap-16 pr-16">
            <BrandItem brand={brand} />
          </div>
        ))}
      </div>
    </section>
  );
}
