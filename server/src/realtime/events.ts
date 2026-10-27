import { EventEmitter } from "node:events";
// Notifications are emitted only after persistence succeeds. One server process
// owns this bus; multiple replicas would need a shared adapter/event transport.
export const chatEvents = new EventEmitter();
