import { logger } from '../../utils/logger';

describe('logger', () => {
  let consoleSpy: {
    debug: jest.SpyInstance;
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: jest.spyOn(console, 'debug').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('basic logging', () => {
    it('should log debug messages in development', () => {
      logger.debug('test message');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should log info messages in development', () => {
      logger.info('test message');
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should log warn messages in development', () => {
      logger.warn('test message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should always log error messages', () => {
      logger.error('test error');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should pass additional arguments', () => {
      logger.info('test', { data: 123 });
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.any(String),
        { data: 123 }
      );
    });
  });

  describe('namespaced logger', () => {
    it('should create namespaced logger', () => {
      const customLogger = logger.create('TestNamespace');
      customLogger.info('test message');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestNamespace]'),
        // No additional args in this call
      );
    });

    it('should allow nested namespaces', () => {
      const parentLogger = logger.create('Parent');
      const childLogger = parentLogger.create('Child');
      childLogger.info('test message');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[Parent:Child]'),
      );
    });
  });
});
