import { inject, injectable } from '@theia/core/shared/inversify';
import { MonacoThemingService } from '@theia/monaco/lib/browser/monaco-theming-service';
import classicDark from '../browser/theme/notepadia-classic-dark.color-theme.json';
import classicLight from '../browser/theme/notepadia-classic.color-theme.json';
import highContrast from '../browser/theme/notepadia-high-contrast.color-theme.json';

/**
 * Registers the Notepadia product themes with Monaco's theming service so
 * both appear in the Settings > Preferences theme picker. The themes are
 * registered in the contributor's constructor (bound as a
 * FrontendApplicationContribution it is constructed before the shell paints)
 * so a cold profile with no stored theme preference converges on "Notepadia
 * Classic" the moment the workbench.colorTheme override takes effect.
 *
 * No color string may appear in this file; the palettes live exclusively in
 * the .color-theme.json files.
 */
@injectable()
export class NotepadiaThemeContribution {

    constructor(
        @inject(MonacoThemingService) protected readonly theming: MonacoThemingService
    ) {
        this.registerThemes();
    }

    protected registerThemes(): void {
        this.theming.registerParsedTheme({
            id: 'Notepadia Classic',
            label: 'Notepadia Classic',
            uiTheme: 'vs',
            description: 'Notepad++ default palette (light)',
            json: classicLight
        });
        this.theming.registerParsedTheme({
            id: 'Notepadia Classic Dark',
            label: 'Notepadia Classic Dark',
            uiTheme: 'vs-dark',
            description: 'Notepad++ dark mode palette',
            json: classicDark
        });
        // F1. A high-contrast variant of the dark palette, not a fourth
        // Notepad++ theme: pure black surfaces with every text pair at 7:1 or
        // better, which is what a user who needs it is actually looking for.
        // test/theme-contrast.test.cjs holds it to AAA rather than AA.
        this.theming.registerParsedTheme({
            id: 'Notepadia High Contrast',
            label: 'Notepadia High Contrast',
            uiTheme: 'vs-dark',
            description: 'High-contrast black palette; every text pair at 7:1 or better',
            json: highContrast
        });
    }
}