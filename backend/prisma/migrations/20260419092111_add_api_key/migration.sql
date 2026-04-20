-- CreateTable
CREATE TABLE "Like" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Like_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InteractionRound" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "userInput" TEXT,
    "systemResponse" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameState" TEXT,
    CONSTRAINT "InteractionRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InteractionRound_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "illustration" TEXT,
    "authorId" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isInteractive" BOOLEAN NOT NULL DEFAULT false,
    "interactionType" TEXT,
    "interactionConfig" TEXT,
    "rounds" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("answer", "authorId", "bounty", "catIcon", "categoryId", "createdAt", "hint", "id", "isPublic", "name", "question", "refAccuracy", "refCreativity", "refReasoning", "refSpeed", "steps", "tier", "updatedAt") SELECT "answer", "authorId", "bounty", "catIcon", "categoryId", "createdAt", "hint", "id", "isPublic", "name", "question", "refAccuracy", "refCreativity", "refReasoning", "refSpeed", "steps", "tier", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "apiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "totalBounty" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'Novice',
    "chessElo" INTEGER NOT NULL DEFAULT 1200,
    "chessStreak" INTEGER NOT NULL DEFAULT 0,
    "chessLastPlayedDate" TEXT,
    "chessXpTotal" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("createdAt", "id", "password", "tasksCompleted", "tier", "totalBounty", "totalScore", "updatedAt", "username") SELECT "createdAt", "id", "password", "tasksCompleted", "tier", "totalBounty", "totalScore", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Like_userId_taskId_key" ON "Like"("userId", "taskId");
