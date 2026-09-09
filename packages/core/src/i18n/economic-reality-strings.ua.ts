import { ER_COPY_KEYS } from './economic-reality-copy.js';
import { ECONOMIC_REALITY_COPY_EN } from './economic-reality-strings.en.js';

/** Ukrainian ER copy: EN base with localized Action Planner + confirm strings. */
export const ECONOMIC_REALITY_COPY_UA = {
  ...ECONOMIC_REALITY_COPY_EN,
  [ER_COPY_KEYS.ACTION_CONFIRM_REGISTRATION]: 'Підтвердити завершення Anmeldung',
  [ER_COPY_KEYS.PLANNER_TITLE]: 'Планувальник дій',
  [ER_COPY_KEYS.PLANNER_SITUATION]: 'Ваша поточна економічна ситуація',
  [ER_COPY_KEYS.PLANNER_KNOWN]: 'Що відомо Atlas',
  [ER_COPY_KEYS.PLANNER_MISSING]: 'Чого бракує',
  [ER_COPY_KEYS.PLANNER_NEXT]: 'Рекомендована наступна дія',
  [ER_COPY_KEYS.PLANNER_STATUS_NOT_READY]: 'Не готово',
  [ER_COPY_KEYS.PLANNER_STATUS_READY]: 'Готово',
  [ER_COPY_KEYS.PLANNER_STATUS_COMPLETE]: 'Завершено',
  [ER_COPY_KEYS.PLANNER_UNKNOWN]: 'Не вказано',
  [ER_COPY_KEYS.PLANNER_ADDRESS_KNOWN]: 'Адреса для реєстрації',
  [ER_COPY_KEYS.PLANNER_REGISTRATION_KNOWN]: 'Підтвердження Anmeldung',
  [ER_COPY_KEYS.PLANNER_INCOME_KNOWN]: 'Дохід',
  [ER_COPY_KEYS.PLANNER_EMPLOYMENT_KNOWN]: 'Статус зайнятості',
  [ER_COPY_KEYS.PLANNER_AFTER_CONFIRM]: 'Ситуацію оновлено. Ваш план перераховано.',
  [ER_COPY_KEYS.PLANNER_MISSING_ADDRESS]:
    'Додайте адресу для реєстрації, перш ніж підтверджувати Anmeldung.',
  [ER_COPY_KEYS.PLANNER_MISSING_CONFIRMATION]:
    'Підтвердіть Anmeldung після завершення в місцевому органі влади.',
  [ER_COPY_KEYS.PLANNER_MISSING_INCOME]:
    'Вкажіть дохід, щоб економічне орієнтування могло продовжитися.',
  [ER_COPY_KEYS.PLANNER_MISSING_EMPLOYMENT]:
    'Вкажіть статус зайнятості, щоб економічне орієнтування могло продовжитися.',
} as const;
