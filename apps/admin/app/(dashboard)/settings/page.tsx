"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/lib/supabase";
import {
  getAdminProfile,
  updateAdminProfile,
  type AdminProfile,
} from "@/lib/api/settings";

const emptyProfileState: AdminProfile = {
  id: null,
  email: null,
  role: null,
  date_of_birth: null,
  address: null,
  account_number: null,
  account_name: null,
  emergency_contact: null,
  verified: false,
  created_at: null,
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<AdminProfile>(emptyProfileState);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    setIsLoadingProfile(true);
    setProfileError(null);

    try {
      const currentProfile = await getAdminProfile();
      setProfile(currentProfile);
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Unable to load profile settings.",
      );
    } finally {
      setIsLoadingProfile(false);
    }
  }

  function updateProfileField(field: keyof AdminProfile, value: string) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setIsSavingProfile(true);

    try {
      const payload = {
        date_of_birth: profile.date_of_birth ?? "",
        address: profile.address ?? "",
        account_number: profile.account_number ?? "",
        account_name: profile.account_name ?? "",
        emergency_contact: profile.emergency_contact ?? "",
      };

      const nextProfile = await updateAdminProfile(payload);
      setProfile(nextProfile);
      setProfileSuccess("Profile saved successfully.");
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Unable to save profile settings.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Current password, new password, and confirmation are required.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const supabase = getSupabaseClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const email = userData?.user?.email ?? profile.email;

      if (userError || !email) {
        throw new Error("Unable to verify your authenticated admin account.");
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (reauthError) {
        throw new Error("Current password is incorrect or reauthentication failed.");
      }

      const { error: updateUserError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateUserError) {
        throw new Error(updateUserError.message || "Unable to update password.");
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordSuccess("Password updated successfully.");
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Unable to update password.",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your admin profile and security preferences.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update the profile details used for your admin account.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProfile ? (
              <p>Loading profile…</p>
            ) : (
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium" htmlFor="admin-email">
                      Email
                    </label>
                    <Input id="admin-email" value={profile.email ?? ""} disabled readOnly />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium" htmlFor="admin-role">
                      Role
                    </label>
                    <Input id="admin-role" value={profile.role ?? ""} disabled readOnly />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium" htmlFor="admin-address">
                      Address
                    </label>
                    <Input
                      id="admin-address"
                      value={profile.address ?? ""}
                      onChange={(event) => updateProfileField("address", event.target.value)}
                      placeholder="Enter your address"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="admin-date-of-birth">
                      Date of birth
                    </label>
                    <Input
                      id="admin-date-of-birth"
                      type="date"
                      value={profile.date_of_birth ?? ""}
                      onChange={(event) => updateProfileField("date_of_birth", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="admin-emergency-contact">
                      Emergency contact
                    </label>
                    <Input
                      id="admin-emergency-contact"
                      value={profile.emergency_contact ?? ""}
                      onChange={(event) =>
                        updateProfileField("emergency_contact", event.target.value)
                      }
                      placeholder="Name or phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="admin-account-name">
                      Account name
                    </label>
                    <Input
                      id="admin-account-name"
                      value={profile.account_name ?? ""}
                      onChange={(event) => updateProfileField("account_name", event.target.value)}
                      placeholder="Bank account holder"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="admin-account-number">
                      Account number
                    </label>
                    <Input
                      id="admin-account-number"
                      value={profile.account_number ?? ""}
                      onChange={(event) => updateProfileField("account_number", event.target.value)}
                      placeholder="Bank account number"
                    />
                  </div>
                </div>

                {profileError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {profileError}
                  </p>
                ) : null}

                {profileSuccess ? (
                  <p role="status" className="text-sm text-emerald-600">
                    {profileSuccess}
                  </p>
                ) : null}

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account overview</CardTitle>
            <CardDescription>Read-only system information for this admin account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{profile.verified ? "Verified" : "Pending verification"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(profile.created_at)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Role</p>
              <p className="font-medium capitalize">{profile.role ?? "Unknown"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Use your current password to verify before updating your sign-in password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="current-password">
                Current password
              </label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
                placeholder="Enter your current password"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="new-password">
                  New password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="confirm-password">
                  Confirm new password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  placeholder="Repeat your new password"
                />
              </div>
            </div>

            {passwordError ? (
              <p role="alert" className="text-sm text-destructive">
                {passwordError}
              </p>
            ) : null}

            {passwordSuccess ? (
              <p role="status" className="text-sm text-emerald-600">
                {passwordSuccess}
              </p>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdatingPassword} variant="secondary">
                {isUpdatingPassword ? "Updating password..." : "Update Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
