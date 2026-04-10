-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authorId" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Course_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Course" ("description", "difficulty", "icon", "id", "isActive", "name", "order") SELECT "description", "difficulty", "icon", "id", "isActive", "name", "order" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "bounty" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "catIcon" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "hint" TEXT,
    "answer" TEXT NOT NULL,
    "refAccuracy" INTEGER NOT NULL,
    "refReasoning" INTEGER NOT NULL,
    "refCreativity" INTEGER NOT NULL,
    "refSpeed" INTEGER NOT NULL,
    "steps" TEXT NOT NULL,
    "authorId" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("answer", "bounty", "catIcon", "categoryId", "hint", "id", "name", "question", "refAccuracy", "refCreativity", "refReasoning", "refSpeed", "steps", "tier") SELECT "answer", "bounty", "catIcon", "categoryId", "hint", "id", "name", "question", "refAccuracy", "refCreativity", "refReasoning", "refSpeed", "steps", "tier" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
