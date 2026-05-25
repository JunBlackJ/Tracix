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
| Zod | 4.4 | Validation schémas |
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
| jsonwebtoken | 9.0 | JWT (access 1h + refresh 7j) |
| bcrypt | 5.1 | Hachage mots de passe |
| otplib v13 | 13.4 | TOTP MFA (TOTP + NobleCryptoPlugin + ScureBase32Plugin) |
| qrcode | 1.5 | Génération QR codes MFA |
| Resend | 6.12 | Envoi d'emails transactionnels |
| @anthropic-ai/bedrock-sdk | 0.29 | IA Claude Haiku via AWS Bedrock |
| node-saml | 5.1 | SSO SAML 2.0 |
| node-cron | 4.2 | Tâches planifiées |
| helmet | 8.2 | Sécurité headers HTTP |
| cors | 2.8 | CORS configurable |
| express-rate-limit | 8.5 | Rate limiting |
| express-async-errors | 3.1 | Gestion erreurs async |
| zod | 3.23 | Validation requêtes |
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
│   │   │   └── ui/             shadcn/ui (40+ composants)
│   │   ├── hooks/
│   │   │   └── useStore.ts     Store global (état auth + données)
│   │   ├── lib/
│   │   │   └── api.ts          Client HTTP (fetch + retry 401)
│   │   ├── types/
│   │   │   └── index.ts        Types TypeScript partagés
│   │   └── test/               Setup Vitest + tests
└── server/                     Backend Node/Express
    ├── src/
    │   ├── index.ts             Point d'entrée Express
    │   ├── routes/             19 routeurs Express
    │   ├── services/           Logique métier
    │   ├── middleware/         Auth, audit, rate-limit, erreurs
    │   ├── prisma/
    │   │   └── client.ts       Singleton Prisma
    │   └── config.ts           Variables d'environnement
    └── prisma/
        └── schema.prisma       Schéma 22 tables PostgreSQL
```

---

## Base de données — Schéma Prisma (23 tables)

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
| `password_reset_tokens` | Tokens de réinitialisation mot de passe (SHA-256, 30 min) |
| `refresh_tokens` | Tokens de refresh JWT (SHA-256, 7 jours, rotation) |
| `promo_codes` | Codes promo (upgrade Pro temporaire) |

---

## Authentification & Sécurité

### Flux d'authentification
- **Email/password** : `POST /api/auth/login` → access token 1h + refresh token 7j
- **MFA TOTP** : si activé, login retourne `{ mfa_required: true, user_id }` → `POST /api/auth/login/mfa` avec code TOTP 6 chiffres
- **OAuth** : Google, Microsoft, GitHub → redirect `/oauth/callback?token=` (access token seul, pas de refresh sur OAuth)
- **SSO SAML 2.0** : `GET /api/saml/login` → IdP → `POST /api/saml/callback` → token JWT
- **Invitations** : `GET /api/invitations/:token/accept` → crée un compte membre Tracix avec mot de passe

### JWT
- **Access token** : 1h, signé `HS256`, payload `{ userId, organizationId, email, role }`
- **Refresh token** : 7j, 32 bytes random hex, haché SHA-256 en DB, rotation à chaque utilisation (l'ancien est révoqué)
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
- Changement : `POST /api/auth/change-password` (vérifie l'ancien mot de passe)
- Réinitialisation : `POST /api/auth/forgot-password` (anti-énumération) → email Resend → `POST /api/auth/reset-password` (token SHA-256, 30 min, single-use)

### Sécurité HTTP
- `helmet` (headers sécurité), CORS restrictif (origine whitelist)
- Rate limiting : global 100 req/15 min, auth endpoints 20 req/15 min, admin 10 req/15 min
- Brute-force : verrouillage compte 15 min après 5 échecs (utilisateurs), 30 min après 5 échecs (admin)
- Délai progressif sur tentatives échouées

---

## API REST — Routes par domaine

### Auth (`/api/auth`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/login` | Login email/password |
| POST | `/login/mfa` | Validation TOTP après login |
| POST | `/register` | Inscription + création org |
| POST | `/logout` | Révoque refresh tokens |
| GET | `/me` | Profil utilisateur + org courante |
| POST | `/refresh` | Renouvelle access token via refresh token |
| PUT | `/organization` | Met à jour les paramètres org (seuils, modules, email) |
| GET | `/plan-limits` | Limites et usage du plan actuel |
| POST | `/onboarding` | Finalise l'onboarding (crée les plateformes initiales) |
| POST | `/promo` | Applique un code promo (upgrade Pro) |
| POST | `/change-password` | Changer son mot de passe |
| POST | `/forgot-password` | Demande de reset (anti-énumération) |
| POST | `/reset-password` | Reset avec token signé |
| GET | `/mfa/status` | Statut MFA utilisateur |
| POST | `/mfa/setup` | Génère secret + QR code |
| POST | `/mfa/enable` | Active le MFA (vérifie premier TOTP) |
| DELETE | `/mfa` | Désactive le MFA |
| POST | `/test-email` | Test envoi email (debug) |
| GET | `/oauth/google` | Redirect OAuth Google |
| GET | `/oauth/google/callback` | Callback Google |
| GET | `/oauth/microsoft` | Redirect OAuth Microsoft |
| GET | `/oauth/microsoft/callback` | Callback Microsoft |
| GET | `/oauth/github` | Redirect OAuth GitHub |
| GET | `/oauth/github/callback` | Callback GitHub |

### Membres (`/api/members`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des membres (filtres: status, team, account_type) |
| POST | `/` | Créer un membre (vérif limite plan) |
| GET | `/:id` | Détail membre + access rights |
| PUT | `/:id` | Modifier membre + recalcul score de risque |
| DELETE | `/:id` | Supprimer membre + accès + audit |

### Plateformes (`/api/platforms`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des plateformes |
| POST | `/` | Créer plateforme (vérif limite plan) |
| GET | `/:id` | Détail plateforme |
| PUT | `/:id` | Modifier plateforme + regénère alertes si MFA changé |
| DELETE | `/:id` | Supprimer plateforme + accès liés |

### Droits d'accès (`/api/access-rights`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des droits (filtres: member_id, platform_id, level) |
| POST | `/` | Créer/modifier un droit + recalcul score + audit |
| GET | `/:id` | Détail droit |
| PUT | `/:id` | Modifier droit + recalcul score + audit |
| DELETE | `/:id` | Révoquer droit (level=none) + audit |

### Systèmes (`/api/systems`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des systèmes |
| POST | `/` | Créer un système |
| GET | `/:id` | Détail système |
| PUT | `/:id` | Modifier système |
| DELETE | `/:id` | Supprimer système |

### Flux réseau (`/api/network-flows`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des flux |
| POST | `/` | Créer un flux |
| GET | `/:id` | Détail flux |
| PUT | `/:id` | Modifier flux |
| DELETE | `/:id` | Supprimer flux |

### Abonnements (`/api/subscriptions`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des abonnements |
| POST | `/` | Créer abonnement |
| GET | `/:id` | Détail abonnement |
| PUT | `/:id` | Modifier abonnement + regénère alertes expiration |
| DELETE | `/:id` | Supprimer abonnement |

### Alertes (`/api/alerts`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste (filtres: is_resolved, severity, type, source_module) |
| GET | `/:id` | Détail alerte |
| PATCH | `/:id/resolve` | Résoudre une alerte + audit |
| POST | `/resolve-all` | Résoudre un tableau d'alertes |
| POST | `/:id/advice` | Conseil IA Claude Haiku (Free: 3/mois, Pro/Ent: illimité) |
| POST | `/regenerate` | Regénère toutes les alertes de l'org |

### Dashboard (`/api/dashboard`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/stats` | KPIs consolidés (membres, alertes, score de risque, distribution, historique) |

### Journal d'audit (`/api/audit-trail`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Journal paginé (filtres: actor, action, target_type) |

### Revues d'accès (`/api/reviews`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des campagnes |
| POST | `/` | Créer une campagne (snapshot des droits actifs) |
| GET | `/:id` | Détail campagne + items |
| PATCH | `/:id/items/:itemId` | Décision sur un item (confirmed/revoked/modified) |
| POST | `/:id/bulk` | Décision groupée sur un tableau d'items |
| POST | `/:id/complete` | Clôturer une campagne |
| DELETE | `/:id` | Supprimer une campagne |

### Import (`/api/import`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/` | Import CSV/Excel/JSON (membres, plateformes, accès, systèmes, flux, abonnements) |

### Rapports (`/api/reports`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Données brutes pour export PDF/Excel côté client |

### Catégories (`/api/categories`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste par type (team/platform/subscription) |
| POST | `/` | Créer catégorie (vérif limite plan) |
| DELETE | `/:id` | Supprimer catégorie |

### Modules personnalisés (`/api/custom-modules`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des modules |
| POST | `/` | Créer module (vérif limite plan) |
| PUT | `/:id` | Modifier module |
| DELETE | `/:id` | Supprimer module + entrées |
| GET | `/:id/entries` | Entrées d'un module |
| POST | `/:id/entries` | Créer entrée |
| PUT | `/:id/entries/:entryId` | Modifier entrée |
| DELETE | `/:id/entries/:entryId` | Supprimer entrée |

### Organisations (`/api/organizations`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Orgs de l'utilisateur connecté |
| POST | `/` | Créer une nouvelle organisation |
| POST | `/:id/switch` | Changer d'organisation active |

### Invitations (`/api/invitations`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Liste des invitations actives |
| POST | `/` | Créer invitation (vérifie limite sièges) |
| DELETE | `/:id` | Révoquer invitation |
| GET | `/:token` | Vérifier un token d'invitation |
| POST | `/:token/accept` | Accepter une invitation (crée compte UserApp) |

### Snapshots de risque (`/api/risk-snapshots`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Historique des snapshots (30 derniers jours) |

### SAML (`/api/saml`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/config` | Config SAML de l'org |
| PUT | `/config` | Sauvegarder la config SAML |
| DELETE | `/config` | Supprimer la config SAML |
| GET | `/login` | Initier une connexion SAML |
| POST | `/callback` | Callback SAML depuis l'IdP |

### Super-Admin (`/api/admin`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/login` | Login admin (mot de passe env) |
| POST | `/login/mfa` | Validation TOTP admin |
| GET | `/stats` | Stats globales (nb orgs, users, alertes) |
| GET | `/organizations` | Liste toutes les organisations |
| GET | `/users` | Liste tous les users |
| PATCH | `/organizations/:id` | Modifier org (plan, suspension) |
| DELETE | `/organizations/:id` | Supprimer organisation |
| GET | `/audit` | Journal d'audit global (toutes orgs) |
| GET | `/promo-codes` | Liste les codes promo |
| POST | `/promo-codes` | Créer un code promo |
| DELETE | `/promo-codes/:id` | Supprimer un code promo |
| GET | `/mfa/status` | Statut MFA admin |
| POST | `/mfa/setup` | Génère secret + QR code admin |
| POST | `/mfa/enable` | Active MFA admin |
| DELETE | `/mfa` | Désactive MFA admin |

---

## Services backend

### `alert.service.ts` — Moteur de règles
Génère les alertes selon 11 types de règles :

| Type | Déclencheur | Sévérité |
|---|---|---|
| `member_offboarding` | Membre actif avec date départ passée + accès actifs | critical |
| `orphan_account` | Membre sans email valide avec accès actifs | warning |
| `no_mfa_on_admin` | Plateforme avec admin(s) mais sans MFA activé | critical |
| `admin_count_high` | Nb d'admins > seuil org (défaut : 3) | warning |
| `shared_account_admin` | Compte service/partagé avec droits admin | warning |
| `access_review_overdue` | Droits sans revue depuis > délai org (défaut : 90j) | warning |
| `subscription_expiring` | Abonnement actif expirant dans < seuil (défaut : 30j) | warning |
| `subscription_expired` | Abonnement avec date passée encore actif | critical |
| `system_end_of_support` | Système avec fin de support dans < 180j | warning/critical |
| `system_not_patched` | Système sans patch depuis > 90j | warning |
| `flow_review_overdue` | Flux réseau sans revue depuis > 180j | info |

Paramètres configurables par org : `max_admin_per_platform`, `access_review_delay_days`, `subscription_alert_days`

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

Fonctions : `computeMemberRisk(memberId)`, `recomputeAllRiskScores(orgId)`

### `plan.service.ts` — Limites par plan

| Limite | Free | Pro | Enterprise |
|---|---|---|---|
| Membres | 10 | Illimité | Illimité |
| Plateformes | 3 | Illimité | Illimité |
| Modules perso | 0 | Illimité | Illimité |
| Catégories | 5 | Illimité | Illimité |
| Sièges | 3 | 10 | Illimité |
| Export | ❌ | ✅ | ✅ |
| Modules perso | ❌ | ✅ | ✅ |
| Invitations | ✅ | ✅ | ✅ |

### `cron.service.ts` — Tâches planifiées
Lancées chaque jour à **08:00** pour toutes les organisations :

1. **`processOffboarding`** : révoque automatiquement tous les accès des membres dont la date de départ est atteinte → statut `inactif` + audit
2. **`generateAlerts`** : exécute le moteur de règles complet
3. **`takeRiskSnapshot`** : capture le score de risque moyen + distribution dans `risk_snapshots`
4. **`checkSubscriptionEmails`** : email de rappel à J-30, J-14, J-7, J-1 pour les abonnements expirants (anti-doublon via audit_trail)
5. **`checkCriticalAlertEmails`** : digest quotidien des alertes critical/warning (si fréquence `daily`)
6. **`checkPlanExpiryEmail`** : alerte expiration plan Pro/Enterprise à J-7 et J-1

### `email.service.ts` — Emails transactionnels (Resend)
- `sendAlertEmail` : digest HTML des alertes avec tableau sévérité/type/message, retry 3× avec backoff exponentiel
- `sendPasswordResetEmail` : email avec lien reset (validité 30 min)

### `snapshot.service.ts`
- `takeRiskSnapshot(orgId)` : calcule et stocke `avg_score`, `count_critical/high/medium/low`, `member_count` dans `risk_snapshots` (upsert par date)

---

## Middleware

### `auth.ts`
- `requireAuth` : vérifie `Authorization: Bearer <token>`, decode JWT, injecte `req.user`
- `generateToken(payload)` : signe JWT HS256, expire 1h
- `generateRefreshToken(userId)` : génère 32 bytes random hex, SHA-256 hash, expire 7j

### `superadmin.ts`
- `requireSuperAdmin` : vérifie le token JWT admin (séparé du token utilisateur)
- `generateSuperAdminToken()` : token admin signé avec secret différent

### `audit.ts`
- `createAuditEntry(opts)` : insère dans `audit_trails` avec actor, action, target, old/new value, IP, user-agent
- `getClientIp(req)` : extrait IP réelle (supporte `X-Forwarded-For`)

### `rateLimiter.ts`
- `globalLimiter` : 100 req / 15 min par IP
- `authLimiter` : 20 req / 15 min par IP (login, register, forgot-password)
- `adminLimiter` : 10 req / 15 min par IP

### `error.ts`
- Handler global : capture `ZodError` (400), `Error` générique (500), log les erreurs inattendues

---

## Frontend — Pages et fonctionnalités

### `Landing.tsx` — Page d'accueil / Authentification
- Formulaire login (email + password) → gestion MFA si activé (étape TOTP 6 chiffres)
- Formulaire inscription
- Lien "Mot de passe oublié" → flow inline (saisie email → "email envoyé")
- Boutons OAuth Google / Microsoft / GitHub
- Design dark (#0E0C1E)

### `Onboarding.tsx` — Wizard 6 étapes
1. Bienvenue (skip possible)
2. Organisation (nom, secteur, taille, objectif)
3. Plateformes (sélection AWS/Azure/GitHub/Google/Okta/Slack/Jira/Autre → créées en DB au submit)
4. Inviter l'équipe (informatif, renvoie vers Paramètres)
5. Alertes (email notification, sélection types)
6. Passer à Pro (comparatif Free vs Pro, code promo)
- Barre de progression, navigation libre entre étapes visitées

### `Dashboard.tsx` — Vue d'ensemble
- KPIs : membres actifs, alertes critiques, score moyen, admins total
- Graphique score de risque historique (30j)
- Distribution des niveaux d'accès (pie)
- Alertes récentes non résolues
- Score moyen par équipe

### `Membres.tsx` — Gestion des membres
- Liste avec filtres (statut, équipe, type de compte, score)
- Vue détail latérale : accès par plateforme, score de risque avec facteurs détaillés, badge "Récent" si admin < 7j
- Création/édition membre (formulaire complet)
- Badge score de risque coloré

### `Plateformes.tsx` — Inventaire des plateformes
- Liste cartes avec indicateurs MFA, nb admins, statut
- Vue détail : membres ayant accès, statistiques
- Création/édition/suppression (boutons Modifier/Supprimer sur chaque carte et en vue détail)

### `Habilitations.tsx` — Matrice des accès
- Tableau membre × plateforme avec niveau d'accès (none/req/ro/rw/admin)
- Modification inline du niveau

### `ScoreRisque.tsx` — Score de risque
- Histogramme 4 barres (Critique/Élevé/Modéré/Conforme) avec vraies données
- Top membres à risque, filtres par niveau
- Export PDF via `window.print()` + CSS `@media print`
- Graphique courbe évolution 30 jours

### `Alertes.tsx` — Centre d'alertes
- Vue split : liste gauche + détail panneau droit
- Tabs : Toutes / Critiques / Élevées / Clôturées
- Filtres : recherche, sévérité, type
- Bouton "Conseil IA" → `AdviceModal` (Claude Haiku via Bedrock)
- Bouton "Traiter / Révoquer" → `RevokeModal` (formulaire contextualisé par type d'alerte)
- Bouton "Tout acquitter"
- Bouton "Configurer les règles" → `/parametres?section=organisation`
- Bell icon dans topbar avec badge rouge comptant les alertes non résolues

### `Revues.tsx` — Revues d'accès
- Tabs : Campagnes actives / Historique / Mes décisions en attente
- `CreateCampaignModal` : nom, description, date limite, filtre équipe/plateformes
- `CampaignCard` : progression, date limite, statut (Active/En retard/Complétée)
- Bouton "Clôturer" sur campagnes actives
- `PendingDecisionsTable` : décisions Maintenir/Révoquer par ligne
- Actions groupées "Tout maintenir / Tout révoquer"
- KPIs : campagnes actives, décisions en attente, taux complétion, droits révoqués

### `Journal.tsx` — Audit trail
- Tableau paginé de toutes les actions (actor, action, cible, IP, timestamp)

### `Rapports.tsx` — Rapports
- Génération et export PDF/Excel des données membres, accès, plateformes, abonnements

### `Import.tsx` — Import de données
- Upload CSV/Excel/JSON
- Mapping colonnes
- Preview avant import
- Modules : membres, plateformes, accès, systèmes, flux, abonnements

### `Systemes.tsx` — Inventaire systèmes
- CRUD systèmes (hostname, OS, criticité, patch, fin de support)

### `FluxReseau.tsx` — Flux réseau
- CRUD flux (source/destination, port, protocole, statut, justification)

### `Abonnements.tsx` — Abonnements SaaS
- CRUD abonnements (coût, renouvellement, statut, responsable)

### `Parametres.tsx` — Paramètres (10 sections)
1. **Profil** : nom, email
2. **Organisation** : nom, seuils d'alerte (max admins, délai revue, jours avant expiration abo)
3. **Plan** : usage actuel vs limites, upgrade
4. **Modules** : activation/désactivation modules
5. **Modules perso** : création/édition/suppression modules personnalisés
6. **Membres** : invitations (liste, créer, révoquer)
7. **Catégories** : tags pour membres/plateformes/abonnements
8. **SSO** : configuration SAML (entity ID, SSO URL, certificat)
9. **Intégrations** : email de notification (adresse, fréquence, test)
10. **Sécurité** : changer mot de passe + MFA TOTP (setup QR, activer, désactiver)
- Accessible via URL avec `?section=organisation` etc.

### `ResetPassword.tsx` — Page reset password
- Lit `?token=` depuis l'URL
- 3 états : formulaire / succès / lien invalide
- Design dark cohérent avec Landing

### `Admin.tsx` — Panneau super-admin
- Accessible sur `admin.tracix.io` ou `/admin`
- Login séparé (email + password d'env)
- MFA TOTP optionnel
- Onglets : Stats globales / Organisations / Utilisateurs / Audit global / Codes promo

### `CustomModulePage.tsx` — Modules personnalisés
- Rendu dynamique selon `module_type` : liste / contacts / documents / procédures / notes / KPIs
- CRUD entrées JSON flexibles

### `OAuthCallback.tsx` — Callback OAuth
- Lit `?token=` (ou `?error=`) depuis l'URL de redirect
- Appelle `loginWithToken` puis redirige vers `/dashboard`

### `Rejoindre.tsx` — Acceptation d'invitation
- Lit `:token` dans l'URL
- Affiche formulaire création de compte (nom, mot de passe)
- Appelle `POST /api/invitations/:token/accept`

---

## Store global — `useStore.ts`

État centralisé (React hooks, pas de Redux/Zustand) :

**État** : `user`, `organization`, `members`, `platforms`, `accessRights`, `systems`, `networkFlows`, `subscriptions`, `alerts`, `categories`, `customModules`, `isAuthenticated`, `isLoading`, `userOrganizations`

**Actions** : `login`, `loginWithMfa`, `loginWithToken`, `register`, `logout`, `loadAllData`, `refreshAlerts`, `refreshMembers`, `resolveAlert`, `resolveAllAlerts`, `updateAccessLevel`, `revokeAccess`, `upsertMember`, `upsertPlatform`, `removePlatform`, `upsertSystem`, `upsertNetworkFlow`, `upsertSubscription`, `addCategory`, `removeCategory`, `upsertCustomModule`, `removeCustomModule`, `setOrganization`, `switchOrganization`, `createOrganization`

---

## Client HTTP — `api.ts`

- Fonction `request<T>(path, options)` : fetch avec timeout 15s, `Authorization: Bearer`, gestion erreurs HTTP
- **Auto-retry sur 401** : tente `POST /auth/refresh` une fois (flag `isRetry`), met à jour les tokens et réessaie la requête originale
- Helpers token : `getToken/setToken/clearToken`, `getRefreshToken/setRefreshToken/clearRefreshToken`, `setTokenPair`

---

## Tests

### Serveur (Vitest, 10 tests)
- `plan.service.test.ts` : `getLimits` (free/pro/enterprise/inconnu) et `checkLimit` (en dessous, illimité, atteint)
- `risk.service.test.ts` : Prisma mocké — score 100 sans accès, pénalité départ, score borné [0, 100]

### Frontend (Vitest + jsdom, 6 tests)
- `api.test.ts` : helpers `getToken/setToken/clearToken` via localStorage
- `plan.test.ts` : shape de `ACCESS_LEVEL_CONFIG` (admin, ro, labels)

---

## Variables d'environnement

### Backend (`server/.env`)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
FRONTEND_URL=https://app.tracix.io
API_URL=https://api.tracix.io
PORT=4000
NODE_ENV=production

# Super-admin
SUPER_ADMIN_EMAIL=admin@tracix.io
SUPER_ADMIN_PASSWORD=...
SUPER_ADMIN_JWT_SECRET=...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Email
RESEND_API_KEY=re_...
RESEND_FROM=Tracix <noreply@tracix.io>

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
