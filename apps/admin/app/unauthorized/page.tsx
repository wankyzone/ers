"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="mx-auto w-full max-w-2xl space-y-6 px-6 text-center">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground">
          You are not authorized to access the ERS Admin Dashboard.
        </p>

        <div className="flex items-center justify-center">
          <Button onClick={() => router.push('/login')}>Return to login</Button>
        </div>
      </div>
    </main>
  );
}
