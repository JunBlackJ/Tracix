# Tracix — Documentation Enterprise

Ce document couvre la sécurité, la conformité, l'observabilité, la qualité, le durcissement et les playbooks d'intégration. Il complète `info.md` (référence technique) et est destiné aux équipes sécurité, ops et intégrateurs.

---

## 1. Sécurité applicative & IAM

### 1.1 Modèle de menaces

| # | Menace | Vecteur | Contrôle en place |
|---|---|---|---|
| T1 | Vol de session (access token) | XSS, réseau non chiffré | Token court (1h), HTTPS obligatoire, CSP stricte (`script-src 'self'`) |
| T2 | Vol de refresh token | XSS | Refresh token dans cookie HttpOnly `__rt` (Secure, SameSite=Strict, Path=/api/auth) — inaccessible au JS, y compris en cas d'XSS. Family revocation si token révoqué réutilisé → révocation de toute la famille + 401 |
| T3 | Réutilisation d'un refresh révoqué | Token volé + replay | Détecté à `POST /auth/refresh` : `stored.revoked === true` → `updateMany revoked=true` + log |
| T4 | Brute-force login | Bots, credential stuffing | `authLimiter` 20 req/15 min, verrouillage 15 min après 5 échecs, bcrypt coût 10 |
| T5 | Takeover compte OAuth | Forgery de callback OAuth (CSRF) | State CSRF : valeur aléatoire 32 octets générée au redirect, stockée dans cookie HttpOnly `__oauth_state` (10 min, `SameSite=Lax`, `Path=/api/auth/oauth`), vérifiée par `crypto.timingSafeEqual` dans chaque callback Google/Microsoft/GitHub — toute divergence → rejet 401. CORS whitelist `FRONTEND_URL` pour les origines cross-site. |
| T6 | Compromission clé JWT | Fuite env, rotation oubliée | Double clé `JWT_SECRET_CURRENT/PREVIOUS`, kid dans header, rotation sans interruption |
| T7 | IDOR multi-tenant | Accès ressource d'une autre org | Toutes les mutations : `findFirst({ id, organization_id: orgId })` avant action |
| T8 | Compromission API key | Clé trcx_* exposée dans log/repo | SHA-256 haché en DB, préfixe seul visible après création, clé complète retournée une fois |
| T9 | Injection de formules CSV | Données utilisateur exportées | Cellules commençant par `=+-@\t\r` préfixées `'` à l'export |
| T10 | Offboarding oublié | Membre parti avec accès actifs | Alerte `member_offboarding` + cron quotidien `processOffboarding` (révocation auto) |
| T11 | Élévation de privilèges | Modification rôle côté client | Rôle décodé du JWT serveur, jamais du body client |
| T12 | Exposition secrets connecteurs | GitHub PAT, Okta token en clair | Config stockée dans colonne JSON `connectors.config`, accessible uniquement via API authentifiée avec vérification `organization_id` |
| T13 | Webhook forgé | Payload entrant non signé | Header `X-Tracix-Signature: sha256=<hmac>` vérifié à la réception (côté intégrateur) |
| T14 | Attaque timing sur tokens | Comparaison string naïve | SHA-256 hash comparé via index DB unique (pas de comparaison directe en mémoire) |
| T15 | Cron exécuté plusieurs fois | Multi-instance sans coordination | Advisory lock PostgreSQL `pg_try_advisory_lock(1337420)` : une seule instance exécute |
| T16 | Injection SCIM | Payload SCIM non validé | Validation Zod sur tous les champs entrants avant `prisma.member.upsert` |

### 1.2 Security Policy utilisateur

**Mots de passe**
- Minimum 10 caractères, 1 majuscule, 1 chiffre (imposé à l'inscription via regex Zod)
- Hachage bcrypt coût 10 (≈ 100 ms par vérification)
- Réinitialisation : token SHA-256 single-use, validité 30 min, email anti-énumération
- Changement : nécessite l'ancien mot de passe (`POST /auth/change-password`)

**MFA**
- TOTP 6 chiffres (otplib v13, NobleCryptoPlugin, ScureBase32Plugin)
- Recommandé pour tous les comptes admin
- Obligatoire pour le super-admin (activé en production avant mise en ligne)
- QR code scannable à l'activation (`POST /auth/mfa/setup` → `POST /auth/mfa/enable`)
- **Recovery codes** : 8 codes aléatoires à usage unique générés à l'activation (`POST /auth/mfa/enable`), retournés en clair **une seule fois**, stockés hashés SHA-256 en DB (`totp_recovery_codes String[]`). `POST /auth/mfa/recovery` consomme un code, désactive le TOTP et force un re-setup — le code utilisé est supprimé de la liste.
- Sans recovery code ni accès admin, le compte TOTP est définitivement verrouillé (acceptable pour le super-admin interne).

**Sessions**
- Access token : 1h — expiration courte pour limiter l'impact d'un vol
- Refresh token : 7j, renouvelé à chaque utilisation (rotation)
- Transport du refresh token : cookie HttpOnly `__rt` (flags : `Secure` en prod, `SameSite=Strict`, `Path=/api/auth`) — inaccessible au JS, y compris en cas d'XSS. Le corps des réponses JSON (`/auth/login`, `/auth/register`, `/auth/refresh`) ne contient **jamais** le refresh token.
- Le frontend envoie `credentials: 'include'` sur toutes les requêtes ; le cookie est transmis automatiquement par le navigateur.
- Politique recommandée : forcer re-authentification après 30j d'inactivité (implémentée via `purgeOldData()` — purge des refresh tokens expirés ou révoqués depuis > 30j)
- Déconnexion : révoque TOUS les refresh tokens de l'utilisateur + efface le cookie (`Max-Age=0`)

**API Keys**
- Rotation recommandée tous les 90 jours
- Scope minimal requis (`read` si lecture seule, `scim` uniquement pour intégrations SCIM)
- Révocation immédiate si suspicion de compromission (`DELETE /api/keys/:id`)
- Ne jamais commiter une clé `trcx_*` dans un repo — ajouter `*.env` et patterns `trcx_*` au `.gitignore`

### 1.3 Politique de gestion des secrets

| Secret | Emplacement | Accès | Rotation |
|---|---|---|---|
| `JWT_SECRET_CURRENT` | `server/.env` (prod : secrets manager) | DevOps uniquement | Procédure §5.3 ci-dessous |
| `JWT_SECRET_PREVIOUS` | Idem | Idem | Supprimé après 2h de coexistence |
| `DATABASE_URL` | `server/.env` | DevOps uniquement | Avec rotation des credentials PostgreSQL |
| `RESEND_API_KEY` | `server/.env` | DevOps | Annuellement ou sur incident |
| `AWS_ACCESS_KEY_ID/SECRET` | `server/.env` | DevOps | Tous les 90j (IAM rotation policy) |
| `GOOGLE/MICROSOFT/GITHUB CLIENT_SECRET` | `server/.env` | DevOps | Sur incident ou révocation OAuth |
| Secrets TOTP (users) | `users.totp_secret` (DB chiffrée) | Jamais exposé en clair | Désactivation + re-setup si compromis |
| Certificats SAML | `saml_configs.certificate` (DB) | Admin org uniquement | À chaque renouvellement IdP |
| Tokens connecteurs (`connectors.config`) | DB, colonne JSON | Admin org via API | Sur rotation côté provider |
| Signing secrets webhooks | `webhook_endpoints.signing_secret` | Admin org via API | Régénérer manuellement si exposé |
| Clés API `trcx_*` | DB (hash SHA-256 uniquement) | Admin org | Tous les 90j recommandé |

**Règle absolue** : aucun secret ne transite dans les logs applicatifs. Voir §5.2.

**En production** : utiliser un secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler). Le code lit `process.env.*` — compatible sans modification.

### 1.4 RBAC — Matrice des permissions (active)

Le middleware `requirePermission(key)` est câblé sur 8 fichiers de routes (`members`, `access`, `alerts`, `audit`, `import`, `connectors`, `webhooks`, `api-keys`). Les tables `roles`, `permissions`, `role_permissions` sont seedées via `prisma/seed.ts`. Le cache en mémoire (TTL 5 min) évite une requête DB à chaque appel.

**Fallback** : si les tables sont vides (deploy sans seed), `admin` et `owner` passent — aucune régression sur les environnements non seedés.

**Règle** : toute nouvelle route doit utiliser `requirePermission('resource.action')` — ne pas utiliser `requireRole` pour les vérifications fonctionnelles.

| Permission | owner | admin | security_manager | reviewer | auditor | viewer |
|---|---|---|---|---|---|---|
| `members.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `members.write` | ✅ | ✅ | ✅ | — | — | — |
| `members.delete` | ✅ | ✅ | — | — | — | — |
| `access_rights.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `access_rights.write` | ✅ | ✅ | ✅ | — | — | — |
| `access_rights.revoke` | ✅ | ✅ | ✅ | ✅ | — | — |
| `alerts.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `alerts.resolve` | ✅ | ✅ | ✅ | ✅ | — | — |
| `reviews.manage` | ✅ | ✅ | ✅ | ✅ | — | — |
| `platforms.write` | ✅ | ✅ | ✅ | — | — | — |
| `connectors.manage` | ✅ | ✅ | ✅ | — | — | — |
| `webhooks.manage` | ✅ | ✅ | ✅ | — | — | — |
| `api_keys.manage` | ✅ | ✅ | — | — | — | — |
| `audit_trail.read` | ✅ | ✅ | ✅ | — | ✅ | — |
| `reports.generate` | ✅ | ✅ | ✅ | — | ✅ | — |
| `organization.settings` | ✅ | ✅ | — | — | — | — |
| `billing.manage` | ✅ | — | — | — | — | — |
| `members.invite` | ✅ | ✅ | — | — | — | — |

### 1.5 Flow d'investigation de session compromise

**Déclencheur** : alerte `POST /auth/refresh` retourne `{ error: "Session compromise détectée" }` (code 401).

**Étapes d'investigation :**

```
1. Identifier l'utilisateur concerné
   → SELECT * FROM refresh_tokens WHERE user_id = '<id>' ORDER BY created_at DESC;

2. Examiner la famille révoquée
   → Filtrer revoked = true, noter user_agent, ip_address, created_at, last_used_at

3. Comparer avec la session légitime
   → L'utilisateur connaît-il l'IP/user_agent suspect ?
   → Heure de last_used_at : correspond à une activité normale ?

4. Vérifier l'audit trail
   → SELECT * FROM audit_trails WHERE actor = '<email>' ORDER BY created_at DESC LIMIT 50;
   → Actions anormales ? Changement de mot de passe, ajout d'API key, modification org ?

5. Actions immédiates
   a. Forcer la déconnexion complète : UPDATE refresh_tokens SET revoked = true WHERE user_id = '<id>';
   b. Forcer le changement de mot de passe (invalide bcrypt actuel)
   c. Si admin : désactiver TOTP + reset setup
   d. Si API keys : révoquer toutes les clés org concernée
   e. Notifier l'utilisateur par email

6. Post-mortem
   → Documenter dans audit_trail avec action 'security.session_compromise'
   → Vérifier si d'autres comptes ont des IP similaires
```

**Champs clés de `refresh_tokens` pour l'investigation :**
- `user_agent` : navigateur/OS de la session
- `ip_address` : IP à la création du token
- `last_used_at` : dernière utilisation (mis à jour à chaque rotation)
- `revoked` : vrai si révoqué
- `revoked_reason` : "family_revocation" si compromis, "logout" si déconnexion normale

---

## 2. Données, multi-tenant & conformité

### 2.1 Isolement des tenants

**Principe** : chaque donnée appartient à une `organization_id`. Aucune requête ne peut retourner des données d'une autre organisation sans être super-admin.

**Implémentation technique :**
- Toutes les routes authentifiées extraient `req.user!.organizationId` du JWT (jamais du body)
- Chaque `findMany` inclut `where: { organization_id: orgId }`
- Chaque `findUnique` sur une ressource mutée est précédé d'un `findFirst({ id, organization_id: orgId })` → 404 si non trouvé (pas de 403 pour éviter l'énumération)
- Le super-admin (`/api/admin`) est le seul endpoint sans filtre `organization_id` — protégé par `requireSuperAdmin` (JWT séparé + optionnellement TOTP)
- Le switch d'organisation (`POST /api/organizations/:id/switch`) vérifie que l'utilisateur est bien membre de l'org cible avant d'émettre un nouveau token

**Vérification automatisée recommandée :**
- Ajouter un test d'intégration "cross-tenant" : créer deux orgs, vérifier qu'un token org A ne peut pas lire/modifier les ressources org B sur toutes les routes mutantes.

### 2.2 Politique de rétention des données

La purge automatique est implémentée dans `server/src/services/cron.service.ts` via `purgeOldData()`, exécutée quotidiennement après le cron d'alertes. Les seuils sont configurables par variable d'environnement.

| Table | Rétention | Variable d'env | Implémentation |
|---|---|---|---|
| `audit_trails` | 365 j | `RETENTION_AUDIT_DAYS` (défaut: 365) | `purgeOldData()` — quotidien |
| `alerts` résolues | 180 j | `RETENTION_RESOLVED_ALERTS_DAYS` (défaut: 180) | `purgeOldData()` — quotidien |
| `refresh_tokens` révoqués/expirés | 30 j | `RETENTION_REFRESH_TOKEN_DAYS` (défaut: 30) | `purgeOldData()` — quotidien |
| `risk_snapshots` | 24 mois | — | À ajouter dans `purgeOldData()` |
| `password_reset_tokens` | 24h après expiration | — | À ajouter dans `purgeOldData()` |
| `webhook_endpoints` | Tant que configuré | — | Suppression manuelle |
| `connectors` | Tant que configuré | — | Suppression manuelle |
| Logs applicatifs | 90 jours | — | Rotation fichiers / politique hébergeur |

**Chaque exécution de `purgeOldData()` produit un log JSON structuré :**
```json
{
  "event": "data_retention_purge",
  "audit_trails_deleted": 42,
  "refresh_tokens_deleted": 15,
  "resolved_alerts_deleted": 8,
  "cutoffs": {
    "audit_trail": "2025-05-25T03:00:00.000Z",
    "refresh_token": "2026-04-25T03:00:00.000Z",
    "resolved_alerts": "2025-11-25T03:00:00.000Z"
  }
}
```

### 2.3 Droit à l'oubli & suppression d'organisation

**Suppression d'organisation (RGPD Art. 17) :**

```
1. Hard-delete de toutes les données liées (Prisma onDelete: Cascade sur toutes les relations)
   → DELETE FROM organizations WHERE id = ':orgId' suffit grâce aux cascades

2. Données non cascadées à traiter manuellement :
   → audit_trails : anonymiser actor (remplacer email par '[supprimé]') plutôt que supprimer
     (les logs d'audit ont une valeur légale indépendante de l'org)
   → refresh_tokens : supprimés par cascade sur users → organization

3. Délai légal : exécution dans les 30 jours suivant la demande (RGPD)

4. Confirmation : email de confirmation au propriétaire + entrée audit super-admin
```

**Suppression d'un utilisateur individuel :**
- `DELETE FROM users WHERE id = ':userId'` → cascade vers `refresh_tokens`, `password_reset_tokens`
- `audit_trails` : anonymiser `actor` = `'[utilisateur supprimé]'`, conserver les entrées pour l'intégrité du journal

**Soft-delete (roadmap) :**
Ajouter `deleted_at DateTime?` sur `Member` et `UserApp` pour permettre la récupération sous 30j. Filtrer `WHERE deleted_at IS NULL` dans toutes les requêtes.

### 2.4 Classification des données

| Niveau | Données | Accès | Mesures |
|---|---|---|---|
| **Confidentiel** | `users.totp_secret`, `saml_configs.certificate`, `connectors.config` (tokens providers), `api_keys` (hash), `users.password_hash` | Jamais exposé en API (totp_secret exclu des SELECT *) | Chiffrement colonne recommandé en prod |
| **Restreint** | `refresh_tokens`, `webhook_endpoints.signing_secret`, `audit_trails`, données membres | Admin org uniquement | Accès loggué, isolation tenant |
| **Interne** | Droits d'accès, alertes, scores de risque, abonnements | Tous les rôles authentifiés | Multi-tenant strict |
| **Public** | Nom de l'organisation (dans JWT), plan actif | Décodable depuis le token | — |

---

## 3. Observabilité & opérations

### 3.1 Métriques backend à surveiller

**Santé API :**
| Métrique | Seuil d'alerte | Source |
|---|---|---|
| Taux 5xx | > 1% sur 5 min | Logs Express / APM |
| Taux 4xx auth (401/403) | > 5% sur 5 min | Logs routes auth |
| Latence moyenne P95 | > 500 ms | APM / logs |
| Latence DB P95 | > 100 ms | Prisma query events |
| Tentatives login échouées | > 20/min par IP | `authLimiter` + logs |
| Refresh token révoqué réutilisé | Toute occurrence | Log `[Security] family revocation triggered` |
| Volume webhooks sortants | Pic > 10× baseline | Compteur `webhook_endpoints.last_status_code` |
| Erreurs connecteurs sync | > 3 échecs consécutifs | `connectors.last_sync_status = 'error'` |
| Durée cron quotidien | > 10 min | Log `[Cron] Daily check done` avec timestamp |

**À implémenter dans `app.ts` :**
```typescript
// Logging structuré (Pino recommandé)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      console.error(JSON.stringify({
        type: 'http_error',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        org_id: (req as any).user?.organizationId,
      }));
    }
  });
  next();
});
```

### 3.2 Métriques frontend à surveiller

**ErrorBoundary** : à chaque `componentDidCatch`, envoyer vers un service d'observabilité (Sentry recommandé) :
```typescript
componentDidCatch(error: Error, info: ErrorInfo) {
  // Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  console.error('[ErrorBoundary]', error, info.componentStack);
}
```

| Métrique | Valeur cible |
|---|---|
| Fréquence ErrorBoundary | < 0.1% des sessions |
| Pages les plus crashantes | Identifier via `info.componentStack` |
| Erreurs API côté client | 401 (session expirée), 503 (backend down) |

**Recommandation** : Sentry (frontend + backend) avec `orgId` et `userId` dans le contexte d'erreur.

### 3.3 Surveillance des crons

Chaque exécution du cron quotidien doit être tracée :

```typescript
// Début
console.log(JSON.stringify({ type: 'cron_start', job: 'daily', ts: new Date().toISOString() }));

// Fin (dans finally)
console.log(JSON.stringify({ type: 'cron_end', job: 'daily', ts: new Date().toISOString(), duration_ms: Date.now() - start }));

// Lock non obtenu
console.log(JSON.stringify({ type: 'cron_skip', job: 'daily', reason: 'advisory_lock_held', ts: new Date().toISOString() }));
```

**Alerte "cron silencieux"** : si aucune entrée `cron_end` n'est trouvée dans les logs depuis > 26h, déclencher une alerte (CloudWatch Logs Insights, Datadog, ou simple check DB sur `risk_snapshots.created_at` le plus récent).

### 3.4 Stratégie de backup PostgreSQL

| Paramètre | Recommandation |
|---|---|
| Fréquence | Daily full backup + WAL archiving continu |
| Rétention | 30 jours (daily) + 1 an (hebdomadaires) |
| Chiffrement | AES-256 au repos (activé par défaut sur AWS RDS / Supabase) |
| Test de restauration | Mensuel sur environnement staging |
| RPO cible | < 1h (avec WAL) |
| RTO cible | < 4h |

**Commande de sauvegarde manuelle :**
```bash
pg_dump $DATABASE_URL --format=custom --file=tracix_$(date +%Y%m%d_%H%M%S).dump
# Chiffrer avant upload :
gpg --symmetric --cipher-algo AES256 tracix_*.dump
```

**Test de restauration :**
```bash
pg_restore --dbname=$STAGING_DATABASE_URL tracix_backup.dump
# Smoke test : vérifier nb orgs, users, alertes
```

### 3.5 Traçage des échecs webhooks et connecteurs

**Webhooks :**
- `webhook_endpoints.last_status_code` et `last_triggered_at` mis à jour à chaque envoi
- Status ≥ 400 : logguer avec `[Webhook] delivery failed` + endpoint id + status
- Recommandation : après 5 échecs consécutifs en 24h, désactiver automatiquement (`active = false`) et notifier l'admin org par email

**Connecteurs :**
- `connectors.last_sync_status`, `last_sync_error`, `last_sync_at` mis à jour après chaque sync
- Si `last_sync_status = 'error'` 3 fois consécutives → alerte interne (alert type `connector_sync_failed`, severity `warning`)
- Recommandation de fréquence de sync : 1×/jour via cron, ou déclenchement manuel

---

## 4. Qualité, tests & déploiement

### 4.1 Tests — Backend (état actuel)

**Implémentés — `server/tests/` (23 tests, vitest + supertest, DB PostgreSQL réelle) :**

`auth.test.ts` (12 tests) :
- Login : 200 + access token, cookie `__rt` HttpOnly, 401 mauvais mot de passe, 401 email inconnu, 400 malformé
- Register : 201 crée user+org, 409 email déjà pris
- Refresh via cookie `__rt` : 200 + nouveau token, 400 sans cookie
- `/auth/me` : 200 avec token valide, 401 sans token
- Logout : cookie effacé (`Max-Age=0`)

`members.test.ts` (11 tests) :
- GET liste : 200 admin, 200 viewer (`members.read`), 401 sans token
- POST créer : 201 admin, 403 viewer (RBAC `members.write`)
- GET/:id : 200, PUT 200 update, DELETE 204, GET 404 après suppression
- Validation : 400 champs manquants, 400 email invalide

**À ajouter (roadmap) :**

`alert.service.test.ts` :
```typescript
// - generateAlerts crée des alertes pour member_offboarding
// - generateAlerts crée des alertes pour no_mfa_on_admin
// - idempotence : pas de doublons sur deux exécutions
```

`cron.service.test.ts` :
```typescript
// - purgeOldData : mock Date.now() pour vérifier les cutoffs
// - advisory lock : si lock non obtenu, job skippé
```

`access.test.ts`, `alerts.test.ts` :
```typescript
// - RBAC : reviewer peut révoquer (access_rights.revoke), viewer ne peut pas
// - Cross-tenant : token org A → 404 sur ressources org B (pas 403)
```

### 4.2 Tests d'intégration API (supertest)

**Flow 1 — Authentification complète (partiellement couvert) :**
```typescript
describe('auth flow', () => {
  it('login → refresh via cookie → logout', async () => {
    // ✅ Couvert dans auth.test.ts
    // À ajouter : login MFA → refresh → family revocation
  });
});
```

**Flow 2 — Cycle de vie d'un membre (partiellement couvert) :**
```typescript
describe('member lifecycle', () => {
  // ✅ create/read/update/delete couvert dans members.test.ts
  // À ajouter :
  // - POST /api/access-rights → assigner accès
  // - POST /api/reviews → créer campagne
  // - POST /api/members/:id/offboard → vérifier révocation accès
});
```

### 4.3 Pipeline CI/CD

```yaml
# Pipeline recommandé (GitHub Actions)

on: [push, pull_request]

jobs:
  lint:
    - eslint app/src --ext .ts,.tsx
    - eslint server/src --ext .ts

  type-check:
    - cd app && npx tsc --noEmit
    - cd server && npx tsc --noEmit

  test:
    services:
      postgres:
        image: postgres:15
        env: POSTGRES_DB=tracix_test
    steps:
      - cd server && npx prisma db push --force-reset
      - cd server && npx vitest run
      - cd app && npx vitest run

  build:
    - cd app && npm run build
    - cd server && npm run build

  deploy-staging:
    needs: [lint, type-check, test, build]
    if: branch == 'develop'
    steps:
      - npx prisma migrate deploy (staging DB)
      - deploy server
      - deploy app
      - smoke tests (voir §4.4)

  deploy-prod:
    needs: deploy-staging
    if: branch == 'master'
    environment: production  # approval manuel requis
    steps:
      - npx prisma migrate deploy (prod DB)
      - deploy server
      - deploy app
      - smoke tests prod
```

### 4.4 Environnements & règles de promotion

| Env | Branch | DB | Déploiement | Accès |
|---|---|---|---|---|
| Local | feature/* | PostgreSQL local | Manuel | Développeurs |
| Staging | develop | PostgreSQL staging | Auto sur push | QA + équipe |
| Production | master | PostgreSQL prod | Manuel (approval) | Tous |

**Règles de promotion staging → prod :**
1. Tous les tests CI verts
2. Smoke tests manuels sur staging :
   - Login email + MFA
   - Créer un membre + assigner un accès
   - Déclencher une alerte + conseil IA
   - Import Excel (5 membres test)
   - Sync un connecteur (GitHub test)
   - Tester un webhook (Discord sandbox)
3. Vérifier les migrations Prisma : `prisma migrate status` → toutes appliquées
4. Approval d'un second développeur (4-eyes principle)

**Smoke tests automatisés (post-deploy) :**
```bash
# Vérifier que l'API répond
curl -f https://api.tracix.io/api/health || exit 1
# Vérifier que le frontend charge
curl -f https://app.tracix.io || exit 1
```

---

## 5. Surface d'attaque & durcissement

### 5.1 Hardening HTTP — Configuration actuelle

```typescript
// server/src/app.ts — Helmet config en prod
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],           // Toutes les ressources : même origine
      scriptSrc:   ["'self'"],           // Pas d'inline scripts, pas de CDN externe
      styleSrc:    ["'self'", "'unsafe-inline'"],  // Inline styles autorisés (shadcn/ui)
      imgSrc:      ["'self'", 'data:', 'https:'],  // Images HTTPS + data URIs
      connectSrc:  ["'self'"],           // XHR/fetch : même origine uniquement
      fontSrc:     ["'self'"],           // Polices : même origine
      objectSrc:   ["'none'"],           // Interdire <object>, <embed>, <applet>
      frameAncestors: ["'none'"],        // Interdire l'intégration en iframe (clickjacking)
      upgradeInsecureRequests: [],       // HTTP → HTTPS automatique
    },
  },
}));

// CORS : whitelist stricte
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [config.frontendUrl, config.frontendUrl.replace('://', '://admin.')];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origine non autorisée — ${origin}`));
  },
  credentials: true,
}));
```

**Headers résultants attendus :**
```
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=15552000; includeSubDomains
```

### 5.2 Politique "no sensitive data in logs"

**Ne jamais logger :**
- Tokens JWT (access ou refresh) — même tronqués
- Clés `trcx_*` — même le préfixe peut être sensible en contexte d'investigation
- `totp_secret`
- `password_hash`
- Configs connecteurs (`config` JSON : tokens GitHub, Okta, MS, Google)
- Signing secrets webhooks
- Payload SCIM complet si contient des données PII

**Pattern à suivre dans les routes :**
```typescript
// ❌ Mauvais
console.log('Refresh token received:', rawToken);

// ✅ Bon
console.log('Refresh token validated for user:', userId);
```

**Prisma query logging** : désactiver en prod ou filtrer pour ne pas exposer les valeurs de `token_hash`.

### 5.3 Procédure de rotation des clés JWT

**Étapes concrètes :**

```
1. Générer une nouvelle clé forte :
   openssl rand -hex 64
   → Copier la valeur : <NEW_SECRET>

2. Mettre à jour les variables d'environnement :
   JWT_SECRET_PREVIOUS=<valeur actuelle de JWT_SECRET_CURRENT>
   JWT_SECRET_CURRENT=<NEW_SECRET>

3. Redéployer le serveur (rolling deploy recommandé)
   → Les tokens signés avec PREVIOUS sont encore acceptés (requireAuth essaie les deux)
   → Les nouveaux tokens sont signés avec CURRENT

4. Attendre 2h (durée de vie max d'un access token = 1h, marge 2×)
   → Après 2h, tous les access tokens signés avec PREVIOUS sont expirés

5. Retirer JWT_SECRET_PREVIOUS de l'environnement :
   JWT_SECRET_PREVIOUS= (vide)

6. Redéployer
   → Seul CURRENT est utilisé désormais

Résultat : rotation complète sans déconnecter aucun utilisateur.
```

**Fréquence recommandée** : tous les 90 jours, ou immédiatement sur incident.

### 5.4 CSV Formula Escaping — Impact et documentation utilisateur

**Vecteur** : un membre Tracix dont le nom contient `=HYPERLINK("http://evil.com","Cliquez")` ou `=cmd|'/c calc'!A1` peut exécuter du code arbitraire quand un admin exporte en CSV et ouvre dans Microsoft Excel.

**Protection implémentée** : toutes les cellules commençant par `=`, `+`, `-`, `@`, `\t`, `\r` sont préfixées par `'` (apostrophe) avant l'écriture CSV.

```typescript
const escCsv = (v: string) => /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
```

**Note utilisateur (à ajouter dans l'aide in-app) :**
> Les exports CSV Tracix protègent contre l'injection de formules Excel. Si un nom ou email commence par `=`, `+`, `-` ou `@`, il sera précédé d'une apostrophe dans le fichier exporté. Cette apostrophe est intentionnelle et n'affecte pas la lisibilité des données.

---

## 6. Produit, intégrations & usage enterprise

### 6.1 Playbook — Intégration Okta/SCIM

**Objectif** : provisionner automatiquement les membres Tracix depuis Okta et les désactiver quand ils quittent l'organisation.

**Prérequis :**
- Compte Okta avec permissions Provisioning
- Clé API Tracix avec scope `scim` (`trcx_...`)

**Étapes Okta :**
1. Dans Okta Admin → Applications → Ajouter une application → SCIM 2.0
2. SCIM connector base URL : `https://api.tracix.io/api/scim/v2`
3. Authentication : HTTP Header → `Authorization: Bearer trcx_<votre_clé>`
4. Supported provisioning actions : ✅ Push new users, ✅ Push profile updates, ✅ Deactivate users
5. Tester la connexion → Vérifier `GET /api/scim/v2/Users` retourne 200

**Résultat :**
- Nouvel employé dans Okta → `POST /api/scim/v2/Users` → Member créé dans Tracix
- Départ dans Okta → `DELETE /api/scim/v2/Users/:id` → Member passé à `status = 'inactif'` dans Tracix + alerte offboarding déclenchée

**Recommandation Tracix :** coupler avec un connecteur Okta (`POST /api/connectors`, provider `okta`) pour synchroniser aussi les groupes comme équipes.

---

### 6.2 Playbook — Intégration Slack/Teams/PagerDuty via Webhooks

**Objectif** : recevoir une notification dans Slack/Teams/PagerDuty dès qu'une alerte critique est générée dans Tracix.

**Étape 1 — Créer un Incoming Webhook dans Slack :**
1. Slack → Votre workspace → Apps → Incoming Webhooks → Add to Slack
2. Choisir le channel `#securite-it` → Copier l'URL `https://hooks.slack.com/services/...`

**Étape 2 — Configurer dans Tracix :**
1. Paramètres → Intégrations → Webhooks → Ajouter un webhook
2. Nom : "Alertes critiques Slack", Provider : Slack, URL : coller l'URL Slack
3. Events : ✅ `alert.critical`
4. Sauvegarder → Cliquer "Tester" → Vérifier le message dans `#securite-it`

**Format du payload envoyé par Tracix :**
```json
{
  "event": "alert.critical",
  "organization_id": "org_xxx",
  "alert": {
    "type": "no_mfa_on_admin",
    "severity": "critical",
    "message": "3 administrateurs sans MFA sur GitHub",
    "source_label": "GitHub",
    "created_at": "2025-06-01T08:00:00Z"
  }
}
```

**Vérification de signature (recommandée côté récepteur) :**
```typescript
const body = await req.text();
const sig = req.headers.get('X-Tracix-Signature'); // "sha256=abc..."
const expected = 'sha256=' + crypto.createHmac('sha256', SIGNING_SECRET).update(body).digest('hex');
if (sig !== expected) throw new Error('Signature invalide');
```

**PagerDuty** : même procédure avec une "Generic Webhook" integration V3 URL.

---

### 6.3 Playbook — Sync GitHub/Google Workspace pour inventaire membres

**Objectif** : maintenir à jour automatiquement la liste des membres Tracix depuis GitHub org ou Google Workspace.

**GitHub — Configuration :**
1. Générer un PAT GitHub (Settings → Developer settings → Personal access tokens → Fine-grained)
   - Permissions : `Organization members: Read`
2. Paramètres Tracix → Connecteurs → GitHub → Configurer
   - `org` : nom de l'organisation GitHub (ex: `acme-corp`)
   - `token` : PAT généré
3. Cliquer "Synchroniser maintenant" → Vérifier les membres créés dans Tracix

**Google Workspace — Configuration :**
1. Dans Google Admin SDK → Service Account → Activer "Directory API"
2. Délégation domain-wide pour `https://www.googleapis.com/auth/admin.directory.user.readonly`
3. Récupérer un access token via le service account
4. Paramètres Tracix → Connecteurs → Google Workspace → Configurer
   - `domain` : votre domaine (ex: `acme.com`)
   - `access_token` : token obtenu

**Fréquence recommandée :** 1×/jour via le cron Tracix (à ajouter dans `cron.service.ts` : appel `triggerSync` pour tous les connecteurs actifs).

**Comportement idempotent :**
- Si un membre existe déjà (même email) : mise à jour `full_name` et `team` uniquement
- Si un membre est dans Tracix mais pas dans le provider : **aucune suppression automatique** (pour éviter les suppressions accidentelles) — une alerte `member_offboarding` sera générée si une date de départ est renseignée
- Conflits de noms : le champ `username` est généré automatiquement avec suffixe numérique si collision

---

### 6.4 Comportement des connecteurs — Détails techniques

| Comportement | Implémentation |
|---|---|
| Idempotence | `upsert` sur `organization_id_email` — deux syncs consécutives donnent le même résultat |
| Membre supprimé côté Tracix, présent côté provider | Recréé à la prochaine sync (pas de tombstone) |
| Provider indisponible | `last_sync_status = 'error'`, `last_sync_error` rempli, sync suivante réessaie |
| Rate limiting provider | Pas de retry automatique (sync replanifiée au lendemain par le cron) |
| Limite de plan | Si l'org atteint sa limite de membres (Free: 10), les membres en excès sont ignorés |
| Audit | Chaque sync crée une entrée `import.connector_sync` dans `audit_trails` |

---

### 6.5 Usage des API Keys — Exemples concrets

**Scope `read` — Script interne de monitoring :**
```bash
# Lister les alertes critiques non résolues
curl https://api.tracix.io/api/alerts?is_resolved=false&severity=critical \
  -H "Authorization: Bearer trcx_votre_cle_read"

# Réponse : tableau d'alertes JSON
```

**Scope `write` — Script d'import automatique :**
```bash
# Créer un membre via API
curl -X POST https://api.tracix.io/api/members \
  -H "Authorization: Bearer trcx_votre_cle_write" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Alice Martin","email":"alice@acme.com","team":"Engineering"}'
```

**Scope `scim` — Intégration Okta/JumpCloud :**
```bash
# Lister les users SCIM (utilisé par Okta pour la réconciliation)
curl https://api.tracix.io/api/scim/v2/Users \
  -H "Authorization: Bearer trcx_votre_cle_scim"

# Créer un user SCIM
curl -X POST https://api.tracix.io/api/scim/v2/Users \
  -H "Authorization: Bearer trcx_votre_cle_scim" \
  -H "Content-Type: application/json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName": "alice.martin",
    "name": {"formatted": "Alice Martin"},
    "emails": [{"value": "alice@acme.com", "primary": true}],
    "active": true
  }'
```

---

### 6.6 Rapports de conformité IA — Usage

**Accès** : Rapports → Générer un rapport de conformité (`POST /api/reports/generate`)

**Ce que l'IA analyse (Claude Haiku via AWS Bedrock) :**
- Taux de complétion des revues d'accès (campagnes actives/terminées)
- Alertes critiques non résolues et leur ancienneté
- Membres avec score de risque élevé (> 60)
- Plateformes sans MFA avec administrateurs
- Taux d'offboarding réussi (membres partis sans accès restants)
- Abonnements expirés ou expirant bientôt

**Sections du rapport généré :**
1. **Synthèse exécutive** : score de conformité global, évolution vs mois précédent
2. **Points critiques** : top 5 risques à adresser en priorité
3. **Tableau de bord accès** : distribution des niveaux, anomalies détectées
4. **Recommandations** : actions concrètes par ordre de priorité
5. **Conformité réglementaire** : correspondance avec ISO 27001 A.9 (access control), SOC 2 CC6

**Utilisation pour un comité de risques :**
- Exporter en PDF (`jsPDF + autotable`) pour présentation en COMEX
- Fréquence recommandée : mensuel pour pilotage, trimestriel pour audit formel
- Conserver les rapports générés (à stocker côté client ou implémenter un endpoint d'archivage)

**Limites :**
- Free : non disponible
- Pro : illimité
- Qualité du rapport dépend du volume de données (> 20 membres recommandé pour des insights pertinents)
