// Rayons dans l'ordre d'un parcours de supermarché, et listes de départ pour un nouvel appart.

export const CATEGORIES = ['Fruits et légumes', 'Frais', 'Boucherie et poisson', 'Épicerie', 'Boissons', 'Surgelés', 'Hygiène', 'Entretien', 'Maison', 'Autre']

const KEYWORDS: [string, string[]][] = [
  ['Fruits et légumes', ['pomme', 'banane', 'tomate', 'salade', 'carotte', 'courgette', 'oignon', 'ail', 'citron', 'avocat', 'poivron', 'concombre', 'champignon', 'fraise', 'orange', 'poire', 'légume', 'fruit', 'herbe', 'persil', 'basilic', 'pomme de terre', 'patate', 'épinard', 'brocoli', 'poireau', 'raisin']],
  ['Frais', ['lait', 'beurre', 'crème', 'yaourt', 'fromage', 'œuf', 'oeuf', 'jambon', 'lardon', 'emmental', 'mozzarella', 'parmesan', 'gruyère', 'pâte feuilletée', 'pâte brisée', 'compote']],
  ['Boucherie et poisson', ['poulet', 'bœuf', 'boeuf', 'steak', 'viande', 'porc', 'saumon', 'poisson', 'thon frais', 'dinde', 'crevette', 'saucisse', 'merguez']],
  ['Boissons', ['eau', 'jus', 'bière', 'vin', 'soda', 'coca', 'sirop', 'limonade']],
  ['Surgelés', ['surgelé', 'glace', 'frites', 'pizza']],
  ['Hygiène', ['savon', 'shampoing', 'shampooing', 'dentifrice', 'brosse à dents', 'déodorant', 'gel douche', 'coton', 'rasoir', 'mouchoir', 'papier toilette', 'serviette hygiénique', 'tampon']],
  ['Entretien', ['lessive', 'éponge', 'vaisselle', 'javel', 'nettoyant', 'sac poubelle', 'sacs poubelle', 'essuie-tout', 'sopalin', 'serpillière', 'détergent', 'adoucissant', 'lave-vaisselle', 'vinaigre blanc', 'chiffon', 'balai']],
  ['Maison', ['ampoule', 'pile', 'bougie', 'multiprise', 'cintre', 'allumette', 'ruban', 'scotch', 'vis ', 'clou']],
  ['Épicerie', ['pâte', 'riz', 'farine', 'sucre', 'sel', 'poivre', 'huile', 'vinaigre', 'café', 'thé', 'chocolat', 'biscuit', 'céréale', 'pain', 'moutarde', 'ketchup', 'mayo', 'conserve', 'thon', 'sauce', 'confiture', 'miel', 'lentille', 'épice', 'semoule', 'levure']],
]

export function guessCategory(name: string) {
  const value = `${name.toLowerCase()} `
  // Les noms les plus longs d'abord, et seulement en début de mot : « gâteau » ne doit pas être pris pour de l'eau.
  const candidates = KEYWORDS.flatMap(([category, words]) => words.map((word) => ({ category, word })))
    .sort((a, b) => b.word.length - a.word.length)
  const startsWord = (word: string) => {
    const index = value.indexOf(word)
    return index === 0 || (index > 0 && /[\s'’-]/.test(value[index - 1]))
  }
  return candidates.find(({ word }) => startsWord(word))?.category ?? 'Autre'
}

export const STARTER_ITEMS = [
  'Sel', 'Poivre', "Huile d'olive", 'Pâtes', 'Riz', 'Café',
  'Liquide vaisselle', 'Éponges', 'Lessive', 'Sacs poubelle', 'Essuie-tout',
  'Papier toilette', 'Savon pour les mains', 'Ampoules de rechange',
]

export const STARTER_TASKS = [
  "Souscrire l'assurance habitation",
  "Ouvrir les contrats d'électricité et de gaz",
  'Relever les compteurs',
  'Installer internet',
  'Changer notre adresse (La Poste, banque, impôts)',
  "Mettre nos noms sur la boîte aux lettres et l'interphone",
  'Noter les jours de collecte des poubelles',
  "Signaler les défauts oubliés à l'état des lieux",
]

export const STARTER_CHORES: { title: string; room: string; every_days: number }[] = [
  { title: 'Sortir les poubelles', room: 'Cuisine', every_days: 3 },
  { title: 'Plan de travail et plaques', room: 'Cuisine', every_days: 3 },
  { title: 'Aspirateur', room: 'Partout', every_days: 7 },
  { title: 'Salle de bain', room: 'Salle de bain', every_days: 7 },
  { title: 'WC', room: 'WC', every_days: 7 },
  { title: 'Serpillière', room: 'Partout', every_days: 14 },
  { title: 'Poussière', room: 'Partout', every_days: 14 },
  { title: 'Changer les draps', room: 'Chambre', every_days: 14 },
  { title: 'Nettoyer le frigo', room: 'Cuisine', every_days: 30 },
  { title: 'Faire les vitres', room: 'Partout', every_days: 90 },
]

export const EVERY_OPTIONS = [1, 3, 7, 14, 30, 90]
export const MEMBER_COLORS = ['#D9482B', '#0E8A7D', '#7A4FD0', '#A86F00', '#C4327A', '#2A6BD6']
// Pas de rouge ici : dans le calendrier, le rouge veut dire « en retard ». Texte blanc lisible sur chacune.
export const CHORE_COLORS = ['#2A6BD6', '#0E8A7D', '#C4327A', '#A86F00', '#7A4FD0', '#3F7D20', '#0B7A9E', '#8A5A2B']
