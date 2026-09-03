/* eslint-disable no-console -- logger 的本業就是輸出到 console,是全 repo 唯一的豁免點 */
export const log = (...args: unknown[]): void => {
  console.log("LOGGER:", ...args);
};
