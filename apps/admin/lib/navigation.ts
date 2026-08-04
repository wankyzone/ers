export interface NavigationItem {
  label: string;
  href: string;
}

export const navigation: readonly NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Runners", href: "/runners" },
  { label: "Clients", href: "/clients" },
  { label: "KYC Reviews", href: "/kyc" },
  { label: "Errands", href: "/errands" },
  { label: "Analytics", href: "/analytics" },
  { label: "Settings", href: "/settings" },
];
