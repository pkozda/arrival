import type { SupportedLanguage } from '@arrival-atlas/ui-contract';

type Translations = Record<string, string>;

/**
 * Phase 1 shell / home chrome: Guest Home, Atlas HUD, Leave Demo, onboarding checklist.
 * Merged into platform dictionaries via `packages/core/src/i18n/index.ts`.
 */
export const SHELL_HOME_I18N: Record<SupportedLanguage, Translations> = {
  en: {
    'common.close': 'Close',
    'common.dismiss': 'Dismiss',
    'common.cancel': 'Cancel',
    'common.continue': 'Continue',

    'nav.exploreAtlas': 'Explore Atlas',
    'nav.economicReality': 'Economic Reality',
    'nav.profile': 'Profile',
    'nav.enterAtlas': 'Enter Atlas',
    'nav.leaveDemo': 'Leave demo',
    'nav.primary': 'Primary',
    'nav.enterAtlasAria': 'Enter Atlas demo',
    'nav.leaveDemoAria': 'Leave Atlas demo and start over',

    'home.guest.eyebrow': 'Personal Life Navigation',
    'home.guest.headline': 'Your new life.',
    'home.guest.headlineAccent': 'Mapped.',
    'home.guest.supporting':
      'Arrival Atlas is your interactive guide through everything you need to build a stable life in a new country.',
    'home.guest.enterAtlas': 'Enter Atlas',
    'home.guest.secondary': "See what's next in 7 days",

    'home.leaveDemo.title': 'Leave demo and start over?',
    'home.leaveDemo.message':
      'Your demo profile, journey progress, and local settings on this device will be cleared. You will return to the Atlas preview.',
    'home.leaveDemo.confirm': 'Start over',
    'home.leaveDemo.resetting': 'Resetting…',
    'home.leaveDemo.cancel': 'Keep exploring',
    'home.leaveDemo.error': 'Could not reset demo',

    'home.onboarding.title': 'Getting oriented in Germany',
    'home.onboarding.progress': '{completed} of {total} steps complete',
    'home.onboarding.dismiss': 'Dismiss',
    'home.onboarding.step.language': 'Choose your language',
    'home.onboarding.step.firstTool': 'Try your first tool',
    'home.onboarding.step.location': 'Add where you live',
    'home.onboarding.step.insurance': 'Explore insurance guidance',
    'home.onboarding.step.reviewSituation': 'Review your situation',
  },
  de: {
    'common.close': 'Schließen',
    'common.dismiss': 'Ausblenden',
    'common.cancel': 'Abbrechen',
    'common.continue': 'Weiter',

    'nav.exploreAtlas': 'Atlas erkunden',
    'nav.economicReality': 'Wirtschaftliche Realität',
    'nav.profile': 'Profil',
    'nav.enterAtlas': 'Atlas betreten',
    'nav.leaveDemo': 'Demo verlassen',
    'nav.primary': 'Hauptnavigation',
    'nav.enterAtlasAria': 'Atlas-Demo betreten',
    'nav.leaveDemoAria': 'Atlas-Demo verlassen und neu starten',

    'home.guest.eyebrow': 'Persönliche Lebensnavigation',
    'home.guest.headline': 'Ihr neues Leben.',
    'home.guest.headlineAccent': 'Kartiert.',
    'home.guest.supporting':
      'Arrival Atlas ist Ihr interaktiver Begleiter für alles, was Sie brauchen, um in einem neuen Land ein stabiles Leben aufzubauen.',
    'home.guest.enterAtlas': 'Atlas betreten',
    'home.guest.secondary': 'Was in 7 Tagen als Nächstes ansteht',

    'home.leaveDemo.title': 'Demo verlassen und neu starten?',
    'home.leaveDemo.message':
      'Ihr Demo-Profil, der Fortschritt Ihrer Reise und lokale Einstellungen auf diesem Gerät werden gelöscht. Sie kehren zur Atlas-Vorschau zurück.',
    'home.leaveDemo.confirm': 'Neu starten',
    'home.leaveDemo.resetting': 'Wird zurückgesetzt…',
    'home.leaveDemo.cancel': 'Weiter erkunden',
    'home.leaveDemo.error': 'Demo konnte nicht zurückgesetzt werden',

    'home.onboarding.title': 'Orientierung in Deutschland',
    'home.onboarding.progress': '{completed} von {total} Schritten erledigt',
    'home.onboarding.dismiss': 'Ausblenden',
    'home.onboarding.step.language': 'Sprache wählen',
    'home.onboarding.step.firstTool': 'Erstes Tool ausprobieren',
    'home.onboarding.step.location': 'Wohnort hinzufügen',
    'home.onboarding.step.insurance': 'Versicherung orientieren',
    'home.onboarding.step.reviewSituation': 'Situation prüfen',
  },
  ru: {
    'common.close': 'Закрыть',
    'common.dismiss': 'Скрыть',
    'common.cancel': 'Отмена',
    'common.continue': 'Продолжить',

    'nav.exploreAtlas': 'Исследовать Atlas',
    'nav.economicReality': 'Экономическая реальность',
    'nav.profile': 'Профиль',
    'nav.enterAtlas': 'Войти в Atlas',
    'nav.leaveDemo': 'Выйти из демо',
    'nav.primary': 'Основная навигация',
    'nav.enterAtlasAria': 'Войти в демо Atlas',
    'nav.leaveDemoAria': 'Выйти из демо Atlas и начать заново',

    'home.guest.eyebrow': 'Личная навигация по жизни',
    'home.guest.headline': 'Ваша новая жизнь.',
    'home.guest.headlineAccent': 'На карте.',
    'home.guest.supporting':
      'Arrival Atlas — ваш интерактивный проводник по всему, что нужно, чтобы построить стабильную жизнь в новой стране.',
    'home.guest.enterAtlas': 'Войти в Atlas',
    'home.guest.secondary': 'Что дальше в ближайшие 7 дней',

    'home.leaveDemo.title': 'Выйти из демо и начать заново?',
    'home.leaveDemo.message':
      'Ваш демо-профиль, прогресс пути и локальные настройки на этом устройстве будут удалены. Вы вернётесь к предварительному просмотру Atlas.',
    'home.leaveDemo.confirm': 'Начать заново',
    'home.leaveDemo.resetting': 'Сброс…',
    'home.leaveDemo.cancel': 'Продолжить знакомство',
    'home.leaveDemo.error': 'Не удалось сбросить демо',

    'home.onboarding.title': 'Ориентация в Германии',
    'home.onboarding.progress': '{completed} из {total} шагов выполнено',
    'home.onboarding.dismiss': 'Скрыть',
    'home.onboarding.step.language': 'Выберите язык',
    'home.onboarding.step.firstTool': 'Попробуйте первый инструмент',
    'home.onboarding.step.location': 'Укажите, где вы живёте',
    'home.onboarding.step.insurance': 'Изучите ориентиры по страховке',
    'home.onboarding.step.reviewSituation': 'Проверьте свою ситуацию',
  },
  ua: {
    'common.close': 'Закрити',
    'common.dismiss': 'Сховати',
    'common.cancel': 'Скасувати',
    'common.continue': 'Продовжити',

    'nav.exploreAtlas': 'Досліджувати Atlas',
    'nav.economicReality': 'Економічна реальність',
    'nav.profile': 'Профіль',
    'nav.enterAtlas': 'Увійти в Atlas',
    'nav.leaveDemo': 'Вийти з демо',
    'nav.primary': 'Основна навігація',
    'nav.enterAtlasAria': 'Увійти в демо Atlas',
    'nav.leaveDemoAria': 'Вийти з демо Atlas і почати спочатку',

    'home.guest.eyebrow': 'Особиста навігація життям',
    'home.guest.headline': 'Ваше нове життя.',
    'home.guest.headlineAccent': 'На карті.',
    'home.guest.supporting':
      'Arrival Atlas — ваш інтерактивний гід у всьому, що потрібно, щоб побудувати стабільне життя в новій країні.',
    'home.guest.enterAtlas': 'Увійти в Atlas',
    'home.guest.secondary': 'Що далі протягом 7 днів',

    'home.leaveDemo.title': 'Вийти з демо і почати спочатку?',
    'home.leaveDemo.message':
      'Ваш демо-профіль, прогрес шляху та локальні налаштування на цьому пристрої буде видалено. Ви повернетесь до попереднього перегляду Atlas.',
    'home.leaveDemo.confirm': 'Почати спочатку',
    'home.leaveDemo.resetting': 'Скидання…',
    'home.leaveDemo.cancel': 'Продовжити знайомство',
    'home.leaveDemo.error': 'Не вдалося скинути демо',

    'home.onboarding.title': 'Орієнтація в Німеччині',
    'home.onboarding.progress': '{completed} з {total} кроків виконано',
    'home.onboarding.dismiss': 'Сховати',
    'home.onboarding.step.language': 'Оберіть мову',
    'home.onboarding.step.firstTool': 'Спробуйте перший інструмент',
    'home.onboarding.step.location': 'Додайте, де ви живете',
    'home.onboarding.step.insurance': 'Ознайомтеся з орієнтирами щодо страхування',
    'home.onboarding.step.reviewSituation': 'Перегляньте свою ситуацію',
  },
};

export const SHELL_HOME_I18N_KEYS = Object.keys(SHELL_HOME_I18N.en);
