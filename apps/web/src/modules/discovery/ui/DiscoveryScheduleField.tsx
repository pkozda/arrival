'use client';

import { useApp } from '@/components/AppProvider';
import {
  setScheduleCadence,
  setScheduleHourUtc,
  type ScheduleDraft,
} from '@/lib/discovery';

type Props = {
  draft: ScheduleDraft;
  onChange: (draft: ScheduleDraft) => void;
  idPrefix?: string;
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

function formatHourUtc(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Manual / Daily schedule editor for Jobs profiles.
 * Weekly profiles render read-only so existing schedule data is not destroyed.
 */
export function DiscoveryScheduleField({
  draft,
  onChange,
  idPrefix = 'discovery-schedule',
}: Props) {
  const { t } = useApp();
  const groupName = `${idPrefix}-cadence`;
  const hourId = `${idPrefix}-hour`;

  if (draft.kind === 'unsupported') {
    return (
      <div className="discovery-schedule" data-ui-surface="discovery-schedule">
        <h3 className="discovery-schedule__title">{t('discovery.schedule.title')}</h3>
        <p className="text-body text-body--muted discovery-schedule__unsupported">
          {t('discovery.schedule.weeklyUnsupported')}
        </p>
        <p className="discovery-empty" data-ui-surface="discovery-schedule-weekly">
          {t('discovery.schedule.weeklySummary')
            .replace('{day}', String(draft.schedule.dayOfWeek))
            .replace('{hour}', formatHourUtc(draft.schedule.hourUtc))}
        </p>
      </div>
    );
  }

  return (
    <fieldset className="discovery-schedule" data-ui-surface="discovery-schedule">
      <legend className="discovery-schedule__title">{t('discovery.schedule.title')}</legend>

      <div className="discovery-schedule__options" role="radiogroup" aria-label={t('discovery.schedule.title')}>
        <label className="discovery-schedule__option">
          <input
            type="radio"
            name={groupName}
            value="manual"
            checked={draft.cadence === 'manual'}
            onChange={() => onChange(setScheduleCadence(draft, 'manual'))}
          />
          <span>
            {t('discovery.schedule.manual')}
            <span className="text-body text-body--muted discovery-schedule__hint">
              {t('discovery.schedule.manualDescription')}
            </span>
          </span>
        </label>

        <label className="discovery-schedule__option">
          <input
            type="radio"
            name={groupName}
            value="daily"
            checked={draft.cadence === 'daily'}
            onChange={() => onChange(setScheduleCadence(draft, 'daily'))}
          />
          <span>
            {t('discovery.schedule.daily')}
            <span className="text-body text-body--muted discovery-schedule__hint">
              {t('discovery.schedule.dailyDescription')}
            </span>
          </span>
        </label>
      </div>

      {draft.cadence === 'daily' ? (
        <label className="discovery-schedule__hour" htmlFor={hourId}>
          {t('discovery.schedule.hourUtc.label')}
          <span className="text-body text-body--muted discovery-schedule__hint">
            {t('discovery.schedule.hourUtc.description')}
          </span>
          <select
            id={hourId}
            value={draft.hourUtc}
            onChange={(event) =>
              onChange(setScheduleHourUtc(draft, Number(event.target.value)))
            }
          >
            {HOUR_OPTIONS.map((hour) => (
              <option key={hour} value={hour}>
                {formatHourUtc(hour)} {t('discovery.schedule.utc')}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </fieldset>
  );
}
