"use client";

import { useState, type FormEvent } from "react";

export default function ProfileForm({
  initialName,
}: {
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: name }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to update your profile.");
        return;
      }
      setName(result.profile.full_name);
      setMessage("Profile saved.");
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      setError("A connection problem prevented the profile update. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 max-w-xl space-y-4">
      <div>
        <label htmlFor="profile-name" className="text-sm font-semibold text-white/85">
          Name
        </label>
        <input
          id="profile-name"
          name="full_name"
          autoComplete="name"
          maxLength={100}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#111a15] px-4 py-3 text-base text-white focus:border-[#19c963] focus:outline-none focus:ring-2 focus:ring-[#19c963]/30"
          disabled={loading}
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="text-sm text-[#a5f2bd]">{message}</p>}
      <button
        type="submit"
        disabled={loading}
        className="min-h-11 rounded-full bg-[#19c963] px-5 py-2 text-sm font-bold text-[#07110b] disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
