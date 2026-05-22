// Platform icons using Simple Icons CDN (free, open source brand icons)
// https://simpleicons.org/

const ICON_MAP: Record<string, string> = {
  // By platform name (lowercase)
  'github':      'https://cdn.simpleicons.org/github/181717',
  'cloudflare':  'https://cdn.simpleicons.org/cloudflare/F38020',
  'mailjet':     'https://cdn.simpleicons.org/mailjet/9B59B6',
  'aws':         'https://cdn.simpleicons.org/amazonaws/FF9900',
  'amazon web services': 'https://cdn.simpleicons.org/amazonaws/FF9900',
  'gcp':         'https://cdn.simpleicons.org/googlecloud/4285F4',
  'google cloud':'https://cdn.simpleicons.org/googlecloud/4285F4',
  'gitlab':      'https://cdn.simpleicons.org/gitlab/FC6D26',
  'jira':        'https://cdn.simpleicons.org/jira/0052CC',
  'slack':       'https://cdn.simpleicons.org/slack/4A154B',
  'notion':      'https://cdn.simpleicons.org/notion/000000',
  'linear':      'https://cdn.simpleicons.org/linear/5E6AD2',
  'figma':       'https://cdn.simpleicons.org/figma/F24E1E',
  'vercel':      'https://cdn.simpleicons.org/vercel/000000',
  'netlify':     'https://cdn.simpleicons.org/netlify/00C7B7',
  'heroku':      'https://cdn.simpleicons.org/heroku/430098',
  'digitalocean':'https://cdn.simpleicons.org/digitalocean/0080FF',
  'ovh':         'https://cdn.simpleicons.org/ovh/123F6D',
  'docker':      'https://cdn.simpleicons.org/docker/2496ED',
  'kubernetes':  'https://cdn.simpleicons.org/kubernetes/326CE5',
  'datadog':     'https://cdn.simpleicons.org/datadog/632CA6',
  'grafana':     'https://cdn.simpleicons.org/grafana/F46800',
  'sentry':      'https://cdn.simpleicons.org/sentry/362D59',
  'stripe':      'https://cdn.simpleicons.org/stripe/635BFF',
  'twilio':      'https://cdn.simpleicons.org/twilio/F22F46',
  'sendgrid':    'https://cdn.simpleicons.org/sendgrid/51A9E3',
  'shopify':     'https://cdn.simpleicons.org/shopify/96BF48',
  'salesforce':  'https://cdn.simpleicons.org/salesforce/00A1E0',
  'hubspot':     'https://cdn.simpleicons.org/hubspot/FF7A59',
  'zendesk':     'https://cdn.simpleicons.org/zendesk/03363D',
  'intercom':    'https://cdn.simpleicons.org/intercom/6AFDEF',
  'kibana':      'https://cdn.simpleicons.org/kibana/005571',
  'elasticsearch': 'https://cdn.simpleicons.org/elasticsearch/005571',
  'postgresql':  'https://cdn.simpleicons.org/postgresql/4169E1',
  'mysql':       'https://cdn.simpleicons.org/mysql/4479A1',
  'mongodb':     'https://cdn.simpleicons.org/mongodb/47A248',
  'redis':       'https://cdn.simpleicons.org/redis/DC382D',
  'nginx':       'https://cdn.simpleicons.org/nginx/009639',
  'apache':      'https://cdn.simpleicons.org/apache/D22128',
  'linux':       'https://cdn.simpleicons.org/linux/FCC624',
  'ubuntu':      'https://cdn.simpleicons.org/ubuntu/E95420',
  'debian':      'https://cdn.simpleicons.org/debian/A81D33',
  'cyberpanel':  'https://cdn.simpleicons.org/cpanel/FF6C2C',
  'cpanel':      'https://cdn.simpleicons.org/cpanel/FF6C2C',
  'plesk':       'https://cdn.simpleicons.org/plesk/52BBE6',
  'wordpress':   'https://cdn.simpleicons.org/wordpress/21759B',
};

// Category fallback icons
const CATEGORY_ICON_MAP: Record<string, string> = {
  'Administration': 'https://cdn.simpleicons.org/gnubash/4EAA25',
  'Dev':            'https://cdn.simpleicons.org/git/F05032',
  'Notification':   'https://cdn.simpleicons.org/mailgun/F06B66',
  'Cloud':          'https://cdn.simpleicons.org/icloud/3693F3',
  'Monitoring':     'https://cdn.simpleicons.org/prometheus/E6522C',
  'Security':       'https://cdn.simpleicons.org/letsencrypt/003A70',
  'Database':       'https://cdn.simpleicons.org/postgresql/4169E1',
};

interface PlatformIconProps {
  name: string;
  category?: string;
  size?: number;
  className?: string;
}

export function PlatformIcon({ name, category, size = 24, className = '' }: PlatformIconProps) {
  const key = name.toLowerCase().trim();
  const iconUrl = ICON_MAP[key]
    ?? (category ? CATEGORY_ICON_MAP[category] : undefined)
    ?? null;

  if (!iconUrl) {
    // Fallback: colored initial letter
    const colors = ['#534AB7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    const colorIndex = name.charCodeAt(0) % colors.length;
    const bg = colors[colorIndex];
    return (
      <div
        className={`rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
        style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.45 }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={iconUrl}
        alt={name}
        width={size * 0.6}
        height={size * 0.6}
        onError={(e) => {
          // If CDN fails, hide img and show fallback letter
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) {
            parent.innerHTML = `<span style="font-size:${size * 0.45}px;font-weight:700;color:#534AB7">${name.charAt(0).toUpperCase()}</span>`;
          }
        }}
      />
    </div>
  );
}
