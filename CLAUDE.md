# CLAUDE.md — Blog / CMS Engine Backend (blog-api.jcrlabs.net)

> Extiende: `SHARED-CLAUDE.md` (sección NestJS)

## Project Overview

CMS headless con API GraphQL code-first. NestJS + MongoDB + Mongoose. Sistema de publicación con drafts, editor TipTap blocks como JSON, y API pública de lectura.

## Tech Stack

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x strict
- **API**: GraphQL code-first — `@nestjs/graphql` + `@apollo/server`
- **DB**: MongoDB 8 — `@nestjs/mongoose` + Mongoose 8.x
- **Auth**: `@nestjs/passport` + `passport-jwt` + `@nestjs/jwt`
- **Validation**: `class-validator` + `class-transformer` (decorators en DTOs)
- **Upload**: `@aws-sdk/client-s3` (MinIO compatible)
- **Package manager**: pnpm
- **Testing**: Vitest (unit) + supertest (e2e) — más rápido que Jest

## Architecture (NestJS modular)

```
blog-cms-back/
├── src/
│   ├── main.ts                          # Bootstrap: validation pipe, CORS, prefix
│   ├── app.module.ts                    # Root: imports todos los feature modules
│   │
│   ├── common/                          # ── SHARED INFRASTRUCTURE ──
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts  # @CurrentUser() — extrae user de GQL context
│   │   │   ├── roles.decorator.ts         # @Roles(Role.ADMIN)
│   │   │   └── public.decorator.ts        # @Public() — skip JWT guard
│   │   ├── guards/
│   │   │   ├── gql-auth.guard.ts          # Extiende AuthGuard('jwt') para GraphQL
│   │   │   └── roles.guard.ts             # Verifica @Roles via Reflector
│   │   ├── filters/
│   │   │   └── gql-exception.filter.ts    # Mapea domain errors → GraphQL errors
│   │   ├── scalars/
│   │   │   └── date-time.scalar.ts        # Custom scalar DateTime
│   │   └── pagination/
│   │       ├── pagination.input.ts        # PaginationInput: first, after (cursor)
│   │       └── paginated.type.ts          # Generic PaginatedResponse<T> con edges + pageInfo
│   │
│   ├── auth/                            # ── AUTH MODULE ──
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts              # Login (bcrypt verify), generateTokens (access+refresh)
│   │   ├── auth.resolver.ts             # Mutation: login, refreshToken
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts          # Passport JWT strategy — extrae payload
│   │   └── dto/
│   │       ├── login.input.ts           # @InputType: email + password (class-validator)
│   │       └── auth-response.type.ts    # @ObjectType: accessToken + refreshToken + user
│   │
│   ├── users/                           # ── USERS MODULE ──
│   │   ├── users.module.ts
│   │   ├── users.service.ts             # CRUD users, hash password con bcrypt
│   │   ├── schemas/
│   │   │   └── user.schema.ts           # @Schema: email (unique), password, role enum, timestamps
│   │   └── dto/
│   │       └── user.type.ts             # @ObjectType (excluye password)
│   │
│   ├── posts/                           # ── POSTS MODULE (core domain) ──
│   │   ├── posts.module.ts
│   │   ├── posts.service.ts             # CRUD + publish workflow (draft → review → published)
│   │   │                                # slug generation, scheduled publish, full-text search
│   │   ├── posts.resolver.ts            # Queries: posts (public), post(slug), myDrafts (auth)
│   │   │                                # Mutations: create, update, publish, delete (auth + roles)
│   │   ├── schemas/
│   │   │   └── post.schema.ts           # title, slug (unique), content (Mixed/JSON), status enum,
│   │   │                                # publishedAt, author (ref User), category (ref), tags (ref[])
│   │   │                                # indexes: { slug: 1 }, { title: 'text', content: 'text' }
│   │   └── dto/
│   │       ├── create-post.input.ts     # @InputType con validación
│   │       ├── update-post.input.ts     # @InputType partial
│   │       ├── post-filter.input.ts     # status, category, tag, search (text)
│   │       └── post.type.ts             # @ObjectType con @Field(() => JSON) para content
│   │
│   ├── categories/                      # ── CATEGORIES MODULE ──
│   │   ├── categories.module.ts
│   │   ├── categories.service.ts
│   │   ├── categories.resolver.ts
│   │   ├── schemas/category.schema.ts   # name (unique), slug, description
│   │   └── dto/
│   │
│   ├── tags/                            # ── TAGS MODULE ──
│   │   ├── tags.module.ts
│   │   ├── tags.service.ts
│   │   ├── schemas/tag.schema.ts        # name (unique), slug
│   │   └── dto/
│   │
│   ├── media/                           # ── MEDIA MODULE ──
│   │   ├── media.module.ts
│   │   ├── media.service.ts             # Upload to MinIO, generate presigned URLs
│   │   ├── media.resolver.ts            # Mutation: uploadMedia (auth)
│   │   └── dto/
│   │       └── media-file.type.ts       # url, key, mimetype, size
│   │
│   └── feed/                            # ── RSS FEED (REST, no GraphQL) ──
│       ├── feed.module.ts
│       └── feed.controller.ts           # GET /rss.xml — genera RSS 2.0
│
├── test/
│   ├── app.e2e-spec.ts                  # E2E contra MongoDB in-memory (mongodb-memory-server)
│   └── helpers/
│       └── setup.ts                     # Test module factory
│
├── k8s/
├── .github/workflows/ci.yaml
├── Dockerfile
├── vitest.config.ts
├── tsconfig.json                        # strict: true
└── pnpm-lock.yaml
```

## GraphQL Schema (auto-generado por code-first)

```graphql
type Post {
  id: ID!
  title: String!
  slug: String!
  content: JSON!                # TipTap blocks serializado
  excerpt: String
  coverImage: String
  status: PostStatus!           # DRAFT | REVIEW | PUBLISHED
  publishedAt: DateTime
  author: User!
  category: Category
  tags: [Tag!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Query {
  posts(filter: PostFilterInput, pagination: PaginationInput): PostConnection!
  post(slug: String!): Post
  myDrafts: [Post!]!            # @UseGuards(GqlAuthGuard)
  categories: [Category!]!
  tags: [Tag!]!
}

type Mutation {
  createPost(input: CreatePostInput!): Post!      # @Roles(AUTHOR, ADMIN)
  updatePost(id: ID!, input: UpdatePostInput!): Post!
  publishPost(id: ID!): Post!                     # Sets status = PUBLISHED, publishedAt = now
  unpublishPost(id: ID!): Post!                   # Reverts to DRAFT
  deletePost(id: ID!): Boolean!                   # @Roles(ADMIN)
  uploadMedia(file: Upload!): MediaFile!
}
```

## Principios específicos de este proyecto

1. **GraphQL code-first**: toda la schema se genera desde decorators TypeScript — no hay `.graphql` files
2. **Cursor-based pagination**: usar `after` (cursor = base64 encoded ID) + `first` (limit). Retornar `edges` + `pageInfo { hasNextPage, endCursor }`
3. **Mongoose lean queries**: `.lean()` en todas las queries de lectura para performance
4. **Post workflow como state machine**: `DRAFT → REVIEW → PUBLISHED`. Solo ADMIN puede publish. Solo author puede editar su draft.
5. **Slug auto-generado**: desde title, con collision handling (`title-2`, `title-3`)
6. **Content como Mixed type**: TipTap JSON se guarda sin schema validation en Mongoose (`Schema.Types.Mixed`)
7. **Testing con mongodb-memory-server**: no necesita MongoDB real para E2E

## Deploy

- **Dominio**: `tech-blog-api.jcrlabs.net` (API) + `tech-blog.jcrlabs.net` (frontend)
- **Namespace**: `blog`
- **MongoDB**: StatefulSet PVC 10Gi
- **MinIO**: bucket `blog-media` en instancia compartida del cluster

## CI local

Ejecutar **antes de cada commit** para evitar que lleguen errores a GitHub Actions:

```bash
pnpm lint
pnpm test
pnpm build
```
## Git

- Ramas: `feature/`, `bugfix/`, `hotfix/`, `release/` — sin prefijos adicionales
- Commits: convencional (`feat:`, `fix:`, `chore:`, etc.) — sin mencionar herramientas externas ni agentes en el mensaje
- PRs: título y descripción propios del cambio — sin mencionar herramientas externas ni agentes
- Comentarios y documentación: redactar en primera persona del equipo — sin atribuir autoría a herramientas
