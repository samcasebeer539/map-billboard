import PageShell from "@/components/PageShell";
import SettingsForm from "@/components/SettingsForm";
import AccountCard from "@/components/AccountCard";

export const metadata = { title: "Settings · Map Billboard" };

export default function SettingsPage() {
  return (
    <PageShell title="Settings">
      <div className="flex flex-col gap-4">
        <AccountCard />
        <SettingsForm />
      </div>
    </PageShell>
  );
}
