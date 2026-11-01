import { EXTRA_DOMAIN_PARENTS } from './extraDomains.js'

// Termes OSM/Nominatim gratuits : chaque domaine possède son propre vocabulaire de recherche.
export const DOMAIN_CONFIG = {
  'Administration et gestion':['administration','accounting','consulting','management','office'],
  'Agriculture et agroalimentaire':['farm','agriculture','food','bakery','winery','dairy'],
  'Animation et sport':['sport','fitness','gym','stadium','animation','leisure'],
  'Architecture et urbanisme':['architect','architecture','urbanism','planning','surveying'],
  'Artisanat d’art':['craft','art','ceramics','jewellery','woodworker','atelier'],
  'Audiovisuel, cinéma et son':['cinema','audio','video','music','recording','studio'],
  'Automobile et mobilité':['garage','car_repair','car','dealership','car_wash','motorcycle'],
  'Banque, finance et assurance':['bank','finance','insurance','financial','credit'],
  'Beauté et bien-être':['beauty','hairdresser','spa','cosmetics','massage'],
  'Bâtiment et travaux publics':['construction','builder','building','plumber','electrician','carpenter'],
  'Biologie et chimie':['laboratory','biology','chemistry','pharmacy','research'],
  'Commerce et vente':['shop','retail','supermarket','mall','boutique','market'],
  'Communication et relations publiques':['communication','media','press','publicity','agency'],
  'Comptabilité et audit':['accounting','accountant','audit','bookkeeping','tax'],
  'Culture, patrimoine et spectacle':['museum','theatre','arts_centre','library','heritage','gallery'],
  'Cybersécurité':['cybersecurity','cyber','security','computer','software','network'],
  'Design graphique et UX/UI':['design','graphic','print','advertising','webdesign','photo'],
  'Droit et justice':['lawyer','legal','notary','court','justice'],
  'Édition et librairie':['books','bookshop','publisher','library','printing'],
  'Éducation et formation':['school','college','university','training','education'],
  'Électronique et robotique':['electronics','robot','electrical','automation','computer'],
  'Énergie et développement durable':['energy','solar','environment','recycling','sustainability'],
  'Événementiel':['event','conference','exhibition','catering','venue'],
  'Hôtellerie et restauration':['hotel','restaurant','cafe','bar','fast_food','catering'],
  'Immobilier':['estate_agent','real_estate','property','housing'],
  'Industrie et production':['industrial','factory','manufacture','production','warehouse'],
  'Informatique et numérique':['information technology','computer','software','web','digital','telecom','repair'],
  'Intelligence artificielle et data':['artificial intelligence','machine learning','data','software','analytics','computer'],
  'Journalisme et médias':['journalism','newspaper','press','media','radio','television'],
  'Jeux vidéo':['game','gaming','software','arcade','computer'],
  'Logistique et transport':['logistics','transport','freight','warehouse','delivery','bus'],
  'Luxe et mode':['fashion','clothes','jewellery','luxury','tailor','boutique'],
  'Marketing et publicité':['marketing','advertising','agency','media','communication'],
  'Mécanique':['mechanic','repair','engineering','machine','garage','workshop'],
  'Médecine et santé':['doctor','clinic','hospital','health','medical','pharmacy'],
  'Multimédia':['multimedia','digital','video','photo','web','design'],
  'Ressources humaines':['recruitment','employment','human resources','staffing','agency'],
  'Sciences et laboratoire':['laboratory','research','science','university','testing'],
  'Sécurité et défense':['security','police','fire_station','defence','guard'],
  'Services à la personne':['care','social','cleaning','childcare','home'],
  'Social et humanitaire':['social','charity','community','association','humanitarian'],
  'Télécommunications':['telecom','telephone','mobile','network','internet'],
  'Tourisme et voyage':['tourism','travel','hotel','museum','information','camp_site'],
  'Aéronautique et spatial':['aerospace','aircraft','aviation','airport','engineering'], 'Alimentation et gastronomie':['food','restaurant','bakery','catering','grocery'], 'Assurance qualité':['quality','inspection','testing','certification','laboratory'], 'Biodiversité et environnement':['environment','ecology','biodiversity','nature','recycling'], 'Data science et statistiques':['data','analytics','statistics','research','software'], 'Économie et recherche':['economics','research','institute','university','consulting'], 'Finance de marché':['finance','investment','trading','broker','bank'], 'Gestion de projet':['project','management','consulting','office','agency'], 'Hôtellerie de plein air':['camp_site','caravan_site','resort','tourism','outdoor'], 'Industrie pharmaceutique':['pharmaceutical','pharmacy','medicine','laboratory','biotech'], 'Influence et réseaux sociaux':['social media','influencer','marketing','communication','media'], 'Maintenance industrielle':['maintenance','engineering','industrial','repair','machinery'], 'Métiers de la mer':['marine','maritime','port','boat','fishing'], 'Mode et textile':['textile','clothes','fashion','tailor','fabric'], 'Optique et lunetterie':['optician','optics','glasses','eyewear','medical'], 'Patrimoine et archéologie':['heritage','archaeology','museum','monument','history'], 'Production audiovisuelle':['film','video','production','television','studio'], 'Psychologie':['psychology','therapy','clinic','health','counselling'], 'Relations internationales':['international','diplomacy','ngo','embassy','consulting'], 'Santé animale':['veterinary','animal','clinic','pet','health'], 'Scénographie':['scenography','theatre','stage','exhibition','design'], 'Urbanisme et mobilité':['urbanism','mobility','transport','planning','surveying'],
  'Autre':['company','office','business']
}

// Valeurs de tags OSM (shop=computer, office=it, amenity=doctors, etc.).
// Elles sont interrogées séparément des noms : les abréviations ne créent donc pas de faux positifs dans les enseignes.
export const DOMAIN_TAG_VALUES = {
  'Administration et gestion':['office','administrative','accountant','consulting'], 'Agriculture et agroalimentaire':['farm','bakery','butcher','greengrocer'],
  'Animation et sport':['fitness_centre','sports_centre','stadium','pitch'], 'Architecture et urbanisme':['architect','surveying'], 'Artisanat d’art':['artist','pottery','jewellery'],
  'Audiovisuel, cinéma et son':['cinema','recording_studio','music_school'], 'Automobile et mobilité':['car_repair','car','car_dealer','car_parts','motorcycle_repair'],
  'Banque, finance et assurance':['bank','insurance','financial_advice'], 'Beauté et bien-être':['beauty','hairdresser','spa'], 'Bâtiment et travaux publics':['construction','builder','plumber','electrician','carpenter'],
  'Biologie et chimie':['laboratory','pharmacy','research_institute'], 'Commerce et vente':['supermarket','convenience','department_store','mall','retail'],
  'Communication et relations publiques':['advertising_agency','media','press'], 'Comptabilité et audit':['accountant','tax_advisor'], 'Culture, patrimoine et spectacle':['museum','theatre','arts_centre','gallery'],
  'Cybersécurité':['it','computer','software','security'], 'Design graphique et UX/UI':['graphic_design','print','photographer'], 'Droit et justice':['lawyer','notary','court'],
  'Édition et librairie':['books','bookshop','publisher'], 'Éducation et formation':['school','college','university','training'], 'Électronique et robotique':['electronics','electrical','automation'],
  'Énergie et développement durable':['solar','recycling','energy'], 'Événementiel':['conference_centre','events_venue','catering'], 'Hôtellerie et restauration':['hotel','restaurant','cafe','fast_food'],
  'Immobilier':['estate_agent','real_estate'], 'Industrie et production':['industrial','factory','manufacture'], 'Informatique et numérique':['it','computer','computer_repair','electronics','software','telecommunication'],
  'Intelligence artificielle et data':['it','software','research_institute','analytics'], 'Journalisme et médias':['newspaper','radio','television','press'], 'Jeux vidéo':['games','video_games','arcade'],
  'Logistique et transport':['logistics','warehouse','freight','transport'], 'Luxe et mode':['clothes','fashion','jewellery','tailor'], 'Marketing et publicité':['advertising_agency','marketing','media'],
  'Mécanique':['car_repair','motorcycle_repair','machinery','engineering','repair'], 'Médecine et santé':['doctors','clinic','hospital','pharmacy','healthcare'],
  'Multimédia':['multimedia','software','photographer','video'], 'Ressources humaines':['recruitment','employment_agency'], 'Sciences et laboratoire':['laboratory','research_institute','science'],
  'Sécurité et défense':['security','police','fire_station'], 'Services à la personne':['social_facility','childcare','cleaning'], 'Social et humanitaire':['social_facility','charity','community_centre'],
  'Télécommunications':['telecommunication','telephone','mobile_phone'], 'Tourisme et voyage':['travel_agency','tourism','hotel','museum'], 'Autre':['company','office']
}

// Classification officielle NAF/APE de l'INSEE. La recherche Annuaire des
// Entreprises utilise ces sections et préfixes plutôt que de deviner le
// secteur à partir du nom commercial d'une enseigne.
Object.assign(DOMAIN_TAG_VALUES, {
  'Aéronautique et spatial':['aerodrome','airport','aviation','industrial'], 'Alimentation et gastronomie':['restaurant','bakery','butcher','cafe','food'], 'Assurance qualité':['laboratory','testing','inspection','industrial'], 'Biodiversité et environnement':['nature_reserve','park','recycling','environment'], 'Data science et statistiques':['it','software','research_institute','analytics'], 'Économie et recherche':['research_institute','university','consulting'], 'Finance de marché':['bank','financial_advice','investment'], 'Gestion de projet':['office','consulting','project'], 'Hôtellerie de plein air':['camp_site','caravan_site','resort'], 'Industrie pharmaceutique':['pharmacy','laboratory','research_institute'], 'Influence et réseaux sociaux':['advertising_agency','marketing','media'], 'Maintenance industrielle':['industrial','machinery','repair'], 'Métiers de la mer':['marina','harbour','boat','fishing'], 'Mode et textile':['clothes','fashion','tailor','fabric'], 'Optique et lunetterie':['optician','optics','medical_supply'], 'Patrimoine et archéologie':['museum','heritage','archaeological_site'], 'Production audiovisuelle':['studio','video','television','film'], 'Psychologie':['psychologist','clinic','counselling'], 'Relations internationales':['embassy','ngo','international'], 'Santé animale':['veterinary','animal_boarding','pet'], 'Scénographie':['theatre','arts_centre','exhibition_centre'], 'Urbanisme et mobilité':['transport','planning','surveying']
})

export const DOMAIN_NAF = {
  'Administration et gestion':{sections:['M','N'],prefixes:['69','70','82']},
  'Agriculture et agroalimentaire':{sections:['A','C'],prefixes:['01','10','11']},
  'Animation et sport':{sections:['R'],prefixes:['85.51','93']},
  'Architecture et urbanisme':{sections:['M'],prefixes:['71.11','71.12']},
  'Artisanat d’art':{sections:['C','S'],prefixes:['23','31','32','74.10']},
  'Audiovisuel, cinéma et son':{sections:['J','R'],prefixes:['59','60','90']},
  'Automobile et mobilité':{sections:['G','C'],prefixes:['45','29','30']},
  'Banque, finance et assurance':{sections:['K'],prefixes:['64','65','66']},
  'Beauté et bien-être':{sections:['S'],prefixes:['96.02','96.04']},
  'Bâtiment et travaux publics':{sections:['F'],prefixes:['41','42','43']},
  'Biologie et chimie':{sections:['C','M'],prefixes:['20','21','71.20','72']},
  'Commerce et vente':{sections:['G'],prefixes:['46','47']},
  'Communication et relations publiques':{sections:['M','J'],prefixes:['70.21','73','63']},
  'Comptabilité et audit':{sections:['M'],prefixes:['69.20']},
  'Culture, patrimoine et spectacle':{sections:['R'],prefixes:['90','91']},
  'Cybersécurité':{sections:['J','M'],prefixes:['62','63','80.20']},
  'Design graphique et UX/UI':{sections:['M'],prefixes:['74.10','73.12']},
  'Droit et justice':{sections:['M'],prefixes:['69.10']},
  'Édition et librairie':{sections:['J','G'],prefixes:['58','47.61','18']},
  'Éducation et formation':{sections:['P'],prefixes:['85']},
  'Électronique et robotique':{sections:['C','M'],prefixes:['26','27','28','71.12']},
  'Énergie et développement durable':{sections:['D','E','M'],prefixes:['35','36','37','38','39','71.12']},
  'Événementiel':{sections:['N','R','I'],prefixes:['82.30','90','93','56.21']},
  'Hôtellerie et restauration':{sections:['I'],prefixes:['55','56']},
  'Immobilier':{sections:['L'],prefixes:['68']},
  'Industrie et production':{sections:['C'],prefixes:['10','11','13','14','15','16','17','18','22','24','25','28','30','32']},
  'Informatique et numérique':{sections:['J'],prefixes:['58.2','61','62','63.1','95.11'],codes:['58.21Z','58.29A','58.29B','58.29C','61.10Z','61.20Z','61.90Z','62.01Z','62.02A','62.02B','62.03Z','62.09Z','63.11Z','63.12Z','95.11Z']},
  'Intelligence artificielle et data':{sections:['J','M'],prefixes:['62','63.11','72']},
  'Journalisme et médias':{sections:['J'],prefixes:['58.13','60','63.91']},
  'Jeux vidéo':{sections:['J'],prefixes:['58.21','62.01']},
  'Logistique et transport':{sections:['H'],prefixes:['49','50','51','52','53']},
  'Luxe et mode':{sections:['C','G'],prefixes:['14','15','32.12','47.71','47.72']},
  'Marketing et publicité':{sections:['M'],prefixes:['73']},
  'Mécanique':{sections:['C','G'],prefixes:['25','28','29','30','33','45.20'],codes:['25.62B','28.11Z','28.12Z','28.13Z','28.15Z','28.22Z','28.29A','28.29B','28.41Z','28.49Z','28.91Z','28.92Z','28.93Z','28.94Z','28.95Z','28.96Z','28.99A','28.99B','29.10Z','29.20Z','29.31Z','29.32Z','30.20Z','30.30Z','33.12Z','45.20A','45.20B']},
  'Médecine et santé':{sections:['Q'],prefixes:['86','87','88']},
  'Multimédia':{sections:['J','M'],prefixes:['58.2','59','62','74.2']},
  'Ressources humaines':{sections:['N'],prefixes:['78']},
  'Sciences et laboratoire':{sections:['M'],prefixes:['71.20','72']},
  'Sécurité et défense':{sections:['N','O'],prefixes:['80','84']},
  'Services à la personne':{sections:['S','N'],prefixes:['81','88','96']},
  'Social et humanitaire':{sections:['Q','S'],prefixes:['87','88','94']},
  'Télécommunications':{sections:['J'],prefixes:['61']},
  'Tourisme et voyage':{sections:['I','N'],prefixes:['55','79']},
  'Autre':{sections:[],prefixes:[]}
}

// Every selectable specialism has an explicit activity filter; none falls
// back to an unrestricted nationwide company list.
Object.assign(DOMAIN_NAF, {
  'Aéronautique et spatial':{sections:['C','H'],prefixes:['30.30','33.16','51']},
  'Alimentation et gastronomie':{sections:['C','G','I'],prefixes:['10','47.2','56']},
  'Assurance qualité':{sections:['M'],prefixes:['71.20']},
  'Biodiversité et environnement':{sections:['E','M','R'],prefixes:['38','39','72.19','91.04']},
  'Data science et statistiques':{sections:['J','M'],prefixes:['62','63.11','72.20']},
  'Économie et recherche':{sections:['M'],prefixes:['72.20']},
  'Finance de marché':{sections:['K'],prefixes:['64','66.12','66.30']},
  'Gestion de projet':{sections:['M'],prefixes:['70.22','71.12']},
  'Hôtellerie de plein air':{sections:['I'],prefixes:['55.30']},
  'Industrie pharmaceutique':{sections:['C','M'],prefixes:['21','72.11']},
  'Influence et réseaux sociaux':{sections:['M','J'],prefixes:['70.21','73.11','59.11']},
  'Maintenance industrielle':{sections:['C'],prefixes:['33.12','33.14','33.20']},
  'Métiers de la mer':{sections:['A','C','H'],prefixes:['03','30.11','33.15','50']},
  'Mode et textile':{sections:['C','G'],prefixes:['13','14','47.71']},
  'Optique et lunetterie':{sections:['G'],prefixes:['47.78A'],codes:['47.78A']},
  'Patrimoine et archéologie':{sections:['R','M'],prefixes:['91.02','91.03','72.20']},
  'Production audiovisuelle':{sections:['J'],prefixes:['59.11','59.12']},
  'Psychologie':{sections:['Q'],prefixes:['86.90F'],codes:['86.90F']},
  'Relations internationales':{sections:['U','S'],prefixes:['99','94.99']},
  'Santé animale':{sections:['M'],prefixes:['75'],codes:['75.00Z']},
  'Scénographie':{sections:['R'],prefixes:['90.02']},
  'Urbanisme et mobilité':{sections:['M'],prefixes:['71.11','71.12']}
})
DOMAIN_TAG_VALUES['Cybersécurité'] = ['it','software']
DOMAIN_NAF['Cybersécurité'] = {sections:['J'],prefixes:['62','63.11']}
DOMAIN_TAG_VALUES['Psychologie'] = ['psychologist','psychotherapist','counselling']
DOMAIN_TAG_VALUES['Santé animale'] = ['veterinary']

export const DOMAIN_PARENT = EXTRA_DOMAIN_PARENTS
for (const [name, parent] of Object.entries(DOMAIN_PARENT)) {
  DOMAIN_CONFIG[name] = DOMAIN_CONFIG[parent]
  DOMAIN_TAG_VALUES[name] = DOMAIN_TAG_VALUES[parent]
  DOMAIN_NAF[name] = DOMAIN_NAF[parent]
}
