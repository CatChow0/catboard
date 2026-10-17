import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		// Keep CSS readable by older Android WebViews (e.g. Chrome 91 on Android 12
		// without updates): stops the minifier from emitting `@media (width<=640px)`
		// range syntax, which Chrome only understands from version 104.
		cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14']
	}
});
