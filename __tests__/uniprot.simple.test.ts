/**
 * Simplified tests for UniProt fetcher - focusing on core functionality
 */

import { processId, UniProtError, searchUniprot } from '../src/fetcher/uniprot';

describe('UniProt Fetcher - Core Functionality', () => {
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

        it('should handle UniProt-specific protein names', () => {
            expect(processId('Insulin-like growth factor I')).toBe('insulin_like_growth_factor_i');
            expect(processId('Heat shock protein 70')).toBe('heat_shock_protein_70');
            expect(processId('Alpha/beta hydrolase')).toBe('alpha_beta_hydrolase');
        });
    });

    describe('UniProtError', () => {
        it('should create error with message', () => {
            const error = new UniProtError('Test error');
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('UniProtError');
            expect(error.cause).toBeUndefined();
        });

        it('should create error with message and cause', () => {
            const cause = new Error('Original error');
            const error = new UniProtError('Test error', cause);
            expect(error.message).toBe('Test error');
            expect(error.name).toBe('UniProtError');
            expect(error.cause).toBe(cause);
        });

        it('should be instance of Error', () => {
            const error = new UniProtError('Test error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(UniProtError);
        });
    });

    describe('searchUniprot', () => {
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

        it('should construct correct search URL and parameters', async () => {
            // Mock the search API response
            const mockSearchResponse = {
                results: [
                    { primaryAccession: 'P01308' },
                    { primaryAccession: 'P06213' }
                ]
            };

            // Mock fetchUniprot calls - need to import and mock the entire module
            const mockProtein = {
                id: 'test_protein',
                name: 'Test Protein',
                sequence: 'SEQUENCE',
                organism: 'Test organism',
                organism_tax_id: '9606',
                ecnumber: null,
                constant: true,
                vessel_id: null,
                references: ['https://www.uniprot.org/uniprotkb/P01308']
            };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSearchResponse
                })
                .mockResolvedValue({
                    ok: true,
                    json: async () => ({
                        uniProtkbId: 'TEST_PROTEIN',
                        primaryAccession: 'P01308',
                        proteinDescription: {
                            recommendedName: {
                                fullName: { value: 'Test Protein' }
                            }
                        },
                        organism: {
                            scientificName: 'Test organism',
                            taxonId: 9606
                        },
                        sequence: {
                            value: 'SEQUENCE',
                            length: 8
                        }
                    })
                });

            await searchUniprot('insulin', 5);

            // Verify the search API was called correctly
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('https://rest.uniprot.org/uniprotkb/search')
            );

            const searchCall = mockFetch.mock.calls[0][0];
            expect(searchCall).toContain('query=insulin');
            expect(searchCall).toContain('size=5');
            expect(searchCall).toContain('format=json');
            expect(searchCall).toContain('fields=accession%2Cid%2Cprotein_name%2Corganism_name');
        });

        it('should handle empty search results gracefully', async () => {
            const mockEmptyResponse = {
                results: []
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockEmptyResponse
            });

            const results = await searchUniprot('nonexistent-protein-xyz', 10);

            expect(results).toEqual([]);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle network errors gracefully', async () => {
            const networkError = new Error('Network timeout');
            mockFetch.mockRejectedValueOnce(networkError);

            await expect(searchUniprot('insulin', 5)).rejects.toThrow('Network timeout');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('https://rest.uniprot.org/uniprotkb/search')
            );
        });

        it('should handle JSON parsing errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => { throw new Error('Invalid JSON'); }
            });

            await expect(searchUniprot('insulin', 5)).rejects.toThrow('Invalid JSON');
        });

        it('should handle API errors with non-ok status', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            // The function doesn't currently check for response.ok, so it will try to parse JSON
            // This test documents current behavior
            await expect(searchUniprot('insulin', 5)).rejects.toThrow();
        });

        it('should process multiple search results correctly', async () => {
            const mockSearchResponse = {
                results: [
                    { primaryAccession: 'P01308' },
                    { primaryAccession: 'P06213' },
                    { primaryAccession: 'P01315' }
                ]
            };

            // Mock the individual UniProt entry responses
            const mockUniprotEntry = {
                uniProtkbId: 'TEST_PROTEIN',
                primaryAccession: 'P01308',
                proteinDescription: {
                    recommendedName: {
                        fullName: { value: 'Test Protein' }
                    }
                },
                organism: {
                    scientificName: 'Test organism',
                    taxonId: 9606
                },
                sequence: {
                    value: 'SEQUENCE',
                    length: 8
                }
            };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSearchResponse
                })
                .mockResolvedValue({
                    ok: true,
                    json: async () => mockUniprotEntry
                });

            const results = await searchUniprot('insulin', 3);

            // Should have called fetch for the search + 3 individual UniProt entries
            expect(mockFetch).toHaveBeenCalledTimes(4);
            expect(results).toHaveLength(3);

            // Verify each result has the correct structure
            results.forEach(protein => {
                expect(protein.id).toBeDefined();
                expect(protein.name).toBeDefined();
                expect(typeof protein.constant).toBe('boolean');
                expect(protein.constant).toBe(true);
                expect(Array.isArray(protein.references)).toBe(true);
            });
        });
    });
}); 