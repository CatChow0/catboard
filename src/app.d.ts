/// <reference types="@sveltejs/kit" />

declare namespace App {
	interface Locals {
		isAuthenticated: boolean;
		username: string | null;
		role: 'admin' | 'mini-admin' | 'user' | null;
	}
}