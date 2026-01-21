# OTUI Studio (Nuxt 4 + Pinia + Nuxt UI + Nitro)

Editor e validador de arquivos OTUI (OTCv8) com Nuxt 4, Pinia, Nuxt UI e Nitro.

## Requisitos
- Bun (recomendado): `bun --version` deve funcionar

## Instalação
```bash
bun install
```

## Desenvolvimento
```bash
bun run dev
# http://localhost:3000
```

## Typecheck
```bash
bun run typecheck
```

## Produção
```bash
bun run build
bun run preview
```

## API
- `POST /api/otui/parse` 
  - body: `{ code: string }`
  - retorno: `{ widgets, templates, templateMap, diagnostics }`
