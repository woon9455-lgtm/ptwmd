-- 폴더 (parent_id가 NULL이면 '내 드라이브' 바로 아래)
CREATE TABLE IF NOT EXISTS folders (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_id  TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

-- 문서 (body = 슬라이드 JSON, preview = 첫 슬라이드 JSON — 목록 썸네일용)
CREATE TABLE IF NOT EXISTS docs (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  folder_id   TEXT,
  theme       TEXT NOT NULL DEFAULT 'light',
  slide_count INTEGER NOT NULL DEFAULT 0,
  preview     TEXT,
  body        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  starred     INTEGER NOT NULL DEFAULT 0,
  trashed_at  INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_folder ON docs(folder_id, trashed_at);
CREATE INDEX IF NOT EXISTS idx_docs_updated ON docs(updated_at);
