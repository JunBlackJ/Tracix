import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, AlertTriangle } from 'lucide-react';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExportConfirmModal({ onConfirm, onCancel }: Props) {
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1E1B2E',
          border: '1px solid rgba(83,74,183,0.35)',
          borderRadius: 16,
          padding: '28px 28px 24px',
          maxWidth: 420, width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.25)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <AlertTriangle size={20} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F0FA' }}>Export unique</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Plan gratuit</div>
          </div>
        </div>

        {/* Body */}
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, marginBottom: 8 }}>
          Sur le plan gratuit, vous disposez d'<strong style={{ color: '#F1F0FA' }}>un seul export</strong>.
          Une fois utilisé, vous ne pourrez plus exporter vos données sans passer à Pro.
        </p>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 22 }}>
          Le plan <strong style={{ color: '#9D94E8' }}>Pro</strong> offre des exports illimités en CSV, XLSX et PDF.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 9, fontSize: 13,
              fontWeight: 500, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
            }}
          >
            Annuler
          </button>
          <button
            onClick={() => { onCancel(); navigate('/paiement'); }}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 9, fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
              border: '1px solid rgba(83,74,183,0.4)',
              background: 'rgba(83,74,183,0.15)', color: '#9D94E8',
            }}
          >
            Passer à Pro
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 9, fontSize: 13,
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #534AB7, #7C3AED)', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 4px 16px rgba(83,74,183,0.4)',
            }}
          >
            <Download size={14} /> Exporter quand même
          </button>
        </div>
      </div>
    </div>
  );
}
