import { requireCustomerUser } from "../../lib/customer-profile";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import ProfileForm from "./profile-form";

export default async function CustomerDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await requireCustomerUser(supabase);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#68e992]">
        Customer account
      </p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      <p className="mt-4 max-w-2xl text-white/60">
        Your ERS customer profile is ready. Errand ordering is not available on
        this website yet.
      </p>
      <section className="mt-10 rounded-3xl border border-white/10 bg-[#111a15] p-6 sm:p-8">
        <h2 className="text-xl font-bold">Profile</h2>
        <p className="mt-2 text-sm text-white/55">{user?.email}</p>
        <ProfileForm initialName={profile?.full_name ?? ""} />
      </section>
    </main>
  );
}
