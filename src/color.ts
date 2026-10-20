/**
 * Utilidades de color para que la ficha de un evento pueda usar cualquier
 * color de marca y el texto siga siendo legible. El sitio no impone un
 * color: el color de cada página es el del evento, así que el contraste
 * se calcula en build time en lugar de asumir blanco sobre el color.
 */

const hexToRgb = (hex: string): [number, number, number] | null => {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!match) return null;
    return [
        parseInt(match[1], 16),
        parseInt(match[2], 16),
        parseInt(match[3], 16),
    ];
};

const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
    const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

// Luminancia a la que el contraste contra blanco y contra negro es ~4.5:1.
const MAX_LUMINANCE_ON_LIGHT = 0.1791;

const toHex = ([r, g, b]: [number, number, number]) =>
    "#" +
    [r, g, b]
        .map((value) =>
            Math.max(0, Math.min(255, Math.round(value)))
                .toString(16)
                .padStart(2, "0"),
        )
        .join("");

/**
 * Texto legible sobre un fondo del color dado. Devuelve tinta o blanco
 * en función de la luminancia del color.
 */
export const readableOn = (hex?: string): string => {
    const rgb = hex ? hexToRgb(hex) : null;
    if (!rgb) return "#ffffff";
    return relativeLuminance(rgb) > MAX_LUMINANCE_ON_LIGHT
        ? "#181818"
        : "#ffffff";
};

/**
 * Versión del color oscura ya para usar como texto sobre papel. Si el
 * color del evento es claro (amarillo, turquesa...), se mezcla con negro
 * hasta cumplir 4.5:1 sobre blanco, conservando el matiz.
 */
export const readableText = (hex?: string): string | undefined => {
    const rgb = hex ? hexToRgb(hex) : null;
    if (!rgb) return undefined;
    if (relativeLuminance(rgb) <= MAX_LUMINANCE_ON_LIGHT) return hex!;

    for (let mix = 0.1; mix <= 1; mix += 0.1) {
        const darkened: [number, number, number] = [
            rgb[0] * (1 - mix),
            rgb[1] * (1 - mix),
            rgb[2] * (1 - mix),
        ];
        if (relativeLuminance(darkened) <= MAX_LUMINANCE_ON_LIGHT) {
            return toHex(darkened);
        }
    }

    return "#181818";
};

/**
 * Color con alfa en rgba(), para tintes de hover y barras translúcidas.
 */
export const withAlpha = (hex: string | undefined, alpha: number): string => {
    const rgb = hex ? hexToRgb(hex) : null;
    if (!rgb) return `rgba(24, 24, 24, ${alpha})`;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
};
