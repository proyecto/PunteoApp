/**
 * @module themes
 * @description Catálogo de temas estéticos y tokens de color del Bullet Journal.
 *
 * Cada tema proporciona una paleta completa y coherente diseñada para journaling
 * de alta legibilidad, reduciendo la fatiga visual y respetando el espíritu
 * analógico y minimalista.
 */

export const systemLightTheme = {
  id:                   'system_light',
  name:                 'Sistema (Azul / Blanco)',
  nameEn:               'System (Blue / White)',
  isDark:               false,
  recommendedFont:      'system',
  recommendedFontLabel: 'Sistema',
  fontStyle:            undefined,
  background:           '#F4F6F9',
  cardBackground:       '#FFFFFF',
  cardCompleted:        '#F8FAFC',
  text:                 '#1E293B',
  textSecondary:        '#64748B',
  textCompleted:        '#94A3B8',
  border:               '#E2E8F0',
  primary:              '#007AFF',
  primaryBackground:    '#E6F4FE',
  tabBar:               '#FFFFFF',
  inputBackground:      '#F1F5F9',
  iconInactive:         '#64748B',
  buttonBackground:     '#CBD5E1',
  error:                '#FF3B30',
};

export const darkTheme = {
  id:                   'dark',
  name:                 'Monocromo Oscuro',
  nameEn:               'Monochrome Dark',
  isDark:               true,
  recommendedFont:      'system',
  recommendedFontLabel: 'Sistema',
  fontStyle:            undefined,
  background:           '#000000',
  cardBackground:       '#1C1C1E',
  cardCompleted:        '#121212',
  text:                 '#FFFFFF',
  textSecondary:        '#A1A1AA',
  textCompleted:        '#636366',
  border:               '#27272A',
  primary:              '#0A84FF',
  primaryBackground:    '#002E5C',
  tabBar:               '#1C1C1E',
  inputBackground:      '#2C2C2E',
  iconInactive:         '#A1A1AA',
  buttonBackground:     '#3A3A3C',
  error:                '#FF453A',
};

export const nordTheme = {
  id:                   'nord',
  name:                 'Nórdico Polar',
  nameEn:               'Arctic Nord',
  isDark:               true,
  recommendedFont:      'space-mono',
  recommendedFontLabel: 'Space Mono',
  fontStyle:            { fontFamily: 'SpaceMono_700Bold' },
  background:           '#222630',
  cardBackground:       '#2B313E',
  cardCompleted:        '#1F232C',
  text:                 '#ECEFF4',
  textSecondary:        '#96A1B4',
  textCompleted:        '#586377',
  border:               '#3A4354',
  primary:              '#88C0D0',
  primaryBackground:    '#1D333E',
  tabBar:               '#252B37',
  inputBackground:      '#333B4A',
  iconInactive:         '#96A1B4',
  buttonBackground:     '#3E485B',
  error:                '#BF616A',
};

export const sepiaTheme = {
  id:                   'sepia',
  name:                 'Papel Moleskine',
  nameEn:               'Warm Moleskine',
  isDark:               false,
  recommendedFont:      'eb-garamond',
  recommendedFontLabel: 'EB Garamond',
  fontStyle:            { fontFamily: 'EBGaramond_700Bold' },
  background:           '#F5EFEB',
  cardBackground:       '#FCF9F5',
  cardCompleted:        '#ECE4DA',
  text:                 '#2B2118',
  textSecondary:        '#807164',
  textCompleted:        '#A49689',
  border:               '#E4D8CC',
  primary:              '#A3532C',
  primaryBackground:    '#F5E5DC',
  tabBar:               '#F5EFEB',
  inputBackground:      '#ECE3D8',
  iconInactive:         '#807164',
  buttonBackground:     '#DECFC0',
  error:                '#B33927',
};

// Aliases para compatibilidad con guardar/cargar temas anteriores
export const lightTheme = systemLightTheme;
export const obsidianTheme = darkTheme;
export const matchaTheme = sepiaTheme;
export const asanaTheme = systemLightTheme;
export const todoistTheme = darkTheme;
export const trelloTheme = nordTheme;

/** Mapa para resolución O(1) del tema por su ID de preferencia */
export const THEMES_MAP = {
  system_light: systemLightTheme,
  system:       systemLightTheme,
  dark:         darkTheme,
  nord:         nordTheme,
  sepia:        sepiaTheme,
  light:        systemLightTheme,
  obsidian:     darkTheme,
  matcha:       sepiaTheme,
  asana:        systemLightTheme,
  todoist:      darkTheme,
  trello:       nordTheme,
};

/**
 * Opciones disponibles para la UI de Ajustes (4 temas curatoriales principales).
 */
export const themeOptions = [
  {
    id:                   'system',
    icon:                 'phone-portrait-outline',
    name:                 'Automático (Sistema)',
    nameEn:               'System Default',
    desc:                 'Se adapta dinámicamente al modo claro u oscuro del dispositivo.',
    descEn:               'Adapts dynamically to light or dark mode on your device.',
    recommendedFont:      'system',
    recommendedFontLabel: 'Sistema',
    fontStyle:            undefined,
    swatches:             ['#F4F6F9', '#FFFFFF', '#007AFF'],
  },
  {
    id:                   'dark',
    icon:                 'moon-outline',
    name:                 'Monocromo Oscuro',
    nameEn:               'Monochrome Dark',
    desc:                 'Negro puro OLED, blanco y gris neutro de alto contraste.',
    descEn:               'Pure OLED black, crisp white and high-contrast neutral gray.',
    recommendedFont:      'system',
    recommendedFontLabel: 'Sistema',
    fontStyle:            undefined,
    swatches:             [darkTheme.background, darkTheme.cardBackground, darkTheme.primary],
  },
  {
    id:                   'nord',
    icon:                 'snow-outline',
    name:                 'Nórdico Polar',
    nameEn:               'Arctic Nord',
    desc:                 'Noche polar ártica y azul glacial aurora.',
    descEn:               'Arctic polar night and glacial aurora cyan.',
    recommendedFont:      'space-mono',
    recommendedFontLabel: 'Space Mono',
    fontStyle:            { fontFamily: 'SpaceMono_700Bold' },
    swatches:             [nordTheme.background, nordTheme.cardBackground, nordTheme.primary],
  },
  {
    id:                   'sepia',
    icon:                 'book-outline',
    name:                 'Papel Moleskine',
    nameEn:               'Warm Moleskine',
    desc:                 'Pergamino cálido, tinta café y cuero terracota.',
    descEn:               'Warm parchment, espresso ink and terracotta accent.',
    recommendedFont:      'eb-garamond',
    recommendedFontLabel: 'EB Garamond',
    fontStyle:            { fontFamily: 'EBGaramond_700Bold' },
    swatches:             [sepiaTheme.background, sepiaTheme.cardBackground, sepiaTheme.primary],
  },
];

/**
 * Presets tipográficos curatoriales que combinan armónicamente títulos y cuerpo de texto
 * a partir de las más de 30 fuentes disponibles en la aplicación.
 */
export const TYPOGRAPHY_PRESETS = [
  {
    id:         'editorial',
    name:       'Editorial Clásico',
    nameEn:     'Classic Editorial',
    desc:       'Playfair Display + EB Garamond',
    descEn:     'Playfair Display + EB Garamond',
    icon:       'book-outline',
    globalFont: 'eb-garamond',
    config: {
      h1:      { fontFamily: 'playfair-display', fontSize: 30, fontWeight: '700', color: null },
      h2:      { fontFamily: 'playfair-display', fontSize: 24, fontWeight: '700', color: null },
      h3:      { fontFamily: 'cormorant-garamond', fontSize: 20, fontWeight: '700', color: null },
      body:    { fontFamily: 'eb-garamond', fontSize: 16, fontWeight: '400', color: null },
      caption: { fontFamily: 'eb-garamond', fontSize: 13, fontWeight: '600', color: null },
      micro:   { fontFamily: 'eb-garamond', fontSize: 12, fontWeight: '400', color: null },
    },
  },
  {
    id:         'manuscript',
    name:       'Diario Manuscrito',
    nameEn:     'Handwritten Journal',
    desc:       'Caveat + Lora',
    descEn:     'Caveat + Lora',
    icon:       'pencil-outline',
    globalFont: 'lora',
    config: {
      h1:      { fontFamily: 'caveat', fontSize: 34, fontWeight: '700', color: null },
      h2:      { fontFamily: 'dancing-script', fontSize: 26, fontWeight: '700', color: null },
      h3:      { fontFamily: 'caveat', fontSize: 22, fontWeight: '600', color: null },
      body:    { fontFamily: 'lora', fontSize: 16, fontWeight: '400', color: null },
      caption: { fontFamily: 'lora', fontSize: 13, fontWeight: '600', color: null },
      micro:   { fontFamily: 'lora', fontSize: 12, fontWeight: '400', color: null },
    },
  },
  {
    id:         'hacker',
    name:       'Terminal Hacker',
    nameEn:     'Hacker Terminal',
    desc:       'JetBrains Mono + Fira Code',
    descEn:     'JetBrains Mono + Fira Code',
    icon:       'terminal-outline',
    globalFont: 'jetbrains',
    config: {
      h1:      { fontFamily: 'jetbrains', fontSize: 28, fontWeight: '700', color: null },
      h2:      { fontFamily: 'jetbrains', fontSize: 22, fontWeight: '700', color: null },
      h3:      { fontFamily: 'fira-code', fontSize: 18, fontWeight: '600', color: null },
      body:    { fontFamily: 'jetbrains', fontSize: 15, fontWeight: '400', color: null },
      caption: { fontFamily: 'fira-code', fontSize: 13, fontWeight: '500', color: null },
      micro:   { fontFamily: 'fira-code', fontSize: 11, fontWeight: '400', color: null },
    },
  },
  {
    id:         'nordic',
    name:       'Estudio Nórdico',
    nameEn:     'Nordic Studio',
    desc:       'Work Sans + Inter',
    descEn:     'Work Sans + Inter',
    icon:       'compass-outline',
    globalFont: 'inter',
    config: {
      h1:      { fontFamily: 'work-sans', fontSize: 30, fontWeight: '700', color: null },
      h2:      { fontFamily: 'montserrat', fontSize: 24, fontWeight: '700', color: null },
      h3:      { fontFamily: 'work-sans', fontSize: 20, fontWeight: '600', color: null },
      body:    { fontFamily: 'inter', fontSize: 16, fontWeight: '400', color: null },
      caption: { fontFamily: 'inter', fontSize: 13, fontWeight: '600', color: null },
      micro:   { fontFamily: 'inter', fontSize: 12, fontWeight: '400', color: null },
    },
  },
  {
    id:         'zen',
    name:       'Zen Wabi-Sabi',
    nameEn:     'Zen Wabi-Sabi',
    desc:       'Playfair Display + Quicksand',
    descEn:     'Playfair Display + Quicksand',
    icon:       'flower-outline',
    globalFont: 'quicksand',
    config: {
      h1:      { fontFamily: 'playfair-display', fontSize: 30, fontWeight: '600', color: null },
      h2:      { fontFamily: 'quicksand', fontSize: 24, fontWeight: '700', color: null },
      h3:      { fontFamily: 'quicksand', fontSize: 20, fontWeight: '600', color: null },
      body:    { fontFamily: 'quicksand', fontSize: 16, fontWeight: '500', color: null },
      caption: { fontFamily: 'quicksand', fontSize: 13, fontWeight: '600', color: null },
      micro:   { fontFamily: 'quicksand', fontSize: 12, fontWeight: '500', color: null },
    },
  },
  {
    id:         'poetry',
    name:       'Poesía & Ensayo',
    nameEn:     'Poetry & Essay',
    desc:       'Cormorant Garamond + Crimson Text',
    descEn:     'Cormorant Garamond + Crimson Text',
    icon:       'document-text-outline',
    globalFont: 'crimson-text',
    config: {
      h1:      { fontFamily: 'cormorant-garamond', fontSize: 32, fontWeight: '700', color: null },
      h2:      { fontFamily: 'cormorant-garamond', fontSize: 26, fontWeight: '600', color: null },
      h3:      { fontFamily: 'libre-baskerville', fontSize: 19, fontWeight: '700', color: null },
      body:    { fontFamily: 'crimson-text', fontSize: 17, fontWeight: '400', color: null },
      caption: { fontFamily: 'crimson-text', fontSize: 13, fontWeight: '600', color: null },
      micro:   { fontFamily: 'crimson-text', fontSize: 12, fontWeight: '400', color: null },
    },
  },
  {
    id:         'default',
    name:       'Predeterminado',
    nameEn:     'System Default',
    desc:       'Tipografía nativa limpia',
    descEn:     'Clean native typography',
    icon:       'refresh-outline',
    globalFont: 'system',
    config: {
      h1:      { fontFamily: null, fontSize: 30, fontWeight: '800', color: null },
      h2:      { fontFamily: null, fontSize: 24, fontWeight: '800', color: null },
      h3:      { fontFamily: null, fontSize: 20, fontWeight: '700', color: null },
      body:    { fontFamily: null, fontSize: 16, fontWeight: '500', color: null },
      caption: { fontFamily: null, fontSize: 13, fontWeight: '600', color: null },
      micro:   { fontFamily: null, fontSize: 12, fontWeight: '400', color: null },
    },
  },
];
