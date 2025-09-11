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
            // Mock the new ChEBI search API response
            const mockSearchResponse = {
                results: [
                    { "_source": { "chebi_accession": "CHEBI:17234" } },
                    { "_source": { "chebi_accession": "CHEBI:4167" } }
                ]
            };

            // Mock the ChEBI compounds API responses for batch fetch
            const mockChebiResponse = {
                "CHEBI:17234": {
                    "standardized_chebi_id": "CHEBI:17234",
                    "primary_chebi_id": "CHEBI:17234",
                    "exists": true,
                    "id_type": "primary",
                    "data": {
                        "id": 17234,
                        "chebi_accession": "CHEBI:17234",
                        "name": "glucose",
                        "ascii_name": "glucose",
                        "stars": 3,
                        "definition": "An aldohexose used as a source of energy",
                        "names": {},
                        "chemical_data": {
                            "formula": "C6H12O6",
                            "charge": 0,
                            "mass": "180.15588",
                            "monoisotopic_mass": "180.06339"
                        },
                        "default_structure": {
                            "id": 1,
                            "smiles": "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
                            "standard_inchi": "InChI=1S/C6H12O6/c7-1-2-3(8)4(9)5(10)6(11)12-2/h2-11H,1H2/t2-,3-,4+,5-,6?/m1/s1",
                            "standard_inchi_key": "WQZGKKKJIJFFOK-GASJEMHNSA-N",
                            "wurcs": null,
                            "is_r_group": false
                        },
                        "modified_on": "2023-01-01T00:00:00Z",
                        "secondary_ids": [],
                        "is_released": true
                    }
                },
                "CHEBI:4167": {
                    "standardized_chebi_id": "CHEBI:4167",
                    "primary_chebi_id": "CHEBI:4167",
                    "exists": true,
                    "id_type": "primary",
                    "data": {
                        "id": 4167,
                        "chebi_accession": "CHEBI:4167",
                        "name": "D-glucose",
                        "ascii_name": "D-glucose",
                        "stars": 3,
                        "definition": "A glucose with D-configuration",
                        "names": {},
                        "chemical_data": {
                            "formula": "C6H12O6",
                            "charge": 0,
                            "mass": "180.15588",
                            "monoisotopic_mass": "180.06339"
                        },
                        "default_structure": {
                            "id": 2,
                            "smiles": "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
                            "standard_inchi": "InChI=1S/C6H12O6/c7-1-2-3(8)4(9)5(10)6(11)12-2/h2-11H,1H2/t2-,3-,4+,5-,6?/m1/s1",
                            "standard_inchi_key": "WQZGKKKJIJFFOK-GASJEMHNSA-N",
                            "wurcs": null,
                            "is_r_group": false
                        },
                        "modified_on": "2023-01-01T00:00:00Z",
                        "secondary_ids": [],
                        "is_released": true
                    }
                }
            };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSearchResponse,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockChebiResponse,
                });

            await searchChebi('glucose', 5);

            // Verify the search API call
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('https://www.ebi.ac.uk/chebi/backend/api/public/es_search/')
            );

            const searchCall = mockFetch.mock.calls[0][0];
            expect(searchCall).toContain('term=glucose');
            expect(searchCall).toContain('size=5');
        });

        it('should handle empty search results', async () => {
            const mockSearchResponse = {
                results: []
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

            await expect(searchChebi('glucose', 5)).rejects.toThrow('Failed to search ChEBI: Network error');
        });

        it('should handle JSON parsing errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => { throw new Error('Invalid JSON'); }
            });

            await expect(searchChebi('glucose', 5)).rejects.toThrow('Failed to search ChEBI: Invalid JSON');
        });

        it('should handle API errors with non-ok status', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            await expect(searchChebi('glucose', 5)).rejects.toThrow('Search failed: HTTP 500: Internal Server Error');
        });

        it('should process multiple search results correctly', async () => {
            const mockSearchResponse = {
                results: [
                    { "_source": { "chebi_accession": "CHEBI:17234" } },
                    { "_source": { "chebi_accession": "CHEBI:4167" } },
                    { "_source": { "chebi_accession": "CHEBI:15903" } }
                ]
            };

            const mockChebiResponse = {
                "CHEBI:17234": {
                    "standardized_chebi_id": "CHEBI:17234",
                    "primary_chebi_id": "CHEBI:17234",
                    "exists": true,
                    "id_type": "primary",
                    "data": {
                        "id": 17234,
                        "chebi_accession": "CHEBI:17234",
                        "name": "glucose",
                        "ascii_name": "glucose",
                        "stars": 3,
                        "definition": "An aldohexose used as a source of energy",
                        "names": {},
                        "chemical_data": {
                            "formula": "C6H12O6",
                            "charge": 0,
                            "mass": "180.15588",
                            "monoisotopic_mass": "180.06339"
                        },
                        "default_structure": {
                            "id": 1,
                            "smiles": "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
                            "standard_inchi": "InChI=1S/C6H12O6/c7-1-2-3(8)4(9)5(10)6(11)12-2/h2-11H,1H2/t2-,3-,4+,5-,6?/m1/s1",
                            "standard_inchi_key": "WQZGKKKJIJFFOK-GASJEMHNSA-N",
                            "wurcs": null,
                            "is_r_group": false
                        },
                        "modified_on": "2023-01-01T00:00:00Z",
                        "secondary_ids": [],
                        "is_released": true
                    }
                },
                "CHEBI:4167": {
                    "standardized_chebi_id": "CHEBI:4167",
                    "primary_chebi_id": "CHEBI:4167",
                    "exists": true,
                    "id_type": "primary",
                    "data": {
                        "id": 4167,
                        "chebi_accession": "CHEBI:4167",
                        "name": "D-glucose",
                        "ascii_name": "D-glucose",
                        "stars": 3,
                        "definition": "A glucose with D-configuration",
                        "names": {},
                        "chemical_data": {
                            "formula": "C6H12O6",
                            "charge": 0,
                            "mass": "180.15588",
                            "monoisotopic_mass": "180.06339"
                        },
                        "default_structure": {
                            "id": 2,
                            "smiles": "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
                            "standard_inchi": "InChI=1S/C6H12O6/c7-1-2-3(8)4(9)5(10)6(11)12-2/h2-11H,1H2/t2-,3-,4+,5-,6?/m1/s1",
                            "standard_inchi_key": "WQZGKKKJIJFFOK-GASJEMHNSA-N",
                            "wurcs": null,
                            "is_r_group": false
                        },
                        "modified_on": "2023-01-01T00:00:00Z",
                        "secondary_ids": [],
                        "is_released": true
                    }
                },
                "CHEBI:15903": {
                    "standardized_chebi_id": "CHEBI:15903",
                    "primary_chebi_id": "CHEBI:15903",
                    "exists": true,
                    "id_type": "primary",
                    "data": {
                        "id": 15903,
                        "chebi_accession": "CHEBI:15903",
                        "name": "glucose 6-phosphate",
                        "ascii_name": "glucose 6-phosphate",
                        "stars": 3,
                        "definition": "A glucose phosphate that is glucose carrying a single phosphate substituent at position 6",
                        "names": {},
                        "chemical_data": {
                            "formula": "C6H13O9P",
                            "charge": 0,
                            "mass": "260.13684",
                            "monoisotopic_mass": "260.02973"
                        },
                        "default_structure": {
                            "id": 3,
                            "smiles": "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1OP(O)(O)=O",
                            "standard_inchi": "InChI=1S/C6H13O9P/c7-1-2-3(8)4(9)5(10)6(14-2)15-16(11,12)13/h2-10H,1H2,(H2,11,12,13)/t2-,3-,4+,5-,6?/m1/s1",
                            "standard_inchi_key": "NBSCHQHZLSJFNQ-GASJEMHNSA-N",
                            "wurcs": null,
                            "is_r_group": false
                        },
                        "modified_on": "2023-01-01T00:00:00Z",
                        "secondary_ids": [],
                        "is_released": true
                    }
                }
            };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSearchResponse,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockChebiResponse,
                });

            const results = await searchChebi('glucose', 3);

            // Should have called fetch for the search + 1 batch fetch for compounds
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(results).toHaveLength(3);
        });
    });
}); 