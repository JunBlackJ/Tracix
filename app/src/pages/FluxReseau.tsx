import React, { useState, useEffect } from 'react';
import { Save, Loader2, Network, X, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { NetworkFlow, FlowDirection, FlowStatus } from '@/types';

const BRAND       = 'oklch(42% 0.18 280)';
const BRAND_LIGHT = 'oklch(55% 0.18 280)';
const RISK_CRIT   = 'oklch(55% 0.22 25)';
const RISK_HIGH   = 'oklch(62% 0.18 52)';
const RISK_MED    = 'oklch(70% 0.14 88)';
const RISK_LOW    = 'oklch(62% 0.16 155)';
const MUTED       = 'oklch(52% 0.012 260)';
const BORDER      = 'oklch(90% 0.006 260)';
const SURFACE     = 'oklch(100% 0 0)';
const FG          = 'oklch(18% 0.02 260)';

const IN_DATA  = [5,4,3,4,6,8,14,22,68,85,92,88,72,64,88,95,90,78,62,50,38,28,18,10];
const OUT_DATA = [3,3,2,3,4,6,10,16,42,56,64,60,50,44,60,68,62,54,42,34,24,18,12,7];

const PROTOCOLS = [
  { name: 'HTTPS', pct: 64.2, color: BRAND, flag: null },
  { name: 'SSH',   pct: 12.8, color: BRAND_LIGHT, flag: null },
  { name: 'DNS',   pct: 8.4,  color: RISK_LOW, flag: null },
  { name: 'RDP',   pct: 5.1,  color: RISK_HIGH, flag: { label: 'Attention', type: 'warn' } as { label: string; type: string } },
  { name: 'SMB',   pct: 3.7,  color: RISK_CRIT, flag: { label: 'Anomalie', type: 'crit' } as { label: string; type: string } },
  { name: 'Autres',pct: 5.8,  color: MUTED, flag: null },
];

const SOURCE_IPS = [
  { ip: '10.0.1.42',       country: '🇫🇷 France',        proto: 'HTTPS', debit: '214 MB/s', sev: 'low',  label: 'Autorisé' },
  { ip: '192.168.12.7',    country: '🇫🇷 France',        proto: 'SSH',   debit: '88 MB/s',  sev: 'low',  label: 'Autorisé' },
  { ip: '185.234.219.44',  country: '🇳🇱 Pays-Bas',      proto: 'RDP',   debit: '56 MB/s',  sev: 'crit', label: 'Bloqué'   },
  { ip: '203.0.113.77',    country: '🇨🇳 Chine',         proto: 'SMB',   debit: '42 MB/s',  sev: 'high', label: 'Suspect'  },
  { ip: '52.86.144.200',   country: '🇺🇸 États-Unis',    proto: 'HTTPS', debit: '39 MB/s',  sev: 'low',  label: 'Autorisé' },
  { ip: '176.9.52.31',     country: '🇩🇪 Allemagne',     proto: 'DNS',   debit: '31 MB/s',  sev: 'low',  label: 'Autorisé' },
  { ip: '91.108.4.10',     country: '🇳🇱 Pays-Bas',      proto: 'HTTPS', debit: '27 MB/s',  sev: 'high', label: 'Suspect'  },
  { ip: '217.138.220.5',   country: '🇬🇧 Royaume-Uni',   proto: 'SSH',   debit: '19 MB/s',  sev: 'low',  label: 'Autorisé' },
  { ip: '198.51.100.88',   country: '🇺🇸 États-Unis',    proto: 'RDP',   debit: '14 MB/s',  sev: 'crit', label: 'Bloqué'   },
  { ip: '10.0.5.114',      country: '🇫🇷 France',        proto: 'HTTPS', debit: '11 MB/s',  sev: 'low',  label: 'Autorisé' },
];

const ANOMALIES = [
  { sev: 'crit', desc: 'Scan de ports depuis 185.234.x.x',          meta: '14:21:03 · Critique · 443 ports sondés'  },
  { sev: 'crit', desc: 'Tentative de connexion RDP — 14 essais',     meta: '14:18:47 · Critique · 198.51.100.88'     },
  { sev: 'high', desc: 'Volume sortant inhabituel — srv-db-02',      meta: '14:10:22 · Élevé · 4.2 GB en 8 min'     },
  { sev: 'high', desc: 'Protocole non autorisé SMB détecté',         meta: '13:58:11 · Élevé · 203.0.113.77'        },
  { sev: 'med',  desc: 'Latence élevée API gateway',                 meta: '13:45:30 · Moyen · p99 = 2 340 ms'      },
  { sev: 'med',  desc: 'Pic de requêtes DNS depuis wks-adupont',     meta: '13:32:08 · Moyen · 1 240 req/min'       },
  { sev: 'low',  desc: 'Connexion VPN — nouveau pays (DE)',          meta: '13:12:55 · Info · utilisateur: m.petit' },
  { sev: 'low',  desc: 'Certificat expirant — 7j restants',          meta: '12:58:40 · Info · api.tracix-internal.fr'},
];

function pillStyle(sev: string): React.CSSProperties {
  switch (sev) {
    case 'crit': return { background: 'oklch(55% 0.22 25 / 0.1)',  color: RISK_CRIT };
    case 'high': return { background: 'oklch(62% 0.18 52 / 0.1)',  color: RISK_HIGH };
    case 'med':  return { background: 'oklch(70% 0.14 88 / 0.1)',  color: RISK_MED  };
    case 'low':  return { background: 'oklch(62% 0.16 155 / 0.1)', color: RISK_LOW  };
    default: return {};
  }
}

function dotStyle(sev: string): React.CSSProperties {
  switch (sev) {
    case 'crit': return { background: RISK_CRIT, boxShadow: `0 0 0 2px oklch(55% 0.22 25 / 0.2)` };
    case 'high': return { background: RISK_HIGH, boxShadow: `0 0 0 2px oklch(62% 0.18 52 / 0.2)` };
    case 'med':  return { background: RISK_MED,  boxShadow: `0 0 0 2px oklch(70% 0.14 88 / 0.2)` };
    case 'low':  return { background: RISK_LOW,  boxShadow: `0 0 0 2px oklch(62% 0.16 155 / 0.2)` };
    default: return {};
  }
}

function Pill({ sev, label }: { sev: string; label: string }) {
  return (
    <span style={{
      ...pillStyle(sev),
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {label}
    </span>
  );
}

function KpiCard({ label, value, delta, deltaType, color }: {
  label: string; value: string; delta: string;
  deltaType: 'up' | 'down' | 'neutral'; color: string;
}) {
  const deltaColor = deltaType === 'up' ? RISK_LOW : deltaType === 'down' ? RISK_CRIT : MUTED;
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '10px 10px 0 0' }} />
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: FG }}>{value}</div>
      <div style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: deltaColor }}>{delta}</div>
    </div>
  );
}

interface FluxReseauProps {
  networkFlows: NetworkFlow[];
  onFlowCreated?: (f: NetworkFlow) => void;
}

export function FluxReseau({ networkFlows, onFlowCreated }: FluxReseauProps) {
  const [trafficMode, setTrafficMode] = useState<'in' | 'out'>('in');
  const [showForm, setShowForm] = useState(false);
  const [clock, setClock] = useState('');

  // ─ Derive protocol distribution from real data ─
  const protoColors: Record<string, string> = {
    HTTPS: BRAND, HTTP: BRAND,
    SSH: BRAND_LIGHT,
    DNS: RISK_LOW,
    RDP: RISK_HIGH,
    SMB: RISK_CRIT,
    FTP: RISK_HIGH,
    SMTP: RISK_MED,
  };
  const protoFlags: Record<string, { label: string; type: string }> = {
    RDP: { label: 'Attention', type: 'warn' },
    SMB: { label: 'Anomalie', type: 'crit' },
    FTP: { label: 'Attention', type: 'warn' },
  };

  const protocols: typeof PROTOCOLS = (() => {
    if (networkFlows.length === 0) return PROTOCOLS;
    const counts: Record<string, number> = {};
    for (const f of networkFlows) {
      const p = (f.protocol || 'Autres').toUpperCase();
      counts[p] = (counts[p] ?? 0) + 1;
    }
    const total = networkFlows.length;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top5 = entries.slice(0, 5);
    const otherCount = entries.slice(5).reduce((s, [, n]) => s + n, 0);
    const result = top5.map(([name, count]) => ({
      name, pct: parseFloat(((count / total) * 100).toFixed(1)),
      color: protoColors[name] ?? MUTED,
      flag: protoFlags[name] ?? null,
    }));
    if (otherCount > 0) result.push({ name: 'Autres', pct: parseFloat(((otherCount / total) * 100).toFixed(1)), color: MUTED, flag: null });
    return result;
  })();

  // ─ Derive source IPs table from real data ─
  const sourceIps: typeof SOURCE_IPS = (() => {
    if (networkFlows.length === 0) return SOURCE_IPS;
    const seen = new Set<string>();
    return networkFlows
      .filter(f => { const k = f.source_host; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 10)
      .map(f => ({
        ip: f.source_host,
        country: f.source_zone || '—',
        proto: (f.protocol || '—').toUpperCase(),
        debit: '—',
        sev: f.status === 'bloqué' ? 'crit' : f.status === 'conditionnel' ? 'high' : 'low',
        label: f.status === 'bloqué' ? 'Bloqué' : f.status === 'conditionnel' ? 'Conditionnel' : 'Autorisé',
      }));
  })();

  const totalFlows = networkFlows.length;
  const blockedFlows = networkFlows.filter(f => f.status === 'bloqué').length;
  const inboundFlows = networkFlows.filter(f => f.direction === 'entrant').length;
  const outboundFlows = networkFlows.filter(f => f.direction === 'sortant').length;

  useEffect(() => {
    const months = ['jan','fév','mar','avr','mai','juin','juil','août','sept','oct','nov','déc'];
    const tick = () => {
      const now = new Date();
      const d = now.getDate();
      const m = months[now.getMonth()];
      const y = now.getFullYear();
      const h = String(now.getHours()).padStart(2,'0');
      const min = String(now.getMinutes()).padStart(2,'0');
      const s = String(now.getSeconds()).padStart(2,'0');
      setClock(`${d} ${m} ${y} — ${h}:${min}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const barData = trafficMode === 'in' ? IN_DATA : OUT_DATA;
  const barMax = Math.max(...barData);
  const barColor = trafficMode === 'in' ? BRAND : BRAND_LIGHT;

  const card: React.CSSProperties = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, display: 'flex', flexDirection: 'column' };
  const cardHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, gap: 10 };
  const thStyle: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, padding: '10px 20px', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 20px', verticalAlign: 'middle' };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: FG }}>Flux réseau</div>
            <div style={{ fontSize: 12, color: MUTED }}>Surveillance du trafic en temps réel</div>
          </div>
          <div style={{ flex: 1 }} />
          {/* live clock */}
          <div style={{ fontSize: 12, color: MUTED, fontFamily: "'JetBrains Mono', ui-monospace, monospace", display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: RISK_LOW, animation: 'pulse 2s ease-in-out infinite', flexShrink: 0 }} />
            {clock}
          </div>
          {/* Exporter PCAP */}
          <button
            onClick={() => toast.info('Export PCAP non disponible en démo')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, transition: 'all 0.12s' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Exporter PCAP
          </button>
          {/* secondary: add flow */}
          <button
            onClick={() => setShowForm(true)}
            title="Nouveau flux"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', cursor: 'pointer', color: MUTED }}
          >
            <Plus style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <KpiCard label="Flux documentés"    value={String(totalFlows)}                delta={totalFlows > 0 ? `${inboundFlows} entrant${inboundFlows !== 1 ? 's' : ''}` : '—'}  deltaType="neutral" color={BRAND}       />
          <KpiCard label="Flux sortants"      value={String(outboundFlows)}             delta={totalFlows > 0 ? `${Math.round((outboundFlows / Math.max(1, totalFlows)) * 100)}% du total` : '—'} deltaType="neutral" color={BRAND_LIGHT}  />
          <KpiCard label="Flux bloqués"       value={String(blockedFlows)}              delta={blockedFlows > 0 ? `${Math.round((blockedFlows / Math.max(1, totalFlows)) * 100)}% des flux` : '→ Aucun'} deltaType={blockedFlows > 0 ? 'down' : 'neutral'} color={RISK_HIGH}    />
          <KpiCard label="Protocoles détectés" value={String(protocols.length)}         delta={protocols.length > 0 ? protocols[0]?.name + ' majoritaire' : '—'}                  deltaType="neutral" color={RISK_LOW}     />
        </div>

        {/* two-col: 2fr 1fr */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

          {/* Trafic sur 24h */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: FG }}>Trafic sur 24h</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>— par heure</span>
            </div>
            <div style={{ padding: '20px 20px 0' }}>
              {/* toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, justifyContent: 'flex-end' }}>
                {(['in', 'out'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTrafficMode(m)}
                    style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                      border: `1px solid ${trafficMode === m ? BRAND : BORDER}`,
                      background: trafficMode === m ? BRAND : 'transparent',
                      color: trafficMode === m ? '#fff' : MUTED,
                      transition: 'all 0.12s',
                    }}
                  >
                    {m === 'in' ? 'Entrant' : 'Sortant'}
                  </button>
                ))}
              </div>
              {/* bars */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
                {barData.map((v, i) => {
                  const pct = Math.round((v / barMax) * 100);
                  return (
                    <div
                      key={i}
                      title={`${i}h — ${v} MB/s`}
                      style={{
                        flex: 1, borderRadius: '3px 3px 0 0', minHeight: 4,
                        background: barColor,
                        opacity: 0.55 + pct / 200,
                        height: `${pct}%`,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                      }}
                    />
                  );
                })}
              </div>
              {/* x-axis */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 16px' }}>
                {['0h','4h','8h','12h','16h','20h','24h'].map((l) => (
                  <span key={l} style={{ fontSize: 10, color: MUTED, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{l}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Répartition par protocole */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: FG }}>Répartition par protocole</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {protocols.map((p) => (
                <div key={p.name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, color: FG }}>
                      {p.name}
                      {p.flag && (
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                          background: p.flag.type === 'crit' ? 'oklch(55% 0.22 25 / 0.12)' : 'oklch(62% 0.18 52 / 0.12)',
                          color: p.flag.type === 'crit' ? RISK_CRIT : RISK_HIGH,
                        }}>
                          {p.flag.label}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: MUTED }}>{p.pct}%</span>
                  </div>
                  <div style={{ height: 6, background: BORDER, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.pct}%`, background: p.color, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* two-col-equal: 1fr 1fr */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Top connexions sources */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: FG }}>Top connexions sources</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>— 10 premières IPs</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {sourceIps.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>
                  Aucun flux documenté — ajoutez des flux via le bouton +.
                </div>
              ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['IP Source','Zone','Protocole','Débit','Statut'].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sourceIps.map((row) => (
                    <tr key={row.ip} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={tdStyle}><span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: MUTED }}>{row.ip}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: 13, color: FG }}>{row.country}</span></td>
                      <td style={tdStyle}><span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: MUTED }}>{row.proto}</span></td>
                      <td style={tdStyle}><span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: MUTED }}>{row.debit}</span></td>
                      <td style={tdStyle}><Pill sev={row.sev} label={row.label} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </div>

          {/* Anomalies récentes */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={{ fontSize: 13, fontWeight: 600, color: FG }}>Anomalies récentes</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: 4 }}>— dernières 2h</span>
              <div style={{ marginLeft: 'auto' }}>
                <Pill sev="crit" label={`${ANOMALIES.filter(a => a.sev === 'crit').length} critiques`} />
              </div>
            </div>
            <div>
              {ANOMALIES.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '11px 20px',
                    borderBottom: i < ANOMALIES.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4, ...dotStyle(a.sev) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.4, color: FG }}>{a.desc}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{a.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {showForm && (
        <FluxFormModal
          onClose={() => setShowForm(false)}
          onSaved={(f) => { setShowForm(false); onFlowCreated?.(f); }}
        />
      )}
    </>
  );
}

interface FluxFormModalProps {
  onClose: () => void;
  onSaved: (f: NetworkFlow) => void;
}

function FluxFormModal({ onClose, onSaved }: FluxFormModalProps) {
  const [form, setForm] = useState({
    flow_id: '',
    source_host: '',
    source_zone: '',
    destination_host: '',
    destination_zone: '',
    port: '',
    protocol: '',
    service: '',
    direction: 'entrant' as FlowDirection,
    status: 'autorisé' as FlowStatus,
    firewall_rule: '',
    justification: '',
    responsible: '',
    last_review_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const validate = () => {
    const e: Partial<Record<string, string>> = {};
    if (!form.flow_id.trim()) e.flow_id = 'Requis';
    if (!form.source_host.trim()) e.source_host = 'Requis';
    if (!form.destination_host.trim()) e.destination_host = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = await api.networkFlows.create(form);
      toast.success('Flux créé avec succès');
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const inp = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const cls = (key: string) =>
    `w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none ${
      errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#534AB7]/10 flex items-center justify-center">
              <Network className="w-4 h-4 text-[#534AB7]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Nouveau flux réseau</h2>
              <p className="text-xs text-gray-400">Documentez un flux autorisé ou bloqué</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">ID Flux *</label>
              <input {...inp('flow_id')} className={cls('flow_id')} placeholder="Ex: FLX-001" />
              {errors.flow_id && <p className="text-[11px] text-red-500 mt-0.5">{errors.flow_id}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Protocole</label>
              <input {...inp('protocol')} className={cls('protocol')} placeholder="Ex: TCP, UDP…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Source *</label>
              <input {...inp('source_host')} className={cls('source_host')} placeholder="Ex: 192.168.1.10" />
              {errors.source_host && <p className="text-[11px] text-red-500 mt-0.5">{errors.source_host}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Zone source</label>
              <input {...inp('source_zone')} className={cls('source_zone')} placeholder="Ex: LAN, DMZ…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Destination *</label>
              <input {...inp('destination_host')} className={cls('destination_host')} placeholder="Ex: 10.0.0.5" />
              {errors.destination_host && <p className="text-[11px] text-red-500 mt-0.5">{errors.destination_host}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Zone destination</label>
              <input {...inp('destination_zone')} className={cls('destination_zone')} placeholder="Ex: WAN, Prod…" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Port</label>
              <input {...inp('port')} className={cls('port')} placeholder="Ex: 443" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Direction</label>
              <select {...inp('direction')} className={cls('direction')}>
                <option value="entrant">Entrant</option>
                <option value="sortant">Sortant</option>
                <option value="bidirectionnel">Bidirectionnel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Statut</label>
              <select {...inp('status')} className={cls('status')}>
                <option value="autorisé">Autorisé</option>
                <option value="bloqué">Bloqué</option>
                <option value="conditionnel">Conditionnel</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Service</label>
              <input {...inp('service')} className={cls('service')} placeholder="Ex: HTTPS, SSH…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Règle firewall</label>
              <input {...inp('firewall_rule')} className={cls('firewall_rule')} placeholder="Ex: FW-RULE-42" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Responsable</label>
            <input {...inp('responsible')} className={cls('responsible')} placeholder="Ex: Jean Martin" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Justification</label>
            <textarea
              {...inp('justification')}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7] outline-none resize-none"
              placeholder="Raison du flux…"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#534AB7] text-white rounded-lg text-sm font-semibold hover:bg-[#3C3489] transition-colors disabled:opacity-60 shadow-sm shadow-[#534AB7]/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Création…' : 'Créer le flux'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
