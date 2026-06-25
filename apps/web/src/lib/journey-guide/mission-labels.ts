const MISSION_LABELS: Record<string, string> = {
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

export function toMissionTitle(nodeId: string, title: string): string {
  if (MISSION_LABELS[nodeId]) {
    return MISSION_LABELS[nodeId]!;
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
