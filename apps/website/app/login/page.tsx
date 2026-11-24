import Link from "next/link";
import CustomerAuthForm from "../auth/customer-auth-form";

const errorMessages: Record<string, string> = {
  link: "That verification or reset link is invalid or expired. Request a new link to continue.",
  verification: "Verify your email before signing in.",
  configuration: "Customer sign-in is temporarily unavailable. Please try again later.",
  profile: "Your customer profile is not ready yet. Please try again later.",
  role: "This account does not have customer access.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; verified?: string }>;
}) {
  const params = await searchParams;
  const message =
    params.verified === "1"
      ? "Your email is verified. Sign in to continue."
      : params.error
        ? errorMessages[params.error] ?? "Please sign in to continue."
        : undefined;

  return (
    <main className="min-h-screen bg-[#080d0a] px-4 py-12 text-white sm:px-6 sm:py-20">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm font-bold uppercase tracking-[0.2em] text-[#68e992]">
          ERS
        </Link>
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Welcome back
        </h1>
        <p className="mb-8 mt-4 text-white/60">
          Sign in to manage your customer profile.
        </p>
        <CustomerAuthForm mode="login" initialMessage={message} />
      </div>
    </main>
  );
}
