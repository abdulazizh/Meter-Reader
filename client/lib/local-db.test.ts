
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a single mock db object that will be returned by the factory
const sharedMockDb = {
  execSync: vi.fn(() => {}),
  run: vi.fn(() => {}),
  getAllSync: vi.fn(() => []),
};

// Use vi.hoisted to ensure this is available for vi.mock
const mocks = vi.hoisted(() => {
  return {
    mockDb: {
      execSync: vi.fn(),
      run: vi.fn(),
      getAllSync: vi.fn(() => []),
    }
  };
});

// Mock react-native
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: vi.fn((objs) => objs.ios),
  },
}));

// Mock expo-sqlite
vi.mock('expo-sqlite', () => {
  return {
    openDatabaseSync: vi.fn(() => mocks.mockDb),
  };
});

// Import AFTER mocks
import { initLocalDB, saveReadingToLocalDB, getPendingReadingsFromDB, markReadingAsSynced } from './local-db';

describe('local-db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default implementations for the shared instance
    mocks.mockDb.execSync.mockReturnValue(undefined);
    mocks.mockDb.run.mockReturnValue(undefined);
    mocks.mockDb.getAllSync.mockReturnValue([]);
  });

  describe('initLocalDB', () => {
    it('should call execSync twice to create tables', () => {
      initLocalDB();
      expect(mocks.mockDb.execSync).toHaveBeenCalledTimes(2);
      expect(mocks.mockDb.execSync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS readings'));
      expect(mocks.mockDb.execSync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS meters'));
    });
  });

  describe('saveReadingToLocalDB', () => {
    it('should call db.run with correct parameters', () => {
      const result = saveReadingToLocalDB(
        'id-1', 'meter-1', 'reader-1', 1234, 'uri', 'file.jpg'
      );
      
      expect(mocks.mockDb.run).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if db.run throws an error', () => {
      mocks.mockDb.run.mockImplementation(() => {
        throw new Error('Database Error');
      });
      
      const result = saveReadingToLocalDB(
        'id-1', 'meter-1', 'reader-1', 1234, 'uri', 'file.jpg'
      );
      
      expect(result).toBe(false);
    });
  });

  describe('getPendingReadingsFromDB', () => {
    it('should return all pending readings from the database', () => {
      const readings = [{ id: '1', synced: 0 }, { id: '2', synced: 0 }];
      mocks.mockDb.getAllSync.mockReturnValue(readings);

      const result = getPendingReadingsFromDB();
      expect(result).toEqual(readings);
      expect(mocks.mockDb.getAllSync).toHaveBeenCalledWith(expect.stringContaining('WHERE synced = 0'));
    });
  });

  describe('markReadingAsSynced', () => {
    it('should update the synced status of a reading', () => {
      const result = markReadingAsSynced('id-1');
      expect(mocks.mockDb.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE readings SET synced = 1'), ['id-1']);
      expect(result).toBe(true);
    });
  });
});
