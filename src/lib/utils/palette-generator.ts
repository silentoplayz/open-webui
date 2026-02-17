import { colord, extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';

extend([mixPlugin]);

export const generatePalette = (
    primaryHex: string,
    neutralHex?: string
): Record<string, string> => {
    const variables: Record<string, string> = {};

    const p = colord(primaryHex);
    const n = neutralHex ? colord(neutralHex) : p.desaturate(0.5); // Default neutral is desaturated primary

    // Helper to generate scale
    // We want 50-950.
    // 50-400: tints (mix with white)
    // 500: base (or close to base)
    // 600-950: shades (mix with black)

    const generateScale = (
        baseColor: any,
        namePrefix: string,
        isGray: boolean = false
    ) => {
        // Define target lightness levels roughly for each step
        // This is a heuristic approach to get a nice ramp
        // 50  : 95% lightness
        // 100 : 90%
        // 200 : 80%
        // 300 : 70%
        // 400 : 60%
        // 500 : 50% (roughly)
        // 600 : 40%
        // 700 : 30%
        // 800 : 20%
        // 900 : 10%
        // 950 : 5%

        // Instead of fixing lightness, we mix with white/black to preserve hue characteristics better
        // 50: 95% white
        // 100: 85% white
        // ...

        const steps = [
            { key: 50, mix: 'white', ratio: 0.95 },
            { key: 100, mix: 'white', ratio: 0.8 },
            { key: 200, mix: 'white', ratio: 0.6 },
            { key: 300, mix: 'white', ratio: 0.4 },
            { key: 400, mix: 'white', ratio: 0.2 },
            { key: 500, mix: 'none', ratio: 0 },
            { key: 600, mix: 'black', ratio: 0.2 },
            { key: 700, mix: 'black', ratio: 0.4 },
            { key: 800, mix: 'black', ratio: 0.6 },
            { key: 850, mix: 'black', ratio: 0.7 },
            { key: 900, mix: 'black', ratio: 0.8 },
            { key: 950, mix: 'black', ratio: 0.9 }
        ];

        steps.forEach((step) => {
            let color;
            if (step.mix === 'white') {
                color = baseColor.mix('#ffffff', step.ratio);
            } else if (step.mix === 'black') {
                color = baseColor.mix('#000000', step.ratio);
            } else {
                color = baseColor;
            }

            // For gray scale, we might want to ensure it's not too saturated even if derived from primary
            if (isGray && !neutralHex) {
                // If strictly derived, keep it low sat
                color = color.desaturate(0.8);
            }

            variables[`--color-${namePrefix}-${step.key}`] = color.toHex();
        });
    };

    generateScale(p, 'blue', false);
    generateScale(n, 'gray', true);

    return variables;
};
