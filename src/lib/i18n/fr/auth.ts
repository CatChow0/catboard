import type { Dict } from '..';

export const auth = {
	'auth.createAdmin': 'Créer le compte admin',
	'auth.login': 'Connexion',
	'auth.setupSubtitle': 'Choisis les identifiants de ton dashboard',
	'auth.loginSubtitle': 'Connecte-toi à ton dashboard',
	'auth.username': 'Nom d\'utilisateur',
	'auth.password': 'Mot de passe',
	'auth.minLength': '6 caractères minimum',
	'auth.createAccount': 'Créer le compte',
	'auth.signIn': 'Se connecter',
} satisfies Partial<Dict>;
