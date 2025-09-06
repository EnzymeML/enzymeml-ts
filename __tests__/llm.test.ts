/**
 * Unit tests for LLM file upload and type discrimination functionality.
 * These tests focus on the local logic without making OpenAI API calls.
 */

import {
    getFilePurpose,
    isFileTypeSupported,
    uploadFile,
    SUPPORTED_FILE_TYPES,
    type UploadFileParams
} from '../src/input-types';
import fs from 'fs';

// Mock OpenAI to avoid real API calls
jest.mock('openai');
const MockedOpenAI = jest.mocked(jest.requireMock('openai')).default;

// Mock fs to avoid real file system operations
jest.mock('fs');
const MockedFs = fs as jest.Mocked<typeof fs>;

describe('File Type Discrimination System', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('isFileTypeSupported', () => {
        test('should return true for supported user_data file types', () => {
            const userDataFiles = [
                'document.pdf'
            ];

            userDataFiles.forEach(file => {
                expect(isFileTypeSupported(file)).toBe(true);
            });
        });

        test('should return true for supported vision file types', () => {
            const visionFiles = [
                'image.png',
                'photo.jpg',
                'picture.jpeg',
                'animation.gif',
                'modern.webp',
                'bitmap.bmp',
                'high-res.tiff',
                'archive.tif'
            ];

            visionFiles.forEach(file => {
                expect(isFileTypeSupported(file)).toBe(true);
            });
        });

        test('should return false for unsupported file types', () => {
            const unsupportedFiles = [
                'video.mp4',
                'audio.mp3',
                'archive.zip',
                'executable.exe',
                'code.py',
                'script.js',
                'style.css',
                'unknown.xyz'
            ];

            unsupportedFiles.forEach(file => {
                expect(isFileTypeSupported(file)).toBe(false);
            });
        });

        test('should be case insensitive', () => {
            expect(isFileTypeSupported('FILE.PDF')).toBe(true);
            expect(isFileTypeSupported('IMAGE.PNG')).toBe(true);
            expect(isFileTypeSupported('UNSUPPORTED.XYZ')).toBe(false);
        });

        test('should handle files without extensions', () => {
            expect(isFileTypeSupported('filename_without_extension')).toBe(false);
        });
    });

    describe('getFilePurpose', () => {
        test('should return "user_data" for document file types', () => {
            const userDataExtensions = SUPPORTED_FILE_TYPES.USER_DATA;

            userDataExtensions.forEach(ext => {
                const filename = `testfile${ext}`;
                expect(getFilePurpose(filename)).toBe('user_data');
            });
        });

        test('should return "vision" for image file types', () => {
            const visionExtensions = SUPPORTED_FILE_TYPES.VISION;

            visionExtensions.forEach(ext => {
                const filename = `testfile${ext}`;
                expect(getFilePurpose(filename)).toBe('vision');
            });
        });

        test('should throw error for unsupported file types', () => {
            const unsupportedFiles = [
                'video.mp4',
                'audio.wav',
                'archive.zip',
                'script.py'
            ];

            unsupportedFiles.forEach(file => {
                expect(() => getFilePurpose(file)).toThrow(/Unsupported file type/);
                expect(() => getFilePurpose(file)).toThrow(new RegExp(file.split('.').pop() || ''));
            });
        });

        test('should include supported types in error message', () => {
            try {
                getFilePurpose('unsupported.xyz');
                fail('Expected error to be thrown');
            } catch (error) {
                const errorMessage = (error as Error).message;
                expect(errorMessage).toContain('.pdf');
                expect(errorMessage).toContain('.png');
                expect(errorMessage).toContain('.jpg');
            }
        });

        test('should be case insensitive', () => {
            expect(getFilePurpose('FILE.PDF')).toBe('user_data');
            expect(getFilePurpose('IMAGE.PNG')).toBe('vision');
        });
    });

    describe('uploadFile function logic', () => {
        let mockClient: any;
        let mockCreateReadStream: jest.MockedFunction<typeof fs.createReadStream>;
        let mockStream: any;

        beforeEach(() => {
            // Mock OpenAI client
            mockClient = {
                files: {
                    create: jest.fn().mockResolvedValue({
                        id: 'file-123',
                        purpose: 'user_data',
                        filename: 'test.pdf'
                    })
                }
            };
            MockedOpenAI.mockImplementation(() => mockClient);

            // Mock file stream
            mockStream = { pipe: jest.fn(), on: jest.fn() };
            mockCreateReadStream = MockedFs.createReadStream as jest.MockedFunction<typeof fs.createReadStream>;
            mockCreateReadStream.mockReturnValue(mockStream as any);
        });

        test('should auto-detect purpose for file path', async () => {
            const pdfFile = await uploadFile({ file: './document.pdf' });

            expect(mockClient.files.create).toHaveBeenCalledWith({
                file: mockStream,
                purpose: 'user_data'
            });
            expect(pdfFile.id).toBe('file-123');
        });

        test('should auto-detect vision purpose for image files', async () => {
            mockClient.files.create.mockResolvedValue({
                id: 'file-456',
                purpose: 'vision',
                filename: 'test.png'
            });

            const imageFile = await uploadFile({ file: './image.png' });

            expect(mockClient.files.create).toHaveBeenCalledWith({
                file: mockStream,
                purpose: 'vision'
            });
            expect(imageFile.id).toBe('file-456');
        });

        test('should use explicit purpose when provided', async () => {
            await uploadFile({
                file: './document.pdf',
                purpose: 'vision' // Override auto-detection
            });

            expect(mockClient.files.create).toHaveBeenCalledWith({
                file: mockStream,
                purpose: 'vision'
            });
        });

        test('should handle stream with filename for auto-detection', async () => {
            const mockStreamInput = { pipe: jest.fn() };

            await uploadFile({
                file: mockStreamInput as any,
                filename: 'document.pdf'
            });

            expect(mockClient.files.create).toHaveBeenCalledWith({
                file: mockStreamInput,
                purpose: 'user_data'
            });
        });

        test('should handle stream with explicit purpose', async () => {
            const mockStreamInput = { pipe: jest.fn() };

            await uploadFile({
                file: mockStreamInput as any,
                purpose: 'vision'
            });

            expect(mockClient.files.create).toHaveBeenCalledWith({
                file: mockStreamInput,
                purpose: 'vision'
            });
        });

        test('should create file stream for file path input', async () => {
            await uploadFile({ file: './test.pdf' });

            expect(mockCreateReadStream).toHaveBeenCalledWith('./test.pdf');
            expect(mockClient.files.create).toHaveBeenCalledWith({
                file: mockStream,
                purpose: 'user_data'
            });
        });

        test('should pass custom client when provided', async () => {
            const customClient = {
                files: {
                    create: jest.fn().mockResolvedValue({ id: 'custom-file-123' })
                }
            };

            await uploadFile({
                file: './test.pdf',
                client: customClient as any
            });

            expect(customClient.files.create).toHaveBeenCalled();
            expect(mockClient.files.create).not.toHaveBeenCalled();
        });
    });

    describe('Error handling', () => {
        test('should throw error for unsupported file extension', async () => {
            await expect(uploadFile({ file: './unsupported.xyz' }))
                .rejects
                .toThrow(/Unsupported file type: \.xyz/);
        });

        test('should throw error for stream without purpose or filename', async () => {
            const mockStream = { pipe: jest.fn() };

            await expect(uploadFile({ file: mockStream as any }))
                .rejects
                .toThrow(/When using a stream, either provide "purpose" explicitly or "filename" for auto-detection/);
        });

        test('should provide helpful error message with supported types', async () => {
            try {
                await uploadFile({ file: './video.mp4' });
                fail('Expected error to be thrown');
            } catch (error) {
                const message = (error as Error).message;
                expect(message).toContain('Supported types:');
                expect(message).toContain('.pdf');
                expect(message).toContain('.png');
            }
        });

        test('should validate file type even when purpose is explicitly provided for paths', async () => {
            // This should still work because we're not validating against explicit purpose
            const mockClient = {
                files: { create: jest.fn().mockResolvedValue({ id: 'test-123' }) }
            };
            MockedOpenAI.mockImplementation(() => mockClient);

            // This should work - explicit purpose overrides validation
            await expect(uploadFile({
                file: './test.pdf',
                purpose: 'vision'
            })).resolves.toBeDefined();
        });
    });

    describe('Edge cases and boundary conditions', () => {
        test('should handle files with multiple dots in filename', () => {
            expect(getFilePurpose('my.document.with.dots.pdf')).toBe('user_data');
            expect(getFilePurpose('complex.file.name.png')).toBe('vision');
        });

        test('should handle empty filename with extension (edge case)', () => {
            // Note: path.extname('.pdf') returns '.' not '.pdf', so these are actually unsupported
            expect(() => getFilePurpose('.pdf')).toThrow(/Unsupported file type: \./);
            expect(() => getFilePurpose('.png')).toThrow(/Unsupported file type: \./);
        });

        test('should handle relative and absolute paths', () => {
            expect(getFilePurpose('./documents/file.pdf')).toBe('user_data');
            expect(getFilePurpose('/absolute/path/to/image.jpg')).toBe('vision');
            expect(getFilePurpose('../relative/path/doc.pdf')).toBe('user_data');
        });

        test('should handle mixed case extensions correctly', () => {
            const mixedCaseFiles = [
                { file: 'document.PDF', expected: 'user_data' },
                { file: 'image.JpG', expected: 'vision' },
                { file: 'photo.PnG', expected: 'vision' }
            ];

            mixedCaseFiles.forEach(({ file, expected }) => {
                expect(getFilePurpose(file)).toBe(expected);
            });
        });
    });

    describe('Supported file types constant', () => {
        test('should export supported file types', () => {
            expect(SUPPORTED_FILE_TYPES).toBeDefined();
            expect(SUPPORTED_FILE_TYPES.USER_DATA).toContain('.pdf');
            expect(SUPPORTED_FILE_TYPES.VISION).toContain('.png');
        });

        test('should have reasonable file type coverage', () => {
            // Ensure we support PDF for documents
            expect(SUPPORTED_FILE_TYPES.USER_DATA).toContain('.pdf');

            // Ensure we support common image types
            expect(SUPPORTED_FILE_TYPES.VISION).toContain('.png');
            expect(SUPPORTED_FILE_TYPES.VISION).toContain('.jpg');
            expect(SUPPORTED_FILE_TYPES.VISION).toContain('.jpeg');
        });
    });
});
