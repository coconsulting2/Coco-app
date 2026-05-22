# Slice template

Molde para crear un nuevo bounded context (slice). Copia esta carpeta como
`app/contexts/<nombre-del-slice>/` y reemplaza `__slice__` por el nombre real.

```bash
SLICE_NAME="mi-slice"
cp -R templates/slice-template app/contexts/$SLICE_NAME
# Renombra placeholders (sin GNU sed: usa sed -i '' en macOS)
find app/contexts/$SLICE_NAME -type f -exec sed -i '' "s/__slice__/$SLICE_NAME/g" {} \;
```

Verifica con:

```bash
bun run lint   # debe pasar con cero errores estructurales
```

## Estructura

```
mi-slice/
├── index.ts                    # API pública del slice (re-exporta use-cases + tipos)
├── domain/
│   ├── entities/MyEntity.ts    # value objects + entities
│   ├── ports/MyRepository.ts   # interfaces de repos/adapters
│   └── errors.ts               # errores tipados del dominio
├── application/                # use-cases (orquestan ports)
│   └── myUseCase.ts            # ejemplo
├── infrastructure/             # adapters concretos (ÚNICO lugar que toca Prisma)
│   └── PrismaMyRepository.server.ts
└── interface/
    ├── loaders/                # RR v7 loader handlers (opcional)
    ├── actions/                # RR v7 action handlers (opcional)
    └── api/                    # dispatcher para resource routes (solo si /api/* necesario)
        └── myApi.server.ts
```
