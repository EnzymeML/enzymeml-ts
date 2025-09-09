/**
 * Unit tests for input-types module.
 * 
 * Tests verify that the upload and conversion functionality works correctly
 * and produces OpenAI API compatible formats.
 */

import { jest } from '@jest/globals';
import {
    BaseInput,
    ImageUpload,
    PDFUpload,
    UserQuery,
    type UploadResult,
    type InputContent
} from "../src/input-types";

// Mock fs
jest.mock('fs', () => ({
    createReadStream: jest.fn().mockReturnValue({
        pipe: jest.fn(),
        on: jest.fn(),
        destroy: jest.fn()
    })
}));

// Mock OpenAI with proper file creation response
const mockFileCreate = jest.fn();
const mockOpenAI = {
    files: {
        create: mockFileCreate
    }
};
jest.mock('openai', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => mockOpenAI)
    };
});

// Import OpenAI after mocking
import OpenAI from 'openai';
const mockClient = new OpenAI();

describe('BaseInput', () => {
    class TestInput extends BaseInput {
        async upload(): Promise<void> {
            // Test implementation
        }

        toInputContent(): InputContent {
            return "test content";
        }
    }

    it('should create instance without client', () => {
        const input = new TestInput();
        expect(input).toBeInstanceOf(BaseInput);
    });

    it('should create message with user role by default', () => {
        const input = new TestInput();
        const message = input.toMessage();

        expect(message).toEqual({
            role: "user",
            content: "test content"
        });
    });

    it('should create message with specified role', () => {
        const input = new TestInput();
        const message = input.toMessage("system");

        expect(message).toEqual({
            role: "system",
            content: "test content"
        });
    });

    it('should return undefined upload result initially', () => {
        const input = new TestInput();
        expect(input.getUploadResult()).toBeUndefined();
    });
});

describe('ImageUpload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create instance with file path', () => {
        const imageUpload = new ImageUpload('./test.png');
        expect(imageUpload.getFilePath()).toBe('./test.png');
        expect(imageUpload.getFilename()).toBe('test.png');
    });

    it('should upload file with vision purpose', async () => {
        const mockUploadResult: UploadResult = {
            id: 'file-123',
            object: 'file',
            bytes: 1024,
            created_at: Date.now(),
            filename: 'test.png',
            purpose: 'vision'
        };

        (mockFileCreate as any).mockResolvedValue(mockUploadResult);

        const imageUpload = new ImageUpload('./test.png');
        await imageUpload.upload(mockClient);

        expect(mockFileCreate).toHaveBeenCalledWith({
            file: expect.any(Object), // ReadStream
            purpose: 'vision'
        });

        expect(imageUpload.getUploadResult()).toEqual(mockUploadResult);
    });

    it('should convert to image URL content after upload', async () => {
        const mockUploadResult: UploadResult = {
            id: 'file-456',
            object: 'file',
            bytes: 2048,
            created_at: Date.now(),
            filename: 'image.jpg',
            purpose: 'vision'
        };

        (mockFileCreate as any).mockResolvedValue(mockUploadResult);

        const imageUpload = new ImageUpload('./image.jpg');
        await imageUpload.upload(mockClient);

        const content = imageUpload.toInputContent();
        expect(content).toEqual([{
            type: "image_url",
            image_url: {
                url: "file://file-456"
            }
        }]);
    });

    it('should throw error when converting without upload', () => {
        const imageUpload = new ImageUpload('./test.png');

        expect(() => imageUpload.toInputContent()).toThrow(
            'File must be uploaded before converting to input content. Call upload() first.'
        );
    });

    it('should create proper message format', async () => {
        const mockUploadResult: UploadResult = {
            id: 'file-789',
            object: 'file',
            bytes: 1500,
            created_at: Date.now(),
            filename: 'photo.png',
            purpose: 'vision'
        };

        (mockFileCreate as any).mockResolvedValue(mockUploadResult);

        const imageUpload = new ImageUpload('./photo.png');
        await imageUpload.upload(mockClient);

        const message = imageUpload.toMessage();
        expect(message).toEqual({
            role: "user",
            content: [{
                type: "image_url",
                image_url: {
                    url: "file://file-789"
                }
            }]
        });
    });
});

describe('PDFUpload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create instance with file path', () => {
        const pdfUpload = new PDFUpload('./document.pdf');
        expect(pdfUpload.getFilePath()).toBe('./document.pdf');
        expect(pdfUpload.getFilename()).toBe('document.pdf');
    });

    it('should upload file with user_data purpose', async () => {
        const mockUploadResult: UploadResult = {
            id: 'file-pdf-123',
            object: 'file',
            bytes: 5120,
            created_at: Date.now(),
            filename: 'document.pdf',
            purpose: 'user_data'
        };

        (mockFileCreate as any).mockResolvedValue(mockUploadResult);

        const pdfUpload = new PDFUpload('./document.pdf');
        await pdfUpload.upload(mockClient);

        expect(mockFileCreate).toHaveBeenCalledWith({
            file: expect.any(Object), // ReadStream
            purpose: 'user_data'
        });

        expect(pdfUpload.getUploadResult()).toEqual(mockUploadResult);
    });

    it('should convert to file reference content after upload', async () => {
        const mockUploadResult: UploadResult = {
            id: 'file-pdf-456',
            object: 'file',
            bytes: 3072,
            created_at: Date.now(),
            filename: 'report.pdf',
            purpose: 'user_data'
        };

        (mockFileCreate as any).mockResolvedValue(mockUploadResult);

        const pdfUpload = new PDFUpload('./report.pdf');
        await pdfUpload.upload(mockClient);

        const content = pdfUpload.toInputContent();
        expect(content).toEqual([{
            type: "input_file",
            file_id: "file-pdf-456"
        }]);
    });

    it('should throw error when converting without upload', () => {
        const pdfUpload = new PDFUpload('./document.pdf');

        expect(() => pdfUpload.toInputContent()).toThrow(
            'File must be uploaded before converting to input content. Call upload() first.'
        );
    });

    it('should create proper message format', async () => {
        const mockUploadResult: UploadResult = {
            id: 'file-pdf-789',
            object: 'file',
            bytes: 4096,
            created_at: Date.now(),
            filename: 'manual.pdf',
            purpose: 'user_data'
        };

        (mockFileCreate as any).mockResolvedValue(mockUploadResult);

        const pdfUpload = new PDFUpload('./manual.pdf');
        await pdfUpload.upload(mockClient);

        const message = pdfUpload.toMessage("system");
        expect(message).toEqual({
            role: "system",
            content: [{
                type: "input_file",
                file_id: "file-pdf-789"
            }]
        });
    });
});

describe('UserQuery', () => {
    it('should create instance with query text', () => {
        const userQuery = new UserQuery("What is enzyme kinetics?");
        expect(userQuery.getQuery()).toBe("What is enzyme kinetics?");
    });

    it('should upload without doing anything', async () => {
        const userQuery = new UserQuery("Test query");

        // Should resolve without errors
        await expect(userQuery.upload(mockClient)).resolves.toBeUndefined();
    });

    it('should convert to text content', () => {
        const userQuery = new UserQuery("Analyze this data");
        const content = userQuery.toInputContent();

        expect(content).toBe("Analyze this data");
    });

    it('should allow updating query text', () => {
        const userQuery = new UserQuery("Original query");
        userQuery.setQuery("Updated query");

        expect(userQuery.getQuery()).toBe("Updated query");
        expect(userQuery.toInputContent()).toBe("Updated query");
    });

    it('should create proper message format', () => {
        const userQuery = new UserQuery("How does this enzyme work?");
        const message = userQuery.toMessage();

        expect(message).toEqual({
            role: "user",
            content: "How does this enzyme work?"
        });
    });

    it('should not have upload result', () => {
        const userQuery = new UserQuery("Test query");
        expect(userQuery.getUploadResult()).toBeUndefined();
    });
});
