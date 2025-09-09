/**
 * OpenAI streaming response utilities for structured data generation.
 * 
 * This module provides utilities for creating streaming responses from OpenAI's API
 * with optional structured output validation using Zod schemas. It handles real-time
 * streaming of text, refusals, and errors from the OpenAI responses API.
 */

import OpenAI, { type ClientOptions } from "openai";
import { z, type ZodTypeAny } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { ResponseInput, Tool } from "openai/resources/responses/responses";
import type { BaseInput, MessageInput } from "./input-types.js";

/**
 * Represents a single item in the streaming response.
 */
export type StreamItem =
    | { kind: "text"; delta: string }
    | { kind: "refusal"; delta: string }
    | { kind: "error"; error: unknown };

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
};

/**
 * Creates a streaming response from OpenAI with optional structured output.
 * 
 * This function sets up a streaming connection to OpenAI's responses API and provides
 * multiple ways to consume the stream: raw event listeners, async iteration, and
 * a final response promise.
 * 
 * @template TSchema - Optional Zod schema type for structured output validation
 * @param params - Configuration parameters for the streaming request
 * @returns An object containing the raw stream, async iterator, and final response promise
 * 
 * @example
 * ```typescript
 * // Basic text streaming
 * const { chunks, final } = extractData({
 *   model: 'gpt-4',
 *   input: [{ role: 'user', content: 'Tell me a joke' }]
 * });
 * 
 * // Using input type classes
 * const userQuery = new UserQuery('Tell me a joke');
 * const { chunks, final } = extractData({
 *   model: 'gpt-4',
 *   input: [userQuery]
 * });
 * 
 * // With file upload
 * const pdfUpload = new PDFUpload('./document.pdf');
 * await pdfUpload.upload(); // Upload the file first
 * const { chunks, final } = extractData({
 *   model: 'gpt-4',
 *   input: [
 *     new UserQuery('Analyze this document'),
 *     pdfUpload
 *   ]
 * });
 * 
 * // Consume stream with async iteration
 * for await (const chunk of chunks) {
 *   if (chunk.kind === 'text') {
 *     console.log(chunk.delta);
 *   }
 * }
 * 
 * // With structured output
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number()
 * });
 * 
 * const { chunks, final } = extractData({
 *   model: 'gpt-4',
 *   input: [{ role: 'user', content: 'Generate a person' }],
 *   schema,
 *   schemaKey: 'person'
 * });
 * ```
 */
export function extractData<TSchema extends ZodTypeAny | undefined>(
    params: CreateStreamParams<TSchema>
) {
    const {
        model,
        input,
        schema,
        multiple,
        schemaKey = "data",
        client,
        tools,
    } = params;

    // Convert input to proper message format, handling BaseInput instances
    const processedInput = input.map((item): MessageInput => {
        // If it's a BaseInput instance, convert it to a message
        if (item && typeof item === 'object' && 'toMessage' in item) {
            return (item as BaseInput).toMessage();
        }
        // Otherwise, assume it's already a proper message object
        return item as MessageInput;
    });

    let schemaInput: ZodTypeAny | undefined = schema;
    if (multiple && schema) {
        schemaInput = z.object({
            items: z.array(schema).describe(`Array of ${schema.description || 'items'} objects`)
        });
    }


    const stream = client.responses.stream({
        model,
        input: processedInput as ResponseInput,
        tools,
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

        // When finalResponse() resolves we consider the stream closed.
        const final = stream.finalResponse().finally(() => {
            done = true;
        });

        // Drain the queue until done.
        while (!done || queue.length) {
            if (queue.length) {
                yield queue.shift()!;
            } else {
                // micro-delay to yield control until new events arrive or final resolves
                await Promise.race([new Promise(r => setTimeout(r, 10)), final]);
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

