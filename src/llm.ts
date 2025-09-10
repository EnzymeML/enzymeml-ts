/**
 * OpenAI streaming response utilities for structured data generation.
 * 
 * This module provides utilities for creating streaming responses from OpenAI's API
 * with optional structured output validation using Zod schemas. It handles real-time
 * streaming of text, refusals, and errors from the OpenAI responses API.
 * 
 * Key features:
 * - Streaming text generation with real-time delta updates
 * - Structured output validation using Zod schemas
 * - Tool chain execution with automatic retry and timeout handling
 * - Support for multiple input types (BaseInput instances, raw messages)
 * - Comprehensive error handling and progress tracking
 */

import OpenAI from "openai";
import { z, type ZodTypeAny } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { SystemQuery, UserQuery, type BaseInput, type MessageInput } from "./input-types";
import { ResponseOutputItem, Tool } from "openai/resources/responses/responses";
import { SearchDatabaseTool, SearchDatabaseToolSpecs } from "./tools";

import PQueue from "p-queue";
import pRetry from "p-retry";
import pTimeout from "p-timeout";

const REASONING_MODELS = [
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "o3",
    "o3-mini",
];

/**
 * Represents a single item in the streaming response.
 * 
 * @example
 * ```typescript
 * // Text delta from the model
 * { kind: "text", delta: "Hello " }
 * 
 * // Refusal delta when model refuses to respond
 * { kind: "refusal", delta: "I cannot " }
 * 
 * // Error during streaming
 * { kind: "error", error: new Error("Connection failed") }
 * ```
 */
export type StreamItem =
    | { kind: "text"; delta: string }
    | { kind: "refusal"; delta: string }
    | { kind: "error"; error: unknown };

/**
 * Represents a tool call reference for tracking tool execution.
 */
export type ToolCallRef = {
    callId: string;
    name: string;
    index: number; // 0-based within this depth
};

/**
 * Metadata for tool chain execution tracking.
 */
export type ToolChainMeta = {
    depth: number;
    totalDepth: number;
    model: string;
    conversationId?: string;
    requestId?: string;
    ts: number;
};

/**
 * Events emitted during tool chain execution for progress tracking.
 */
export type ToolChainEvent =
    | { type: "chain_start"; meta: ToolChainMeta; payload: { inputSize: number } }
    | { type: "planning_result"; meta: ToolChainMeta; payload: { toolCount: number; toolNames: string[]; calls: ToolCallRef[] } }
    | { type: "no_tools"; meta: ToolChainMeta; payload: {} }
    | { type: "tool_start"; meta: ToolChainMeta; payload: ToolCallRef & { args: unknown } }
    | { type: "tool_retry"; meta: ToolChainMeta; payload: ToolCallRef & { attempt: number; nextDelayMs: number; message: string } }
    | { type: "tool_success"; meta: ToolChainMeta; payload: ToolCallRef & { durationMs: number; resultSize?: number } }
    | { type: "tool_error"; meta: ToolChainMeta; payload: ToolCallRef & { error: string; detail?: unknown } }
    | { type: "outputs_appended"; meta: ToolChainMeta; payload: { count: number; elapsedMs: number } }
    | { type: "chain_complete"; meta: ToolChainMeta; payload: { outputSize: number } };

/**
 * Parameters for creating a streaming response from OpenAI.
 * 
 * @template TSchema - Optional Zod schema type for structured output validation
 */
export type CreateStreamParams<TSchema extends ZodTypeAny | undefined> = {
    /** The OpenAI model to use (e.g., 'gpt-5', 'gpt-4o') */
    model: string;
    /** Array of messages forming the conversation context - can be BaseInput instances or raw message objects */
    input: Array<{ role: "system" | "user" | "assistant"; content: unknown } | BaseInput>;
    /** Optional Zod schema for structured output validation */
    schema?: TSchema;
    /** When you expect multiple items within a list */
    multiple?: boolean;
    /** Key name for the structured output in the response (default: "data") */
    schemaKey?: string;
    /** Pre-configured OpenAI client instance */
    client: OpenAI;
    /** Optional tools for the model to use */
    tools?: Tool[];
    /** Optional progress callback for tool-chain state */
    onToolChainEvent?: (e: ToolChainEvent) => void;
};

/**
 * Creates a streaming response from OpenAI with optional structured output and tool execution.
 * 
 * This function sets up a streaming connection to OpenAI's responses API and provides
 * multiple ways to consume the stream: raw event listeners, async iteration, and
 * a final response promise.
 * 
 * **Tool Chain Execution**: If tools are provided, the function first executes a blocking
 * tool chain to resolve any tool calls before starting the final streaming response. This
 * ensures that tool outputs are available in context for the structured generation.
 * 
 * @template TSchema - Optional Zod schema type for structured output validation
 * @param params - Configuration parameters for the streaming request
 * @returns An object containing the raw stream, async iterator, and final response promise
 * 
 * @example
 * ```typescript
 * import { SystemQuery, UserQuery, PDFUpload } from 'enzymeml';
 * import { z } from 'zod';
 * 
 * // Basic text streaming with SystemQuery and UserQuery
 * const { chunks, final } = await extractData({
 *   model: 'gpt-4o',
 *   input: [
 *     new SystemQuery('You are a helpful assistant that tells funny jokes.'),
 *     new UserQuery('Tell me a joke')
 *   ],
 *   client
 * });
 * 
 * // Mixed input types (raw messages and input classes)
 * const { chunks, final } = await extractData({
 *   model: 'gpt-4o',
 *   input: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     new UserQuery('Tell me a joke')
 *   ],
 *   client
 * });
 * 
 * // With file upload and system prompt
 * const pdfUpload = new PDFUpload('./document.pdf', undefined, client);
 * await pdfUpload.upload(); // Upload the file first
 * const { chunks, final } = await extractData({
 *   model: 'gpt-4o',
 *   input: [
 *     new SystemQuery('You are an expert document analyzer.'),
 *     new UserQuery('Analyze this document'),
 *     pdfUpload
 *   ],
 *   client
 * });
 * 
 * // Consume stream with async iteration
 * for await (const chunk of chunks) {
 *   if (chunk.kind === 'text') {
 *     console.log(chunk.delta);
 *   }
 * }
 * 
 * // With structured output and system prompt
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number()
 * });
 * 
 * const { chunks, final } = await extractData({
 *   model: 'gpt-4o',
 *   input: [
 *     new SystemQuery('Respond only with JSON matching the schema under key "person".'),
 *     new UserQuery('Generate a person')
 *   ],
 *   schema,
 *   schemaKey: 'person',
 *   client
 * });
 * 
 * // With tools and progress tracking
 * const { chunks, final } = await extractData({
 *   model: 'gpt-4o',
 *   input: [
 *     new SystemQuery('You can search databases to answer questions.'),
 *     new UserQuery('Find information about renewable energy')
 *   ],
 *   tools: [SearchDatabaseToolSpecs],
 *   onToolChainEvent: (event) => {
 *     console.log(`Tool event: ${event.type}`, event.payload);
 *   },
 *   client
 * });
 * ```
 */
export async function extractData<TSchema extends ZodTypeAny | undefined>(
    params: CreateStreamParams<TSchema>
) {
    const {
        model,
        input,
        schema,
        multiple,
        schemaKey = "data",
        client,
        tools = [SearchDatabaseToolSpecs],
        onToolChainEvent,
    } = params;

    // Convert input to proper message format, handling BaseInput instances
    let processedInput = input.map((item): MessageInput => {
        if (item && typeof item === "object" && "toMessage" in item) {
            return (item as BaseInput).toMessage();
        }
        return item as MessageInput;
    });

    let schemaInput: ZodTypeAny | undefined = schema;
    if (multiple && schema) {
        schemaInput = z.object({
            items: z
                .array(schema)
                .describe(`Array of ${schema.description || "items"} objects`),
        });
    }

    if (tools && tools.length > 0) {
        // *** BLOCKING TOOL CHAIN: resolve any tool calls before final stream ***
        processedInput = await runToolChain(
            tools,
            processedInput,
            client,
            model,
            {
                concurrency: 2,
                toolTimeoutMs: 10_000,
                toolRetries: 2,
                depth: 1,
                totalDepth: 1,
                handlers: {
                    search_databases: SearchDatabaseTool,
                },
            },
            onToolChainEvent
        );

        processedInput = [
            new SystemQuery("You will see tool search results below.").toMessage(),
            ...processedInput,
        ];
    }

    if (tools && tools.length > 0) {
        processedInput.push(
            new SystemQuery("CRITICAL FINAL INSTRUCTION: Adapt the tool search results to the user query.").toMessage()
        );
    }

    // Start the final streaming call with tool outputs already in context
    const stream = client.responses.stream({
        model,
        input: processedInput as any,
        temperature: REASONING_MODELS.includes(model) ? undefined : 0,
        ...(schemaInput
            ? { text: { format: zodTextFormat(schemaInput, schemaKey) } }
            : undefined),
    });

    // Expose a convenient async iterator over minimal "chunks".
    const iterator = (async function* () {
        const queue: StreamItem[] = [];
        let done = false;

        const push = (item: StreamItem) => queue.push(item);

        stream.on("response.output_text.delta", (e: any) =>
            push({ kind: "text", delta: e.delta })
        );
        stream.on("response.refusal.delta", (e: any) =>
            push({ kind: "refusal", delta: e.delta })
        );
        // @ts-expect-error - response.error event exists but not in types
        stream.on("response.error", (e: any) => push({ kind: "error", error: e.error }));

        const final = stream.finalResponse().finally(() => {
            done = true;
        });

        // Drain the queue until done.
        while (!done || queue.length) {
            if (queue.length) {
                yield queue.shift()!;
            } else {
                // micro-delay to yield control until new events arrive or final resolves
                await Promise.race([new Promise((r) => setTimeout(r, 10)), final]);
            }
        }
    })();

    return {
        /** Raw OpenAI stream for direct event listener access */
        stream,
        /** Async iterator for consuming stream chunks */
        chunks: iterator as AsyncIterable<StreamItem>,
        /** Promise that resolves with the complete response when streaming finishes */
        final: stream.finalResponse(),
    };
}

/**
 * Executes a tool chain by planning tool calls and executing them in parallel.
 * 
 * This function handles the complete tool execution lifecycle:
 * 1. Plans tool calls by sending input to the model with available tools
 * 2. Executes tool calls in parallel with configurable concurrency and retries
 * 3. Appends tool outputs to the input for subsequent processing
 * 
 * @param tools - Array of available tools for the model to use
 * @param baseInput - Initial input messages
 * @param client - OpenAI client instance
 * @param model - Model to use for planning tool calls
 * @param opts - Configuration options for tool execution
 * @param onEvent - Optional callback for tool chain events
 * @returns Updated input array with tool outputs appended
 * 
 * @example
 * ```typescript
 * const updatedInput = await runToolChain(
 *   [SearchDatabaseToolSpecs],
 *   [{ role: 'user', content: 'Search for renewable energy data' }],
 *   client,
 *   'gpt-4o',
 *   {
 *     concurrency: 2,
 *     toolTimeoutMs: 10000,
 *     toolRetries: 2,
 *     handlers: {
 *       search_databases: SearchDatabaseTool
 *     }
 *   },
 *   (event) => console.log(event.type, event.payload)
 * );
 * ```
 */
export async function runToolChain(
    tools: Tool[],
    baseInput: any[],
    client: OpenAI,
    model: string,
    opts: {
        /** Maximum number of tools to execute concurrently */
        concurrency?: number;
        /** Maximum tasks per interval for rate limiting */
        intervalCap?: number;
        /** Interval in milliseconds for rate limiting */
        interval?: number;
        /** Timeout in milliseconds for individual tool execution */
        toolTimeoutMs?: number;
        /** Number of retries for failed tool calls */
        toolRetries?: number;
        /** Current depth in tool chain (for nested calls) */
        depth?: number;
        /** Total depth allowed in tool chain */
        totalDepth?: number;
        /** Conversation ID for tracking */
        conversationId?: string;
        /** Map of tool names to handler functions */
        handlers?: Record<string, (args: any, signal?: AbortSignal) => Promise<unknown> | unknown>;
    } = {},
    onEvent?: (e: ToolChainEvent) => void
): Promise<any[]> {
    // Configuration
    const CONCURRENCY = Math.max(1, opts.concurrency ?? 2);
    const TOOL_TIMEOUT_MS = opts.toolTimeoutMs ?? 12_000;
    const TOOL_RETRIES = Math.max(0, opts.toolRetries ?? 1);
    const DEPTH = opts.depth ?? 1;
    const TOTAL = opts.totalDepth ?? 1;

    let input = [...baseInput];

    // Setup queue with concurrency and rate limiting
    const queue = new PQueue({
        concurrency: CONCURRENCY,
        ...(opts.intervalCap && opts.interval
            ? { intervalCap: opts.intervalCap, interval: opts.interval }
            : {}),
        carryoverConcurrencyCount: true,
    });

    // Helper functions
    const meta = (extra?: Partial<ToolChainMeta>): ToolChainMeta => ({
        depth: DEPTH,
        totalDepth: TOTAL,
        model,
        conversationId: opts.conversationId,
        requestId: undefined,
        ts: Date.now(),
        ...extra,
    });

    const handlerFor = (name: string) => opts.handlers?.[name];

    const sizeHint = (x: unknown): number | undefined => {
        try {
            if (x == null) return 0;
            if (typeof x === "string") return x.length;
            if (Array.isArray(x)) return x.length;
            if (x instanceof Uint8Array) return x.byteLength;
            const s = JSON.stringify(x);
            return s?.length;
        } catch {
            return undefined;
        }
    };

    onEvent?.({ type: "chain_start", meta: meta(), payload: { inputSize: input.length } });

    // Step 1: Get tool calls from model
    const toolCalls = await planToolCalls(client, model, input, tools);

    if (toolCalls.length === 0) {
        onEvent?.({ type: "no_tools", meta: meta(), payload: {} });
        onEvent?.({ type: "chain_complete", meta: meta(), payload: { outputSize: input.length } });
        return input;
    }

    // Step 2: Emit planning result and append function calls to input
    const callRefs: ToolCallRef[] = toolCalls.map((c, i) => ({
        callId: c.call_id,
        name: c.name,
        index: i
    }));

    onEvent?.({
        type: "planning_result",
        meta: meta(),
        payload: {
            toolCount: toolCalls.length,
            toolNames: toolCalls.map((c) => c.name),
            calls: callRefs
        },
    });

    // Append function_call events (required by Responses API)
    input.push(
        ...toolCalls.map((c) => ({
            type: "function_call",
            name: c.name,
            call_id: c.call_id,
            arguments: c.arguments,
        }))
    );

    // Step 3: Execute tools and append outputs
    const outputs = await executeToolCalls(
        toolCalls,
        queue,
        handlerFor,
        TOOL_TIMEOUT_MS,
        TOOL_RETRIES,
        meta,
        sizeHint,
        onEvent
    );

    input.push(...outputs);

    onEvent?.({ type: "chain_complete", meta: meta(), payload: { outputSize: input.length } });
    return input;
}

/**
 * Plans tool calls by sending input to the model with available tools.
 * 
 * @param client - OpenAI client instance
 * @param model - Model to use for planning
 * @param input - Input messages
 * @param tools - Available tools
 * @returns Array of function call items from the model response
 */
async function planToolCalls(
    client: OpenAI,
    model: string,
    input: any[],
    tools: Tool[],
): Promise<Extract<ResponseOutputItem, { type: "function_call" }>[]> {
    const resp = await client.responses.create({
        model,
        input,
        tools,
        tool_choice: "required",
        temperature: REASONING_MODELS.includes(model) ? undefined : 0,
    });

    const calls: Extract<ResponseOutputItem, { type: "function_call" }>[] = [];
    for (const item of resp.output as ResponseOutputItem[]) {
        if (item.type === "function_call") {
            calls.push(item);
        }
    }

    return calls;
}

/**
 * Executes multiple tool calls in parallel with retry logic and timeout handling.
 * 
 * @param calls - Array of function call items to execute
 * @param queue - PQueue instance for managing concurrency
 * @param handlerFor - Function to get handler for a tool name
 * @param timeoutMs - Timeout in milliseconds for each tool call
 * @param retries - Number of retries for failed calls
 * @param meta - Function to generate metadata
 * @param sizeHint - Function to estimate size of data
 * @param onEvent - Optional event callback
 * @returns Array of function call output objects
 */
async function executeToolCalls(
    calls: Extract<ResponseOutputItem, { type: "function_call" }>[],
    queue: PQueue,
    handlerFor: (name: string) => ((args: any, signal?: AbortSignal) => Promise<unknown> | unknown) | undefined,
    timeoutMs: number,
    retries: number,
    meta: () => ToolChainMeta,
    sizeHint: (x: unknown) => number | undefined,
    onEvent?: (e: ToolChainEvent) => void
): Promise<{ type: string; call_id: string; output: string }[]> {
    const startedAt = Date.now();

    const results = await Promise.allSettled(
        calls.map((call, idx) =>
            queue.add(() => executeSingleTool(
                call,
                idx,
                handlerFor,
                timeoutMs,
                retries,
                meta,
                sizeHint,
                onEvent
            ))
        )
    );

    const outputs = results.map((res, i) => {
        const call_id = res.status === "fulfilled" ? res.value?.call_id : calls[i].call_id;
        const output = res.status === "fulfilled" ? res.value?.output : JSON.stringify({ error: String(res.reason) });
        return { type: "function_call_output", call_id, output };
    });

    onEvent?.({
        type: "outputs_appended",
        meta: meta(),
        payload: { count: outputs.length, elapsedMs: Date.now() - startedAt },
    });

    return outputs.map(output => ({
        type: output.type,
        call_id: output.call_id ?? "",
        output: output.output ?? ""
    }));
}

/**
 * Executes a single tool call with timeout and retry logic.
 * 
 * @param call - Function call item to execute
 * @param index - Index of the call in the batch
 * @param handlerFor - Function to get handler for a tool name
 * @param timeoutMs - Timeout in milliseconds
 * @param retries - Number of retries
 * @param meta - Function to generate metadata
 * @param sizeHint - Function to estimate size of data
 * @param onEvent - Optional event callback
 * @returns Object with call_id and output
 */
async function executeSingleTool(
    call: Extract<ResponseOutputItem, { type: "function_call" }>,
    index: number,
    handlerFor: (name: string) => ((args: any, signal?: AbortSignal) => Promise<unknown> | unknown) | undefined,
    timeoutMs: number,
    retries: number,
    meta: () => ToolChainMeta,
    sizeHint: (x: unknown) => number | undefined,
    onEvent?: (e: ToolChainEvent) => void
): Promise<{ call_id: string; output: string }> {
    const ref: ToolCallRef = { callId: call.call_id, name: call.name, index };

    // Parse arguments
    let args: any = {};
    try {
        args = call.arguments ? JSON.parse(call.arguments) : {};
    } catch {
        const error = "Invalid JSON arguments";
        onEvent?.({
            type: "tool_error",
            meta: meta(),
            payload: { ...ref, error, detail: call.arguments },
        });
        return {
            call_id: ref.callId,
            output: JSON.stringify({ error, raw: call.arguments })
        };
    }

    onEvent?.({ type: "tool_start", meta: meta(), payload: { ...ref, args } });

    // Get handler
    const handler = handlerFor(call.name) ?? (call.name === "search_databases" ? SearchDatabaseTool : undefined);
    if (!handler) {
        const error = `Unknown tool: ${call.name}`;
        onEvent?.({
            type: "tool_error",
            meta: meta(),
            payload: { ...ref, error },
        });
        return {
            call_id: ref.callId,
            output: JSON.stringify({ error, args })
        };
    }

    // Execute with timeout and retries
    const controller = new AbortController();

    const timedExecution = async () => {
        const t0 = performance.now?.() ?? Date.now();
        const out = await pTimeout(
            Promise.resolve().then(() => handler(args)),
            { milliseconds: timeoutMs, message: `Timeout after ${timeoutMs}ms: ${call.name}` }
        );
        const t1 = performance.now?.() ?? Date.now();

        onEvent?.({
            type: "tool_success",
            meta: meta(),
            payload: { ...ref, durationMs: Math.round(t1 - t0), resultSize: sizeHint(out) },
        });

        return out;
    };

    try {
        const out = await pRetry(timedExecution, {
            retries,
            factor: 2,
            minTimeout: 300,
            maxTimeout: 2000,
            randomize: true,
            onFailedAttempt: (e) => {
                onEvent?.({
                    type: "tool_retry",
                    meta: meta(),
                    payload: {
                        ...ref,
                        attempt: e.attemptNumber + 1,
                        nextDelayMs: (e as any).nextDelay ?? 0,
                        message: String(e),
                    },
                });
            },
        });

        return { call_id: ref.callId, output: JSON.stringify(out) };
    } catch (err) {
        try {
            controller.abort();
        } catch {
            // Ignore abort errors
        }

        onEvent?.({
            type: "tool_error",
            meta: meta(),
            payload: { ...ref, error: String(err), detail: err },
        });

        return { call_id: ref.callId, output: JSON.stringify({ error: String(err) }) };
    }
}