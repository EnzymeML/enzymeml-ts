import { fetchPubChem } from '../src/fetcher/pubchem';
import { Compound } from 'pubchem';
import { SmallMolecule } from '../src';

// Mock the pubchem module
jest.mock('pubchem');

const MockedCompound = Compound as jest.MockedClass<typeof Compound>;

describe('fromName Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Real-world compound data scenarios', () => {
        it('should handle caffeine data correctly', async () => {
            const mockCaffeineData = {
                getIdentifiers: () => ({
                    formula: {
                        label: 'C8H10N4O2'
                    }
                }),
                getSMILES: () => ({
                    value: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C'
                }),
                getInChI: () => ({
                    value: 'InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3'
                }),
                getInChIKey: () => ({
                    value: 'RYYVLZVUVIJVGH-UHFFFAOYSA-N'
                })
            };

            const mockCompound = {
                getCID: jest.fn().mockReturnValue('2519'),
                getData: jest.fn().mockResolvedValue(mockCaffeineData)
            };

            MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

            const result = await fetchPubChem('caffeine');

            expect(result).toEqual({
                id: '2519',
                name: 'C8H10N4O2',
                constant: false,
                vessel_id: null,
                canonical_smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
                inchi: 'InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3',
                inchikey: 'RYYVLZVUVIJVGH-UHFFFAOYSA-N',
                synonymous_names: [],
                references: []
            });
        });

        it('should handle aspirin data correctly', async () => {
            const mockAspirinData = {
                getIdentifiers: () => ({
                    formula: {
                        label: 'C9H8O4'
                    }
                }),
                getSMILES: () => ({
                    value: 'CC(=O)OC1=CC=CC=C1C(=O)O'
                }),
                getInChI: () => ({
                    value: 'InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)'
                }),
                getInChIKey: () => ({
                    value: 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N'
                })
            };

            const mockCompound = {
                getCID: jest.fn().mockReturnValue('2244'),
                getData: jest.fn().mockResolvedValue(mockAspirinData)
            };

            MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

            const result = await fetchPubChem('aspirin');

            expect(result.id).toBe('2244');
            expect(result.name).toBe('C9H8O4');
            expect(result.canonical_smiles).toBe('CC(=O)OC1=CC=CC=C1C(=O)O');
            expect(result.inchi).toBe('InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)');
            expect(result.inchikey).toBe('BSYNRYMUTXBXSQ-UHFFFAOYSA-N');
        });

        it('should handle glucose data correctly', async () => {
            const mockGlucoseData = {
                getIdentifiers: () => ({
                    formula: {
                        label: 'C6H12O6'
                    }
                }),
                getSMILES: () => ({
                    value: 'C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O'
                }),
                getInChI: () => ({
                    value: 'InChI=1S/C6H12O6/c7-1-2-3(8)4(9)5(10)6(11)12-2/h2-11H,1H2/t2-,3-,4+,5-,6+/m1/s1'
                }),
                getInChIKey: () => ({
                    value: 'WQZGKKKJIJFFOK-GASJEMHNSA-N'
                })
            };

            const mockCompound = {
                getCID: jest.fn().mockReturnValue('5793'),
                getData: jest.fn().mockResolvedValue(mockGlucoseData)
            };

            MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

            const result = await fetchPubChem('glucose');

            expect(result.id).toBe('5793');
            expect(result.name).toBe('C6H12O6');
            expect(result.canonical_smiles).toBe('C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O');
            expect(result.inchi).toContain('InChI=1S/C6H12O6');
            expect(result.inchikey).toBe('WQZGKKKJIJFFOK-GASJEMHNSA-N');
        });
    });

    describe('Edge cases with real-world variations', () => {
        it('should handle compounds with complex stereochemistry', async () => {
            const mockComplexData = {
                getIdentifiers: () => ({
                    formula: {
                        label: 'C20H25N3O'
                    }
                }),
                getSMILES: () => ({
                    value: 'CCN(CC)CCNC(=O)C1=CC=C(C=C1)N(C)C2=CC=CC=C2'
                }),
                getInChI: () => ({
                    value: 'InChI=1S/C20H25N3O/c1-4-22(5-2)15-14-21-20(24)17-10-12-19(13-11-17)23(3)18-8-6-7-9-16(18)18/h6-13H,4-5,14-15H2,1-3H3,(H,21,24)'
                }),
                getInChIKey: () => ({
                    value: 'MPLHNVLQVRSVEE-UHFFFAOYSA-N'
                })
            };

            const mockCompound = {
                getCID: jest.fn().mockReturnValue('3676'),
                getData: jest.fn().mockResolvedValue(mockComplexData)
            };

            MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

            const result = await fetchPubChem('lidocaine');

            expect(result.canonical_smiles).toContain('CCN(CC)CCNC(=O)');
            expect(result.inchi).toContain('/C20H25N3O/');
            expect(result.inchikey).toBe('MPLHNVLQVRSVEE-UHFFFAOYSA-N');
        });

        it('should handle very simple molecules like water', async () => {
            const mockWaterData = {
                getIdentifiers: () => ({
                    formula: {
                        label: 'H2O'
                    }
                }),
                getSMILES: () => ({
                    value: 'O'
                }),
                getInChI: () => ({
                    value: 'InChI=1S/H2O/h1H2'
                }),
                getInChIKey: () => ({
                    value: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N'
                })
            };

            const mockCompound = {
                getCID: jest.fn().mockReturnValue('962'),
                getData: jest.fn().mockResolvedValue(mockWaterData)
            };

            MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

            const result = await fetchPubChem('water');

            expect(result.id).toBe('962');
            expect(result.name).toBe('H2O');
            expect(result.canonical_smiles).toBe('O');
            expect(result.inchi).toBe('InChI=1S/H2O/h1H2');
            expect(result.inchikey).toBe('XLYOFNOQVPJJNP-UHFFFAOYSA-N');
        });

        it('should handle compounds with unusual CID formats', async () => {
            const mockData = {
                getIdentifiers: () => ({
                    formula: {
                        label: 'C2H6O'
                    }
                }),
                getSMILES: () => ({
                    value: 'CCO'
                }),
                getInChI: () => ({
                    value: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3'
                }),
                getInChIKey: () => ({
                    value: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N'
                })
            };

            const mockCompound = {
                getCID: jest.fn().mockReturnValue('00000702'), // Leading zeros
                getData: jest.fn().mockResolvedValue(mockData)
            };

            MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

            const result = await fetchPubChem('ethanol');

            expect(result.id).toBe('00000702');
            expect(result.name).toBe('C2H6O');
        });
    });

    describe('Error scenarios with realistic conditions', () => {
        it('should handle rate limiting errors from PubChem', async () => {
            const rateLimitError = new Error('Request failed with status code 429');
            rateLimitError.name = 'HTTPError';

            MockedCompound.fromName = jest.fn().mockRejectedValue(rateLimitError);

            await expect(fetchPubChem('caffeine')).rejects.toThrow('Request failed with status code 429');
            expect(console.error).toHaveBeenCalledWith('Error searching PubChem: Request failed with status code 429');
        });

        it('should handle compound not found in database', async () => {
            const notFoundError = new Error('No matches found for the specified compound');

            MockedCompound.fromName = jest.fn().mockRejectedValue(notFoundError);

            await expect(fetchPubChem('nonexistentcompound123')).rejects.toThrow('No matches found for the specified compound');
            expect(console.error).toHaveBeenCalledWith('Error searching PubChem: No matches found for the specified compound');
        });

        it('should handle malformed compound data', async () => {
            const mockMalformedData = {
                getIdentifiers: () => { throw new Error('Invalid identifier data'); },
                getSMILES: () => ({ value: 'CCO' }),
                getInChI: () => ({ value: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3' }),
                getInChIKey: () => ({ value: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N' })
            };

            const mockCompound = {
                getCID: jest.fn().mockReturnValue('702'),
                getData: jest.fn().mockResolvedValue(mockMalformedData)
            };

            MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

            await expect(fetchPubChem('ethanol')).rejects.toThrow('Invalid identifier data');
            expect(console.error).toHaveBeenCalledWith('Error searching PubChem: Invalid identifier data');
        });
    });

    describe('Performance and async behavior', () => {
        it('should handle concurrent requests properly', async () => {
            const compounds = ['caffeine', 'aspirin', 'glucose'];
            const mockDataMap = {
                caffeine: {
                    cid: '2519',
                    formula: 'C8H10N4O2',
                    smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C'
                },
                aspirin: {
                    cid: '2244',
                    formula: 'C9H8O4',
                    smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O'
                },
                glucose: {
                    cid: '5793',
                    formula: 'C6H12O6',
                    smiles: 'C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O'
                }
            };

            MockedCompound.fromName = jest.fn().mockImplementation((name: string) => {
                const data = mockDataMap[name as keyof typeof mockDataMap];
                const mockData = {
                    getIdentifiers: () => ({ formula: { label: data.formula } }),
                    getSMILES: () => ({ value: data.smiles }),
                    getInChI: () => ({ value: 'InChI=mock' }),
                    getInChIKey: () => ({ value: 'MOCK-INCHIKEY' })
                };

                return Promise.resolve({
                    getCID: jest.fn().mockReturnValue(data.cid),
                    getData: jest.fn().mockResolvedValue(mockData)
                });
            });

            const results = await Promise.all(compounds.map(compound => fetchPubChem(compound)));

            expect(results).toHaveLength(3);
            expect(results[0].id).toBe('2519'); // caffeine
            expect(results[1].id).toBe('2244'); // aspirin
            expect(results[2].id).toBe('5793'); // glucose
            expect(MockedCompound.fromName).toHaveBeenCalledTimes(3);
        });

        it('should handle slow API responses', async () => {
            const mockData = {
                getIdentifiers: () => ({ formula: { label: 'C8H10N4O2' } }),
                getSMILES: () => ({ value: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C' }),
                getInChI: () => ({ value: 'InChI=mock' }),
                getInChIKey: () => ({ value: 'MOCK-INCHIKEY' })
            };

            const mockCompound = {
                getCID: jest.fn().mockReturnValue('2519'),
                getData: jest.fn().mockImplementation(() =>
                    new Promise(resolve => setTimeout(() => resolve(mockData), 100))
                )
            };

            MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

            const startTime = Date.now();
            const result = await fetchPubChem('caffeine');
            const duration = Date.now() - startTime;

            expect(result.id).toBe('2519');
            expect(duration).toBeGreaterThanOrEqual(100);
        });
    });
}); 