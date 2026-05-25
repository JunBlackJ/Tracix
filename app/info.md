# Tracix — Documentation technique complète

Tracix est une plateforme SaaS de gouvernance des accès IT (IAM / PAM) permettant aux équipes sécurité de centraliser, surveiller et auditer les droits d'accès de leurs membres sur leurs plateformes.

---

## Stack technique

### Frontend
| Technologie | Version | Rôle |
|---|---|---|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Typage statique |
| Vite | 7.2 | Build tool & dev server |
| React Router DOM | 7.6 | Routing SPA |
| Tailwind CSS | 3.4 | Utility-first CSS |
| shadcn/ui | — | Composants UI (Radix UI) |
| Lucide React | 0.562 | Icônes |
| Sonner | 2.0 | Toasts/notifications |
| Recharts | 2.15 | Graphiques (barres, courbes) |
| jsPDF + autotable | 4.2 / 5.0 | Export PDF |
| xlsx | 0.18 | Import/export Excel/CSV |
| Zod | 4.4 | Validation schémas (frontend uniquement) |
| Vitest | 1.6 | Tests unitaires |
| @testing-library/react | 16.3 | Tests composants |

### Backend
| Technologie | Version | Rôle |
|---|---|---|
| Node.js | 20 | Runtime |
| Express | 4.19 | HTTP framework |
| TypeScript | 5.4 | Typage statique |
| Prisma ORM | 5.13 | Accès base de données |
| PostgreSQL | — | Base de données |
| jsonwebtoken | 9.0 | JWT (access 1h + refresh 7j, kid + rotation) |
| bcrypt | 5.1 | Hachage mots de passe |
| otplib v13 | 13.4 | TOTP MFA (NobleCryptoPlugin + ScureBase32Plugin) |
| qrcode | 1.5 | Génération QR codes MFA |
| Resend | 6.12 | Envoi d'emails transactionnels |
| @anthropic-ai/bedrock-sdk | 0.29 | IA Claude Haiku via AWS Bedrock |
| node-saml | 5.1 | SSO SAML 2.0 |
| node-cron | 4.2 | Tâches planifiées (advisory lock PostgreSQL) |
| helmet | 8.2 | Sécurité headers HTTP + CSP stricte |
| cors | 2.8 | CORS configurable |
| express-rate-limit | 8.5 | Rate limiting |
| express-async-errors | 3.1 | Gestion erreurs async |
| zod | 3.23 | Validation requêtes (backend uniquement) |
| uuid | 9.0 | Génération UUIDs |
| Vitest | 1.6 | Tests unitaires services |

---

## Architecture

```
/
├── app/                        Frontend React/Vite
│   ├── src/
│   │   ├── pages/              Pages principales (une par route)
│   │   ├── components/
│   │   │   ├── layout/         AppLayout, sidebar, topbar
│   │   │   ├── ui/             shadcn/ui (40+ composants)
│   │   │   └── ErrorBoundary.tsx  Boundary React pour crash recovery
│   │   ├── hooks/
│   │   │   └── useStore.ts     Store global (état auth + données)
│   │   ├── lib/
│   │   │   └── api.ts          Client HTTP (fetch + retry 401 + refresh auto)
│   │   ├── types/
│   │   │   └── index.ts        Types TypeScript partagés
│   │   └── test/               Setup Vitest + tests
└── server/                     Backend Node/Express
    ├── src/
    │   ├── index.ts             Point d'entrée Express (22 routeurs)
    │   ├── routes/             22 routeurs Express
    │   ├── services/           Logique métier
    │   ├── middleware/         Auth (kid+rotation), audit, rate-limit, erreurs
    │   ├── prisma/
    │   │   └── client.ts       Singleton Prisma
    │   └── config.ts           Variables d'environnement
    └── prisma/
        └── schema.prisma       Schéma 30 tables PostgreSQL
```

---

## Base de données — Schéma Prisma (30 tables)

| Table | Description |
|---|---|
| `organizations` | Organisation (multi-tenant root) |
| `users` (UserApp) | Utilisateurs Tracix (admin, viewer, superadmin) |
| `user_organizations` | Relation N-N users ↔ orgs (multi-org) |
| `members` | Membres IT de l'organisation (pas des users Tracix) |
| `platforms` | Plateformes surveillées (AWS, GitHub, Okta…) |
| `access_rights` | Droits d'accès membre×plateforme (level: none/req/ro/rw/admin) |
| `systems` | Systèmes/serveurs inventoriés |
| `network_flows` | Flux réseau (source→destination, port, protocole) |
| `subscriptions` | Abonnements SaaS de l'organisation |
| `categories` | Catégories pour membres/plateformes/abonnements |
| `custom_modules` | Modules personnalisés (liste/contacts/documents/procédures/notes/kpis) |
| `custom_entries` | Entrées JSON flexibles dans les modules perso |
| `invitations` | Liens d'invitation membres (token, rôle, expiration 7j) |
| `review_campaigns` | Campagnes de revue d'accès |
| `review_items` | Décisions individuelles de revue (confirmed/revoked/modified) |
| `alerts` | Alertes générées par le moteur de règles |
| `audit_trails` | Journal d'audit complet (actor, action, old/new value, IP) |
| `saml_configs` | Configuration SSO SAML par organisation |
| `risk_snapshots` | Snapshots quotidiens du score de risque moyen |
| `admin_config` | Singleton config super-admin (TOTP) |
| `password_reset_tokens` | Tokens réinitialisation mot de passe (SHA-256, 30 min) |
| `refresh_tokens` | Tokens refresh JWT (SHA-256, 7j, rotation + session metadata) |
| `promo_codes` | Codes promo (upgrade Pro temporaire) |
| `roles` | Rôles RBAC nommés (préparation enterprise, tables vides) |
| `permissions` | Permissions granulaires RBAC (ex: `members.write`, `alerts.resolve`) |
| `role_permissions` | Jointure rôle ↔ permission |
| `user_roles` | Assignation utilisateur ↔ rôle ↔ organisation |
| `connectors` | Connecteurs d'import automatique (GitHub, Okta, MS Graph, Google WS) |
| `webhook_endpoints` | Endpoints webhook sortants (Slack, Teams, Discord, PagerDuty, Custom) |
| `api_keys` | Clés API format `trcx_*` (SHA-256 hashées, scopes, SCIM) |

### Index DB (tables chaudes)
- `alerts` : `(organization_id, is_resolved)`, `(organization_id, severity)`
- `audit_trails` : `(organization_id, created_at DESC)`, `(organization_id, actor)`
- `access_rights` : `(organization_id, level)`, `(member_id)`, `(platform_id)`
- `refresh_tokens` : `(user_id, revoked)`

---

## Authentification & Sécurité

### Flux d'authentification
- **Email/password** : `POST /api/auth/login` → access token 1h + refresh token 7j
- **MFA TOTP** : si activé, login retourne `{ mfa_required: true, user_id }` → `POST /api/auth/login/mfa` avec code TOTP 6 chiffres
- **OAuth** : Google, Microsoft, GitHub → `handleOAuthUser` émet les deux tokens via `issueTokenPair` → redirect `/oauth/callback?token=...&refreshToken=...`. `OAuthCallback` lit les deux params et appelle `loginWithToken(token, refreshToken)`.
- **SSO SAML 2.0** : `GET /api/saml/login` → IdP → `POST /api/saml/callback` → token JWT
- **Invitations** : `GET /api/invitations/:token/accept` → crée un compte membre Tracix avec mot de passe

### JWT
- **Access token** : 1h, signé `HS256`, header `kid: 'current'`, payload `{ userId, organizationId, email, role }`
- **Rotation de secret** : `JWT_SECRET_CURRENT` (actif) + `JWT_SECRET_PREVIOUS` (accepté pendant transition). `requireAuth` et `requireSuperAdmin` essaient les deux clés — rotation sans interruption de session.
- **Refresh token** : 7j, 32 bytes random hex, haché SHA-256 en DB, rotation à chaque utilisation (l'ancien est révoqué). Stocke `user_agent`, `ip_address`, `last_used_at`, `revoked_reason`.
- **Family revocation** : si un refresh token déjà révoqué est réutilisé → `updateMany({ revoked: true })` sur toute la famille + réponse 401 "session compromise".
- **Endpoint refresh** : `POST /api/auth/refresh` → valide hash, révoque ancien, émet nouvelle paire
- **Auto-retry frontend** : sur 401, `api.ts` tente un refresh automatique une seule fois (flag `isRetry`)

### MFA TOTP (utilisateurs et admin)
- Librairie : `otplib v13` — `new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() })`
- API : `totp.generate({ secret })` et `totp.verify(token, { secret })` (objets, pas strings)
- QR code PNG via `qrcode` avec URI `otpauth://totp/...`
- Routes : `GET /auth/mfa/status`, `POST /auth/mfa/setup`, `POST /auth/mfa/enable`, `DELETE /auth/mfa`
- Admin : mêmes routes sous `/api/admin/mfa/*`

### Mot de passe
- Hachage : `bcrypt` coût 10
- Politique : min 10 caractères, 1 majuscule, 1 chiffre (à l'inscription)
- Changement : `POST /api/auth/change-password` (vérifie l'ancien)
- Réinitialisation : `POST /api/auth/forgot-password` (anti-énumération) → email Resend → `POST /api/auth/reset-password` (token SHA-256, 30 min, single-use)

### Sécurité HTTP
- `helmet` avec CSP stricte : `defaultSrc 'self'`, `scriptSrc 'self'`, `objectSrc 'none'`, `frameAncestors 'none'`, `upgradeInsecureRequests`
- CORS restrictif (origine whitelist `FRONTEND_URL`)
- Rate limiting : global 100 req/15 min, auth 20 req/15 min, admin 10 req/15 min
- Brute-force : verrouillage 15 min après 5 échecs (utilisateurs), 30 min (admin)
- IDOR protection : toutes les routes mutantes vérifient `organization_id === req.user.organizationId` via `findFirst` avant mutation
- CSV formula escaping : toutes les cellules commençant par `=+-@\t\r` sont préfixées `'` à l'export (Journal, Membres)

### API Keys & SCIM
- Format clé : `trcx_<48 hex chars>`, SHA-256 haché en DB, préfixe 12 chars stocké
- Scopes : `read`, `write`, `scim`
- Middleware `requireApiKeyAuth` : vérifie Bearer token haché, scope requis, met à jour `last_used_at`
- SCIM v2 : `GET/POST/PUT/DELETE /api/scim/v2/Users` + `ServiceProviderConfig`

---

## API REST — Routes par domaine

### Auth (`/api/auth`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/login` | Login email/password |
| POST | `/login/mfa` | Validation TOTP après login |
| POST | `/register` | Inscription + création org |
| POST | `/logout` | Révoque tous les refresh tokens |
| GET | `/me` | Profil utilisateur + org courante |
| POST | `/refresh` | Renouvelle access token (family revocation si token révoqué) |
| PUT | `/organization` | Paramètres org (seuils, modules, email) |
| GET | `/plan-limits` | Limites et usage du plan actuel |
| POST | `/onboarding` | Finalise l'onboarding + crée plateformes initiales |
| POST | `/promo` | Applique un code promo |
| POST | `/change-password` | Changer mot de passe |
| POST | `/forgot-password` | Demande de reset (anti-énumération) |
| POST | `/reset-password` | Reset avec token signé |
| GET | `/mfa/status` | Statut MFA utilisateur |
| POST | `/mfa/setup` | Génère secret + QR code |
| POST | `/mfa/enable` | Active le MFA |
| DELETE | `/mfa` | Désactive le MFA |
| POST | `/test-email` | Test envoi email (admin only, timeout 5s) |
| GET | `/oauth/google` | Redirect OAuth Google |
| GET | `/oauth/google/callback` | Callback Google → redirect avec token+refreshToken |
| GET | `/oauth/microsoft` | Redirect OAuth Microsoft |
| GET | `/oauth/microsoft/callback` | Callback Microsoft |
| GET | `/oauth/github` | Redirect OAuth GitHub |
| GET | `/oauth/github/callback` | Callback GitHub |

### Membres (`/api/members`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des membres |
| POST | `/` | Créer un membre (vérif limite plan) |
| GET | `/:id` | Détail membre |
| PUT | `/:id` | Modifier membre + recalcul score |
| DELETE | `/:id` | Supprimer membre + accès + audit |
| GET | `/:id/risk` | Score de risque recalculé |
| POST | `/:id/offboard` | Offboarding manuel (révoque tous les accès) |

### Plateformes (`/api/platforms`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste |
| POST | `/` | Créer (vérif limite plan) |
| GET | `/:id` | Détail |
| PUT | `/:id` | Modifier + regénère alertes si MFA changé |
| DELETE | `/:id` | Supprimer + accès liés |

### Droits d'accès (`/api/access-rights`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste (filtres: member_id, platform_id, level) |
| POST | `/` | Créer droit + recalcul score + audit |
| GET | `/:id` | Détail |
| PUT | `/:id` | Modifier niveau + audit |
| PATCH | `/:id/level` | Changer niveau spécifiquement |
| PATCH | `/:id/revoke` | Révoquer (level=none) + audit |
| DELETE | `/:id` | Supprimer |

### Connecteurs (`/api/connectors`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des connecteurs configurés |
| POST | `/` | Créer/MAJ connecteur (upsert sur provider) |
| DELETE | `/:id` | Supprimer connecteur |
| POST | `/:id/sync` | Déclencher sync (202 fire-and-forget) |

Providers supportés : **GitHub** (PAT + org), **Okta** (SSWS token + domain), **Microsoft Graph** (client_credentials OAuth2), **Google Workspace** (Bearer + domain). Chaque sync upsert les membres via email comme clé unique.

### Webhooks (`/api/webhooks`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des endpoints |
| POST | `/` | Créer (signing_secret auto-généré) |
| PUT | `/:id` | Modifier |
| DELETE | `/:id` | Supprimer |
| POST | `/:id/test` | Envoyer payload signé HMAC-SHA256, retourne status_code |

Events : `alert.critical`, `alert.all`. Signature : header `X-Tracix-Signature: sha256=<hex>`.
Déclenchement automatique par `alert.service.ts` sur nouvelles alertes critical/high.

### API Keys (`/api/keys`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste (sans les clés complètes) |
| POST | `/` | Créer (retourne clé complète une seule fois) |
| DELETE | `/:id` | Révoquer |

### SCIM v2 (`/api/scim/v2`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/Users` | Liste users (format SCIM) |
| POST | `/Users` | Créer user → crée un Member |
| GET | `/Users/:id` | Get user |
| PUT | `/Users/:id` | Update user |
| DELETE | `/Users/:id` | Désactiver member (status = inactif) |
| GET | `/ServiceProviderConfig` | Metadata SCIM |

### Systèmes (`/api/systems`)
| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/` | Liste / Créer |
| GET/PUT/DELETE | `/:id` | Détail / Modifier / Supprimer |

### Flux réseau (`/api/network-flows`)
| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/` | Liste / Créer |
| GET/PUT/DELETE | `/:id` | Détail / Modifier / Supprimer |

### Abonnements (`/api/subscriptions`)
| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/` | Liste / Créer |
| GET/PUT/DELETE | `/:id` | Détail / Modifier + regénère alertes / Supprimer |

### Alertes (`/api/alerts`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste (filtres: is_resolved, severity, type) |
| GET | `/:id` | Détail |
| PATCH | `/:id/resolve` | Résoudre + audit |
| POST | `/resolve-all` | Résoudre un tableau d'alertes |
| POST | `/:id/advice` | Conseil IA Claude Haiku (Free: 3/mois, Pro/Ent: illimité) |
| POST | `/regenerate` | Regénère toutes les alertes |

### Dashboard (`/api/dashboard`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/stats` | KPIs consolidés (membres, alertes, score, distribution, historique) |

### Journal d'audit (`/api/audit-trail`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Journal paginé (filtres: actor, action, target_type) |

### Revues d'accès (`/api/reviews`)
| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/` | Liste / Créer campagne |
| GET | `/:id` | Détail + items |
| PATCH | `/:id/items/:itemId` | Décision individuelle |
| POST | `/:id/bulk` | Décision groupée |
| POST | `/:id/complete` | Clôturer |
| DELETE | `/:id` | Supprimer |

### Import (`/api/import`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/analyze` | Analyse IA des colonnes (Claude Haiku, max 50 lignes) |
| POST | `/batch` | Import membres + plateformes + accès (transaction) |
| POST | `/batch-platforms` | Import plateformes uniquement |
| POST | `/batch-subscriptions` | Import abonnements |
| POST | `/batch-members` | Import membres |
| POST | `/batch-systems` | Import systèmes |
| POST | `/batch-network-flows` | Import flux réseau |

### Rapports (`/api/reports`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/generate` | Génère rapport de conformité IA (Claude Haiku) |

### Catégories (`/api/categories`)
| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/` | Liste / Créer (vérif limite plan) |
| PUT/DELETE | `/:id` | Modifier / Supprimer |

### Modules personnalisés (`/api/custom-modules`)
| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/` | Liste / Créer (vérif limite plan) |
| PUT/DELETE | `/:id` | Modifier / Supprimer + entrées |
| GET/POST | `/:id/entries` | Entrées / Créer entrée |
| PUT/DELETE | `/:id/entries/:entryId` | Modifier / Supprimer entrée |

### Organisations (`/api/organizations`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Orgs de l'utilisateur |
| POST | `/` | Créer une organisation |
| POST | `/:id/switch` | Changer d'organisation active |

### Invitations (`/api/invitations`)
| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/` | Liste / Créer |
| DELETE | `/:id` | Révoquer |
| GET | `/:token` | Vérifier token |
| POST | `/:token/accept` | Accepter (crée compte UserApp) |

### Snapshots de risque (`/api/risk-snapshots`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Historique 30 derniers jours |

### SAML (`/api/saml`)
| Méthode | Route | Description |
|---|---|---|
| GET/PUT/DELETE | `/config` | Config SAML |
| GET | `/login` | Initier connexion SAML |
| POST | `/callback` | Callback depuis l'IdP |

### Super-Admin (`/api/admin`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/login` | Login admin |
| POST | `/login/mfa` | Validation TOTP admin |
| GET | `/stats` | Stats globales |
| GET/PATCH/DELETE | `/organizations/:id` | Gestion orgs |
| GET | `/users` | Liste tous les users |
| GET | `/audit` | Journal global |
| GET/POST/DELETE | `/promo-codes` | Gestion codes promo |
| GET/POST/DELETE | `/mfa/*` | Gestion MFA admin |

---

## Services backend

### `alert.service.ts` — Moteur de règles
Génère les alertes selon 11 types, puis appelle `triggerWebhooks(orgId, newAlerts)` en fire-and-forget pour notifier les endpoints configurés.

| Type | Déclencheur | Sévérité |
|---|---|---|
| `member_offboarding` | Membre actif avec date départ passée + accès actifs | critical |
| `orphan_account` | Membre sans email valide avec accès actifs | warning |
| `no_mfa_on_admin` | Plateforme avec admin(s) mais sans MFA activé | critical |
| `admin_count_high` | Nb d'admins > seuil org (défaut : 3) | warning |
| `shared_account_admin` | Compte service/partagé avec droits admin | warning |
| `access_review_overdue` | Droits sans revue depuis > délai org (défaut : 90j) | warning |
| `subscription_expiring` | Abonnement expirant dans < seuil (défaut : 30j) | warning |
| `subscription_expired` | Abonnement avec date passée encore actif | critical |
| `system_end_of_support` | Système avec fin de support dans < 180j | warning/critical |
| `system_not_patched` | Système sans patch depuis > 90j | warning |
| `flow_review_overdue` | Flux réseau sans revue depuis > 180j | info |

### `risk.service.ts` — Score de risque
Score sur 100, 6 facteurs de pénalité :

| Facteur | Pénalité |
|---|---|
| Trop d'accès Admin (> seuil org) | −20 pts |
| Revues dépassées (< 30j) | −15 pts |
| Revues dépassées (30–90j) | −25 pts |
| Revues dépassées (> 90j) | −35 pts |
| Départ passé + accès actifs | −30 pts |
| Compte partagé/service avec accès | −10 à −15 pts |
| Plateforme admin sans MFA | −10 pts |
| Membre inactif/suspendu avec accès | −20 pts |

Niveaux : 80–100 Conforme | 60–79 Modéré | 40–59 Élevé | 0–39 Critique

### `plan.service.ts` — Limites par plan

| Limite | Free | Pro | Enterprise |
|---|---|---|---|
| Membres | 10 | Illimité | Illimité |
| Plateformes | 3 | Illimité | Illimité |
| Modules perso | 0 | Illimité | Illimité |
| Catégories | 5 | Illimité | Illimité |
| Sièges | 3 | 10 | Illimité |

### `cron.service.ts` — Tâches planifiées
Lancées chaque jour à **08:00** avec **advisory lock PostgreSQL** (`pg_try_advisory_lock`) — une seule instance exécute le job en cas de déploiement multi-instance.

1. `processOffboarding` : révoque automatiquement les accès des membres partis
2. `generateAlerts` : moteur de règles complet + trigger webhooks
3. `takeRiskSnapshot` : capture score moyen + distribution
4. `checkSubscriptionEmails` : rappels J-30/J-14/J-7/J-1
5. `checkCriticalAlertEmails` : digest quotidien alertes critical/warning
6. `checkPlanExpiryEmail` : alerte expiration plan à J-7 et J-1

### `email.service.ts` — Emails transactionnels
- `sendAlertEmail` : digest HTML des alertes, retry 3× avec backoff exponentiel (max 6s)
- `sendPasswordResetEmail` : lien reset (30 min)
- Note : dans le handler `POST /test-email`, l'envoi est wrappé dans un `Promise.race` avec timeout 5s pour éviter de bloquer la requête HTTP

### `connector.service` (inline dans connectors.ts)
Sync providers via fetch natif :
- **GitHub** : `GET /orgs/{org}/members` avec PAT
- **Okta** : `GET /api/v1/users?filter=status eq "ACTIVE"` avec SSWS token
- **Microsoft Graph** : OAuth2 client_credentials → `GET /v1.0/users`
- **Google Workspace** : `GET /admin/directory/v1/users?domain=...` avec Bearer token

---

## Middleware

### `auth.ts`
- `requireAuth` : vérifie `Authorization: Bearer`, essaie `JWT_SECRET_CURRENT` puis `JWT_SECRET_PREVIOUS` (rotation sans coupure)
- `generateToken(payload)` : signe JWT HS256 avec `kid: 'current'`, expire 1h
- `generateRefreshToken(userId)` : 32 bytes random hex, SHA-256 hash, expire 7j

### `superadmin.ts`
- `requireSuperAdmin` : même logique double-clé pour rotation
- `generateSuperAdminToken()` : token admin `kid: 'current'`, expire 2h

### `audit.ts`
- `createAuditEntry(opts)` : insère dans `audit_trails`
- `getClientIp(req)` : extrait IP réelle (supporte `X-Forwarded-For`)

### `rateLimiter.ts`
- `globalLimiter` : 100 req / 15 min
- `authLimiter` : 20 req / 15 min
- `adminLimiter` : 10 req / 15 min

### `error.ts`
- Capture `ZodError` (400), erreurs génériques (500)

---

## Frontend — Pages et fonctionnalités

### `Landing.tsx` — Authentification
- Login (email + password + MFA TOTP si activé)
- Inscription, mot de passe oublié
- OAuth Google / Microsoft / GitHub

### `Onboarding.tsx` — Wizard 6 étapes
1. Bienvenue
2. Organisation (nom, secteur, taille, objectif)
3. Plateformes (sélection → créées en DB au submit)
4. Inviter l'équipe
5. Alertes email
6. Passer à Pro

### `Dashboard.tsx` — Vue d'ensemble
- KPIs, graphique score historique 30j, distribution accès, alertes récentes

### `Membres.tsx` — Gestion des membres
- Liste + vue détail latérale, score de risque avec facteurs, export CSV (formula-escaped)

### `Plateformes.tsx` — Inventaire des plateformes
- Cartes, vue détail, CRUD

### `Habilitations.tsx` — Matrice des accès
- Tableau membre × plateforme, modification inline

### `ScoreRisque.tsx` — Score de risque
- Distribution, top membres, courbe 30j, export PDF

### `Alertes.tsx` — Centre d'alertes
- Split liste/détail, tabs, conseil IA, bouton "Configurer les règles" → `/parametres?section=organisation`

### `Revues.tsx` — Revues d'accès
- Campagnes, décisions par item, actions groupées

### `Journal.tsx` — Audit trail
- Tableau paginé, export CSV (formula-escaped)

### `Import.tsx` — Import de données
- Upload Excel, analyse IA colonnes, mapping, preview, import batch

### `Parametres.tsx` — Paramètres (12 sections)
1. **Profil** : nom, email
2. **Organisation** : nom, seuils d'alerte
3. **Plan** : usage, upgrade
4. **Modules** : activation/désactivation
5. **Modules perso** : CRUD modules personnalisés
6. **Membres** : invitations
7. **Catégories** : tags
8. **SSO** : configuration SAML
9. **Intégrations** : email de notification + **Webhooks** (Slack/Teams/Discord/PagerDuty/Custom, HMAC signé, test live)
10. **Connecteurs** : sync automatique membres (GitHub/Okta/MS Graph/Google WS), bouton sync manuel
11. **API & SCIM** : gestion clés `trcx_*`, affichage clé complète unique à la création, infos endpoint SCIM
12. **Sécurité** : changer mot de passe + MFA TOTP
- Navigation directe via `?section=<id>`

### `ErrorBoundary.tsx` — Composant React
- Class component wrappant toutes les `<Routes>` (authenticated + unauthenticated)
- UI d'erreur cohérente avec bouton "Réessayer"
- Log `console.error` pour debug

### `OAuthCallback.tsx`
- Lit `?token=` et `?refreshToken=` depuis l'URL, appelle `loginWithToken(token, refreshToken)`

### `Admin.tsx` — Panneau super-admin
- Accessible sur `admin.tracix.io` ou `/admin`
- Onglets : Stats / Organisations / Utilisateurs / Audit global / Codes promo

---

## Store global — `useStore.ts`

État centralisé (React hooks) :

**État** : `user`, `organization`, `members`, `platforms`, `accessRights`, `systems`, `networkFlows`, `subscriptions`, `alerts`, `categories`, `customModules`, `isAuthenticated`, `isLoading`, `userOrganizations`

**Actions** : `login`, `loginWithMfa`, `loginWithToken(token, refreshToken?)`, `register`, `logout`, `loadAllData`, `refreshAlerts`, `refreshMembers`, `resolveAlert`, `resolveAllAlerts`, `updateAccessLevel`, `revokeAccess`, `upsertMember`, `upsertPlatform`, `removePlatform`, `upsertSystem`, `upsertNetworkFlow`, `upsertSubscription`, `addCategory`, `removeCategory`, `upsertCustomModule`, `removeCustomModule`, `setOrganization`, `switchOrganization`, `createOrganization`

---

## Client HTTP — `api.ts`

- Fonction `request<T>(path, options)` : fetch avec timeout 15s, `Authorization: Bearer`
- **Auto-retry sur 401** : tente `POST /auth/refresh` une fois (`isRetry`), met à jour tokens, réessaie
- Helpers token : `getToken/setToken/clearToken`, `getRefreshToken/setRefreshToken/clearRefreshToken`, `setTokenPair`
- Namespaces : `auth`, `members`, `platforms`, `accessRights`, `systems`, `networkFlows`, `subscriptions`, `alerts`, `categories`, `customModules`, `organizations`, `invitations`, `reviews`, `riskSnapshots`, `saml`, `dashboard`, `reports`, `import`, **`connectors`**, **`webhooks`**, **`apiKeys`**

---

## Tests

### Serveur (Vitest, 10 tests)
- `plan.service.test.ts` : `getLimits` (free/pro/enterprise/inconnu) et `checkLimit`
- `risk.service.test.ts` : Prisma mocké — score 100 sans accès, pénalité départ, score borné [0, 100]

### Frontend (Vitest + jsdom, 6 tests)
- `api.test.ts` : helpers `getToken/setToken/clearToken`
- `plan.test.ts` : shape de `ACCESS_LEVEL_CONFIG`

---

## Variables d'environnement

### Backend (`server/.env`)
```
DATABASE_URL=postgresql://...

# JWT — rotation sans coupure de session
JWT_SECRET_CURRENT=...       # clé active (signe les nouveaux tokens)
JWT_SECRET_PREVIOUS=...      # clé acceptée pendant transition (optionnel)
JWT_SECRET=...               # fallback compat anciens déploiements

FRONTEND_URL=https://app.tracix.io
API_URL=https://api.tracix.io
PORT=4000
NODE_ENV=production

# Super-admin
SUPER_ADMIN_EMAIL=admin@tracix.io
SUPER_ADMIN_PASSWORD=...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Email
RESEND_API_KEY=re_...

# AWS Bedrock (IA)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Frontend (`app/.env`)
```
VITE_API_URL=https://api.tracix.io/api
```

---

## Plans tarifaires

| | Free | Pro | Enterprise |
|---|---|---|---|
| Prix | 0 €/mois | 49 €/mois | Sur devis |
| Membres | 10 | Illimité | Illimité |
| Plateformes | 3 | Illimité | Illimité |
| Sièges Tracix | 3 | 10 | Illimité |
| Modules perso | ❌ | ✅ | ✅ |
| Export | ❌ | ✅ | ✅ |
| Invitations | ✅ | ✅ | ✅ |
| Conseil IA | 3/mois | Illimité | Illimité |
| SSO SAML | ❌ | ❌ | ✅ |

Codes promo : upgrade Pro temporaire via table `promo_codes` (N utilisations max, expiration optionnelle)

---

## Roadmap RBAC (préparé, non activé)

Les tables `roles`, `permissions`, `role_permissions`, `user_roles` sont créées en DB avec seed initial (`admin` → toutes les permissions). Le code applicatif utilise encore les rôles string (`admin`, `viewer`). La migration vers RBAC fin consiste à :
1. Seeder les rôles/permissions cibles
2. Remplacer les `requireRole([...])` par des vérifications `hasPermission('key')`
3. Exposer la gestion des rôles dans Paramètres
