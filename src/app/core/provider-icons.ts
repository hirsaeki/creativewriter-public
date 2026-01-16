/**
 * Centralized provider icon configuration
 * Single source of truth for all AI provider icons, colors, and tooltips
 *
 * SECURITY NOTE: Custom SVG content is rendered using bypassSecurityTrustHtml().
 * This is safe ONLY because SVGs are statically defined here. NEVER accept SVG
 * content from user input, API responses, or database queries.
 */

export interface ProviderIconConfig {
  iconName: string;
  color: string;
  tooltip: string;
  /** SVG content for custom icons (optional, for icons not in Ionicons) */
  svg?: string;
}

// Custom SVG icons for providers not in Ionicons
const CUSTOM_SVGS = {
  openrouter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g clip-path="url(#clip0)"><path d="M3 248.945C18 248.945 76 236 106 219C136 202 136 202 198 158C276.497 102.293 332 120.945 423 120.945" stroke="currentColor" stroke-width="90" fill="none"/><path d="M511 121.5L357.25 210.268L357.25 32.7324L511 121.5Z" fill="currentColor"/><path d="M0 249C15 249 73 261.945 103 278.945C133 295.945 133 295.945 195 339.945C273.497 395.652 329 377 420 377" stroke="currentColor" stroke-width="90" fill="none"/><path d="M508 376.445L354.25 287.678L354.25 465.213L508 376.445Z" fill="currentColor"/></g><defs><clipPath id="clip0"><rect width="512" height="512" fill="white"/></clipPath></defs></svg>`,
  claude: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 101" fill="currentColor"><path d="M96 40L99.5 42L99.5 43.5L98.5 47L56 57L52 47L96 40Z" transform="rotate(330 50 50) scale(1 1.12)"/><path d="M80 10.6L85 11.6L86.3 13.2L87.5 17L87 19.5L58.5 58.5L49 49L75.3 14.5L80 10.6Z" transform="rotate(300 50 50) scale(1 1.11)"/><path d="M55.5 4.5L58.5 2.5L61 3.5L63.5 7L56.7 48.2L52 45L50 39.5L53.5 8.5L55.5 4.5Z" transform="rotate(270 50 50)"/><path d="M23.4 5.2L26.5 1.2L28.5 0.8L32.5 1.3L34.5 2.9L48.8 34.7L54 49.8L47.9 53.2L24.8 11.2L23.4 5.2Z" transform="rotate(240 50 50) scale(1 1.08)"/><path d="M8.5 27L7.5 23L10.5 19.5L14 20L15 20L36 35.5L42.5 40.5L51.5 47.5L46.5 56L42 52.5L39 49.5L10 29L8.5 27Z" transform="rotate(210 50 50) scale(1 1.09)"/><path d="M2.5 53L0.24 50.5L0.24 48.3L2.5 47.5L28 49L53 51L52.2 56L4.5 53.5L2.5 53Z" transform="rotate(180 50 50)"/><path d="M17.5 79L12.5 79L10.5 76.7L10.5 74L19 68L53.5 46L57 52L17.5 79Z" transform="rotate(150 50 50) scale(1 1.06)"/><path d="M27 93L25 93.5L22 92L22.5 89.5L52 50.5L56 56L34 85L27 93Z" transform="rotate(120 50 50) scale(1 0.96)"/><path d="M52 98L50.5 100L47.5 101L45 99L43.5 96L51 55.5L55.5 56L52 98Z" transform="rotate(90 50 50) scale(1 0.94)"/><path d="M77.5 87L77.5 91L77 92.5L75 93.5L71.5 93L47.5 57.3L57 50L65 64.5L65.8 69.7L77.5 87Z" transform="rotate(60 50 50) scale(1 0.99)"/><path d="M89 81L89.5 83.5L88 85.5L86.5 85L78 79L65 67.5L55 60.5L58 51L63 54L66 59.5L89 81Z" transform="rotate(30 50 50) scale(1 1.13)"/><path d="M82.5 55.5L95 56.5L98 58.5L100 61.5L100 63.7L94.5 66L66.5 59L55 58.5L58 48L66 54L82.5 55.5Z"/></svg>`,
  ollama: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 646 854" fill="currentColor"><path d="M140.6 0.2C132.7 1.5 123.1 5.7 116.4 10.8C96 26.4 80.1 59.3 73.4 100.3C70.9 115.8 69.2 137.3 69.2 153.7C69.2 173.1 71.5 197.9 74.7 215C75.5 218.8 75.8 222.2 75.5 222.4C75.3 222.6 72.3 225.1 68.9 227.8C57.4 237 44.2 251.1 35.1 264.1C17.7 288.8 6.4 316.9 1.7 347.3C-0.1 359.3 -0.6 383.6 0.9 395.6C4.1 423.3 12.4 446.7 26.7 468.2L31.4 475.1L30 477.3C20.5 493.4 12.3 516.6 8.5 539C5.5 556.6 5.2 561.3 5.2 585C5.2 608.8 5.5 613.6 8.3 630C11.7 649.8 18.5 670.7 26.2 684.6C28.7 689.1 34.8 698.6 35.6 699.1C35.8 699.2 35.1 701.5 33.9 704.1C25.1 723.4 17.5 749.1 14.4 770.7C12.2 785.6 11.9 790.3 11.9 806C11.9 825.9 13 835.6 17.2 851.5L17.8 853.8H44H70.3L68.6 850.5C58 831 57 794.5 66.1 758.2C70.3 741.4 75 729 83.9 712.1L89.1 701.8V695.5C89.1 689.6 89 688.9 87.1 685C85.6 682.1 83.7 679.6 80.2 676.1C74.2 670.4 70 664.3 66.5 656.8C51.4 624.1 48.5 575.5 59.1 534C63.5 516.8 70.8 501.4 78.5 493C83.7 487.2 86.4 480.8 86.4 474.1C86.4 467.2 83.9 461.5 78.4 455.5C62.6 438.6 52.8 418 49.4 394C44.4 359.9 53.4 322.7 73.9 293.2C93.9 264.3 122.1 245.7 153.5 240.7C160.6 239.6 173.7 239.7 181.1 241.1C189.1 242.5 194.1 242.1 199.3 239.6C205.7 236.6 208.9 232.9 212.6 224.3C215.9 216.6 218.5 212.5 225.4 203.8C233.7 193.5 241.8 186.4 254.6 177.9C269.4 168.3 286.1 161.3 302.8 157.9C308.8 156.7 311.7 156.5 323 156.5C334.3 156.5 337.2 156.7 343.2 157.9C367.7 162.9 392 175.5 411.3 193.4C415.5 197.3 425.5 209.6 428.7 214.8C429.9 216.8 432.1 221.1 433.4 224.3C437.1 232.9 440.3 236.6 446.7 239.6C451.7 242 456.9 242.5 464.6 241.2C476.8 239.1 486.2 239.3 498.1 241.8C538.8 250 574.3 283.5 590 328.4C603.6 367.9 599.8 409.1 579.4 440.6C576 446 572.6 450.3 567.6 455.5C556.9 467 556.9 481.2 567.5 493C585.1 512.2 596 559.4 592.7 601C590.5 628.5 583.5 653 573.8 667C572.1 669.4 568.5 673.6 565.8 676.1C562.3 679.6 560.4 682.1 558.9 685C557 688.9 556.9 689.6 556.9 695.5V701.8L562.1 712.1C571 729 575.7 741.4 579.9 758.2C588.9 794 588.1 829.7 577.8 850C576.9 851.7 576.2 853.3 576.2 853.5C576.2 853.7 587.9 853.8 602.2 853.8H628.2L628.9 851.2C629.3 849.8 629.9 847.6 630.2 846.4C630.9 843.7 632.2 835.7 633.3 828C634.3 820.3 634.3 791.9 633.3 783.3C629.4 752.2 622.8 727.5 612.1 704.1C610.9 701.5 610.2 699.2 610.4 699.1C610.7 698.9 612.5 696.4 614.3 693.7C627.7 673.4 635.9 648 640 614.4C641.2 605.2 641.2 565.4 640 556.5C637.1 533.6 633.6 518 627.7 502.2C625.2 495.7 618.7 481.8 616 477.3L614.6 475.1L619.3 468.2C633.6 446.7 641.9 423.3 645.1 395.6C646.6 383.6 646.1 359.3 644.3 347.3C639.5 316.8 628.3 288.8 610.9 264.1C601.8 251.1 588.6 237 577.1 227.8C573.7 225.1 570.7 222.6 570.5 222.4C570.2 222.2 570.5 218.8 571.3 215C578.7 176.3 578.4 128.1 570.7 90.4C564 57.5 551.7 31.4 535.8 16.3C523.2 4.3 510.3 -0.9 494.9 0.1C459.5 2.2 430.9 43 419.6 107.2C417.8 117.6 416.2 129.7 416.2 133C416.2 134.3 416 135.3 415.6 135.3C415.3 135.3 412.9 134.1 410.4 132.6C383 116.4 352.6 107.8 323 107.8C293.4 107.8 263 116.4 235.6 132.6C233.1 134.1 230.7 135.3 230.4 135.3C230.1 135.3 229.8 134.3 229.8 133C229.8 129.6 228.2 117.1 226.4 107.2C216.2 49.5 192.7 11.3 161.5 1.7C157.2 0.4 145 -0.4 140.6 0.2ZM151.1 50.1C159.9 57.1 169.7 77.1 175.3 99.5C176.4 103.5 177.5 108.2 177.8 109.9C178 111.6 178.7 115.3 179.2 118.2C181.6 131.2 182.7 145.2 182.9 162.3L183 179.2L178.7 185.4L174.5 191.7H164.6C153.1 191.7 141.6 193.2 130.6 196.2C126.7 197.1 122.9 198.1 122.2 198.3C121 198.5 120.8 198.2 120.2 193.2C116.5 165.9 116.7 135.7 120.7 110.5C125.1 82.5 135.4 57.1 145.5 49.6C147.9 47.9 148.3 47.9 151.1 50.1ZM500.6 49.7C506.7 54.2 513.3 66.1 518.3 81.3C528.3 111.7 531.1 153.4 525.8 193.2C525.2 198.2 525 198.5 523.8 198.3C523.1 198.1 519.3 197.1 515.4 196.2C504.4 193.2 492.9 191.7 481.4 191.7H471.5L467.3 185.4L463.1 179.2L463.1 162.3C463.3 138.5 465.5 120 470.7 99.3C476.3 77.1 486.2 57.1 495 50.1C497.7 47.9 498.1 47.9 500.6 49.7Z"/></svg>`,
  replicate: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="currentColor"><polygon points="1000,427.6 1000,540.6 603.4,540.6 603.4,1000 477,1000 477,427.6"/><polygon points="1000,213.8 1000,327 364.8,327 364.8,1000 238.4,1000 238.4,213.8"/><polygon points="1000,0 1000,113.2 126.4,113.2 126.4,1000 0,1000 0,0"/></svg>`,
  fal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.5 15h-3v-1.5h1.5v-4h-1.5V10h3v5.5h1.5V17h-1.5zm0-9h-3V6h3v2z"/></svg>`
};

export const PROVIDER_ICONS: Record<string, ProviderIconConfig> = {
  openrouter: {
    iconName: 'openrouter-custom',
    color: '#6467f2',
    tooltip: 'OpenRouter - Unified API gateway for multiple AI models',
    svg: CUSTOM_SVGS.openrouter
  },
  claude: {
    iconName: 'claude-custom',
    color: '#C15F3C',
    tooltip: 'Claude - Anthropic\'s helpful, harmless, and honest AI assistant',
    svg: CUSTOM_SVGS.claude
  },
  ollama: {
    iconName: 'ollama-custom',
    color: '#ff9800',
    tooltip: 'Ollama - Run large language models locally on your machine',
    svg: CUSTOM_SVGS.ollama
  },
  replicate: {
    iconName: 'replicate-custom',
    color: '#9c27b0',
    tooltip: 'Replicate - Cloud platform for running machine learning models',
    svg: CUSTOM_SVGS.replicate
  },
  fal: {
    iconName: 'fal-custom',
    color: '#a855f7',
    tooltip: 'fal.ai - Fast inference for generative AI',
    svg: CUSTOM_SVGS.fal
  },
  gemini: {
    iconName: 'logo-google',
    color: '#4285f4',
    tooltip: 'Google Gemini - Advanced multimodal AI from Google'
  },
  grok: {
    iconName: 'sparkles-outline',
    color: '#1DA1F2',
    tooltip: 'Grok - xAI\'s conversational AI'
  },
  openaiCompatible: {
    iconName: 'server-outline',
    color: '#4caf50',
    tooltip: 'OpenAI-Compatible - Local server with OpenAI API (LM Studio, LocalAI, etc.)'
  }
};

/**
 * Get the icon name for a provider
 */
export function getProviderIcon(provider: string): string {
  return PROVIDER_ICONS[provider]?.iconName ?? 'globe-outline';
}

/**
 * Get the color for a provider
 */
export function getProviderColor(provider: string): string {
  return PROVIDER_ICONS[provider]?.color ?? 'var(--ion-color-medium)';
}

/**
 * Get the tooltip for a provider
 */
export function getProviderTooltip(provider: string): string {
  return PROVIDER_ICONS[provider]?.tooltip ?? 'AI Provider';
}

/**
 * Check if a provider uses a custom icon (vs standard ionicon)
 */
export function isCustomProviderIcon(provider: string): boolean {
  return !!PROVIDER_ICONS[provider]?.svg;
}

/**
 * Get the SVG content for a custom provider icon
 * Returns null if provider uses a standard ionicon
 */
export function getProviderSvg(provider: string): string | null {
  return PROVIDER_ICONS[provider]?.svg ?? null;
}
