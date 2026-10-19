import type { Dict } from '..';

export const gitea = {
	'gitea.reposShown': 'Dépôts récents',
	'gitea.issuesShown': 'Issues et pull requests ouvertes',
	'gitea.settingsHint': '0 masque la liste. Actualisé toutes les 2 minutes.',
	'gitea.openIssues': 'Issues ouvertes',
	'gitea.openPulls': 'Pull requests ouvertes',
	'gitea.nIssues': { one: '{count} issue', other: '{count} issues' },
	'gitea.nPulls': { one: '{count} PR', other: '{count} PR' },
	'gitea.repos': 'Dépôts',
	'gitea.private': 'Privé',
	'gitea.noRepo': 'Aucun dépôt pour le moment',
	'gitea.open': 'Ouvertes',
	'gitea.pr': 'PR',
	'gitea.issue': 'Issue',
	'gitea.nothingOpen': 'Rien d\'ouvert',
} satisfies Partial<Dict>;
