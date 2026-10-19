import type { Entry } from '..';

export const gitea = {
	'gitea.reposShown': 'Recent repositories',
	'gitea.issuesShown': 'Open issues and pull requests',
	'gitea.settingsHint': '0 hides the list. Refreshed every 2 minutes.',
	'gitea.openIssues': 'Open issues',
	'gitea.openPulls': 'Open pull requests',
	'gitea.nIssues': { one: '{count} issue', other: '{count} issues' },
	'gitea.nPulls': { one: '{count} PR', other: '{count} PRs' },
	'gitea.repos': 'Repositories',
	'gitea.private': 'Private',
	'gitea.noRepo': 'No repository yet',
	'gitea.open': 'Open',
	'gitea.pr': 'PR',
	'gitea.issue': 'Issue',
	'gitea.nothingOpen': 'Nothing open',
} satisfies Record<string, Entry>;
