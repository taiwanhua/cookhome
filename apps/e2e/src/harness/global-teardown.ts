import { stopStack } from "./stack";

/** Playwright 的 globalTeardown:與 globalSetup 同一個行程,模組層的 handle 拿得到。 */
export default async function globalTeardown(): Promise<void> {
  await stopStack();
}
