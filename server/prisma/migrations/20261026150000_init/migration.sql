CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_members" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_message_id" UUID,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id", "user_id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "conversation_members_user_id_idx" ON "conversation_members"("user_id");
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversation_members"
    ADD CONSTRAINT "conversation_members_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_members"
    ADD CONSTRAINT "conversation_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_members"
    ADD CONSTRAINT "conversation_members_last_read_message_id_fkey"
    FOREIGN KEY ("last_read_message_id") REFERENCES "messages"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
