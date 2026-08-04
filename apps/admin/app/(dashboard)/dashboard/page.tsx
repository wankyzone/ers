import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const metrics = [
  { label: "Total Runners", value: "24" },
  { label: "Active Clients", value: "128" },
  { label: "Open Errands", value: "16" },
  { label: "Pending KYC Reviews", value: "8" },
] as const;

const recentActivity = [
  "New runner application received.",
  "Client account verified.",
  "Errand assigned to a runner.",
] as const;

const quickActions = [
  { label: "Review KYC", href: "/kyc" },
  { label: "View Errands", href: "/errands" },
  { label: "Manage Runners", href: "/runners" },
] as const;

export default function DashboardPage() {
  return (
    <div>
      <section aria-labelledby="dashboard-title">
        <h1 id="dashboard-title">ERS Admin Dashboard</h1>
        <p>Welcome to the ERS administration portal.</p>
      </section>

      <section aria-label="Dashboard metrics">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle>{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="recent-activity-title">
        <h2 id="recent-activity-title">Recent Activity</h2>
        <Card>
          <CardContent>
            <ul>
              {recentActivity.map((activity) => (
                <li key={activity}>{activity}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title">Quick Actions</h2>
        <Card>
          <CardContent>
            <ul>
              {quickActions.map((action) => (
                <li key={action.href}>
                  <a href={action.href}>{action.label}</a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
