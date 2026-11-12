import PageShell from "@/components/PageShell";
import NotificationsList from "@/components/NotificationsList";

export const metadata = { title: "Notifications · Map Billboard" };

export default function NotificationsPage() {
  return (
    <PageShell title="Notifications">
      <NotificationsList />
    </PageShell>
  );
}
