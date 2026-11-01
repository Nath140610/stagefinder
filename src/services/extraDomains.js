// Specialties reuse the public activity filters of their parent sector.
// They help users choose a field without claiming that a company has a
// specific internship role. Keep ten specialties per sector.
const specialties = {
  'Informatique et numérique': [
    'Développement web', 'Développement mobile', 'Développement logiciel', 'Administration systèmes', 'Administration réseaux', 'Support informatique', 'Maintenance informatique', 'Cloud computing', 'Tests logiciels', 'Intégration web'
  ],
  'Commerce et vente': [
    'Grande distribution', 'Commerce de proximité', 'Vente en magasin', 'Vente en ligne', 'Vente de produits alimentaires', 'Vente de vêtements', 'Vente de matériel informatique', 'Vente de meubles', 'Vente de fournitures professionnelles', 'Relation client en magasin'
  ],
  'Hôtellerie et restauration': [
    'Restauration rapide', 'Restauration traditionnelle', 'Cuisine collective', 'Cuisine gastronomique', 'Service en salle', 'Hébergement hôtelier', 'Réception hôtelière', 'Traiteur et banquets', 'Cafés et salons de thé', 'Boulangerie restauration'
  ],
  'Médecine et santé': [
    'Soins infirmiers', 'Centres médicaux', 'Cliniques privées', 'Laboratoires médicaux', 'Imagerie médicale', 'Rééducation fonctionnelle', 'Kinésithérapie', 'Soins dentaires', 'Santé publique', 'Matériel médical'
  ],
  'Bâtiment et travaux publics': [
    'Maçonnerie', 'Plomberie', 'Électricité du bâtiment', 'Menuiserie du bâtiment', 'Charpente', 'Couverture et toiture', 'Peinture en bâtiment', 'Travaux de voirie', 'Rénovation de bâtiments', 'Génie civil'
  ],
  'Agriculture et agroalimentaire': [
    'Cultures céréalières', 'Maraîchage', 'Horticulture', 'Élevage bovin', 'Élevage avicole', 'Viticulture', 'Transformation alimentaire', 'Produits laitiers', 'Production de viande', 'Coopératives agricoles'
  ],
  'Industrie et production': [
    'Métallurgie', 'Plasturgie', 'Industrie textile', 'Industrie du bois', 'Fabrication de machines', 'Fabrication de meubles', 'Industrie papetière', 'Industrie chimique', 'Assemblage industriel', 'Contrôle de production'
  ],
  'Logistique et transport': [
    'Transport routier de marchandises', 'Transport de voyageurs', 'Entreposage', 'Préparation de commandes', 'Gestion de stocks', 'Livraison du dernier kilomètre', 'Fret ferroviaire', 'Fret aérien', 'Fret maritime', 'Chaîne logistique'
  ],
  'Tourisme et voyage': [
    'Agences de voyage', 'Guides touristiques', 'Offices de tourisme', 'Séjours organisés', 'Tourisme d’affaires', 'Tourisme rural', 'Tourisme culturel', 'Tourisme sportif', 'Accueil touristique', 'Réservation de voyages'
  ],
  'Énergie et développement durable': [
    'Énergie solaire', 'Énergie éolienne', 'Réseaux électriques', 'Gestion de l’eau', 'Traitement des déchets', 'Recyclage industriel', 'Efficacité énergétique', 'Chauffage durable', 'Hydrogène et énergie', 'Conseil en environnement'
  ],
  'Éducation et formation': [
    'Enseignement primaire', 'Enseignement secondaire', 'Enseignement supérieur', 'Formation professionnelle', 'Apprentissage', 'Soutien scolaire', 'Formation linguistique', 'Formation à distance', 'Orientation scolaire', 'Formation continue'
  ],
  'Culture, patrimoine et spectacle': [
    'Musées et expositions', 'Salles de spectacle', 'Production théâtrale', 'Conservation du patrimoine', 'Médiation culturelle', 'Bibliothèques publiques', 'Galeries d’art', 'Festivals culturels', 'Arts du spectacle', 'Centres culturels'
  ],
  'Banque, finance et assurance': [
    'Banque de détail', 'Banque professionnelle', 'Courtage en assurance', 'Assurance automobile', 'Assurance habitation', 'Assurance santé', 'Conseil financier', 'Gestion de patrimoine financier', 'Crédit immobilier', 'Services de paiement'
  ],
  'Droit et justice': [
    'Cabinets d’avocats', 'Notariat', 'Conseil juridique', 'Droit des entreprises', 'Droit du travail', 'Droit immobilier', 'Médiation juridique', 'Études de commissaires de justice', 'Services juridiques', 'Justice administrative'
  ],
  'Immobilier': [
    'Agences immobilières', 'Gestion locative', 'Promotion immobilière', 'Syndics de copropriété', 'Expertise immobilière', 'Immobilier commercial', 'Immobilier résidentiel', 'Location de bureaux', 'Administration de biens', 'Transactions immobilières'
  ],
  'Beauté et bien-être': [
    'Salons de coiffure', 'Instituts de beauté', 'Soins esthétiques', 'Spa et détente', 'Onglerie', 'Barber shops', 'Cosmétiques en institut', 'Massages bien-être', 'Soins du visage', 'Soins du corps'
  ],
  'Animation et sport': [
    'Clubs sportifs', 'Salles de sport', 'Coaching sportif', 'Activités nautiques', 'Sports collectifs', 'Sports de raquette', 'Centres équestres', 'Animation sportive', 'Équipements sportifs', 'Événements sportifs'
  ],
  'Journalisme et médias': [
    'Presse locale', 'Presse nationale', 'Radio locale', 'Télévision régionale', 'Médias en ligne', 'Rédaction de contenus', 'Reportage audiovisuel', 'Photojournalisme', 'Production d’information', 'Édition de journaux'
  ],
  'Social et humanitaire': [
    'Associations solidaires', 'Aide alimentaire', 'Insertion professionnelle', 'Accueil des personnes âgées', 'Accompagnement du handicap', 'Protection de l’enfance', 'Médiation sociale', 'Centres sociaux', 'Aide aux familles', 'Action humanitaire'
  ],
  'Automobile et mobilité': [
    'Concessions automobiles', 'Garages automobiles', 'Réparation de carrosserie', 'Entretien automobile', 'Vente de pièces automobiles', 'Contrôle technique automobile', 'Mobilité électrique', 'Location de véhicules', 'Réparation de motos', 'Équipements automobiles'
  ]
}

export const EXTRA_DOMAIN_PARENTS = Object.fromEntries(
  Object.entries(specialties).flatMap(([parent, names]) => names.map(name => [name, parent]))
)
