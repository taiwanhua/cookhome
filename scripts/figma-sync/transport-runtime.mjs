/**
 * Figma 端的傳輸入口:首次 scan / apply 的結果編成有界 head,後續只唯讀重掃同一 scope 取指定區塊。
 * 不儲存任何跨 call 的 workflow state;apply 只在首次入口執行一次,取區塊的入口沒有 executor。
 * 會被序列化進 Figma 執行。
 */
export function createRuntimeTransport(runtime, transport, budget) {
  /** 首次入口。apply 先驗寫前 trace 預算:超量在任何 mutation 前回 TRANSPORT_TRACE_TOO_LARGE。 */
  async function run(request, plan) {
    if (request.operation === "apply") {
      if (!budget || !budget.traceBudget(request, plan).ok) {
        return transport.errorEnvelope(
          request,
          "attempt",
          "TRANSPORT_TRACE_TOO_LARGE",
          null,
        );
      }
      return transport.buildHead(
        request,
        await runtime.applyPlan(request, plan),
      );
    }
    return transport.buildHead(request, await runtime.scanScope(request));
  }

  /** 後續入口:唯讀重掃,內容與第一份完全相同才回指定區塊。 */
  async function readChunk(request, head, index) {
    return transport.buildChunk(
      request,
      head,
      index,
      await runtime.scanScope(request),
    );
  }

  return { run, readChunk };
}

/**
 * 生成碼的具名入口邏輯(Node 測試也直接呼叫同一支):解碼並驗證內嵌的 request / plan,
 * 只組該 operation 必需的 factories,再交給上面的傳輸入口。
 * input={request,plan:null|payload,read:null|{head,index}};read 入口的 factories 不含 executor / recovery。
 */
export async function runTransportEntry(
  figma,
  codec,
  input,
  factories,
  decoded = false,
) {
  const values = factories.createContractValues();
  const bytes = factories.createByteCodec(values);
  const envelope = factories.createEnvelopeLimits(values);
  const transport = factories.createTransport(values, codec, {
    bytes,
    envelope,
    decoder: factories.createPayloadDecoder(
      values,
      codec,
      bytes,
      envelope.LIMITS,
    ),
  });
  const contract = factories.assembleContract(
    factories,
    input.schema
      ? decoded
        ? input.schema
        : transport.decodeInput(input.schema)
      : undefined,
  );
  const request = contract.validateArtifact(
    decoded ? input.request : transport.decodeInput(input.request),
  );
  if (request.kind !== "request") contract.fail("ARTIFACT_KIND_MISMATCH");
  const core = { validateArtifact: contract.validateArtifact };
  let plan = null;
  if (input.plan) {
    plan = contract.validateArtifact(
      decoded ? input.plan : transport.decodeInput(input.plan),
    );
    const matched =
      plan.kind === "plan" &&
      request.operation === "apply" &&
      contract.digest(plan) === request.inputDigests.plan;
    if (!matched || input.read) contract.fail("PLAN_CHANGED");
    core.reconcileInterruptedPlan = factories.assembleRecovery(
      factories,
      contract,
    ).reconcileInterruptedPlan;
  } else if (request.operation === "apply" && !input.read) {
    contract.fail("REQUEST_OPERATION_INVALID");
  }
  const runtime = factories.assembleRuntime(figma, factories, core);
  const runner = factories.createRuntimeTransport(
    runtime,
    transport,
    factories.createTraceBudget ? factories.createTraceBudget(contract) : null,
  );
  return input.read
    ? runner.readChunk(request, input.read.head, input.read.index)
    : runner.run(request, plan);
}
