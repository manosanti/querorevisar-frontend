import { v7 } from 'uuid';

/** UUID v7: time-ordered ids generated on the device; they double as idempotency keys. */
export const newId = (): string => v7();
