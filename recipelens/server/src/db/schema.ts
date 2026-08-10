/**
 * Schema migrations. Each entry runs exactly once, in order, inside a
 * transaction; `user_version` records how far the database has come.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial',
    sql: `
      CREATE TABLE users (
        id             TEXT PRIMARY KEY,
        email          TEXT NOT NULL,
        email_lower    TEXT NOT NULL UNIQUE,
        display_name   TEXT NOT NULL,
        password_hash  TEXT NOT NULL,
        token_version  INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );

      CREATE TABLE recipes (
        id             TEXT PRIMARY KEY,
        user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title          TEXT NOT NULL,
        description    TEXT,
        servings       INTEGER,
        prep_minutes   INTEGER,
        cook_minutes   INTEGER,
        difficulty     TEXT,
        cuisine        TEXT,
        image_url      TEXT,
        source_url     TEXT,
        source_type    TEXT NOT NULL DEFAULT 'manual',
        notes          TEXT,
        tags_json      TEXT NOT NULL DEFAULT '[]',
        equipment_json TEXT NOT NULL DEFAULT '[]',
        missing_json   TEXT NOT NULL DEFAULT '[]',
        confidence     REAL,
        version        INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );
      CREATE INDEX idx_recipes_user_created ON recipes(user_id, created_at DESC);
      CREATE INDEX idx_recipes_user_title ON recipes(user_id, title);

      CREATE TABLE ingredients (
        id         TEXT PRIMARY KEY,
        recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        position   INTEGER NOT NULL DEFAULT 0,
        name       TEXT NOT NULL,
        quantity   REAL,
        unit       TEXT,
        note       TEXT,
        optional   INTEGER NOT NULL DEFAULT 0,
        estimated  INTEGER NOT NULL DEFAULT 0,
        scalable   INTEGER NOT NULL DEFAULT 1,
        group_name TEXT
      );
      CREATE INDEX idx_ingredients_recipe ON ingredients(recipe_id, position);

      CREATE TABLE steps (
        id               TEXT PRIMARY KEY,
        recipe_id        TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        position         INTEGER NOT NULL DEFAULT 0,
        instruction      TEXT NOT NULL,
        duration_seconds INTEGER,
        temperature_c    INTEGER,
        estimated        INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_steps_recipe ON steps(recipe_id, position);

      CREATE TABLE favorites (
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, recipe_id)
      );
      CREATE INDEX idx_favorites_user ON favorites(user_id, created_at DESC);

      CREATE TABLE collections (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        name_lower  TEXT NOT NULL,
        description TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        UNIQUE (user_id, name_lower)
      );

      CREATE TABLE collection_recipes (
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        recipe_id     TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        added_at      TEXT NOT NULL,
        PRIMARY KEY (collection_id, recipe_id)
      );
      CREATE INDEX idx_collection_recipes_recipe ON collection_recipes(recipe_id);

      CREATE TABLE shopping_list_items (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        merge_key  TEXT NOT NULL,
        quantity   REAL,
        unit       TEXT,
        note       TEXT,
        checked    INTEGER NOT NULL DEFAULT 0,
        recipe_id  TEXT REFERENCES recipes(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_shopping_user ON shopping_list_items(user_id, checked, created_at);
      CREATE INDEX idx_shopping_merge ON shopping_list_items(user_id, merge_key);

      CREATE TABLE ai_analyses (
        id            TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id     TEXT REFERENCES recipes(id) ON DELETE SET NULL,
        source_type   TEXT NOT NULL,
        source_ref    TEXT,
        source_hash   TEXT NOT NULL,
        provider      TEXT NOT NULL,
        model         TEXT NOT NULL,
        status        TEXT NOT NULL,
        error_code    TEXT,
        attempts      INTEGER NOT NULL DEFAULT 1,
        duration_ms   INTEGER NOT NULL DEFAULT 0,
        result_json   TEXT,
        created_at    TEXT NOT NULL
      );
      CREATE INDEX idx_ai_user_hash ON ai_analyses(user_id, source_hash, created_at DESC);

      CREATE TABLE cooking_sessions (
        id                   TEXT PRIMARY KEY,
        user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id            TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        current_step         INTEGER NOT NULL DEFAULT 0,
        completed_steps_json TEXT NOT NULL DEFAULT '[]',
        servings             INTEGER,
        started_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        completed_at         TEXT,
        UNIQUE (user_id, recipe_id)
      );
      CREATE INDEX idx_cooking_user ON cooking_sessions(user_id, updated_at DESC);
    `,
  },
  {
    version: 2,
    name: 'federated-identity',
    sql: `
      ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'password';
      ALTER TABLE users ADD COLUMN google_sub TEXT;
      CREATE UNIQUE INDEX idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
    `,
  },
];
