// ═══════════════════════════════════════════
// App Tracix — Routing et layout principal
// ═══════════════════════════════════════════

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Landing } from '@/pages/Landing';
import { Dashboard } from '@/pages/Dashboard';
import { Habilitations } from '@/pages/Habilitations';
import { Membres } from '@/pages/Membres';
import { Plateformes } from '@/pages/Plateformes';
import { ScoreRisque } from '@/pages/ScoreRisque';
import { Systemes } from '@/pages/Systemes';
import { FluxReseau } from '@/pages/FluxReseau';
import { Abonnements } from '@/pages/Abonnements';
import { Alertes } from '@/pages/Alertes';
import { Journal } from '@/pages/Journal';
import { Rapports } from '@/pages/Rapports';
import { Parametres } from '@/pages/Parametres';
import { Import } from '@/pages/Import';
import { CustomModulePage } from '@/pages/CustomModulePage';
import { Revues } from '@/pages/Revues';
import { OAuthCallback } from '@/pages/OAuthCallback';
import { Rejoindre } from '@/pages/Rejoindre';
import { ResetPassword } from '@/pages/ResetPassword';
import { Admin } from '@/pages/Admin';
import { Onboarding } from '@/pages/Onboarding';
import { useStore } from '@/hooks/useStore';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  const store = useStore();

  // Full-screen spinner while restoring session
  const isOAuthCallback = window.location.pathname === '/oauth/callback';
  const isAdmin =
    window.location.hostname.startsWith('admin.') ||
    window.location.pathname === '/admin';

  if (isAdmin) {
    return (
      <>
        <Admin />
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  if (store.isLoading && !isOAuthCallback) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#534AB7]/20 border-t-[#534AB7] rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Chargement…</p>
        </div>
      </div>
    );
  }

  if (!store.isAuthenticated || isOAuthCallback) {
    return (
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/oauth/callback" element={<OAuthCallback onLoginWithToken={store.loginWithToken} />} />
            <Route path="/rejoindre/:token" element={<Rejoindre onLoginWithToken={store.loginWithToken} />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Landing onLogin={store.login} onLoginWithMfa={store.loginWithMfa} onRegister={store.register} />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    );
  }

  const unresolvedAlerts = store.alerts.filter((a) => !a.is_resolved).length;

  // Show onboarding wizard for first-time users
  if (!store.organization?.onboarding_completed) {
    return (
      <>
        <BrowserRouter>
          <Onboarding
            organization={store.organization!}
            onComplete={(updatedOrg) => store.setOrganization(updatedOrg)}
          />
        </BrowserRouter>
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  return (
    <BrowserRouter>
      <AppLayout
        user={store.user!}
        organization={store.organization!}
        onLogout={store.logout}
        onRefresh={store.loadAllData}
        unresolvedAlerts={unresolvedAlerts}
        customModules={store.customModules}
        userOrganizations={store.userOrganizations}
        onSwitchOrg={store.switchOrganization}
        onCreateOrg={store.createOrganization}
      >
        <ErrorBoundary>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <Dashboard
                onResolveAlert={store.resolveAlert}
                alerts={store.alerts}
                auditTrail={store.auditTrail}
              />
            }
          />
          <Route
            path="/habilitations"
            element={
              <Habilitations
                onUpdateAccess={store.updateAccessLevel}
                onRevokeAccess={store.revokeAccess}
                members={store.members}
                platforms={store.platforms}
                accessRights={store.accessRights}
              />
            }
          />
          <Route
            path="/membres"
            element={
              <Membres
                onRevokeAccess={store.revokeAccess}
                members={store.members}
                platforms={store.platforms}
                alerts={store.alerts}
                accessRights={store.accessRights}
                onUpdateAccess={store.updateAccessLevel}
                categories={store.categories.filter((c) => c.type === 'team')}
                onMemberCreated={store.upsertMember}
                onMemberUpdated={store.upsertMember}
              />
            }
          />
          <Route
            path="/membres/:id"
            element={
              <Membres
                onRevokeAccess={store.revokeAccess}
                members={store.members}
                platforms={store.platforms}
                alerts={store.alerts}
                accessRights={store.accessRights}
                onUpdateAccess={store.updateAccessLevel}
                categories={store.categories.filter((c) => c.type === 'team')}
                onMemberCreated={store.upsertMember}
                onMemberUpdated={store.upsertMember}
              />
            }
          />
          <Route
            path="/plateformes"
            element={
              <Plateformes
                platforms={store.platforms}
                members={store.members}
                alerts={store.alerts}
                accessRights={store.accessRights}
                categories={store.categories.filter((c) => c.type === 'platform')}
                onPlatformCreated={store.upsertPlatform}
                onPlatformUpdated={store.upsertPlatform}
                onPlatformDeleted={store.removePlatform}
              />
            }
          />
          <Route
            path="/plateformes/:id"
            element={
              <Plateformes
                platforms={store.platforms}
                members={store.members}
                alerts={store.alerts}
                accessRights={store.accessRights}
                categories={store.categories.filter((c) => c.type === 'platform')}
                onPlatformCreated={store.upsertPlatform}
                onPlatformUpdated={store.upsertPlatform}
                onPlatformDeleted={store.removePlatform}
              />
            }
          />
          <Route
            path="/score-de-risque"
            element={
              <ScoreRisque
                members={store.members}
                platforms={store.platforms}
                accessRights={store.accessRights}
              />
            }
          />
          <Route
            path="/systemes"
            element={<Systemes systems={store.systems} onSystemCreated={store.upsertSystem} />}
          />
          <Route
            path="/flux-reseau"
            element={<FluxReseau networkFlows={store.networkFlows} onFlowCreated={store.upsertNetworkFlow} />}
          />
          <Route
            path="/abonnements"
            element={
              <Abonnements
                subscriptions={store.subscriptions}
                categories={store.categories.filter((c) => c.type === 'subscription')}
                onSubscriptionCreated={store.upsertSubscription}
                onSubscriptionUpdated={store.upsertSubscription}
              />
            }
          />
          <Route
            path="/alertes"
            element={
              <Alertes
                onResolveAlert={store.resolveAlert}
                onResolveAll={store.resolveAllAlerts}
                alerts={store.alerts}
              />
            }
          />
          <Route
            path="/journal"
            element={<Journal auditTrail={store.auditTrail} />}
          />
          <Route
            path="/rapports"
            element={
              <Rapports
                members={store.members}
                platforms={store.platforms}
                accessRights={store.accessRights}
                subscriptions={store.subscriptions}
                systems={store.systems}
                alerts={store.alerts}
              />
            }
          />
          <Route
            path="/parametres"
            element={
              <Parametres
                user={store.user}
                organization={store.organization}
                categories={store.categories}
                customModules={store.customModules}
                onCategoryAdded={store.addCategory}
                onCategoryRemoved={store.removeCategory}
                onOrganizationUpdated={store.setOrganization}
                onCustomModuleCreated={store.upsertCustomModule}
                onCustomModuleRemoved={store.removeCustomModule}
                onThresholdSaved={async () => {
                  await Promise.all([store.refreshAlerts(), store.refreshMembers()]);
                }}
              />
            }
          />
          <Route
            path="/revues"
            element={
              <Revues
                members={store.members}
                platforms={store.platforms}
              />
            }
          />
          <Route path="/import" element={<Import />} />
          <Route
            path="/modules/:moduleId"
            element={<CustomModulePage modules={store.customModules} />}
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </ErrorBoundary>
      </AppLayout>
    </BrowserRouter>
  );
}

export default function AppWithToaster() {
  return (
    <>
      <App />
      <Toaster position="bottom-right" richColors />
    </>
  );
}
