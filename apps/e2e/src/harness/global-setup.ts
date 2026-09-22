import { startStack } from "./stack";

/** Playwright 的 globalSetup:整套 stack 在這裡起來(細節見 `stack.ts`)。 */
export default async function globalSetup(): Promise<void> {
  await startStack();
}
