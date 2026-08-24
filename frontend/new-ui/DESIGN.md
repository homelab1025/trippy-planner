---
name: Alpine Explorer
colors:
  surface: '#f4fafd'
  surface-dim: '#d4dbdd'
  surface-bright: '#f4fafd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef5f7'
  surface-container: '#e8eff1'
  surface-container-high: '#e2e9ec'
  surface-container-highest: '#dde4e6'
  on-surface: '#161d1f'
  on-surface-variant: '#404943'
  inverse-surface: '#2b3234'
  inverse-on-surface: '#ebf2f4'
  outline: '#707973'
  outline-variant: '#bfc9c1'
  surface-tint: '#256a4e'
  primary: '#256a4e'
  on-primary: '#ffffff'
  primary-container: '#76ba99'
  on-primary-container: '#004a32'
  inverse-primary: '#90d5b2'
  secondary: '#48663f'
  on-secondary: '#ffffff'
  secondary-container: '#c7eab8'
  on-secondary-container: '#4c6a43'
  tertiary: '#8d4f01'
  on-tertiary: '#ffffff'
  tertiary-container: '#ea9a4e'
  on-tertiary-container: '#623500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#abf1ce'
  primary-fixed-dim: '#90d5b2'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005138'
  secondary-fixed: '#caecba'
  secondary-fixed-dim: '#aed0a0'
  on-secondary-fixed: '#062103'
  on-secondary-fixed-variant: '#314e29'
  tertiary-fixed: '#ffdcc1'
  tertiary-fixed-dim: '#ffb877'
  on-tertiary-fixed: '#2e1500'
  on-tertiary-fixed-variant: '#6c3a00'
  background: '#f4fafd'
  on-background: '#161d1f'
  surface-variant: '#dde4e6'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  card-padding: 20px
  container-max-width: 1440px
---

## Brand & Style
The design system is built for outdoor enthusiasts and travel planners who value precision, clarity, and a connection to the natural world. The brand personality is adventurous yet grounded—reliable enough for technical route planning but soft enough to evoke the serenity of a mountain landscape.

The visual style is **Corporate / Modern** with a slight lean toward **Minimalism**. It prioritizes data legibility and functional density while using soft color washes and high-quality whitespace to prevent information overload. The interface should feel like a high-end physical field guide: structured, tactile, and effortlessly professional.

## Colors
The palette is centered around nature-inspired tones that reflect forest canopies and alpine trails. 

- **Primary Green (#76BA99):** Used for primary actions, header backgrounds, and key active states. It provides a calming, professional anchor for the UI.
- **Secondary Sage (#ADCF9F):** Used for subtle highlights, background washes, and secondary data visualizations.
- **Tertiary Ochre (#F2A154):** Reserved for peak indicators, warnings, or highlighting specific data points like "Category" climbs in elevation charts.
- **Error Coral (#E5707E):** A soft, desaturated red chosen to harmonize with the green palette without creating jarring visual friction.
- **Neutrals:** A range of cool grays starting from a deep slate for text down to a very light, almost-white mint for backgrounds.

## Typography
This design system utilizes **Hanken Grotesk** as its primary typeface. It is a sharp, contemporary sans-serif that maintains high legibility in data-dense sidebars.

- **Headlines:** Use tighter letter spacing and bolder weights to create a strong hierarchy.
- **Body:** Standardized at 14px for utility to allow more content on screen without sacrificing readability.
- **Labels:** Small, uppercase labels with increased tracking are used for secondary metadata and chart axes.
- **Technical Data:** For GPS coordinates, elevation numbers, and time stamps, an optional monospaced secondary font (JetBrains Mono) may be used to ensure numerical alignment.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a sidebar-main content architecture.

- **Sidebar (Fixed-Fluid):** The left control panel occupies a fixed width of 320px on desktop, housing all input controls and route details.
- **Main Canvas (Fluid):** The right section expands to fill the viewport, containing data visualizations and the map.
- **Gutter & Margins:** A consistent 16px gutter separates cards. Main page margins are set to 24px for desktop, scaling down to 16px for mobile.
- **Rhythm:** An 8px spatial grid governs all element relationships. Components should use 8px, 16px, or 24px padding internally.

## Elevation & Depth
The design system employs **Tonal Layers** rather than heavy shadows to define depth.

- **Level 0 (Background):** A soft, neutral tint (#F8FAF9) that recedes from the eye.
- **Level 1 (Cards):** Pure white surfaces with a very subtle, light gray border (1px solid #E0E4E2). Shadows are extremely diffused (0px 4px 12px rgba(0,0,0,0.03)).
- **Level 2 (Active/Floating):** Used for tooltips and dropdown menus. These use a slightly more pronounced shadow (0px 8px 24px rgba(0,0,0,0.08)) to indicate they sit above the main UI plane.
- **Header:** A flat color block that provides a solid structural anchor at the top of the viewport.

## Shapes
The shape language is friendly but disciplined. A standard radius of **12px (0.75rem)** is used for all primary containers and cards.

- **Small Components:** Checkboxes and small inputs use a 4px radius.
- **Buttons:** Use a 6px radius to appear slightly more technical and precise than the cards they sit within.
- **Interactive States:** Hover states on list items should use a subtle 8px rounded background.

## Components

### Buttons
- **Primary:** Filled with Primary Green (#76BA99), white text.
- **Secondary:** 1px border using Primary Green, green text, or "Save as New" style with 1px Neutral border.
- **Destructive:** Filled with Error Coral (#E5707E), white text.

### Input Fields
- **Default:** White background, 1px light gray border (#D1D5D3), Hanken Grotesk Body-md text.
- **Focus:** Border changes to Primary Green with a 2px soft outer glow.
- **Error:** Border changes to Error Coral with supporting red micro-copy below the field.

### Cards & Containers
- Cards must have a 12px border radius. 
- Grouped sections within sidebars (e.g., "Ride Details") should use an accordion-style header with a subtle separator line (#EEEEEE).

### Charts & Data
- **Elevation Area:** Uses a gradient fill from Primary Green (top) to transparent (bottom).
- **Markers:** Icons and labels should be circular or pill-shaped to match the overall rounded aesthetic.