// Small pure helpers of the server modules.
import { describe, expect, it } from 'vitest';
import { normalizeUrl, resolveUrl } from './arr';
import { nameCandidates, sniffImage } from './icon-cache';
import { spoolmanOrder, spoolmanSections } from '$lib/widgets/spoolman';

describe('normalizeUrl', () => {
	it('drops trailing slashes', () => {
		expect(normalizeUrl('http://radarr:7878///')).toBe('http://radarr:7878');
		expect(normalizeUrl('http://radarr:7878/base')).toBe('http://radarr:7878/base');
	});
});

describe('resolveUrl', () => {
	it('proxies *Arr images and strips any API key', () => {
		expect(resolveUrl('radarr', '/MediaCover/1/poster.jpg?apikey=SECRET&lastWrite=2')).toBe(`/api/integrations/arr/image?source=radarr&path=${encodeURIComponent('/MediaCover/1/poster.jpg?lastWrite=2')}`);
		expect(resolveUrl('sonarr', 'MediaCover/2/fanart.jpg?apikey=SECRET')).not.toContain('SECRET');
	});
	it('returns public URLs as they are', () => {
		expect(resolveUrl('radarr', 'https://image.tmdb.org/t/p/x.jpg')).toBe('https://image.tmdb.org/t/p/x.jpg');
		expect(resolveUrl('radarr', '')).toBe('');
	});
});

describe('sniffImage', () => {
	it.each([
		[[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], 'image/png'],
		[[0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'],
		[[...Buffer.from('GIF89a')], 'image/gif'],
		[[...Buffer.from('RIFF\0\0\0\0WEBPVP8 ')], 'image/webp'],
		[[0, 0, 1, 0, 1, 0], 'image/x-icon']
	])('%j -> %s', (bytes, type) => {
		expect(sniffImage(Buffer.from(bytes))).toBe(type);
	});
	it('recognises SVG, with or without an XML prolog', () => {
		expect(sniffImage(Buffer.from('  <svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('image/svg+xml');
		expect(sniffImage(Buffer.from('<?xml version="1.0"?><svg/>'))).toBe('image/svg+xml');
	});
	it('rejects HTML and tiny buffers', () => {
		expect(sniffImage(Buffer.from('<!doctype html><html>'))).toBeNull();
		expect(sniffImage(Buffer.from([1, 2]))).toBeNull();
	});
});

describe('nameCandidates', () => {
	it('builds dashed, joined and underscored names', () => {
		expect(nameCandidates('Orca Slicer')).toEqual(['orca-slicer', 'orcaslicer', 'orca_slicer']);
		expect(nameCandidates('Jellyfin')).toEqual(['jellyfin']);
	});
	it('strips accents and symbols', () => {
		expect(nameCandidates('Café  (Home)!')).toEqual(['cafe-home', 'cafehome', 'cafe_home']);
		expect(nameCandidates('***')).toEqual([]);
	});
});

describe('spoolman sections', () => {
	it('reads the old "show" option as before', () => {
		expect(spoolmanSections({ show: 'recent' } as never)).toEqual({ recent: true, low: false, only: true });
		expect(spoolmanSections({ show: 'both' } as never)).toEqual({ recent: true, low: true, only: true });
	});
	it('"only" needs at least one section', () => {
		expect(spoolmanSections({ showOnly: true } as never)).toEqual({ recent: false, low: false, only: false });
		expect(spoolmanSections({ showLow: true, showOnly: true } as never)).toEqual({ recent: false, low: true, only: true });
	});
	it('order keeps known blocks once and appends the missing ones', () => {
		expect(spoolmanOrder({ order: ['low', 'bogus', 'low'] } as never)).toEqual(['low', 'list', 'recent']);
		expect(spoolmanOrder()).toEqual(['list', 'recent', 'low']);
	});
});
