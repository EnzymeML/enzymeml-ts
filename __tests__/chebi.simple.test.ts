/**
 * Simplified tests for ChEBI fetcher - focusing on core functionality
 */

import { processId, ChEBIError, searchChebi } from '../src/fetcher/chebi';

describe('ChEBI Fetcher - Core Functionality', () => {
    describe('processId', () => {
        it('should process a simple name correctly', () => {
            expect(processId('glucose')).toBe('glucose');
        });

        it('should replace special characters with underscores', () => {
            expect(processId('D-glucose 6-phosphate')).toBe('d_glucose_6_phosphate');
        });

        it('should handle multiple consecutive special characters', () => {
            expect(processId('test--name__here')).toBe('test_name_here');
        });

        it('should trim leading and trailing underscores', () => {
            expect(processId('_test_name_')).toBe('test_name');
        });

        it('should handle mixed case', () => {
            expect(processId('ATP-Mg2+')).toBe('atp_mg2');
        });

        it('should handle empty string', () => {
            expect(processId('')).toBe('');
        });

        it('should handle complex chemical names', () => {
            expect(processId('D-glucose 6-phosphate')).toBe('d_glucose_6_phosphate');
            expect(processId('ATP-Mg2+')).toBe('atp_mg2');
            expect(processId('(2S)-2-amino-3-hydroxypropanoic acid')).toBe('2s_2_amino_3_hydroxypropanoic_acid');
        });
    });

    describe('ChEBIError', () => {
        it('should create error with message', () => {
            const error = new ChEBIError('Test error');
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('ChEBIError');
            expect(error.cause).toBeUndefined();
        });

        it('should create error with message and cause', () => {
            const cause = new Error('Original error');
            const error = new ChEBIError('Test error', cause);
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('ChEBIError');
            expect(error.cause).toBe(cause);
        });

        it('should be instance of Error', () => {
            const error = new ChEBIError('Test error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(ChEBIError);
        });
    });

    describe('searchChebi', () => {
        // Mock the global fetch function
        const mockFetch = jest.fn();
        const originalFetch = global.fetch;

        beforeEach(() => {
            global.fetch = mockFetch;
            jest.clearAllMocks();
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        it('should construct correct URL and search parameters', async () => {
            // Mock the OLS4 API response
            const mockSearchResponse = {
                response: {
                    docs: [
                        { short_form: '17234', label: 'glucose' },
                        { short_form: '4167', label: 'D-glucose' }
                    ]
                }
            };

            // Mock the ChEBI API responses for individual entries
            const mockChebiResponse = `<?xml version="1.0" encoding="UTF-8"?>
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <getCompleteEntityResponse>
                        <return>
                            <chebiId>CHEBI:17234</chebiId>
                            <chebiAsciiName>glucose</chebiAsciiName>
                            <status>PUBLISHED</status>
                        </return>
                    </getCompleteEntityResponse>
                </soap:Envelope>`;

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSearchResponse,
                })
                .mockResolvedValue({
                    ok: true,
                    text: async () => mockChebiResponse,
                });

            await searchChebi('glucose', 5);

            // Verify the search API call
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('https://www.ebi.ac.uk/ols4/api/search')
            );

            const searchCall = mockFetch.mock.calls[0][0];
            expect(searchCall).toContain('q=glucose');
            expect(searchCall).toContain('ontology=chebi');
            expect(searchCall).toContain('rows=5');
        });

        it('should handle empty search results', async () => {
            const mockSearchResponse = {
                response: {
                    docs: []
                }
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSearchResponse,
            });

            const results = await searchChebi('nonexistent', 10);

            expect(results).toEqual([]);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle network errors gracefully', async () => {
            const networkError = new Error('Network error');
            mockFetch.mockRejectedValueOnce(networkError);

            await expect(searchChebi('glucose', 5)).rejects.toThrow('Network error');
        });

        it('should handle JSON parsing errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => { throw new Error('Invalid JSON'); }
            });

            await expect(searchChebi('glucose', 5)).rejects.toThrow('Invalid JSON');
        });

        it('should handle API errors with non-ok status', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            // The function doesn't currently check for response.ok, so it will try to parse JSON
            // This test documents current behavior
            await expect(searchChebi('glucose', 5)).rejects.toThrow();
        });

        it('should process multiple search results correctly', async () => {
            const mockSearchResponse = {
                response: {
                    docs: [
                        { short_form: '17234', label: 'glucose' },
                        { short_form: '4167', label: 'D-glucose' },
                        { short_form: '15903', label: 'glucose 6-phosphate' }
                    ]
                }
            };

            const mockChebiResponse = `<?xml version="1.0" encoding="UTF-8"?>
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <getCompleteEntityResponse>
                        <return>
                            <chebiId>CHEBI:17234</chebiId>
                            <chebiAsciiName>glucose</chebiAsciiName>
                            <status>PUBLISHED</status>
                        </return>
                    </getCompleteEntityResponse>
                </soap:Envelope>`;

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSearchResponse,
                })
                .mockResolvedValue({
                    ok: true,
                    text: async () => mockChebiResponse,
                });

            const results = await searchChebi('glucose', 3);

            // Should have called fetch for the search + 3 individual ChEBI entries
            expect(mockFetch).toHaveBeenCalledTimes(4);
            expect(results).toHaveLength(3);
        });
    });
}); 