import { fromPubChem } from '../src/fetcher/pubchem';
import { Compound } from 'pubchem';
import { SmallMolecule } from '../src';

// Mock the pubchem module
jest.mock('pubchem');

const MockedCompound = Compound as jest.MockedClass<typeof Compound>;

describe('fromName', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear console.log and console.error mocks
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should successfully fetch compound data from PubChem and return SmallMolecule', async () => {
        // Mock PubChem data structure
        const mockPubChemData = {
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
            getData: jest.fn().mockResolvedValue(mockPubChemData)
        };

        MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

        const result = await fromPubChem('caffeine');

        expect(MockedCompound.fromName).toHaveBeenCalledWith('caffeine');
        expect(mockCompound.getData).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(mockPubChemData);

        const expectedResult: SmallMolecule = {
            id: '2519',
            name: 'C8H10N4O2',
            constant: false,
            vessel_id: null,
            canonical_smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
            inchi: 'InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3',
            inchikey: 'RYYVLZVUVIJVGH-UHFFFAOYSA-N',
            synonymous_names: [],
            references: []
        };

        expect(result).toEqual(expectedResult);
    });

    it('should handle empty or null data gracefully', async () => {
        const mockPubChemData = {
            getIdentifiers: () => ({
                formula: {
                    label: null
                }
            }),
            getSMILES: () => ({
                value: null
            }),
            getInChI: () => ({
                value: null
            }),
            getInChIKey: () => ({
                value: null
            })
        };

        const mockCompound = {
            getCID: jest.fn().mockReturnValue('12345'),
            getData: jest.fn().mockResolvedValue(mockPubChemData)
        };

        MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

        const result = await fromPubChem('unknown-compound');

        expect(result).toEqual({
            id: '12345',
            name: null,
            constant: false,
            vessel_id: null,
            canonical_smiles: null,
            inchi: null,
            inchikey: null,
            synonymous_names: [],
            references: []
        });
    });

    it('should handle PubChem API errors and rethrow them', async () => {
        const errorMessage = 'Compound not found';
        const mockError = new Error(errorMessage);

        MockedCompound.fromName = jest.fn().mockRejectedValue(mockError);

        await expect(fromPubChem('nonexistent-compound')).rejects.toThrow(errorMessage);

        expect(console.error).toHaveBeenCalledWith(`Error searching PubChem: ${errorMessage}`);
        expect(MockedCompound.fromName).toHaveBeenCalledWith('nonexistent-compound');
    });

    it('should handle getData errors and rethrow them', async () => {
        const errorMessage = 'Failed to get compound data';
        const mockError = new Error(errorMessage);

        const mockCompound = {
            getCID: jest.fn().mockReturnValue('2519'),
            getData: jest.fn().mockRejectedValue(mockError)
        };

        MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

        await expect(fromPubChem('caffeine')).rejects.toThrow(errorMessage);

        expect(console.error).toHaveBeenCalledWith(`Error searching PubChem: ${errorMessage}`);
        expect(MockedCompound.fromName).toHaveBeenCalledWith('caffeine');
        expect(mockCompound.getData).toHaveBeenCalled();
    });

    it('should handle network timeout errors', async () => {
        const timeoutError = new Error('Request timeout');
        timeoutError.name = 'TimeoutError';

        MockedCompound.fromName = jest.fn().mockRejectedValue(timeoutError);

        await expect(fromPubChem('caffeine')).rejects.toThrow('Request timeout');

        expect(console.error).toHaveBeenCalledWith('Error searching PubChem: Request timeout');
    });

    it('should handle different compound name formats', async () => {
        const testCases = [
            'aspirin',
            'acetylsalicylic acid',
            'C9H8O4',
            '50-78-2', // CAS number
            'BSYNRYMUTXBXSQ-UHFFFAOYSA-N' // InChIKey
        ];

        const mockPubChemData = {
            getIdentifiers: () => ({ formula: { label: 'Test Compound' } }),
            getSMILES: () => ({ value: 'CCO' }),
            getInChI: () => ({ value: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3' }),
            getInChIKey: () => ({ value: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N' })
        };

        const mockCompound = {
            getCID: jest.fn().mockReturnValue('702'),
            getData: jest.fn().mockResolvedValue(mockPubChemData)
        };

        MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

        for (const testCase of testCases) {
            await fromPubChem(testCase);
            expect(MockedCompound.fromName).toHaveBeenCalledWith(testCase);
        }

        expect(MockedCompound.fromName).toHaveBeenCalledTimes(testCases.length);
    });

    it('should handle special characters in compound names', async () => {
        const compoundName = 'β-D-glucose';

        const mockPubChemData = {
            getIdentifiers: () => ({ formula: { label: 'C6H12O6' } }),
            getSMILES: () => ({ value: 'C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O' }),
            getInChI: () => ({ value: 'InChI=1S/C6H12O6/c7-1-2-3(8)4(9)5(10)6(11)12-2/h2-11H,1H2/t2-,3-,4+,5-,6?/m1/s1' }),
            getInChIKey: () => ({ value: 'WQZGKKKJIJFFOK-GASJEMHNSA-N' })
        };

        const mockCompound = {
            getCID: jest.fn().mockReturnValue('5793'),
            getData: jest.fn().mockResolvedValue(mockPubChemData)
        };

        MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

        const result = await fromPubChem(compoundName);

        expect(MockedCompound.fromName).toHaveBeenCalledWith(compoundName);
        expect(result.name).toBe('C6H12O6');
    });

    it('should handle undefined/null input gracefully', async () => {
        const mockError = new Error('Invalid compound name');
        MockedCompound.fromName = jest.fn().mockRejectedValue(mockError);

        await expect(fromPubChem('')).rejects.toThrow('Invalid compound name');
        expect(console.error).toHaveBeenCalledWith('Error searching PubChem: Invalid compound name');
    });

    it('should preserve type safety and return correct SmallMolecule structure', async () => {
        const mockPubChemData = {
            getIdentifiers: () => ({ formula: { label: 'Water' } }),
            getSMILES: () => ({ value: 'O' }),
            getInChI: () => ({ value: 'InChI=1S/H2O/h1H2' }),
            getInChIKey: () => ({ value: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N' })
        };

        const mockCompound = {
            getCID: jest.fn().mockReturnValue('962'),
            getData: jest.fn().mockResolvedValue(mockPubChemData)
        };

        MockedCompound.fromName = jest.fn().mockResolvedValue(mockCompound);

        const result = await fromPubChem('water');

        // Type checking - ensure all required SmallMolecule properties are present
        expect(typeof result.id).toBe('string');
        expect(typeof result.name).toBe('string');
        expect(typeof result.constant).toBe('boolean');
        expect(result.vessel_id).toBeNull();
        expect(typeof result.canonical_smiles).toBe('string');
        expect(typeof result.inchi).toBe('string');
        expect(typeof result.inchikey).toBe('string');
        expect(Array.isArray(result.synonymous_names)).toBe(true);
        expect(Array.isArray(result.references)).toBe(true);

        // Check that constant is always false (as per the implementation)
        expect(result.constant).toBe(false);

        // Check that arrays are always initialized as empty arrays
        expect(result.synonymous_names).toHaveLength(0);
        expect(result.references).toHaveLength(0);
    });
}); 