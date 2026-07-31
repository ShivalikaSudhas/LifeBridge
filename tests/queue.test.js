const { PRIORITY_SCORES } = require('../src/redis/queueService');
const { classifyByRules } = require('../src/services/emergencyService');

describe('Priority Classification & Queue Scoring Logic', () => {

  describe('Priority Score Mapping', () => {
    it('CRITICAL should have score 100', () => {
      expect(PRIORITY_SCORES.CRITICAL).toEqual(100);
    });

    it('HIGH should have score 75', () => {
      expect(PRIORITY_SCORES.HIGH).toEqual(75);
    });

    it('MEDIUM should have score 50', () => {
      expect(PRIORITY_SCORES.MEDIUM).toEqual(50);
    });

    it('LOW should have score 25', () => {
      expect(PRIORITY_SCORES.LOW).toEqual(25);
    });
  });

  describe('Rule-Based Keyword Classifier', () => {
    it('should classify cardiac arrest as CRITICAL', () => {
      const res = classifyByRules('Patient having cardiac arrest and not breathing');
      expect(res.priority).toEqual('CRITICAL');
    });

    it('should classify vehicle accident with bleeding as HIGH', () => {
      const res = classifyByRules('Vehicle crash on highway with severe bleeding');
      expect(res.priority).toEqual('HIGH');
    });

    it('should classify fever as MEDIUM', () => {
      const res = classifyByRules('High fever and dizziness for two days');
      expect(res.priority).toEqual('MEDIUM');
    });

    it('should classify minor cut as LOW', () => {
      const res = classifyByRules('Minor cut on left thumb requiring assistance');
      expect(res.priority).toEqual('LOW');
    });
  });

});
