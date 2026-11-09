import PageShell from "@/components/PageShell";
import MyPosts from "@/components/MyPosts";

export const metadata = { title: "Profile · Map Billboard" };

export default function ProfilePage() {
  return (
    <PageShell title="Profile">
      <MyPosts />
    </PageShell>
  );
}
