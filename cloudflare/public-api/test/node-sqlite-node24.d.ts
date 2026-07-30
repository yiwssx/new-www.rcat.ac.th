import "node:sqlite";

declare module "node:sqlite" {
  interface DatabaseSync {
    serialize(dbName?: string): Uint8Array;
    deserialize(buffer: Uint8Array, options?: { dbName?: string }): void;
  }
}
