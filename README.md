# Prisma ORM guide

How to setup multi databases using prisma

## Pull multi databases

### First database

1. Pull database schemas

```bash
npx prisma db pull
```

2. Generate database schemas

```bash
npx prisma generate
```

### Second database

1. Pull database schemas

- Syntax

```bash
npx prisma db pull --schema= {schema.prisma file direction}
```

- Example

```bash
npx prisma db pull --schema=./prisma_auth/schema.prisma
```

2. Generate database schemas

- Syntax

```bash
npx prisma generate --schema={{schema.prisma file direction}}
```

- Example

```bash
npx prisma generate --schema=./prisma_auth/schema.prisma
```
