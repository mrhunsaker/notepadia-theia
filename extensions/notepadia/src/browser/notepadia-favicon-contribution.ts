import { injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';

const NOTEPADIA_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgb(255 188 222)"/>
      <stop offset="1" stop-color="rgb(234 111 176)"/>
    </linearGradient>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgb(255 255 255)"/>
      <stop offset="1" stop-color="rgb(255 240 247)"/>
    </linearGradient>
    <linearGradient id="pencil" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgb(214 51 143)"/>
      <stop offset="1" stop-color="rgb(142 15 82)"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="rgb(122 16 73)" flood-opacity="0.35"/>
    </filter>
  </defs>

  <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)"/>
  <rect x="70" y="70" width="884" height="884" rx="202" fill="none" stroke="rgb(255 255 255)" stroke-opacity="0.35" stroke-width="8"/>

  <g filter="url(#shadow)">
    <path d="M336 188 H628 L744 304 V756 Q744 790 710 790 H336 Q302 790 302 756 V222 Q302 188 336 188 Z" fill="url(#page)"/>
  </g>
  <path d="M628 188 V270 Q628 304 662 304 H744 Z" fill="rgb(255 211 232)"/>
  <path d="M628 188 V270 Q628 304 662 304 H744" fill="none" stroke="rgb(240 167 203)" stroke-width="7" stroke-linejoin="round"/>

  <g fill="rgb(230 74 158)">
    <rect x="356" y="356" width="294" height="28" rx="14"/>
    <rect x="356" y="428" width="322" height="28" rx="14"/>
    <rect x="356" y="500" width="244" height="28" rx="14"/>
    <rect x="356" y="572" width="294" height="28" rx="14"/>
    <rect x="356" y="644" width="204" height="28" rx="14"/>
  </g>

  <g transform="translate(608,548) rotate(-135)" stroke="rgb(122 16 73)" stroke-width="9" stroke-linejoin="round">
    <rect x="-50" y="-306" width="100" height="56" rx="20" fill="rgb(255 194 224)"/>
    <rect x="-54" y="-248" width="108" height="48" rx="12" fill="rgb(194 24 91)"/>
    <rect x="-46" y="-208" width="92" height="322" rx="18" fill="url(#pencil)"/>
    <rect x="-34" y="-198" width="24" height="300" rx="12" fill="rgb(255 255 255)" fill-opacity="0.28" stroke="none"/>
    <path d="M-46 114 H46 L0 226 Z" fill="rgb(243 206 155)"/>
    <path d="M-16 166 H16 L0 226 Z" fill="rgb(74 74 74)" stroke="none"/>
  </g>
</svg>`;

@injectable()
export class NotepadiaFaviconContribution implements FrontendApplicationContribution {

    onStart(): void {
        document.querySelectorAll('link[rel~="icon"]').forEach(existing => existing.remove());
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(NOTEPADIA_ICON)}`;
        document.head.appendChild(link);
    }
}
