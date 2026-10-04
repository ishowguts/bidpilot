import type { ScenarioName } from '../scenarios.js';
import { createEqualPolicy } from './equal.js';
import { createGreedyPolicy } from './greedy.js';
import { createOraclePolicy } from './oracle.js';
import { createThompsonPolicy } from './thompson.js';
import type { Policy, PolicyName } from './types.js';

/** A fresh policy instance for one campaign. The scenario is used only by the oracle. */
export function createPolicy(name: PolicyName, scenario: ScenarioName): Policy {
  switch (name) {
    case 'thompson':
      return createThompsonPolicy();
    case 'equal':
      return createEqualPolicy();
    case 'greedy':
      return createGreedyPolicy();
    case 'oracle':
      return createOraclePolicy(scenario);
  }
}
