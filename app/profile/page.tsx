import PageShell from "@/components/PageShell";
import ProfileTabs from "@/components/ProfileTabs";
import GuestNotice from "@/components/GuestNotice";

export const metadata = { title: "Profile · Map Billboard" };

export default function ProfilePage() {
  return (
    <PageShell title="Profile">
      <div className="flex flex-col gap-4">
        <GuestNotice />
        <ProfileTabs />
      </div>
    </PageShell>
  );
}
