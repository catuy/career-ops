# Modo: pdf - CV Personalizado

## Critical Rules

1. **cv.md is the source of truth.** The content, structure, tone, and descriptions in cv.md are Diego's actual words. Preserve them.
2. **Minimal modifications only.** When personalizing for a JD, you may:
   - Rewrite the Summary (3 paragraphs) to bridge toward the role
   - Reorder experience blocks by relevance to the JD
   - Adjust tags per experience to match JD keywords
   - Add a "Curriculum Vitae / Application for [Role] - [Company]" subtitle
3. **Do NOT rewrite experience descriptions.** They are already polished. Only make minor word swaps if a JD keyword is a direct synonym (e.g., "user experience" to "UX").
4. **Never use the em dash character.** Use " - " (space hyphen space) instead.
5. **Write like a human.** No AI-sounding phrases. No "leveraging", "spearheading", "passionate about". Diego's tone is direct, clear, and humble. Match it.
6. **All sections from cv.md must appear.** The full structure is: Header, Subtitle, Summary + Photo, Education, Experience (all roles), Core Skills, Exhibitions & Awards, Publications & Talks, Tools & Technologies, References.
7. **Photo is required.** Use `file:///Users/diego/www/career-ops/templates/photo.png`

## Pipeline

1. Read `cv.md` as source of truth
2. Read JD (from context, URL, or ask user)
3. Extract 15-20 keywords from JD
4. Detect language (EN default) and paper format (US = letter, else = a4)
5. Detect archetype and decide which experience to put on page 1
6. Write Summary: 3 paragraphs, bridging Diego's background to the JD. Use Diego's voice from cv.md as baseline, not generic rewrites.
7. Select which experience goes on page 1 (most relevant to JD) vs page 2+
8. Adjust Core Skills tags to include JD keywords (but keep existing relevant ones)
9. Adjust per-experience tags to echo JD vocabulary
10. Generate HTML from `templates/cv-template.html` with all placeholders
11. Write to `/tmp/cv-diego-cataldo-{company}.html`
12. Run: `node generate-pdf.mjs /tmp/cv-diego-cataldo-{company}.html output/cv-diego-cataldo-{company}-{YYYY-MM-DD}.pdf --format={letter|a4}`
13. Report: path, pages, keyword coverage

## Reglas ATS (parseo limpio)

- Layout single-column (sin sidebars, sin columnas paralelas)
- Headers estándar: "Professional Summary", "Work Experience", "Education", "Skills", "Certifications", "Projects"
- Sin texto en imágenes/SVGs
- Sin info crítica en headers/footers del PDF (ATS los ignora)
- UTF-8, texto seleccionable (no rasterizado)
- Sin tablas anidadas
- Keywords del JD distribuidas: Summary (top 5), primer bullet de cada rol, Skills section

## Diseño del PDF

- **Font**: Inter (Google Fonts, loaded via @import in template)
- **Base size**: 10px, font-weight 500 (medium) for body, 700 for labels/titles
- **Summary**: 14px, weight 500, letter-spacing -0.28px
- **Layout**: Label-left (148px fixed) + content-right. NOT single column — it's a two-column label/content layout.
- **Header**: Name (10px bold, 148px) | Contact (10px bold, flex) | Portfolio link (10px bold, right)
- **Tags**: Pill-style with 1px black border, border-radius 100px, 9px text
- **Colors**: Black (#000) only. Period dates in rgba(0,0,0,0.4). No accent colors.
- **Pages**: A4 (595×842px / 210×297mm) or Letter (8.5×11in). Padding 10px.
- **Background**: White

## Section order (optimized for recruiter scan)

1. Header (name + contact + portfolio link)
2. Subtitle (optional — "Application for [Role] – [Company]")
3. Summary/Bio (14px, 2-3 paragraphs, keyword-dense)
4. Education (one line)
5. Core Competencies (tag pills with JD keywords)
6. Experience Highlights (1-2 most relevant on page 1)
7. Experience continued (remaining on page 2+)
8. Projects (optional, top 3-4)
9. Skills (optional)

## Estrategia de keyword injection (ético, basado en verdad)

Ejemplos de reformulación legítima:
- JD dice "RAG pipelines" y CV dice "LLM workflows with retrieval" → cambiar a "RAG pipeline design and LLM orchestration workflows"
- JD dice "MLOps" y CV dice "observability, evals, error handling" → cambiar a "MLOps and observability: evals, error handling, cost monitoring"
- JD dice "stakeholder management" y CV dice "collaborated with team" → cambiar a "stakeholder management across engineering, operations, and business"

**NUNCA añadir skills que el candidato no tiene. Solo reformular experiencia real con el vocabulario exacto del JD.**

## Template HTML

Usar el template en `templates/cv-template.html`. Design: Inter font, 10px base, label-left (148px) + content-right layout, tags with pill borders, A4 pages.

### Placeholders

| Placeholder | Content |
|-------------|---------|
| `{{LANG}}` | `en` or `es` |
| `{{PAGE_WIDTH}}` | `8.5in` (letter) or `210mm` (A4) |
| `{{PAGE_HEIGHT}}` | `11in` (letter) or `297mm` (A4) |
| `{{NAME}}` | from profile.yml |
| `{{EMAIL}}` | from profile.yml |
| `{{PORTFOLIO_URL}}` | from profile.yml |
| `{{PORTFOLIO_DISPLAY}}` | from profile.yml (display text) |
| `{{LOCATION}}` | from profile.yml |
| `{{SUBTITLE_SECTION}}` | Optional. For targeted applications: `<div class="section-row"><div class="section-label">Curriculum Vitae</div><div class="subtitle">Application for [Role] – [Company]</div></div>` |
| `{{SUMMARY_TEXT}}` | Bio/summary as `<p>` blocks with `<div class="spacer"></div>` between paragraphs. 14px, 500 weight. Inject JD keywords. |
| `{{SECTION_EDUCATION}}` | "Relevant Education" or "Education" |
| `{{EDUCATION}}` | Plain text: "2010 – Bachelor's Degree in Graphic Design – Universidad ORT Uruguay" |
| `{{SECTION_COMPETENCIES}}` | "Core Competencies" |
| `{{COMPETENCIES}}` | `<span class="tag">keyword</span>` × 6-10. Use JD vocabulary. |
| `{{SECTION_EXPERIENCE}}` | "Experience Highlights" |
| `{{EXPERIENCE_PAGE1}}` | First 1-2 experience blocks (fits page 1). See format below. |
| `{{SECTION_EXPERIENCE_CONT}}` | "Experience (continued)" |
| `{{EXPERIENCE_PAGE2}}` | Remaining experience blocks for page 2+. |
| `{{PROJECTS_SECTION}}` | Optional. `<div class="section-row"><div class="section-label">Projects</div><div class="section-content"><div class="exp-list">...</div></div></div>` |
| `{{SKILLS_SECTION}}` | Optional. `<div class="section-row"><div class="section-label">Skills</div><div class="section-content">...</div></div>` |

### Experience block format

```html
<div class="exp-block">
  <div class="exp-header">
    <div class="exp-title">Role Title – Company Name</div>
    <div class="exp-period">2023–Present | Remote</div>
    <div class="exp-desc">Description with JD keywords injected naturally. 2-4 sentences.</div>
  </div>
  <div class="tags">
    <span class="tag">Keyword 1</span>
    <span class="tag">Keyword 2</span>
  </div>
</div>
```

### Project block format

```html
<div class="project-block">
  <div class="project-title">Project Name</div>
  <div class="project-desc">One-line description with key tech/outcome.</div>
</div>
```

## Post-generación

Actualizar tracker si la oferta ya está registrada: cambiar PDF de ❌ a ✅.
