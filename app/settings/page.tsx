import PageShell from "@/components/PageShell";
import SettingsForm from "@/components/SettingsForm";

export const metadata = { title: "Settings · Map Billboard" };

export default function SettingsPage() {
  return (
    <PageShell title="Settings">
      <SettingsForm />
    </PageShell>
  );
}
