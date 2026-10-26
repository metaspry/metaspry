import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Static output: build/ is loaded as an unpacked extension (AGENTS.md 4.1).
		adapter: adapter(),
		appDir: 'app',
	},
	preprocess: vitePreprocess()
};

export default config;
