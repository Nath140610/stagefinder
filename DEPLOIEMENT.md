# Mettre Stage Finder en ligne

Version préparée le 1er novembre 2026. Le site n’est pas encore déployé sur un hébergement public.

## Version de lancement

- Recherche gratuite par domaine, commune, rayon et enseigne.
- Coordonnées GPS réinitialisées lorsqu’on change de ville ; choix explicite de la commune.
- Entreprises avec ou sans e-mail ; seules celles avec une adresse de contact peuvent être sélectionnées pour l’envoi automatique. L’utilisateur peut ajouter une adresse qu’il a vérifiée.
- Paiement Stripe Checkout avant Google : 2 € de préparation + 0,50 € par entreprise choisie, en un seul paiement.
- Connexion Google et envoi automatique disponibles après vérification du paiement sur le serveur. Le site public ne charge aucun pixel tiers ; les e-mails envoyés peuvent intégrer une image de suivi d’ouverture.
- Lors du paiement, profil et sélection sont conservés dans le stockage temporaire de l’onglet pour restaurer la commande. Les documents PDF restent en mémoire et doivent être ajoutés de nouveau après un rechargement.

## Hébergement Node

Utiliser Node 22.12 ou plus récent, avec HTTPS fourni par l’hébergeur.

```sh
npm ci
npm run build
npm test
npm start
```

Le serveur écoute sur `PORT` (3000 par défaut), sert uniquement `dist/` et fournit `/api/find-emails` ainsi que les routes Stripe `/api/payment/*`. Le contrôle de santé est `/api/health`. `render.yaml` contient une configuration de service Node ; `Dockerfile` propose une image autonome.

## Render et Supabase

1. Dans Supabase, exécuter `supabase/schema.sql` dans **SQL Editor**, puis relever l’URL du projet et une clé secrète (**Settings → API Keys**).
2. Dans Render, choisir **New → Blueprint** et sélectionner ce dépôt : `render.yaml` crée le service et demande les variables secrètes.
3. Renseigner `VITE_GOOGLE_CLIENT_ID`, `STRIPE_SECRET_KEY`, `ADMIN_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` et `BRAVE_SEARCH_API_KEY`. Une variable `VITE_*` modifiée demande un nouveau déploiement, car elle est lue à la compilation. Ne pas définir `VITE_GMAIL_TEST_RECIPIENT` ni `ANALYTICS_DATA_FILE` sur Render.
4. Ajouter l’URL `https://….onrender.com` aux origines JavaScript autorisées du client OAuth Google.
5. Vérifier que les journaux Render affichent `Statistiques : Supabase`.

Le plan gratuit de Render met le service en veille après une période d’inactivité : le premier visiteur attend alors son redémarrage. Garder une seule instance (voir ci-dessous).

## Administration et statistiques

Le tableau est accessible sur `/ADMIN`. Il est protégé par `ADMIN_PASSWORD` (au moins 4 caractères), à définir comme variable secrète sur l’hébergeur. Le mot de passe local se trouve dans `.env.local` ; ne jamais le placer dans une variable `VITE_*` ou le publier. Les sessions administrateur sont conservées en mémoire pendant 12 heures. La connexion est limitée à cinq tentatives par adresse IP et par quart d’heure. Pour une mise en ligne publique, utiliser un mot de passe long et unique.

Le tableau compte les visites par onglet, les formulaires commencés et remplis, les arrivées au paiement et les visites issues des liens `/r/<code>`. L’abandon au paiement est compté après 30 minutes sans confirmation ou après une annulation. Les montants ne sont enregistrés qu’après vérification auprès de Stripe ; les paiements de test et les paiements réels sont séparés. L’ouverture du tableau vérifie également les commandes encore en attente auprès de Stripe, pour retrouver un paiement si l’onglet du candidat a été fermé. Ces statistiques ne stockent ni noms ni adresses e-mail des candidats.

En production, les données sont enregistrées dans Supabase : exécuter `supabase/schema.sql` une fois, puis définir `SUPABASE_URL` et `SUPABASE_SECRET_KEY` sur le serveur. Le serveur charge les tables au démarrage, les garde en mémoire et n’écrit que ce qui change : ne faire tourner qu’une seule instance à la fois. Sans ces variables, les données sont écrites dans `data/analytics.json`, hors de la racine HTTP (ou dans `ANALYTICS_DATA_FILE`, prioritaire sur Supabase), ce qui convient au développement local mais pas à Render, dont le disque est effacé à chaque déploiement. Le dossier `data/` et `.env.local` sont exclus de l’archive de publication.

## Suivi d’ouverture des e-mails

Quand Stage Finder est ouvert sur un domaine public HTTPS, chaque e-mail envoyé peut contenir une image de suivi unique fournie par `/api/tracking/pixel/<jeton>`. Les jetons et les dates du premier chargement sont conservés avec les statistiques sur le serveur. Le tableau de bord permet de vérifier les signaux d’ouverture sans demander l’accès en lecture à Gmail. Une image bloquée, mise en cache, chargée par un proxy ou préchargée ne permet pas de conclure avec certitude qu’une personne a lu ou n’a pas lu le message. Aucun pixel n’est inséré dans les messages préparés depuis localhost, inaccessible aux destinataires externes. Un domaine public HTTPS et un stockage persistant sont nécessaires pour un suivi durable.

Si le site et l’endpoint de suivi utilisent deux origines différentes, définir `VITE_TRACKING_BASE_URL` au build (URL publique HTTPS du serveur) et `TRACKING_ALLOWED_ORIGIN` sur le serveur (origine exacte du site). La configuration la plus simple utilise la même origine HTTPS pour les deux.

L’archive `StageFinder-production.zip` contient déjà le build, le serveur et ce guide. Après extraction, définir `STRIPE_SECRET_KEY` dans l’environnement puis démarrer `node server/index.js` : le serveur utilise uniquement les modules intégrés de Node. Ne pas utiliser `vite preview` comme serveur public.

Pour trouver le site des entreprises qui n’en ont pas dans les sources publiques, définir `BRAVE_SEARCH_API_KEY` sur le serveur (clé créée sur https://api-dashboard.search.brave.com). Une recherche d’utilisateur consomme jusqu’à 40 requêtes : fixer une limite de dépense dans le tableau de bord Brave. Sans clé, le serveur essaie DuckDuckGo, qui bloque rapidement le trafic automatisé : seuls les sites déjà connus sont alors lus, et l’interface le signale.

Ne jamais publier `.env.local`, `client_secret_*.json`, `.text/` ou le dossier source complet comme racine HTTP. Ces fichiers sont exclus des archives et de l’image Docker. Le client secret Google n’est pas nécessaire à cette application navigateur.

## Contrôles effectués

- Compilation de production et tests automatiques de recherche et du serveur.
- Audit npm : aucune vulnérabilité signalée après mise à jour des dépendances.
- Recherche réelle « Burger King », Paris, rayon de 3 km : quatre établissements actifs et correspondants renvoyés par l’annuaire. La source cartographique était indisponible et le résultat était bien signalé comme partiel.
- Navigation visuelle non vérifiée : aucun navigateur connecté disponible dans la session. Avant l’ouverture publique, parcourir le site sur ordinateur et mobile : profil, sélection de commune, recherche, sélection d’entreprise, récapitulatif, copie du message et lien de contact.

## Limites connues

Les API publiques peuvent être lentes ou indisponibles. L’interface indique les résultats partiels et permet de relancer. Les pages de registre et les résultats de carte sont plafonnés ; il ne s’agit pas d’un annuaire exhaustif. Un secteur proche, un contact publié ou une entreprise active ne signifie pas qu’un stage est proposé. Vérifier la fiche et le destinataire.

La recherche d’e-mail consulte uniquement le site renseigné, une entreprise à la fois, avec une limite de requêtes. Les coordonnées ne sont ni devinées ni transférées entre voisins. Une boîte de contact générale peut ne pas convenir au recrutement.

L’export DOCX vers PDF conserve le texte, pas la mise en page originale. Privilégier les PDF déjà exportés. Le module de conversion se charge seulement lors de l’ajout d’un document.

Compléter les informations réelles de l’éditeur et son moyen de contact avant une ouverture publique. Le panneau de confidentialité décrit le fonctionnement actuel ; il ne remplace pas ces informations.

## Configuration Stripe et Gmail

La clé secrète Stripe **de test** est maintenant configurée dans `.env.local` sur ce poste et reste exclue du dépôt et de l’archive : `STRIPE_SECRET_KEY=sk_test_…`. Redémarrer le serveur après chaque modification de cette clé. Deux sessions réelles de Checkout en mode test ont été créées puis annulées sans paiement : 2,50 € pour une entreprise et 3,50 € pour trois. Le retour « payé » n’a été vérifié qu’avec des réponses simulées dans les tests automatisés ; effectuer un parcours avec une carte de test Stripe avant l’ouverture aux utilisateurs. Ne passer à `sk_live_…` qu’après essais complets et configuration de l’activité Stripe. Ne jamais placer cette clé dans une variable `VITE_*` ni dans le build client.

Stripe Checkout est ouvert dans un second onglet. Garder l’onglet Stage Finder ouvert : il vérifie le paiement directement auprès de Stripe avant de proposer Google. Si l’onglet est rechargé, le profil et la commande sont restaurés depuis le stockage de session ; ajouter de nouveau les documents PDF. Une session ouverte peut être annulée côté Stripe avant de modifier la sélection.

Suivre `GOOGLE_SETUP.md`, vérifier l’origine HTTPS du domaine dans Google Cloud et l’accès OAuth des utilisateurs prévus. `VITE_ENABLE_GMAIL=true` est activé ; fournir `VITE_GOOGLE_CLIENT_ID` avant de reconstruire. Une variable `VITE_*` est publique : ne jamais y placer un secret. L’origine `http://localhost:3000` doit également être autorisée pour les essais locaux.

Quand `VITE_GMAIL_TEST_RECIPIENT` est renseigné au moment de la compilation, tous les envois Gmail sont redirigés uniquement vers cette adresse, même dans un build de production. L’interface affiche clairement le mode test avant l’envoi. Vider cette variable puis reconstruire le site pour envoyer aux entreprises sélectionnées.
