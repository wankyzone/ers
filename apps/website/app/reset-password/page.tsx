import CustomerAuthForm from "../auth/customer-auth-form";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#080d0a] px-4 py-12 text-white sm:px-6 sm:py-20">
      <div className="mx-auto max-w-lg">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#68e992]">
          Account recovery
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Choose a new password
        </h1>
        <p className="mb-8 mt-4 text-white/60">
          Use a password with at least eight characters. If your link has
          expired, request a new one.
        </p>
        <CustomerAuthForm mode="reset" />
      </div>
    </main>
  );
}
