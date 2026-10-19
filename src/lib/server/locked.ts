// Wraps a route handler that reads, changes and saves a config file, so two
// requests touching the same file run one after the other instead of the
// second save erasing the first one's change.
import type { RequestEvent } from '@sveltejs/kit';
import { mutate } from './config';

export function locked<E extends RequestEvent>(name: string, handler: (event: E) => Promise<Response>) {
	return (event: E) => mutate(name, () => handler(event));
}
