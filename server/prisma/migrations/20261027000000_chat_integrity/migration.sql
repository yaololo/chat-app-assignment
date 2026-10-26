BEGIN;

ALTER TABLE "conversations"
    ADD COLUMN "direct_user_low" UUID,
    ADD COLUMN "direct_user_high" UUID;

-- Backfill existing direct chats. Invalid member counts deliberately fail the
-- check below; duplicate pairs fail the unique index. No history is discarded.
UPDATE "conversations" AS c
SET "direct_user_low" = pairs.ids[1], "direct_user_high" = pairs.ids[2]
FROM (
    SELECT "conversation_id", array_agg("user_id" ORDER BY "user_id") AS ids
    FROM "conversation_members"
    GROUP BY "conversation_id"
    HAVING count(*) = 2
) AS pairs
WHERE c."id" = pairs."conversation_id" AND lower(c."type") = 'direct';

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_direct_pair_check"
CHECK (
    (lower("type") = 'direct'
        AND "direct_user_low" IS NOT NULL AND "direct_user_high" IS NOT NULL
        AND "direct_user_low" < "direct_user_high")
    OR (lower("type") <> 'direct'
        AND "direct_user_low" IS NULL AND "direct_user_high" IS NULL)
);

CREATE UNIQUE INDEX "conversations_direct_user_low_direct_user_high_key"
    ON "conversations"("direct_user_low", "direct_user_high");
CREATE UNIQUE INDEX "messages_conversation_id_id_key"
    ON "messages"("conversation_id", "id");
CREATE INDEX "messages_conversation_id_sender_id_idx"
    ON "messages"("conversation_id", "sender_id");
CREATE INDEX "conversation_members_conversation_id_last_read_message_id_idx"
    ON "conversation_members"("conversation_id", "last_read_message_id");

ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_sender_id_fkey"
    FOREIGN KEY ("conversation_id", "sender_id")
    REFERENCES "conversation_members"("conversation_id", "user_id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "conversation_members"
    DROP CONSTRAINT "conversation_members_last_read_message_id_fkey",
    ADD CONSTRAINT "conversation_members_conversation_id_last_read_message_id_fkey"
    FOREIGN KEY ("conversation_id", "last_read_message_id")
    REFERENCES "messages"("conversation_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- A pair key alone would allow incorrect memberships. Deferred checks allow
-- creating the conversation and its members together in one transaction.
CREATE FUNCTION "check_direct_conversation_members"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    target_id UUID;
    target_ids UUID[];
    chat RECORD;
    member_ids UUID[];
BEGIN
    IF TG_TABLE_NAME = 'conversations' THEN
        target_ids := ARRAY[NEW.id];
    ELSIF TG_OP = 'INSERT' THEN
        target_ids := ARRAY[NEW.conversation_id];
    ELSIF TG_OP = 'DELETE' THEN
        target_ids := ARRAY[OLD.conversation_id];
    ELSE
        target_ids := ARRAY[OLD.conversation_id, NEW.conversation_id];
    END IF;

    FOREACH target_id IN ARRAY target_ids LOOP
        SELECT * INTO chat FROM "conversations" WHERE id = target_id;
        IF FOUND AND lower(chat.type) = 'direct' THEN
            SELECT array_agg(user_id ORDER BY user_id) INTO member_ids
            FROM "conversation_members" WHERE conversation_id = target_id;
            IF member_ids IS DISTINCT FROM ARRAY[chat.direct_user_low, chat.direct_user_high] THEN
                RAISE EXCEPTION 'Direct conversation % must contain exactly its two specified users', target_id
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "conversations_direct_members_check"
AFTER INSERT OR UPDATE ON "conversations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_direct_conversation_members"();

CREATE CONSTRAINT TRIGGER "conversation_members_direct_members_check"
AFTER INSERT OR UPDATE OR DELETE ON "conversation_members"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_direct_conversation_members"();

COMMIT;
