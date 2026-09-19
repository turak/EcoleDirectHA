# EcoleDirecte vers Discord

Envoie automatiquement les devoirs et les alertes de notes EcoleDirecte sur un salon Discord, via un serveur MCP EcoleDirecte ([jeromeboivin/EcoleDirecteMCP](https://github.com/jeromeboivin/EcoleDirecteMCP)) construit et exécuté dans ce conteneur.

## Installation

1. Crée un webhook Discord dans le salon cible (Paramètres du salon → Intégrations → Webhooks) et copie son URL.
2. Configure les options de cet add-on : webhook, liste des élèves (nom + `student_id` EcoleDirecte), horaires.
3. **Avant le premier démarrage**, il faut fournir des identifiants EcoleDirecte déjà validés (la double authentification par question de sécurité n'est pas gérable depuis un add-on sans interface) :
   - Sur un PC, authentifie-toi une première fois avec le serveur MCP EcoleDirecte (voir son README), ce qui crée `~/.ecoledirecte/credentials.json` et `~/.ecoledirecte/session.json`.
   - Copie ces deux fichiers dans le dossier de données de cet add-on, sous `.ecoledirecte/` (accessible via le partage Samba ou l'add-on *File editor*, chemin `/addon_configs/<nom_du_slug>/.ecoledirecte/`).
4. Démarre l'add-on. Les journaux confirment la planification et l'état d'authentification.

## Trouver le `student_id`

Regarde les logs au premier démarrage, ou consulte le profil renvoyé par l'outil `get_student_profile` du serveur MCP.

## Options

| Option | Description |
|---|---|
| `discord_webhook_url` | URL du webhook Discord |
| `students` | Liste `{name, student_id}` |
| `daily_time` | Heure du digest quotidien (devoirs du lendemain) |
| `daily_skip_weekday` | Jour à sauter (0=dimanche...6=samedi, défaut 5=vendredi car pas cours le samedi) |
| `weekly_day` / `weekly_time` | Jour et heure du récapitulatif hebdomadaire |
| `grade_check_time` | Heure de vérification des nouvelles notes |
| `grade_alert_fraction` | Seuil d'alerte (0.5 = note à la moitié du barème ou moins) |

## Limite connue

Si la session EcoleDirecte expire un jour et qu'une nouvelle question de sécurité est demandée, l'add-on ne peut pas y répondre seul : les journaux afficheront une erreur d'authentification. Il faudra refaire l'étape 3 (répondre à la question sur un PC, recopier les fichiers).
