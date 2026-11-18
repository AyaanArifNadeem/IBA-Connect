-- Trigram matching for directory search (FR2.2, NFR1)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Course_code_trgm_idx" ON "Course" USING GIN ("code" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Course_title_trgm_idx" ON "Course" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Skill_name_trgm_idx" ON "Skill" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "User_name_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);
