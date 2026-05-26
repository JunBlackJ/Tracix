import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

interface Props {
  locked: boolean;
  message: string;
  children: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;
}

// Wraps a button: if locked, disables it and shows an upgrade tooltip on hover.
export function PlanGate({ locked, message, children }: Props) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  if (!locked) return children;

  const child = React.cloneElement(children, {
    disabled: true,
    onClick: undefined,
    style: {
      ...(children.props.style ?? {}),
      opacity: 0.45,
      cursor: 'not-allowed',
      filter: 'grayscale(0.4)',
    },
  });

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {child}
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#1E1B2E',
          border: '1px solid rgba(83,74,183,0.4)',
          borderRadius: 8,
          padding: '8px 12px',
          minWidth: 200,
          maxWidth: 260,
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          pointerEvents: 'all',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <Lock size={13} style={{ color: '#9D94E8', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, margin: 0 }}>{message}</p>
              <button
                onMouseDown={e => { e.preventDefault(); navigate('/paiement'); }}
                style={{
                  marginTop: 6, fontSize: 11.5, fontWeight: 600,
                  color: '#9D94E8', background: 'rgba(83,74,183,0.2)',
                  border: '1px solid rgba(83,74,183,0.35)',
                  borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                Passer à Pro →
              </button>
            </div>
          </div>
          {/* Arrow */}
          <div style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 8, height: 8, background: '#1E1B2E',
            border: '1px solid rgba(83,74,183,0.4)',
            borderTop: 'none', borderLeft: 'none',
            rotate: '45deg',
          }} />
        </div>
      )}
    </div>
  );
}
