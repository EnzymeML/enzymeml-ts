/**
 * Input type classes for handling different kinds of inputs to OpenAI's API.
 * 
 * This module provides a structured way to handle file uploads, text queries,
 * and other input types, with automatic upload functionality and conversion
 * to OpenAI API compatible format.
 */

import OpenAI, { type ClientOptions } from "openai";
import fs from "fs";
import path from "path";

// =============================================================================
// Type Definitions and Interfaces
// =============================================================================

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
    /** Optional pre-configured OpenAI client instance */
    client?: OpenAI;
    /** Options for creating a new OpenAI client if none provided */
    clientOptions?: ClientOptions;
};

// =============================================================================
// Constants
// =============================================================================

/**
 * Supported file types for OpenAI uploads
 */
export const SUPPORTED_FILE_TYPES = {
    // User data files (documents)
    USER_DATA: ['.pdf'],
    // Vision files (images)  
    VISION: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif']
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

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

// =============================================================================
// Core Upload Functionality
// =============================================================================

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
 * import { uploadFile, extractData, EnzymeMLDocumentSchema } from 'enzymeml';
 * 
 * // Upload a PDF file
 * const pdfFile = await uploadFile({ file: './document.pdf' });
 * 
 * // Upload an image file
 * const imageFile = await uploadFile({ file: './image.png' });
 * 
 * // Upload a stream
 * const stream = fs.createReadStream('./document.pdf');
 * const streamFile = await uploadFile({ file: stream, filename: 'document.pdf' });
 * 
 * // Extract data from a file using input classes
 * const pdfUpload = new PDFUpload('./document.pdf');
 * await pdfUpload.upload();
 * const { chunks, final } = extractData({
 *   model: 'gpt-5',
 *   input: [
 *     new UserQuery('Extract the text from the following file'),
 *     pdfUpload
 *   ],
 * });
 * ```
 */
export async function uploadFile(params: UploadFileParams): Promise<UploadResult> {
    const {
        file,
        purpose,
        filename,
        client = new OpenAI(params.clientOptions),
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

// =============================================================================
// Input Classes
// =============================================================================

/**
 * Abstract base class for all input types.
 * Provides a common interface for uploading content and converting to OpenAI API format.
 */
export abstract class BaseInput {
    protected client: OpenAI;
    protected uploadResult?: UploadResult;

    constructor(clientOptions?: ClientOptions) {
        this.client = new OpenAI(clientOptions);
    }

    /**
     * Performs any necessary upload operations.
     * Override in subclasses that need to upload files.
     */
    abstract upload(): Promise<void>;

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
 */
export class UserQuery extends BaseInput {
    /**
     * @param query - The text query/message content
     * @param clientOptions - Optional OpenAI client options  
     */
    constructor(
        private query: string,
        clientOptions?: ClientOptions
    ) {
        super(clientOptions);
    }

    /**
     * No upload needed for text queries.
     */
    async upload(): Promise<void> {
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
 * Handles image file uploads for vision-based tasks.
 */
export class ImageUpload extends BaseInput {
    private filePath: string;
    private filename?: string;

    /**
     * @param file - File path (string) or readable stream
     * @param filename - Optional filename for streams
     * @param clientOptions - Optional OpenAI client options
     */
    constructor(
        private file: string | fs.ReadStream,
        filename?: string,
        clientOptions?: ClientOptions
    ) {
        super(clientOptions);
        this.filePath = typeof file === 'string' ? file : '';
        this.filename = filename;
    }

    /**
     * Uploads the image file to OpenAI with "vision" purpose.
     */
    async upload(): Promise<void> {
        const uploadParams: UploadFileParams = {
            file: this.file,
            purpose: "vision",
            filename: this.filename,
            client: this.client
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
     * Gets the original file path (if provided as string).
     */
    getFilePath(): string {
        return this.filePath;
    }

    /**
     * Gets the filename.
     */
    getFilename(): string | undefined {
        return this.filename || (this.filePath ? this.filePath.split('/').pop() : undefined);
    }
}

/**
 * Handles PDF file uploads for document processing tasks.
 */
export class PDFUpload extends BaseInput {
    private filePath: string;
    private filename?: string;

    /**
     * @param file - File path (string) or readable stream
     * @param filename - Optional filename for streams  
     * @param clientOptions - Optional OpenAI client options
     */
    constructor(
        private file: string | fs.ReadStream,
        filename?: string,
        clientOptions?: ClientOptions
    ) {
        super(clientOptions);
        this.filePath = typeof file === 'string' ? file : '';
        this.filename = filename;
    }

    /**
     * Uploads the PDF file to OpenAI with "user_data" purpose.
     */
    async upload(): Promise<void> {
        const uploadParams: UploadFileParams = {
            file: this.file,
            purpose: "user_data",
            filename: this.filename,
            client: this.client
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
     * Gets the original file path (if provided as string).
     */
    getFilePath(): string {
        return this.filePath;

    }

    /**
     * Gets the filename.
     */
    getFilename(): string | undefined {
        return this.filename || (this.filePath ? this.filePath.split('/').pop() : undefined);
    }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Helper function to create appropriate input type from file path based on extension.
 */
export function createInputFromFile(
    filePath: string,
    clientOptions?: ClientOptions
): ImageUpload | PDFUpload {
    const ext = filePath.toLowerCase().split('.').pop();

    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'tif'];
    const documentExtensions = ['pdf'];

    if (imageExtensions.includes(ext || '')) {
        return new ImageUpload(filePath, undefined, clientOptions);
    } else if (documentExtensions.includes(ext || '')) {
        return new PDFUpload(filePath, undefined, clientOptions);
    } else {
        throw new Error(`Unsupported file extension: ${ext}. Supported: ${[...imageExtensions, ...documentExtensions].join(', ')}`);
    }
}
