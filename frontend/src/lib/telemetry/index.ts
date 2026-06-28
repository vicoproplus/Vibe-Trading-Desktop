// frontend/src/lib/telemetry/index.ts
export { track } from "./track";
export { flushNow, setUploadEndpoint } from "./uploader";
export { setConsent, getConsent } from "./consent";

import { flushNow } from "./uploader";

/** app 启动调用：触发隔天 flush（§4.4）。非阻塞、失败吞掉。 */
export function init(): void {
  // ponytail: 故意不 await；flush 不得阻塞首屏
  flushNow().catch((_e: unknown) => console.warn("[telemetry] flush failed", _e));
}
