import type { Employment, FinancialPerson, HouseholdInput } from '../types/index.js';
import type { SimulatorBaselineState, SimulatorEvent } from './types.js';

function cloneHousehold(household: HouseholdInput): HouseholdInput {
  return structuredClone(household);
}

function cloneEmployments(employments: Record<string, Employment>): Record<string, Employment> {
  return structuredClone(employments);
}

function defaultEmploymentsForMembers(members: FinancialPerson[]): Record<string, Employment> {
  const employments: Record<string, Employment> = {};
  for (const member of members) {
    employments[member.id] = { type: 'none' };
  }
  return employments;
}

function resolveMemberId(
  members: FinancialPerson[],
  memberId: string | undefined
): string {
  if (memberId) return memberId;
  const applicant = members.find((m) => m.role === 'applicant');
  if (!applicant) {
    throw new Error('Household must contain an applicant');
  }
  return applicant.id;
}

function applySingleEvent(
  state: SimulatorBaselineState,
  event: SimulatorEvent
): SimulatorBaselineState {
  const household = cloneHousehold(state.household);
  const employments = cloneEmployments(state.employments);

  switch (event.type) {
    case 'unemployment': {
      const memberId = resolveMemberId(household.members, event.memberId);
      employments[memberId] = { type: 'none' };
      break;
    }
    case 'employment': {
      const memberId = resolveMemberId(household.members, event.memberId);
      employments[memberId] = {
        type: 'regular',
        grossMonthly: event.grossMonthly,
        taxClass: event.taxClass,
        churchTax: event.churchTax ?? false,
        hoursPerWeek: event.hoursPerWeek,
      };
      break;
    }
    case 'part-time-employment': {
      const memberId = resolveMemberId(household.members, event.memberId);
      employments[memberId] = {
        type: 'regular',
        grossMonthly: event.grossMonthly,
        taxClass: event.taxClass,
        churchTax: event.churchTax ?? false,
        hoursPerWeek: event.hoursPerWeek,
      };
      break;
    }
    case 'minijob': {
      const memberId = resolveMemberId(household.members, event.memberId);
      employments[memberId] = {
        type: 'minijob',
        grossMonthly: event.grossMonthly,
        rvOptIn: event.rvOptIn,
      };
      break;
    }
    case 'midijob': {
      const memberId = resolveMemberId(household.members, event.memberId);
      employments[memberId] = {
        type: 'midijob',
        grossMonthly: event.grossMonthly,
        taxClass: event.taxClass,
        churchTax: event.churchTax ?? false,
      };
      break;
    }
    case 'child-added': {
      const childCount = household.members.filter((m) => m.role === 'child').length;
      household.members.push({
        id: `child-${childCount + 1}`,
        role: 'child',
        age: event.age,
      });
      employments[`child-${childCount + 1}`] = { type: 'none' };
      break;
    }
    case 'child-removed': {
      const children = household.members.filter((m) => m.role === 'child');
      const target = children[event.childIndex];
      if (!target) break;
      household.members = household.members.filter((m) => m.id !== target.id);
      delete employments[target.id];
      break;
    }
    case 'household-composition': {
      const applicant = household.members.find((m) => m.role === 'applicant');
      if (!applicant) break;

      const nextMembers: FinancialPerson[] = [applicant];
      if (event.maritalStatus === 'married') {
        nextMembers.push({
          id: 'partner',
          role: 'partner',
          age: 30,
          taxClass: 5,
          churchTax: false,
        });
      }

      event.children.forEach((child, index) => {
        nextMembers.push({
          id: `child-${index + 1}`,
          role: 'child',
          age: child.age,
        });
      });

      household.members = nextMembers;
      const nextEmployments = defaultEmploymentsForMembers(nextMembers);
      for (const [memberId, employment] of Object.entries(employments)) {
        if (nextEmployments[memberId]) {
          nextEmployments[memberId] = employment;
        }
      }
      return { household, employments: nextEmployments };
    }
    case 'rent-change': {
      household.housing = {
        ...household.housing,
        coldRent: event.newColdRent,
        utilities: event.newUtilities ?? household.housing.utilities,
      };
      break;
    }
    case 'partner-employment-change': {
      const partner = household.members.find((m) => m.role === 'partner');
      if (partner) {
        employments[partner.id] = structuredClone(event.employment);
      }
      break;
    }
  }

  return { household, employments };
}

/** Apply events immutably: baselineState + pure(eventTransform). */
export function applyEventsToBaseline(
  baseline: SimulatorBaselineState,
  events: SimulatorEvent[]
): SimulatorBaselineState {
  return events.reduce(applySingleEvent, {
    household: cloneHousehold(baseline.household),
    employments: cloneEmployments(baseline.employments),
  });
}

export function describeEvents(events: SimulatorEvent[]): string[] {
  return events.map((event) => event.type);
}
