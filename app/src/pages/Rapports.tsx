// ═══════════════════════════════════════════
// Page Rapports
// ═══════════════════════════════════════════

import { useState } from 'react';
import { FileText, Shield, TrendingUp, Award, FileSpreadsheet, UserX, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Member, Platform, AccessRight, Subscription } from '@/types';
import { ACCESS_LEVEL_CONFIG } from '@/types';
import { toast } from 'sonner';

interface RapportsProps {
  members: Member[];
  platforms: Platform[];
  accessRights: AccessRight[];
  subscriptions: Subscription[];
}

export function Rapports({ members, platforms, accessRights, subscriptions }: RapportsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const generate = async (id: string) => {
    setLoading(id);
    try {
      switch (id) {
        case 'hab': generateHabilitations(members, platforms, accessRights); break;
        case 'review': generateRevue(accessRights, members, platforms); break;
        case 'risk': generateRisk(members, platforms); break;
        case 'iso': generateISO(members, platforms, accessRights); break;
        case 'subs': generateSubscriptions(subscriptions); break;
        case 'offboard': generateOffboard(members, platforms, accessRights); break;
      }
      toast.success('Rapport téléchargé');
    } catch {
      toast.error('Erreur lors de la génération du rapport');
    } finally {
      setLoading(null);
    }
  };

  const REPORTS = [
    {
      id: 'hab',
      title: 'Rapport Habilitations complet',
      desc: 'Matrice complète membres × plateformes, liste des Admin par plateforme, accès non revus',
      icon: Shield,
      color: '#534AB7',
      format: 'PDF',
    },
    {
      id: 'review',
      title: 'Rapport Revue d\'accès',
      desc: 'Accès confirmés, révoqués ou modifiés lors de la dernière revue, avec horodatage et acteur',
      icon: FileText,
      color: '#3B82F6',
      format: 'PDF',
    },
    {
      id: 'risk',
      title: 'Rapport Score de risque',
      desc: 'Top 10 membres à risque + top 5 plateformes à risque, avec détail des facteurs',
      icon: TrendingUp,
      color: '#E24B4A',
      format: 'PDF',
    },
    {
      id: 'iso',
      title: 'Rapport ISO 27001 — A.9',
      desc: 'Contrôle des accès : politique, matrice, revues, preuves de révocations',
      icon: Award,
      color: '#1D9E75',
      format: 'PDF',
    },
    {
      id: 'subs',
      title: 'Export registre abonnements',
      desc: 'Tous les abonnements avec coûts mensuels, annuels et dates de renouvellement',
      icon: FileSpreadsheet,
      color: '#EF9F27',
      format: 'XLSX',
    },
    {
      id: 'offboard',
      title: 'Rapport Offboarding',
      desc: 'Checklist de révocations pour un membre sélectionné avec statut de chaque item',
      icon: UserX,
      color: '#6B7280',
      format: 'PDF',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Rapports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Générez des rapports d'audit et d'export</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${r.color}15` }}
              >
                <r.icon className="w-5 h-5" style={{ color: r.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{r.format}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
                <button
                  onClick={() => generate(r.id)}
                  disabled={loading === r.id}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#534AB7] hover:underline opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:no-underline"
                >
                  {loading === r.id
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Génération…</>
                    : <><Download className="w-3.5 h-3.5" />Télécharger</>
                  }
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Générateurs ───

function generateHabilitations(members: Member[], platforms: Platform[], accessRights: AccessRight[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const now = new Date().toLocaleDateString('fr-FR');

  doc.setFontSize(16);
  doc.text('Rapport Habilitations', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Généré le ${now}`, 14, 22);
  doc.setTextColor(0);

  // Matrice membres × plateformes
  const headers = ['Membre', 'Équipe', ...platforms.map((p) => p.name.substring(0, 12))];
  const rows = members.map((m) => {
    const cells = platforms.map((p) => {
      const ar = accessRights.find((a) => a.member_id === m.id && a.platform_id === p.id && a.level !== 'none');
      return ar ? ACCESS_LEVEL_CONFIG[ar.level].label : '—';
    });
    return [m.full_name, m.team, ...cells];
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 26,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [83, 74, 183] },
  });

  doc.save('rapport-habilitations.pdf');
}

function generateRevue(accessRights: AccessRight[], members: Member[], platforms: Platform[]) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString('fr-FR');

  doc.setFontSize(16);
  doc.text('Rapport Revue d\'accès', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Généré le ${now}`, 14, 22);
  doc.setTextColor(0);

  const overdue = accessRights.filter((a) => a.next_review_date && new Date(a.next_review_date) < new Date() && a.level !== 'none');
  const rows = overdue.map((a) => {
    const m = members.find((x) => x.id === a.member_id);
    const p = platforms.find((x) => x.id === a.platform_id);
    return [
      m?.full_name ?? '?',
      p?.name ?? '?',
      ACCESS_LEVEL_CONFIG[a.level].label,
      a.last_review_date ? new Date(a.last_review_date).toLocaleDateString('fr-FR') : '—',
      a.next_review_date ? new Date(a.next_review_date).toLocaleDateString('fr-FR') : '—',
    ];
  });

  autoTable(doc, {
    head: [['Membre', 'Plateforme', 'Niveau', 'Dernière revue', 'Prochaine revue']],
    body: rows,
    startY: 26,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save('rapport-revue-acces.pdf');
}

function generateRisk(members: Member[], platforms: Platform[]) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString('fr-FR');

  doc.setFontSize(16);
  doc.text('Rapport Score de risque', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Généré le ${now}`, 14, 22);
  doc.setTextColor(0);

  const top10 = [...members].sort((a, b) => a.risk_score - b.risk_score).slice(0, 10);
  const rows = top10.map((m) => [
    m.full_name,
    m.team,
    String(m.risk_score),
    m.risk_factors.map((f) => f.label).join(', ') || '—',
  ]);

  autoTable(doc, {
    head: [['Membre', 'Équipe', 'Score', 'Facteurs de risque']],
    body: rows,
    startY: 26,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [226, 75, 74] },
  });

  // Top 5 plateformes sans MFA
  const noMfa = platforms.filter((p) => !p.has_mfa).slice(0, 5);
  if (noMfa.length > 0) {
    const lastY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text('Plateformes sans MFA', 14, lastY);
    autoTable(doc, {
      head: [['Plateforme', 'Catégorie', 'Environnement', 'Responsable']],
      body: noMfa.map((p) => [p.name, p.category, p.environment, p.responsible]),
      startY: lastY + 4,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [226, 75, 74] },
    });
  }

  doc.save('rapport-score-risque.pdf');
}

function generateISO(members: Member[], platforms: Platform[], accessRights: AccessRight[]) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString('fr-FR');

  doc.setFontSize(16);
  doc.text('Rapport ISO 27001 — Contrôle des accès (A.9)', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Généré le ${now} · ${members.length} membres · ${platforms.length} plateformes`, 14, 22);
  doc.setTextColor(0);

  // Résumé
  const adminCount = accessRights.filter((a) => a.level === 'admin').length;
  const overdueCount = accessRights.filter((a) => a.next_review_date && new Date(a.next_review_date) < new Date() && a.level !== 'none').length;
  const noMfaCount = platforms.filter((p) => !p.has_mfa).length;

  autoTable(doc, {
    head: [['Indicateur', 'Valeur']],
    body: [
      ['Nombre de membres', String(members.length)],
      ['Nombre de plateformes', String(platforms.length)],
      ['Droits Admin actifs', String(adminCount)],
      ['Revues en retard', String(overdueCount)],
      ['Plateformes sans MFA', String(noMfaCount)],
    ],
    startY: 26,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [29, 158, 117] },
  });

  doc.save('rapport-iso27001-a9.pdf');
}

function generateSubscriptions(subscriptions: Subscription[]) {
  const ws = XLSX.utils.json_to_sheet(
    subscriptions.map((s) => ({
      Nom: s.name,
      Catégorie: s.category,
      Fournisseur: s.vendor,
      'Coût mensuel': s.cost_monthly,
      'Coût annuel': s.cost_annual,
      Devise: s.currency,
      Cycle: s.billing_cycle,
      'Renouvellement': s.renewal_date ? new Date(s.renewal_date).toLocaleDateString('fr-FR') : '',
      'Auto-renouvellement': s.auto_renew ? 'Oui' : 'Non',
      Responsable: s.responsible,
      Statut: s.status,
    }))
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Abonnements');
  XLSX.writeFile(wb, 'registre-abonnements.xlsx');
}

function generateOffboard(members: Member[], platforms: Platform[], accessRights: AccessRight[]) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString('fr-FR');

  doc.setFontSize(16);
  doc.text('Rapport Offboarding', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Généré le ${now}`, 14, 22);
  doc.setTextColor(0);

  // Membres avec date de départ passée ou prochaine
  const toOffboard = members.filter((m) => m.departure_date);

  if (toOffboard.length === 0) {
    doc.setFontSize(11);
    doc.text('Aucun membre avec date de départ planifiée.', 14, 32);
    doc.save('rapport-offboarding.pdf');
    return;
  }

  toOffboard.forEach((m, idx) => {
    if (idx > 0) doc.addPage();
    const startY = idx === 0 ? 30 : 20;

    doc.setFontSize(12);
    doc.text(`${m.full_name} — ${m.team}`, 14, startY);
    if (m.departure_date) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Départ prévu : ${new Date(m.departure_date).toLocaleDateString('fr-FR')}`, 14, startY + 6);
      doc.setTextColor(0);
    }

    const memberAccess = accessRights.filter((a) => a.member_id === m.id && a.level !== 'none');
    const rows = memberAccess.map((a) => {
      const p = platforms.find((x) => x.id === a.platform_id);
      return [
        p?.name ?? '?',
        ACCESS_LEVEL_CONFIG[a.level].label,
        '☐ À révoquer',
      ];
    });

    autoTable(doc, {
      head: [['Plateforme', 'Niveau', 'Action']],
      body: rows.length > 0 ? rows : [['Aucun accès actif', '', '']],
      startY: startY + 10,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [107, 114, 128] },
    });
  });

  doc.save('rapport-offboarding.pdf');
}
