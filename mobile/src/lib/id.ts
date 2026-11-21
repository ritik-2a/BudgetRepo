import { randomUUID } from 'expo-crypto';

/** UUID primary keys so records can later sync to the cloud without id clashes. */
export const newId = (): string => randomUUID();
