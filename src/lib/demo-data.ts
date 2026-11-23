import "server-only";
import { join } from "node:path";
import { isDemoMode } from "./env";
import { readDemoFile, changeDemoFile, type DemoData } from "./demo-store";

const directory = join(process.cwd(), ".client-hub-demo");

function requireDemo() {
  if (!isDemoMode()) throw new Error("Demo data requires local development mode.");
}

export function readDemo() {
  requireDemo();
  return readDemoFile(directory);
}

export function changeDemo<T>(operation: (data: DemoData) => T) {
  requireDemo();
  return changeDemoFile(directory, operation);
}
