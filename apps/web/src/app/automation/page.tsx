'use client';

import { useRequireAuth } from '@/lib/useRequireAuth';
import { useAuth } from '@/lib/auth';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/PageHeader';
import { AutomationSettings } from '@/components/AutomationSettings';

export default function AutomationPage() {
  const { ready } = useRequireAuth();
  const agent = useAuth((s) => s.agent);

  if (!ready) {
    return <main className="flex h-screen items-center justify-center text-gray-500">Loading…</main>;
  }

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="page-transition flex flex-1 flex-col overflow-hidden">
        <PageHeader
          title="Automation"
          subtitle="Greetings, away messages, business hours, and keyword auto-responses."
        />
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <AutomationSettings isAdmin={agent?.role === 'admin'} />
        </div>
      </div>
    </div>
  );
}
