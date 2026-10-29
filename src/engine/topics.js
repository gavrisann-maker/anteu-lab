export const TOPICS = [
  { id: 'educatie', label: 'Educație' },
  { id: 'sanatate', label: 'Sănătate' },
  { id: 'mediu', label: 'Mediu' },
  { id: 'economie', label: 'Economie' },
];

export const topicLabel = (id) => TOPICS.find((t) => t.id === id)?.label ?? id;
