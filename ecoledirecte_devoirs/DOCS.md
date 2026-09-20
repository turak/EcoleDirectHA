# EcoleDirecte vers Discord

Envoie automatiquement les devoirs et les alertes de notes EcoleDirecte sur un salon Discord, via un serveur MCP EcoleDirecte ([jeromeboivin/EcoleDirecteMCP](https://github.com/jeromeboivin/EcoleDirecteMCP)) construit et exécuté dans ce conteneur.

## Installation

1. Crée un webhook Discord dans le salon cible (Paramètres du salon → Intégrations → Webhooks) et copie son URL.
2. Configure les options de cet add-on : webhook, liste des élèves (nom + `student_id` EcoleDirecte), horaires.
3. **Avant le premier démarrage**, il faut fournir des identifiants EcoleDirecte déjà validés (la double authentification par question de sécurité n'est pas gérable depuis un add-on sans interface) :
   - Sur un PC, authentifie-toi une première fois avec le serveur MCP EcoleDirecte (voir son README), ce qui crée `~/.ecoledirecte/credentials.json` et `~/.ecoledirecte/session.json`.
   - Copie ces deux fichiers dans le dossier de données de cet add-on, sous `.ecoledirecte/` (accessible via SSH/Samba, chemin `/addon_configs/<hash>_<nom_du_slug>/.ecoledirecte/` sur l'hôte HAOS ; ce dossier est monté sur `/config` à l'intérieur du conteneur).
   - **Important** : si tu changes la version de l'add-on après une première installation, une simple mise à jour ne suffit pas toujours à appliquer un nouveau point de montage — désinstalle puis réinstalle l'add-on pour forcer la recréation du conteneur avec les bons montages.
4. Démarre l'add-on. Les journaux confirment la planification et l'état d'authentification.

## Déclencher un test manuel

**Interface avec boutons (recommandé)** : ouvre la page de l'add-on dans Home Assistant → bouton **"OUVRIR L'INTERFACE WEB"** (ou l'icône dans la barre latérale si épinglée). Une page s'affiche avec un bouton par tâche (devoirs du lendemain, devoirs de la semaine, alertes notes) : clique dessus pour la lancer immédiatement et voir le résultat s'afficher sur la page (et sur Discord).

**Alternative en SSH/Samba** : crée un fichier **vide** dans le dossier de données de l'add-on (le même que `.ecoledirecte/`, donc `/addon_configs/<hash>_<slug>/`) :

- `trigger_daily` → lance le digest des devoirs du lendemain
- `trigger_weekly` → lance le récapitulatif de la semaine
- `trigger_grades` → lance la vérification des notes

```bash
touch /addon_configs/<hash>_<slug>/trigger_daily
```

L'add-on détecte le fichier dans les 5 secondes, lance la tâche correspondante puis le supprime automatiquement.

Pour tester une nouvelle tâche ajoutée plus tard, il suffit de l'enregistrer dans l'objet `JOBS` de `index.mjs` — elle apparaît alors automatiquement comme un nouveau bouton sur l'interface et bénéficie aussi de son fichier `trigger_<nom>`.

## Trouver le `student_id`

Regarde les logs au premier démarrage, ou consulte le profil renvoyé par l'outil `get_student_profile` du serveur MCP.

## Options

| Option | Description |
|---|---|
| `discord_webhook_url` | URL du webhook Discord |
| `students` | Liste `{name, student_id}` |
| `daily_time` | Heure du digest quotidien (devoirs du lendemain) |
| `daily_send_<jour>` | Un interrupteur par jour (dimanche à samedi) pour activer/désactiver l'envoi du digest ce jour-là. Par défaut activé dimanche→jeudi, désactivé vendredi et samedi (pas cours le lendemain) |
| `weekly_day` / `weekly_time` | Jour et heure du récapitulatif hebdomadaire |
| `grade_check_time` | Heure de vérification des nouvelles notes |
| `grade_alert_fraction` | Seuil d'alerte (0.5 = note à la moitié du barème ou moins) |

## Limite connue

Si la session EcoleDirecte expire un jour et qu'une nouvelle question de sécurité est demandée, l'add-on ne peut pas y répondre seul : les journaux afficheront une erreur d'authentification. Il faudra refaire l'étape 3 (répondre à la question sur un PC, recopier les fichiers).
