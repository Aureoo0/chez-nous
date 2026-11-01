# Chez nous

L'app de l'appart : courses, tâches, ménage et lampes, synchronisés entre deux téléphones.

- **Courses** : ce qu'il faut acheter et ce qu'il y a à la maison. Un article coché passe « à la maison » ; quand il n'y en a plus, un geste le remet sur la liste. Fonctionne sans réseau au supermarché.
- **Tâches** : à faire une seule fois, avec une date et une personne.
- **Ménage** : corvées à jours fixes (le dimanche, le mardi et le vendredi) ou à fréquence, dans un calendrier du mois.
- **Maison** : lampes Philips Hue, autres objets, code d'invitation et réglages.

## Développement

```bash
npm install
npm run dev
```

Tant que `src/config.ts` est vide, ou avec `?demo` dans l'adresse, l'app tourne en mode démo avec des exemples, sans serveur. Ce mode n'existe pas dans la version en ligne.

## Fonctionnement

- Interface : React et Vite, installable sur le téléphone (PWA).
- Données : Supabase. Le schéma et les règles d'accès sont dans `supabase/migrations`.
- `supabase/functions/register` : crée les comptes. Seuls le premier compte et les détenteurs du code d'invitation peuvent s'inscrire, deux personnes au maximum.
- `supabase/functions/hue` : passerelle vers Philips Hue. Les jetons restent côté serveur.
- Mise en ligne : GitHub Pages à chaque push sur `main` (`.github/workflows/deploy.yml`).

## Activer les lampes Philips Hue

Il faut un pont Hue relié à la box. À faire une seule fois, depuis un ordinateur :

1. Créer un compte développeur sur [developers.meethue.com](https://developers.meethue.com), puis une application « Remote Hue API ».
2. Comme adresse de retour (callback), indiquer `https://tkgejauhvlroeskfzesl.supabase.co/functions/v1/hue/callback`.
3. Dans Supabase, section Edge Functions puis Secrets, ajouter `HUE_CLIENT_ID` et `HUE_CLIENT_SECRET` (fournis par Hue).
4. Dans l'app, onglet Maison, toucher « Connecter notre compte Hue ».

## Mot de passe oublié

L'app n'envoie pas d'e-mails. Pour réinitialiser un mot de passe : tableau de bord Supabase, section Authentication puis Users.
