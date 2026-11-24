import CustomerAuthForm from "../auth/customer-auth-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#080d0a] px-4 py-12 text-white sm:px-6 sm:py-20">
      <div className="mx-auto max-w-lg">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#68e992]">
          Built for Nigeria
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Create your ERS account
        </h1>
        <p className="mb-8 mt-4 text-white/60">
          Start with a customer account. Runner access requires a separate
          application and verification process.
        </p>
        <CustomerAuthForm mode="signup" />
      </div>
    </main>
  );
}
