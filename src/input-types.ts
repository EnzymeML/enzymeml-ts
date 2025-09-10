/**
 * Input type classes for handling different kinds of inputs to OpenAI's API.
 * 
 * This module provides a structured way to handle file uploads, text queries,
 * and other input types, with automatic upload functionality and conversion
 * to OpenAI API compatible format.
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { Readable } from "stream";

/**
 * Represents the result of an OpenAI file upload
 */
export interface UploadResult {
    id: string;
    object: string;
    bytes: number;
    created_at: number;
    filename: string;
    purpose: string;
}

/**
 * Input content that can be used in OpenAI API messages
 */
export type InputContent =
    | string
    | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>
    | { type: "input_file"; file_id: string };

/**
 * Message format compatible with OpenAI API
 */
export interface MessageInput {
    role: "system" | "user" | "assistant";
    content: InputContent;
}

/**
 * Parameters for uploading a file.
 */
export type UploadFileParams = {
    /** File input - can be a file path (string) or a readable stream */
    file: string | fs.ReadStream;
    /** 
     * Purpose of the file upload. If not provided, will be auto-detected based on file extension.
     * For streams, either provide purpose or filename for auto-detection.
     */
    purpose?: "user_data" | "vision";
    /** 
     * Optional filename for streams to enable auto-detection of file purpose.
     * Required when using streams without explicit purpose.
     */
    filename?: string;
    /** Pre-configured OpenAI client instance */
    client: OpenAI;
};

/**
 * Supported file types for OpenAI uploads
 */
export const SUPPORTED_FILE_TYPES = {
    // User data files (documents)
    USER_DATA: ['.pdf'],
    // Vision files (images)  
    VISION: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif']
} as const;

/**
 * Checks if a file type is supported by OpenAI
 * @param filePath - File path or filename to check
 * @returns True if the file type is supported
 */
export function isFileTypeSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const allSupported = [...SUPPORTED_FILE_TYPES.USER_DATA, ...SUPPORTED_FILE_TYPES.VISION];
    return allSupported.includes(ext as any);
}

/**
 * Determines the appropriate OpenAI file purpose based on file extension
 * @param filePath - File path or filename
 * @returns The appropriate purpose for the file type
 * @throws Error if file type is not supported
 */
export function getFilePurpose(filePath: string): "user_data" | "vision" {
    const ext = path.extname(filePath).toLowerCase();

    if (SUPPORTED_FILE_TYPES.USER_DATA.includes(ext as any)) {
        return "user_data";
    }

    if (SUPPORTED_FILE_TYPES.VISION.includes(ext as any)) {
        return "vision";
    }

    const allSupported = [...SUPPORTED_FILE_TYPES.USER_DATA, ...SUPPORTED_FILE_TYPES.VISION];
    throw new Error(
        `Unsupported file type: ${ext}. ` +
        `Supported types: ${allSupported.join(', ')}`
    );
}

/**
 * Uploads a file using OpenAI's API with automatic file type detection.
 * 
 * This function provides flexibility in file input and automatically determines
 * the appropriate purpose based on file type:
 * - PDFs, text files, documents → "user_data" purpose
 * - Images (PNG, JPEG, GIF, WebP, etc.) → "vision" purpose
 * - Unsupported file types will throw an error
 * 
 * @param params - Configuration parameters for file upload
 * @returns Promise that resolves with the uploaded file object
 * @throws Error if file type is not supported by OpenAI
 * 
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { uploadFile } from 'enzymeml';
 * 
 * const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * 
 * // Upload a PDF file
 * const pdfFile = await uploadFile({ file: './document.pdf', client });
 * 
 * // Upload an image file
 * const imageFile = await uploadFile({ file: './image.png', client });
 * 
 * // Upload a stream with filename for auto-detection
 * const stream = fs.createReadStream('./document.pdf');
 * const streamFile = await uploadFile({ file: stream, filename: 'document.pdf', client });
 * ```
 */
export async function uploadFile(params: UploadFileParams): Promise<UploadResult> {
    const {
        file,
        purpose,
        filename,
        client,
    } = params;

    // Determine the file purpose
    let filePurpose: "user_data" | "vision";

    if (purpose) {
        // Use explicitly provided purpose
        filePurpose = purpose;
    } else {
        // Auto-detect purpose based on file type
        if (typeof file === 'string') {
            // File path provided - can detect from path
            filePurpose = getFilePurpose(file);
        } else if (filename) {
            // Stream with filename - can detect from filename
            filePurpose = getFilePurpose(filename);
        } else {
            // Stream without filename or purpose
            throw new Error(
                'When using a stream, either provide "purpose" explicitly or "filename" for auto-detection'
            );
        }
    }

    // Validate file type if we have a path or filename
    const pathToCheck = typeof file === 'string' ? file : filename;
    if (pathToCheck && !purpose) {
        // This will throw if unsupported - already handled in getFilePurpose
        getFilePurpose(pathToCheck);
    }

    // Create file stream based on input type
    const fileStream = typeof file === 'string' ? fs.createReadStream(file) : file;

    // Upload the file with determined purpose
    return await client.files.create({
        file: fileStream,
        purpose: filePurpose,
    });
}

/**
 * Abstract base class for all input types.
 * Provides a common interface for uploading content and converting to OpenAI API format.
 */
export abstract class BaseInput {
    protected uploadResult?: UploadResult;

    constructor() { }

    /**
     * Performs any necessary upload operations.
     * Override in subclasses that need to upload files.
     */
    abstract upload(client: OpenAI): Promise<void>;

    /**
     * Converts the input to OpenAI API compatible message content.
     */
    abstract toInputContent(): InputContent[] | InputContent;

    /**
     * Creates a message object ready for OpenAI API consumption.
     */
    toMessage(role: "system" | "user" | "assistant" = "user"): MessageInput {
        return {
            role,
            content: this.toInputContent() as InputContent
        };
    }

    /**
     * Gets the stored upload result if available.
     */
    getUploadResult(): UploadResult | undefined {
        return this.uploadResult;
    }
}

/**
 * Handles text-based user queries that don't require file uploads.
 * 
 * @example
 * ```typescript
 * import { UserQuery, extractData } from 'enzymeml';
 * 
 * const query = new UserQuery('Extract the metadata from this document');
 * 
 * const { chunks, final } = extractData({
 *   model: 'gpt-4o',
 *   input: [query],
 *   client
 * });
 * ```
 */
export class UserQuery extends BaseInput {
    /**
     * @param query - The text query/message content
     */
    constructor(
        private query: string
    ) {
        super();
    }

    /**
     * No upload needed for text queries.
     */
    async upload(client: OpenAI): Promise<void> {
        // Text queries don't need uploading
        return Promise.resolve();
    }

    /**
     * Returns the query text as-is.
     */
    toInputContent(): InputContent[] | InputContent {
        return this.query;
    }

    /**
     * Gets the original query text.
     */
    getQuery(): string {
        return this.query;
    }

    /**
     * Updates the query text.
     */
    setQuery(query: string): void {
        this.query = query;
    }
}

/**
 * Handles system prompts that define the behavior and role of the AI assistant.
 * Similar to UserQuery but specifically designed for system messages.
 * 
 * @example
 * ```typescript
 * import { SystemQuery, UserQuery, extractData } from 'enzymeml';
 * 
 * const systemPrompt = new SystemQuery('You are an expert at extracting structured data from scientific documents.');
 * const userQuery = new UserQuery('Extract the metadata from this document');
 * 
 * const { chunks, final } = extractData({
 *   model: 'gpt-4o',
 *   input: [systemPrompt, userQuery],
 *   client
 * });
 * ```
 */
export class SystemQuery extends BaseInput {
    /**
     * @param prompt - The system prompt/message content
     */
    constructor(
        private prompt: string
    ) {
        super();
    }

    /**
     * No upload needed for system prompts.
     */
    async upload(client: OpenAI): Promise<void> {
        // System prompts don't need uploading
        return Promise.resolve();
    }

    /**
     * Returns the prompt text as-is.
     */
    toInputContent(): InputContent[] | InputContent {
        return this.prompt;
    }

    /**
     * Creates a message object with system role by default.
     */
    toMessage(role: "system" | "user" | "assistant" = "system"): MessageInput {
        return {
            role,
            content: this.toInputContent() as InputContent
        };
    }

    /**
     * Gets the original prompt text.
     */
    getPrompt(): string {
        return this.prompt;
    }

    /**
     * Updates the prompt text.
     */
    setPrompt(prompt: string): void {
        this.prompt = prompt;
    }
}

/**
 * Handles image file uploads for vision-based tasks.
 * 
 * @example
 * ```typescript
 * import { ImageUpload, UserQuery, extractData } from 'enzymeml';
 * 
 * const imageUpload = new ImageUpload('./image.png');
 * await imageUpload.upload(client);
 * 
 * const { chunks, final } = extractData({
 *   model: 'gpt-4o',
 *   input: [
 *     new UserQuery('Describe what you see in this image'),
 *     imageUpload
 *   ],
 *   client
 * });
 * ```
 */
export class ImageUpload extends BaseInput {
    private file: string;

    /**
     * @param file - File path to the image file
     */
    constructor(
        file: string
    ) {
        super();
        if (!isFileTypeSupported(file)) {
            throw new Error(`File ${file} is not a supported file type. Supported types: ${SUPPORTED_FILE_TYPES.VISION.join(', ')}`);
        }
        this.file = file;
    }

    /**
     * Uploads the image file to OpenAI with "vision" purpose.
     */
    async upload(client: OpenAI): Promise<void> {
        const uploadParams: UploadFileParams = {
            file: this.file,
            purpose: "vision",
            filename: this.file.split('/').pop(),
            client: client
        };

        this.uploadResult = await uploadFile(uploadParams);
    }

    /**
     * Converts to image URL content format for vision models.
     */
    toInputContent(): InputContent[] | InputContent {
        if (!this.uploadResult) {
            throw new Error("File must be uploaded before converting to input content. Call upload() first.");
        }

        return [
            {
                type: "image_url",
                image_url: {
                    url: `file://${this.uploadResult.id}`
                }
            }
        ];
    }

    /**
     * Gets the original file path.
     */
    getFilePath(): string {
        return this.file;
    }

    /**
     * Gets the filename.
     */
    getFilename(): string | undefined {
        return this.file ? this.file.split('/').pop() : undefined;
    }
}

/**
 * Handles PDF file uploads for document processing tasks with optional page selection.
 * 
 * @example
 * ```typescript
 * import { PDFUpload, UserQuery, extractData, EnzymeMLDocumentSchema } from 'enzymeml';
 * 
 * // Upload entire PDF
 * const pdfUpload = new PDFUpload('./document.pdf');
 * await pdfUpload.upload(client);
 * 
 * // Upload only specific pages (1-indexed)
 * const pdfUploadPages = new PDFUpload('./document.pdf', [1, 3, 5]);
 * await pdfUploadPages.upload(client);
 * 
 * const { chunks, final } = extractData({
 *   model: 'gpt-4o',
 *   input: [
 *     new UserQuery('Extract the metadata from this document'),
 *     pdfUpload
 *   ],
 *   schema: EnzymeMLDocumentSchema,
 *   schemaKey: 'enzymeml_document',
 *   client
 * });
 * ```
 */
export class PDFUpload extends BaseInput {
    private file: string;
    private pages?: number[];
    private processedFile?: string;

    /**
     * @param file - File path to the PDF file
     * @param pages - Optional array of page numbers to extract (1-indexed)
     */
    constructor(
        file: string,
        pages?: number[]
    ) {
        super();
        // Validate file path
        if (!isFileTypeSupported(file)) {
            throw new Error(`File ${file} is not a supported file type. Supported types: ${SUPPORTED_FILE_TYPES.USER_DATA.join(', ')} and ${SUPPORTED_FILE_TYPES.VISION.join(', ')}`);
        }
        this.file = file;
        this.pages = pages;
    }

    /**
     * Processes the PDF to extract specific pages if specified.
     * @returns Path to the file to upload (original or processed)
     */
    private async processPDF(): Promise<string | fs.ReadStream> {
        if (!this.pages || this.pages.length === 0) {
            // No page selection, return original file path
            return this.file;
        }

        try {
            // Read the original PDF
            const existingPdfBytes = fs.readFileSync(this.file);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);

            // Get total page count for validation
            const totalPages = pdfDoc.getPageCount();

            // Validate page numbers
            const invalidPages = this.pages.filter(p => p < 1 || p > totalPages);
            if (invalidPages.length > 0) {
                throw new Error(`Invalid page numbers: ${invalidPages.join(', ')}. PDF has ${totalPages} pages.`);
            }

            // Create a new PDF document
            const newPdfDoc = await PDFDocument.create();

            // Copy the specified pages (convert from 1-indexed to 0-indexed)
            const pageIndices = this.pages.map(p => p - 1);
            const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);

            // Add the pages to the new document
            copiedPages.forEach((page) => newPdfDoc.addPage(page));

            // Save the new PDF
            const pdfBytes = await newPdfDoc.save();

            // Create a ReadStream from the PDF bytes
            const stream = new Readable();
            stream.push(pdfBytes);
            stream.push(null); // End the stream

            // Add the name property that OpenAI requires for Uploadable objects
            (stream as any).name = `processed_${path.basename(this.file)}`;

            return stream as fs.ReadStream;
        } catch (error) {
            throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Uploads the PDF file (or processed version) to OpenAI with "user_data" purpose.
     */
    async upload(client: OpenAI): Promise<void> {
        // Process the PDF if page selection is specified
        const fileToUpload = await this.processPDF();

        const uploadParams: UploadFileParams = {
            file: fileToUpload,
            purpose: "user_data",
            filename: path.basename(this.file),
            client: client
        };

        this.uploadResult = await uploadFile(uploadParams);
    }

    /**
     * Converts to file reference format for document processing.
     */
    toInputContent(): InputContent[] | InputContent {
        if (!this.uploadResult) {
            throw new Error("File must be uploaded before converting to input content. Call upload() first.");
        }

        return [{
            type: "input_file",
            file_id: this.uploadResult.id
        }];
    }

    /**
     * Gets the original file path.
     */
    getFilePath(): string {
        return this.file;

    }

    /**
     * Gets the filename.
     */
    getFilename(): string | undefined {
        return this.file ? this.file.split('/').pop() : undefined;
    }

    /**
     * Gets the selected page numbers (if any).
     */
    getSelectedPages(): number[] | undefined {
        return this.pages;
    }

    /**
     * Checks if the upload will use page selection.
     */
    hasPageSelection(): boolean {
        return this.pages !== undefined && this.pages.length > 0;
    }
}
