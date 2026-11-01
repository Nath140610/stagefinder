# Connexion Google et envoi automatique

Le bouton Google est activé et le client OAuth existant est utilisé dans le build local. Aucun secret client n’est envoyé au navigateur. La validation OAuth réelle doit être effectuée par l’utilisateur ; les tests automatisés utilisent des réponses Gmail simulées et n’envoient aucun e-mail.

## Réglages du projet Google

Dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials), ouvrir le client OAuth Web correspondant au client ID de `.env.local`.

1. Activer **Gmail API** dans les API du projet.
2. Ajouter aux **origines JavaScript autorisées** les adresses exactes utilisées :
   - `http://localhost:3000` pour le serveur actuellement lancé ;
   - `http://127.0.0.1:3000` si cette adresse est utilisée ;
   - `http://localhost:5173` et `http://127.0.0.1:5173` pour Vite ;
   - l’origine HTTPS exacte du site après déploiement.
3. Configurer l’écran de consentement avec `openid`, `email`, `profile` et `https://www.googleapis.com/auth/gmail.send` uniquement. Retirer `gmail.readonly` s’il y figure : ce scope imposerait un audit de sécurité.
4. Tant que le projet est en mode test, ajouter les comptes autorisés dans **Audience → Utilisateurs tests**. Pour une ouverture à tous, suivre le processus de publication et de vérification requis par Google.

Le fichier de configuration OAuth local ne contient aucune origine JavaScript déclarée. Ce fichier peut être ancien : il faut vérifier les réglages actuels dans la console. Modifier ce JSON local ne modifie pas les réglages chez Google.

## Utilisation

1. Ouvrir `http://localhost:3000`, renseigner le profil et choisir les entreprises. Seules celles avec une adresse e-mail peuvent recevoir un envoi automatique.
2. Ajouter le CV et la lettre PDF au récapitulatif.
3. Régler le montant indiqué avec Stripe. La connexion Google apparaît seulement après confirmation du paiement par le serveur.
4. Choisir son compte Google puis autoriser l’envoi d’e-mails.
5. Vérifier le compte, les adresses et les messages, puis cliquer sur **Lancer l’envoi automatique**. Un message distinct est envoyé à chaque entreprise, avec les deux pièces jointes.
6. Garder l’onglet ouvert. Les envois confirmés sont conservés en mémoire et exclus lors d’une reprise. En cas de résultat incertain, vérifier d’abord le dossier Envoyés ; l’interface attend cette vérification avant toute reprise.

Le jeton reste en mémoire et expire. Une reconnexion est proposée au besoin. Recharger la page efface le profil, les documents et l’historique en mémoire : ne pas recharger pendant un envoi. Il ne s’agit pas d’une tâche serveur qui continue après fermeture de l’onglet.

## Variables et déploiement

```env
VITE_ENABLE_GMAIL=true
VITE_GOOGLE_CLIENT_ID=ton-client-id.apps.googleusercontent.com
```


Reconstruire avec `npm run build` après une modification de variable `VITE_*`. Sur Docker, fournir `--build-arg VITE_GOOGLE_CLIENT_ID=...`. Les identifiants clients sont publics ; ne jamais fournir le secret OAuth dans une variable VITE.

## En cas de blocage

- **origin_mismatch** : ajouter l’origine exacte dans le client OAuth Web.
- **access_denied / accès bloqué** : vérifier l’utilisateur test, l’audience et les autorisations Google.
- **Fenêtre bloquée** : autoriser les fenêtres Google pour localhost puis recliquer.
- **403 à l’envoi** : vérifier l’activation de Gmail API et l’autorisation `gmail.send`.
- **401** : reconnecter le compte puis reprendre les candidatures restantes.
- **429** : attendre avant de reprendre ; le site ne relance pas les envois en boucle.

Documentation officielle : [modèle de jeton Google](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [envoi avec Gmail API](https://developers.google.com/workspace/gmail/api/guides/sending).

## Validation Google

Le site n’utilise que `gmail.send`, classé « sensible » : Google demande une validation, sans audit de sécurité. Pour la demander, dans **Google Auth Platform → Centre de validation** :

- page d’accueil et règles de confidentialité (`/confidentialite`) sur le domaine vérifié de l’application ;
- une vidéo montrant la connexion, l’écran de consentement et l’envoi d’une candidature ;
- la justification suivante :

> Stage Finder lets students apply for internships. After reviewing the recipients, the user clicks a button and the app sends one personalised application e-mail with their CV and cover letter from their own Gmail account to each selected company. gmail.send is the narrowest scope that allows this. The app cannot read the mailbox, and the access token stays in the browser.
