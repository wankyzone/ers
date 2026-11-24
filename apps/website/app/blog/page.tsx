"use client";

export default function BlogPage() {
  const posts = [
    {
      title: "Everyday errands, connected",
      desc: "Ideas on making everyday errands simpler to coordinate through a marketplace.",
      date: "June 2026",
    },
    {
      title: "Everyday errands, connected",
      desc: "A closer look at how customers and runners connect through the ERS marketplace.",
      date: "June 2026",
    },
    {
      title: "The runner experience",
      desc: "How runner coordination and errand updates fit into one marketplace experience.",
      date: "June 2026",
    },
  ];

  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">

        {/* HERO */}
        <div className="mb-16">
          <p className="text-xs tracking-widest text-[#1ED760] mb-4">
            ERS UPDATES
          </p>

          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Stories from the ERS marketplace
          </h1>

          <p className="text-white/60 max-w-2xl text-lg">
            Updates and perspectives on connecting customers with runners for
            everyday errands.
          </p>
        </div>

        {/* POSTS */}
        <div className="grid gap-6">

          {posts.map((post, i) => (
            <div
              key={i}
              className="
                bg-[#111217]
                border border-white/10
                rounded-xl p-6
                hover:border-white/20
                hover:-translate-y-1
                transition-all duration-300
              "
            >
              <div className="flex justify-between items-center mb-3 text-xs text-white/40">
                <span>{post.date}</span>
                <span className="text-[#1ED760]">Coming soon</span>
              </div>

              <h2 className="text-xl font-semibold mb-2">
                {post.title}
              </h2>

              <p className="text-white/60 text-sm">
                {post.desc}
              </p>

            </div>
          ))}

        </div>

      </div>
    </main>
  );
}