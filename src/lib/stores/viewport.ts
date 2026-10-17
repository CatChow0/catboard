import { readable } from 'svelte/store';

/** Viewport width at or below which the app chrome switches to its phone layout. */
export const PHONE_MAX_WIDTH = 640;

function mediaStore(query: string) {
	return readable(false, (set) => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mq = window.matchMedia(query);
		set(mq.matches);
		const onChange = (e: MediaQueryListEvent) => set(e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});
}

/** Phone-sized viewport: compact navbar, bottom sheets, bottom edit bar. */
export const isPhone = mediaStore(`(max-width: ${PHONE_MAX_WIDTH}px)`);

/** Primary pointer is a finger: hold-to-drag, always-visible edit controls. */
export const isTouch = mediaStore('(pointer: coarse)');
