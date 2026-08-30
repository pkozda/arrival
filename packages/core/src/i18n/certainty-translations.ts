import type { SupportedLanguage } from '@arrival-atlas/ui-contract';

type Translations = Record<string, string>;

/**
 * Phase 2B — Certainty presentation templates.
 * Domain formatters emit keys + params; UI resolves via useApp().t().
 */
export const CERTAINTY_I18N: Record<SupportedLanguage, Translations> = {
  en: {
    'certainty.chrome.locationEyebrow': 'Where you are',
    'certainty.chrome.becauseHeading': 'Why this step',
    'certainty.chrome.progressHeading': 'Your progress',
    'certainty.chrome.expectedResultPrefix': 'This helps you',

    'certainty.confidence.clear': 'On track',
    'certainty.confidence.needsAttention': 'Needs your attention',
    'certainty.confidence.blocked': 'Blocked for now',
    'certainty.confidence.unknown': 'Still learning your situation',

    'certainty.reason.dependency': 'To unlock {target}, {prerequisite} is needed first.',
    'certainty.reason.description': 'Do this now because {description}.',
    'certainty.reason.progress': 'Do this now because it moves {target} forward.',

    'certainty.outcome.unlock': 'This unlocks {target}.',
    'certainty.outcome.openPath': 'This opens the path to {target}.',
    'certainty.outcome.unlockGuide': 'That unlocks {target}.',
    'certainty.outcome.openPathGuide': 'That opens the path to {target}.',

    'certainty.progress.partial': '{completed} of {total} steps are already in place.',
    'certainty.progress.noneCompleted': '{total} steps in your plan.',
    'certainty.progress.ariaLabel': '{completed} of {total} steps completed',
  },
  de: {
    'certainty.chrome.locationEyebrow': 'Wo Sie stehen',
    'certainty.chrome.becauseHeading': 'Warum dieser Schritt',
    'certainty.chrome.progressHeading': 'Ihr Fortschritt',
    'certainty.chrome.expectedResultPrefix': 'Das hilft Ihnen',

    'certainty.confidence.clear': 'Auf Kurs',
    'certainty.confidence.needsAttention': 'Braucht Ihre Aufmerksamkeit',
    'certainty.confidence.blocked': 'Vorübergehend blockiert',
    'certainty.confidence.unknown': 'Noch dabei, Ihre Situation zu verstehen',

    'certainty.reason.dependency':
      'Um {target} freizuschalten, wird zuerst {prerequisite} benötigt.',
    'certainty.reason.description': 'Tun Sie das jetzt, weil {description}.',
    'certainty.reason.progress': 'Tun Sie das jetzt, weil es {target} voranbringt.',

    'certainty.outcome.unlock': 'Das schaltet {target} frei.',
    'certainty.outcome.openPath': 'Das öffnet den Weg zu {target}.',
    'certainty.outcome.unlockGuide': 'Das schaltet {target} frei.',
    'certainty.outcome.openPathGuide': 'Das öffnet den Weg zu {target}.',

    'certainty.progress.partial': '{completed} von {total} Schritten sind bereits erledigt.',
    'certainty.progress.noneCompleted': '{total} Schritte in Ihrem Plan.',
    'certainty.progress.ariaLabel': '{completed} von {total} Schritten erledigt',
  },
  ru: {
    'certainty.chrome.locationEyebrow': 'Где вы сейчас',
    'certainty.chrome.becauseHeading': 'Почему этот шаг',
    'certainty.chrome.progressHeading': 'Ваш прогресс',
    'certainty.chrome.expectedResultPrefix': 'Это поможет вам',

    'certainty.confidence.clear': 'Всё по плану',
    'certainty.confidence.needsAttention': 'Требует внимания',
    'certainty.confidence.blocked': 'Пока заблокировано',
    'certainty.confidence.unknown': 'Ещё изучаем вашу ситуацию',

    'certainty.reason.dependency':
      'Чтобы открыть «{target}», сначала нужно «{prerequisite}».',
    'certainty.reason.description': 'Сделайте это сейчас, потому что {description}.',
    'certainty.reason.progress': 'Сделайте это сейчас, потому что это продвигает «{target}».',

    'certainty.outcome.unlock': 'Это откроет «{target}».',
    'certainty.outcome.openPath': 'Это откроет путь к «{target}».',
    'certainty.outcome.unlockGuide': 'Это откроет «{target}».',
    'certainty.outcome.openPathGuide': 'Это откроет путь к «{target}».',

    'certainty.progress.partial': 'Уже выполнено {completed} из {total} шагов.',
    'certainty.progress.noneCompleted': 'В вашем плане {total} шагов.',
    'certainty.progress.ariaLabel': 'Выполнено {completed} из {total} шагов',
  },
  ua: {
    'certainty.chrome.locationEyebrow': 'Де ви зараз',
    'certainty.chrome.becauseHeading': 'Чому цей крок',
    'certainty.chrome.progressHeading': 'Ваш прогрес',
    'certainty.chrome.expectedResultPrefix': 'Це допоможе вам',

    'certainty.confidence.clear': 'Усе за планом',
    'certainty.confidence.needsAttention': 'Потребує уваги',
    'certainty.confidence.blocked': 'Поки заблоковано',
    'certainty.confidence.unknown': 'Ще вивчаємо вашу ситуацію',

    'certainty.reason.dependency':
      'Щоб відкрити «{target}», спочатку потрібне «{prerequisite}».',
    'certainty.reason.description': 'Зробіть це зараз, бо {description}.',
    'certainty.reason.progress': 'Зробіть це зараз, бо це просуває «{target}».',

    'certainty.outcome.unlock': 'Це відкриє «{target}».',
    'certainty.outcome.openPath': 'Це відкриє шлях до «{target}».',
    'certainty.outcome.unlockGuide': 'Це відкриє «{target}».',
    'certainty.outcome.openPathGuide': 'Це відкриє шлях до «{target}».',

    'certainty.progress.partial': 'Уже виконано {completed} з {total} кроків.',
    'certainty.progress.noneCompleted': 'У вашому плані {total} кроків.',
    'certainty.progress.ariaLabel': 'Виконано {completed} з {total} кроків',
  },
};

export const CERTAINTY_I18N_KEYS = Object.keys(CERTAINTY_I18N.en);
