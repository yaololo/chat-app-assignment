Chat integrity constraints
==========================

Apply changes with `npm run db:deploy` from `server`. Use the migration history:
the direct-chat check and deferred triggers are custom SQL and are not represented
fully in `schema.prisma` or recreated by `prisma db push`.

For a direct conversation, use `type: "direct"` and set `directUserLow` and
`directUserHigh` to the two distinct user UUIDs in ascending order. Normalize UUID
strings to lowercase before sorting. Create the conversation and both memberships
in one Prisma nested write or `$transaction`; the database checks the exact member
pair at commit. A unique index prevents concurrent requests from creating duplicate
pairs. Handle the uniqueness conflict by fetching the existing conversation.
Other conversation types must leave both pair fields null.

Messages require an existing membership for `(conversationId, senderId)`.
Read pointers must reference a message in the same conversation. The server must
still authenticate the caller and authorize sending messages or updating receipts;
foreign keys do not establish the caller's identity.

Clear any `lastReadMessageId` references before deleting an individual message.
Memberships with messages cannot be deleted while those messages remain. To
support leaving a chat while retaining history, keep the membership row and add
a separate inactive/left state when that feature is needed. Deleting an entire
conversation still cascades to its messages and memberships.

The integrity migration backfills direct pairs from existing memberships (matching
`direct` case insensitively). It fails atomically on duplicate pairs, direct chats
without exactly two members, messages without memberships, or cross-conversation
read pointers. Resolve invalid existing data before retrying; it does not delete
or merge chat history automatically.
