# RevoTake — Design System v2

> **Stitch Project ID:** `11820113749280719171`
> **Design System Asset:** `assets/9600318170220148035`

## Filosofía

RevoTake sirve a negocios de belleza y bienestar en Chile. El diseño debe transmitir **premium, calidez profesional y confianza** — alejándose del look genérico azul-corporativo anterior (v1) hacia una identidad más distintiva y aspiracional.

---

## Paleta de Colores

| Token          | Hex       | Uso                                      |
|----------------|-----------|------------------------------------------|
| `primary`      | `#7C3AED` | CTAs, nav activo, highlights principales |
| `primary-dark` | `#6D28D9` | Hover/active de primary                  |
| `secondary`    | `#F59E0B` | Accents de éxito, KPIs positivos, badges |
| `tertiary`     | `#EC4899` | Industry beauty, alertas suaves          |
| `surface`      | `#FDFCFF` | Background general (warm off-white)      |
| `on-surface`   | `#1E1B2E` | Texto principal                          |
| `sidebar-bg`   | `#1E1B2E` | Fondo del sidebar desktop                |
| `sidebar-item` | `#A1A1C2` | Texto items inactivos en sidebar         |

### Semánticos
- **Success/Active:** `emerald-500` (#10B981)
- **Warning:** `amber-500` (#F59E0B)
- **Error/Critical:** `rose-500` (#F43F5E)
- **Info:** `violet-500` (#8B5CF6)

---

## Tipografía

| Rol       | Familia           | Peso       | Tamaño base |
|-----------|-------------------|------------|-------------|
| Headline  | Plus Jakarta Sans | 700-800    | 28-32px     |
| Body      | Manrope           | 400-600    | 14px        |
| Label     | Manrope           | 500-600    | 12px        |
| Caption   | Manrope           | 400        | 10-11px     |

---

## Jerarquía de Superficies

```
Background:  #FDFCFF  (warm off-white, no frío)
Card:        #FFFFFF  + border violet-100/40 + shadow-sm
Sidebar:     #1E1B2E  (oscuro premium)
TopBar:      blur glassmorphism + border-b #E5E5F0/80
Modal/Sheet: #FFFFFF  + shadow-2xl
```

---

## Componentes

### Sidebar
- **Fondo:** `#1E1B2E` — oscuro, premium, alto contraste
- **Header:** Logo "RT" en cuadro `rounded-xl` con gradiente `from-violet-500 to-rose-500`, texto "RevoTake" blanco bold
- **Secciones nav:** label `10px uppercase tracking-widest text-slate-500`
- **Item inactivo:** texto `#A1A1C2`, icono Material Symbols outline
- **Item activo:** pill `bg-violet-500/15 text-violet-300`, icono filled, `ChevronRight` violet
- **Footer:** avatar + nombre + logout (rojo on hover)

### TopBar
- `bg-white/80 backdrop-blur-md border-b border-slate-100/80`
- **Izquierda:** hamburger mobile + store name chip `border border-violet-200 bg-violet-50`
- **Derecha:** "Reserva rápida" → `btn-primary` (pill violet), bell icon, avatar gradiente violet→rose
- **Avatar:** `bg-gradient-to-br from-violet-500 to-rose-500` con iniciales blancas

### KPI Cards
```
rounded-2xl bg-white border-t-[3px] border-t-{color} border border-slate-100 shadow-sm p-5
├── Icon circle: w-12 h-12 rounded-xl bg-{color}/10
├── Number: text-3xl font-extrabold tracking-tight text-slate-900
└── Label: text-xs font-semibold uppercase tracking-wide text-slate-500
```

### Botones
```css
/* Primary */
.btn-primary {
  background: linear-gradient(135deg, #7C3AED, #6D28D9);
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.25);
  border-radius: 9999px; /* pill */
}

/* Secondary */
.btn-secondary {
  background: #F3F4F6;
  border-radius: 9999px;
  color: #1E1B2E;
}
```

### Badges
```
badge-vip:      bg-amber-50 text-amber-800 border border-amber-200
badge-active:   bg-emerald-50 text-emerald-800 border border-emerald-200
badge-inactive: bg-slate-100 text-slate-600 border border-slate-200
badge-new:      bg-violet-50 text-violet-800 border border-violet-200
badge-critical: bg-rose-50 text-rose-800 border border-rose-200
```

---

## Motion (Framer Motion)

| Patrón          | Configuración                                              |
|-----------------|------------------------------------------------------------|
| Page enter      | `initial:{opacity:0,y:16}` → `animate:{opacity:1,y:0}` 0.35s ease-out |
| Card hover      | `whileHover:{y:-4}` + `transition:{duration:0.15}`         |
| Sidebar item    | `whileHover:{x:3}` + `transition:{duration:0.1}`           |
| Badge/counter   | `initial:{scale:0}` → `animate:{scale:1}` spring           |
| Dropdown        | `initial:{opacity:0,y:-8,scale:0.97}` → `animate:{opacity:1,y:0,scale:1}` |

---

## Cambios v1 → v2 (resumen)

| Elemento         | v1 (antes)                    | v2 (ahora)                         |
|------------------|-------------------------------|------------------------------------|
| Color primario   | Azul `#0050cb`                | Violet `#7C3AED`                   |
| Sidebar          | Blanco con borde gris         | Oscuro `#1E1B2E` premium           |
| Headlines font   | Manrope                       | Plus Jakarta Sans                  |
| Botones          | `rounded-full bg-primary`     | Pill con gradiente violet + shadow |
| KPI cards        | Icono con bg coloreado simple | Borde-top 3px colored              |
| Avatar           | `bg-blue-600` plano           | Gradiente violet→rose              |
| Store chip       | `bg-slate-50 border-slate-200`| `bg-violet-50 border-violet-200`   |
| Background       | `#f7f9fb` (frío)              | `#FDFCFF` (cálido)                 |

---

## Archivos a actualizar

1. `tailwind.config.ts` — paleta violet/amber/rose como primario
2. `src/app/globals.css` — clases utilitarias actualizadas
3. `src/components/layout/Sidebar.tsx` — sidebar oscuro premium
4. `src/components/layout/TopBar.tsx` — avatar gradiente, store chip violet
5. `src/app/dashboard/page.tsx` — KPI cards borde-top colored
