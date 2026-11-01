import Logo from '../../components/Logo.jsx'

const env = import.meta.env
export const legalInfo = {
  name:env.VITE_LEGAL_NAME, address:env.VITE_LEGAL_ADDRESS, email:env.VITE_LEGAL_EMAIL, phone:env.VITE_LEGAL_PHONE,
  siret:env.VITE_LEGAL_SIRET, mediator:env.VITE_LEGAL_MEDIATOR, host:env.VITE_LEGAL_HOST, vat:env.VITE_LEGAL_VAT
}
const required = ['name', 'address', 'email', 'phone', 'siret', 'mediator', 'host']
// Live payments stay closed until the seller's identity is published.
export const legalReady = required.every(key => String(legalInfo[key] || '').trim())
const fill = value => String(value || '').trim() || '[à compléter avant l’ouverture]'
export const LEGAL_PATHS = { '/mentions-legales':Mentions, '/cgv':Terms, '/confidentialite':Privacy }

function Mentions() {
  return <>
    <h1>Mentions légales</h1>
    <h2>Éditeur du site</h2>
    <p>{fill(legalInfo.name)}<br />{fill(legalInfo.address)}<br />SIRET : {fill(legalInfo.siret)}<br />E-mail : {fill(legalInfo.email)}<br />Téléphone : {fill(legalInfo.phone)}{legalInfo.vat && <><br />{legalInfo.vat}</>}</p>
    <p>Directeur de la publication : {fill(legalInfo.name)}.</p>
    <h2>Hébergement</h2>
    <p>{fill(legalInfo.host)}</p>
    <h2>Sources des données</h2>
    <p>Les entreprises proviennent de l’<a href="https://annuaire-entreprises.data.gouv.fr/" target="_blank" rel="noreferrer">Annuaire des Entreprises</a> et d’<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> (© contributeurs OpenStreetMap). Les adresses e-mail sont celles publiées par les entreprises sur leurs sites. Une entreprise qui souhaite faire corriger ou retirer une information peut écrire à l’adresse ci-dessus.</p>
  </>
}

function Terms() {
  return <>
    <h1>Conditions générales de vente</h1>
    <h2>1. Vendeur et objet</h2>
    <p>Le service Stage Finder est vendu par {fill(legalInfo.name)}, dont les coordonnées figurent dans les <a href="/mentions-legales">mentions légales</a>. La recherche d’entreprises est gratuite. Le service payant permet d’envoyer automatiquement, depuis le compte Gmail du client, un e-mail personnalisé avec son CV et sa lettre à chaque entreprise sélectionnée.</p>
    <h2>2. Prix et paiement</h2>
    <p>Le prix est de 2 € de préparation, plus 0,50 € par entreprise sélectionnée, en euros et toutes taxes comprises. {legalInfo.vat ? `${legalInfo.vat}. ` : ''}Le total est affiché avant la commande. Il s’agit d’un paiement unique, sans abonnement, réalisé par carte sur la page sécurisée de Stripe. Stage Finder ne reçoit pas le numéro de carte.</p>
    <h2>3. Commande</h2>
    <p>Le client doit avoir au moins 18 ans ou disposer de l’autorisation de son représentant légal. La commande est conclue lorsque le paiement est confirmé. Un justificatif est envoyé à l’adresse indiquée sur la page Stripe.</p>
    <h2>4. Conditions nécessaires au service</h2>
    <p>Le client doit disposer d’un compte Google, le connecter et autoriser l’envoi d’e-mails, garder l’onglet ouvert pendant l’envoi et fournir son CV et sa lettre. Sans connexion ni autorisation de son compte Google, aucun e-mail ne peut être envoyé. Les limites et décisions de Google peuvent également restreindre les envois.</p>
    <h2>5. Absence de garantie de résultat</h2>
    <p>Stage Finder fournit un outil, avec une obligation de moyens. Il ne garantit ni l’obtention d’un stage, ni une réponse, ni l’existence d’une offre, ni l’exactitude de chaque adresse publiée, ni la réception du message par l’entreprise (filtres anti-spam, boîte fermée, destinataire inadapté). Les résultats sont des pistes issues de sources publiques, qui peuvent être incomplètes ou obsolètes.</p>
    <h2>6. Responsabilité du client</h2>
    <p>Les e-mails partent du compte du client et sous sa responsabilité. Il vérifie les destinataires, le contenu et les pièces jointes avant de lancer l’envoi. Un e-mail envoyé ne peut pas être annulé.</p>
    <h2>7. Droit de rétractation</h2>
    <p>Le client consommateur dispose de 14 jours à compter de la commande pour se rétracter, sans motif, en écrivant à {fill(legalInfo.email)}, par exemple avec le formulaire ci-dessous. Le remboursement intervient dans les 14 jours, par le même moyen de paiement.</p>
    <p>En cochant la case prévue avant le paiement, le client demande que le service commence immédiatement. Il perd son droit de rétractation une fois le service entièrement exécuté, c’est-à-dire lorsque tous les e-mails commandés ont été envoyés (article L221-28, 1° du Code de la consommation). S’il se rétracte après un envoi partiel, il paie un montant proportionnel au service déjà fourni (article L221-25). <b>Tant que l’envoi n’a pas été lancé, notamment si le compte Google n’a pas été connecté, le droit de rétractation reste entier pendant les 14 jours.</b></p>
    <blockquote><b>Formulaire de rétractation</b><br />À l’attention de {fill(legalInfo.name)}, {fill(legalInfo.address)}, {fill(legalInfo.email)} :<br />Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous.<br />Commandé le : … · Nom du consommateur : … · Adresse du consommateur : … · Date : …</blockquote>
    <h2>8. Garanties légales et remboursement</h2>
    <p>Le client bénéficie de la garantie légale de conformité applicable aux services numériques (articles L224-25-1 et suivants du Code de la consommation). Si le service ne peut pas être fourni pour une cause imputable à Stage Finder, y compris lorsque la connexion Google est impossible pour cette raison, le client est remboursé à hauteur des envois non réalisés.</p>
    <h2>9. Réclamation et médiation</h2>
    <p>Toute réclamation peut être adressée à {fill(legalInfo.email)}. À défaut d’accord, le client consommateur peut recourir gratuitement au médiateur de la consommation : {fill(legalInfo.mediator)}.</p>
    <h2>10. Droit applicable</h2>
    <p>Les présentes conditions sont soumises au droit français, sans priver le consommateur des protections de son pays de résidence.</p>
    <p><small>Version du 1er novembre 2026.</small></p>
  </>
}

function Privacy() {
  return <>
    <h1>Politique de confidentialité</h1>
    <p>Responsable du traitement : {fill(legalInfo.name)}, {fill(legalInfo.email)}.</p>
    <h2>Données restant dans ton navigateur</h2>
    <p>Ton profil, ton message, ton CV et ta lettre ne sont pas envoyés à notre serveur. Ils restent dans ton navigateur et partent directement vers Google lors de l’envoi. Une copie temporaire du profil et de la sélection reste dans l’onglet pendant le paiement.</p>
    <h2>Compte Google</h2>
    <p>Avec ton accord, le site demande ton identité Google (nom, adresse e-mail, photo) et l’autorisation d’envoyer des e-mails (<code>gmail.send</code>). Il ne peut pas lire ta boîte de réception. Le jeton d’accès reste en mémoire dans ton navigateur et n’est pas transmis à notre serveur. Ces données servent uniquement à envoyer les candidatures que tu lances, jamais à de la publicité. L’utilisation des données Google respecte la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, y compris ses exigences de Limited Use.</p>
    <h2>Données traitées sur le serveur</h2>
    <ul>
      <li><b>Statistiques de visite</b> : identifiant aléatoire d’onglet, étapes atteintes, lien de partage utilisé. Finalité : mesure d’audience. Conservation : 13 mois.</li>
      <li><b>Commandes</b> : identifiant de session Stripe, montant, nombre d’entreprises, dates, version des conditions acceptées. Finalité : exécution du contrat et obligations comptables. Conservation : 10 ans.</li>
      <li><b>Image de suivi</b> : jeton aléatoire, date et nombre de chargements, sans nom ni adresse e-mail. Finalité : indiquer une ouverture possible dans ton tableau de bord. Conservation : 13 mois.</li>
      <li><b>Recherche</b> : zone, critères et nom des entreprises, transmis pour trouver leurs coordonnées publiques.</li>
    </ul>
    <p>Le serveur limite le nombre de requêtes à l’aide de ton adresse IP, gardée en mémoire quelques minutes.</p>
    <h2>Image de suivi dans les e-mails</h2>
    <p>Sur le site public, chaque candidature contient une image invisible et, en bas du message, une ligne qui informe l’entreprise de l’utilisation de Stage Finder et de cette image. Son chargement signale une ouverture possible, sans preuve de lecture. Un destinataire peut bloquer les images de sa messagerie, ou demander des informations et s’opposer en écrivant à {fill(legalInfo.email)}.</p>
    <h2>Prestataires</h2>
    <p>Render (hébergement), Supabase (base de données), Stripe (paiement), Google (connexion et envoi), Brave Search (recherche de sites), Annuaire des Entreprises, API Découpage administratif et services OpenStreetMap (recherche et carte). Certains sont situés hors de l’Union européenne, notamment aux États-Unis, et peuvent y traiter des données dans le cadre des garanties prévues par le RGPD.</p>
    <h2>Cookies et stockage local</h2>
    <p>Le site utilise un cookie temporaire pour attribuer une visite à un lien de partage, un cookie de session pour l’administration et le stockage de l’onglet pour ta commande et les statistiques. Il ne charge aucun traceur publicitaire.</p>
    <h2>Tes droits</h2>
    <p>Tu peux demander l’accès, la rectification, l’effacement, la limitation ou t’opposer au traitement en écrivant à {fill(legalInfo.email)}. Tu peux aussi saisir la <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer">CNIL</a>. Tu peux retirer l’accès du site à ton compte depuis les <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">autorisations de ton compte Google</a>.</p>
    <p><small>Version du 1er novembre 2026.</small></p>
  </>
}

export default function LegalPage({ path }) {
  const Page = LEGAL_PATHS[path]
  return <div className="legal-page"><a href="/" aria-label="Retour à l’accueil"><Logo /></a><main><Page /></main><footer><a href="/mentions-legales">Mentions légales</a><a href="/cgv">CGV</a><a href="/confidentialite">Confidentialité</a></footer></div>
}
