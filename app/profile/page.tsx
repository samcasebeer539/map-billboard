import PageShell from "@/components/PageShell";
import MyPosts from "@/components/MyPosts";
import SavedPosts from "@/components/SavedPosts";

export const metadata = { title: "Profile · Map Billboard" };

export default function ProfilePage() {
  return (
    <PageShell title="Profile">
      <div className="flex flex-col gap-12">
        <MyPosts />
        <SavedPosts />
      </div>
    </PageShell>
  );
}
