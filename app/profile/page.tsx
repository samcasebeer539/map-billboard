import PageShell from "@/components/PageShell";
import ProfileTabs from "@/components/ProfileTabs";

export const metadata = { title: "Profile · Map Billboard" };

export default function ProfilePage() {
  return (
    <PageShell title="Profile">
      <ProfileTabs />
    </PageShell>
  );
}
