export type GuideTranslate = (key: string) => string;

const MISSION_KEY_BY_ID: Record<string, string> = {
  'move-to-germany': 'guide.mission.moveToGermany',
  'where-you-live': 'guide.mission.whereYouLive',
  'household-family': 'guide.mission.householdFamily',
  'work-income': 'guide.mission.workIncome',
  'health-insurance': 'guide.mission.healthInsurance',
  'benefits-support': 'guide.mission.benefitsSupport',
  'language-display': 'guide.mission.languageDisplay',
  __journey__: 'guide.mission.journey',
};

/** English fallbacks for engine unit tests that omit `t`. */
const MISSION_LABELS_EN: Record<string, string> = {
  'move-to-germany': 'Establish Your Arrival Base',
  'where-you-live': 'Set Your Home Base',
  'household-family': 'Map Your Household Constellation',
  'work-income': 'Configure Work & Income Systems',
  'health-insurance': 'Align Health Coverage',
  'benefits-support': 'Open Benefits Channels',
  'language-display': 'Configure Communication Systems',
  __journey__: 'Chart Your Journey',
};

const MISSION_PREFIX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/^complete\s+/i, 'Establish '],
  [/^add\s+/i, 'Define '],
  [/^update\s+/i, 'Refresh '],
  [/^submit\s+/i, 'Transmit '],
  [/^open\s+/i, 'Activate '],
  [/^review\s+/i, 'Survey '],
  [/^fix\s+/i, 'Repair '],
  [/^register\s+/i, 'Register '],
];

export function missionLabelKey(nodeId: string): string | undefined {
  return MISSION_KEY_BY_ID[nodeId];
}

export function toMissionTitle(nodeId: string, title: string, t?: GuideTranslate): string {
  const key = MISSION_KEY_BY_ID[nodeId];
  if (key) {
    if (t) {
      const localized = t(key);
      if (localized !== key) {
        return localized;
      }
    }
    return MISSION_LABELS_EN[nodeId] ?? title;
  }

  let mission = title.trim();
  for (const [pattern, replacement] of MISSION_PREFIX_REPLACEMENTS) {
    if (pattern.test(mission)) {
      mission = mission.replace(pattern, replacement);
      break;
    }
  }

  if (mission.length > 0 && mission[0] === mission[0]?.toLowerCase()) {
    mission = mission[0]!.toUpperCase() + mission.slice(1);
  }

  return mission;
}
