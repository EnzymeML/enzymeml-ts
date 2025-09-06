/**
 * Simplified tests for PDB fetcher - focusing on core functionality
 */

import { processId, PDBError, searchPdb } from '../src/fetcher/pdb';

describe('PDB Fetcher - Core Functionality', () => {
    describe('processId', () => {
        it('should process a simple name correctly', () => {
            expect(processId('hemoglobin')).toBe('hemoglobin');
        });

        it('should replace special characters with underscores', () => {
            expect(processId('protein kinase A')).toBe('protein_kinase_a');
        });

        it('should handle multiple consecutive special characters', () => {
            expect(processId('test--protein__name')).toBe('test_protein_name');
        });

        it('should trim leading and trailing underscores', () => {
            expect(processId('_protein_name_')).toBe('protein_name');
        });

        it('should handle mixed case', () => {
            expect(processId('DNA-binding protein')).toBe('dna_binding_protein');
        });

        it('should handle empty string', () => {
            expect(processId('')).toBe('');
        });

        it('should handle complex protein names', () => {
            expect(processId('Cytochrome c oxidase subunit I')).toBe('cytochrome_c_oxidase_subunit_i');
            expect(processId('β-lactamase')).toBe('lactamase');
            expect(processId('5\'-nucleotidase')).toBe('5_nucleotidase');
        });

        it('should handle protein names with EC numbers', () => {
            expect(processId('Alcohol dehydrogenase (EC 1.1.1.1)')).toBe('alcohol_dehydrogenase_ec_1_1_1_1');
        });
    });

    describe('PDBError', () => {
        it('should create error with message', () => {
            const error = new PDBError('Test error');
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('PDBError');
            expect(error.cause).toBeUndefined();
        });

        it('should create error with message and cause', () => {
            const cause = new Error('Original error');
            const error = new PDBError('Test error', cause);
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('PDBError');
            expect(error.cause).toBe(cause);
        });

        it('should be instance of Error', () => {
            const error = new PDBError('Test error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(PDBError);
        });
    });

    describe('searchPdb', () => {
        // Mock the global fetch function
        const mockFetch = jest.fn();
        const originalFetch = global.fetch;

        beforeEach(() => {
            global.fetch = mockFetch;
            jest.clearAllMocks();
            jest.spyOn(console, 'log').mockImplementation(() => { });
            jest.spyOn(console, 'error').mockImplementation(() => { });
        });

        afterEach(() => {
            global.fetch = originalFetch;
            jest.restoreAllMocks();
        });

        it('should construct correct search URL and query parameters', async () => {
            // Mock empty search response to avoid making real PDB API calls
            const mockSearchResponse = {
                query_id: "search123",
                result_type: "entry",
                total_count: 0,
                result_set: []
            };

            const mockResponseText = JSON.stringify(mockSearchResponse);

            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => mockResponseText,
                json: async () => mockSearchResponse
            });

            await searchPdb('insulin');

            // Verify the search API was called correctly
            expect(mockFetch).toHaveBeenCalledWith(
                'https://search.rcsb.org/rcsbsearch/v2/query',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: expect.stringContaining('insulin')
                })
            );
        });

        it('should handle empty search results gracefully', async () => {
            // Mock empty search response
            const mockEmptyResponse = {
                query_id: "search456",
                result_type: "entry",
                total_count: 0,
                result_set: []
            };

            const mockResponseText = JSON.stringify(mockEmptyResponse);

            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: async () => mockResponseText,
                json: async () => mockEmptyResponse
            });

            const results = await searchPdb('nonexistent-protein-xyz');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://search.rcsb.org/rcsbsearch/v2/query',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                })
            );
            expect(results).toEqual([]);
        });

        it('should handle network errors gracefully', async () => {
            // Mock network error
            const networkError = new Error('Network timeout');
            mockFetch.mockRejectedValueOnce(networkError);

            await expect(searchPdb('insulin')).rejects.toThrow('PDB search failed: Network timeout');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://search.rcsb.org/rcsbsearch/v2/query',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                })
            );
        });
    });
});
