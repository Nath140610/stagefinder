import { useState } from 'react'
import Logo, { Mark } from '../../components/Logo.jsx'
import { Button } from '../../components/ui.jsx'
export default function Landing({ onStart }) {
  const [privacy, setPrivacy] = useState(false)
  return (
    <div className="landing">
      <header className="top"><Logo /><nav aria-label="Navigation principale"><a href="#comment">Comment ça marche</a><Button variant="ghost" onClick={() => onStart()}>C’est parti ↗</Button></nav></header>
      <main>
        <section className="hero hero-split">
          <div className="hero-copy">
            <h1>Ton prochain stage.<br /><span>Juste au coin.</span></h1>
            <div className="hero-cta"><Button onClick={() => onStart()}>Trouver mon stage ! <span aria-hidden="true">↗</span></Button></div>
          </div>
          <div className="hero-map" aria-label="Illustration d’une recherche d’entreprises, sans résultats réels">
            <div className="map-paper"><div className="map-river" /><div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" /><div className="map-park park-one" /><div className="map-park park-two" /><span className="map-street">RUE DES POSSIBLES</span><div className="hero-radar" /><div className="hero-you"><Mark size={52} /><span>TOI, ET TON POTENTIEL</span></div>
            <div className="map-opportunity opportunity-one"><span>⌨</span><div><b>L’agence du coin</b><small>Et si c’était ici ?</small></div><i>↗</i></div>
            <div className="map-opportunity opportunity-two"><span>☕</span><div><b>Le prochain déclic</b><small>Parfois à deux rues.</small></div><i>↗</i></div>
            <div className="map-opportunity opportunity-three"><span>✦</span><div><b>Ta première expérience</b><small>Une piste à explorer.</small></div><i>↗</i></div>
            </div><span className="map-sticker">Petit rayon.<br />Grand départ.</span><span className="illustration-note">Illustration · à toi de trouver tes adresses</span>
          </div>
        </section>
        <section className="how-section" id="comment"><div className="section-intro"><span className="eyebrow">À toi le premier pas</span><h2>Trois étapes.<br />Et un vrai point de départ.</h2></div><div className="how-grid">{[['01', 'Pose ton épingle.', 'Ton domaine, ta ville, ton rayon. On part de ce qui compte pour toi.'], ['02', 'Repère les bons spots.', 'Des entreprises réelles, leur activité, leur distance et les contacts publiés.'], ['03', 'Passe à l’action.', 'Choisis tes pistes, prépare ton message et garde la main sur chaque candidature.']].map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
        <section className="closing-cta"><Mark size={54} /><div><h2>Ton stage ne va pas se trouver tout seul.</h2><p>Mais tu n’es plus tout seul pour le chercher.</p></div><Button onClick={() => onStart()}>Allez, on s’y met ↗</Button></section>
      </main>
      <footer className="site-footer"><Logo /><span>Des pistes locales. Un départ qui compte.</span><button onClick={() => setPrivacy(!privacy)} aria-expanded={privacy}>Données & confidentialité</button><a href="/mentions-legales">Mentions légales</a><a href="/cgv">CGV</a><a href="/confidentialite">Confidentialité</a></footer>
      {privacy && <section className="privacy-panel"><h3>Tes données restent entre tes mains.</h3><p>Ton profil et tes documents restent dans ton navigateur. Lors du paiement, une copie temporaire du profil et des entreprises choisies est conservée dans cet onglet pour retrouver la commande après un rechargement ; elle est effacée avec les données de l’onglet. Les recherches transmettent ta zone et tes critères aux services publics de cartographie et d’annuaire. La recherche automatique d’e-mails consulte les sites publics indiqués pour les entreprises trouvées, sans envoyer de message.</p><p>Des statistiques anonymes comptent les visites, les étapes du formulaire, les paiements vérifiés et les visites arrivées par un lien de partage. Elles ne contiennent ni ton nom ni ton adresse e-mail. La recherche est gratuite. L’envoi automatique coûte 2 € + 0,50 € par entreprise sélectionnée et passe par Stripe avant la connexion Google. Aucun e-mail n’est envoyé sans ton action sur le bouton d’envoi. Stripe traite les données de paiement ; Stage Finder ne reçoit pas ton numéro de carte.</p><p>Sur un site public en HTTPS, les e-mails envoyés peuvent contenir une image de suivi unique. Son chargement signale une ouverture possible, sans garantir que le destinataire a lu le message. Les jetons et leurs dates de chargement restent sur le serveur ; aucun pixel n’est ajouté aux e-mails envoyés depuis localhost.</p><p>Sources : <a href="https://annuaire-entreprises.data.gouv.fr/" target="_blank" rel="noreferrer">Annuaire des Entreprises</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> et <a href="https://geo.api.gouv.fr/" target="_blank" rel="noreferrer">API Découpage administratif</a>.</p></section>}
    </div>
  )
}
