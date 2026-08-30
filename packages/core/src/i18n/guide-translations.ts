import type { SupportedLanguage } from '@arrival-atlas/ui-contract';

type Translations = Record<string, string>;

/**
 * Phase 2A — Journey Guide chrome (welcome, speech, cinematic templates, mission labels).
 * Certainty-authored speech remains Phase 2B.
 */
export const GUIDE_I18N: Record<SupportedLanguage, Translations> = {
  en: {
    'guide.welcome.title': 'Welcome to Arrival Atlas.',
    'guide.welcome.lead': "Let's build your journey together.",
    'guide.welcome.startGuided': 'Start Guided Journey',
    'guide.welcome.exploreAlone': 'Explore On My Own',

    'guide.fabLabel': 'Journey Guide',
    'guide.dismissAria': 'Dismiss guide',
    'guide.recommendedNextStep': 'Recommended next step',
    'guide.destinationLocked': 'Destination locked',
    'guide.requiredSteps': 'Required steps',
    'guide.takeMeThere': 'Take Me There',
    'guide.completingUnlocks': 'Completing this unlocks',
    'guide.previewRoute': 'Preview route',
    'guide.replayDiscovery': 'Replay discovery',
    'guide.resumeGuided': 'Resume guided journey',
    'guide.emptyHelp':
      'Need help finding your next step? Select any available planet to continue your journey.',
    'guide.lockedNotAccessibleRest': ' is not yet accessible.',

    'guide.reason.recommended': 'This is the most actionable step on your current route.',
    'guide.reason.blocked': 'Resolving this blocker clears the path ahead.',
    'guide.reason.default': 'This node opens nearby progression.',

    'guide.unlock.progressTitle': 'Progress recorded',
    'guide.unlock.progressBody': 'Your route has been updated.',
    'guide.unlock.newRouteTitle': 'A new route has become available',
    'guide.unlock.newRouteBody': 'Completing {source} unlocked your access to {target}.',
    'guide.unlock.newRoutesTitle': 'New routes discovered',
    'guide.unlock.newRoutesBodyTwo': 'Completing {source} unlocked {a} and {b}.',
    'guide.unlock.newRoutesBodyMany': 'Completing {source} unlocked {list}, and {last}.',
    'guide.unlock.destinationsAvailable': '{count} new destinations available',
    'guide.unlock.overlayOne': 'New route discovered',
    'guide.unlock.overlayMany': '{count} new destinations available',

    'guide.mission.moveToGermany': 'Establish Your Arrival Base',
    'guide.mission.whereYouLive': 'Set Your Home Base',
    'guide.mission.householdFamily': 'Map Your Household Constellation',
    'guide.mission.workIncome': 'Configure Work & Income Systems',
    'guide.mission.healthInsurance': 'Align Health Coverage',
    'guide.mission.benefitsSupport': 'Open Benefits Channels',
    'guide.mission.languageDisplay': 'Configure Communication Systems',
    'guide.mission.journey': 'Chart Your Journey',
  },
  de: {
    'guide.welcome.title': 'Willkommen bei Arrival Atlas.',
    'guide.welcome.lead': 'Lassen Sie uns Ihre Reise gemeinsam aufbauen.',
    'guide.welcome.startGuided': 'Geführte Reise starten',
    'guide.welcome.exploreAlone': 'Selbst erkunden',

    'guide.fabLabel': 'Reisebegleiter',
    'guide.dismissAria': 'Begleiter schließen',
    'guide.recommendedNextStep': 'Empfohlener nächster Schritt',
    'guide.destinationLocked': 'Ziel noch gesperrt',
    'guide.requiredSteps': 'Erforderliche Schritte',
    'guide.takeMeThere': 'Dorthin führen',
    'guide.completingUnlocks': 'Damit öffnen sich',
    'guide.previewRoute': 'Route ansehen',
    'guide.replayDiscovery': 'Entdeckung wiederholen',
    'guide.resumeGuided': 'Geführte Reise fortsetzen',
    'guide.emptyHelp':
      'Brauchen Sie Hilfe für den nächsten Schritt? Wählen Sie einen verfügbaren Planeten, um fortzufahren.',
    'guide.lockedNotAccessibleRest': ' ist noch nicht zugänglich.',

    'guide.reason.recommended': 'Das ist der sinnvollste Schritt auf Ihrer aktuellen Route.',
    'guide.reason.blocked': 'Wenn Sie diese Blockade lösen, öffnet sich der Weg weiter.',
    'guide.reason.default': 'Dieser Knoten öffnet nahe Fortschritte.',

    'guide.unlock.progressTitle': 'Fortschritt gespeichert',
    'guide.unlock.progressBody': 'Ihre Route wurde aktualisiert.',
    'guide.unlock.newRouteTitle': 'Eine neue Route ist verfügbar',
    'guide.unlock.newRouteBody': 'Mit dem Abschluss von {source} haben Sie Zugang zu {target} erhalten.',
    'guide.unlock.newRoutesTitle': 'Neue Routen entdeckt',
    'guide.unlock.newRoutesBodyTwo': 'Mit dem Abschluss von {source} wurden {a} und {b} freigeschaltet.',
    'guide.unlock.newRoutesBodyMany':
      'Mit dem Abschluss von {source} wurden {list} und {last} freigeschaltet.',
    'guide.unlock.destinationsAvailable': '{count} neue Ziele verfügbar',
    'guide.unlock.overlayOne': 'Neue Route entdeckt',
    'guide.unlock.overlayMany': '{count} neue Ziele verfügbar',

    'guide.mission.moveToGermany': 'Ihre Ankunftsbasis aufbauen',
    'guide.mission.whereYouLive': 'Ihren Wohnort festlegen',
    'guide.mission.householdFamily': 'Ihre Haushaltskonstellation erfassen',
    'guide.mission.workIncome': 'Arbeit und Einkommen einrichten',
    'guide.mission.healthInsurance': 'Krankenversicherung ausrichten',
    'guide.mission.benefitsSupport': 'Leistungskanäle öffnen',
    'guide.mission.languageDisplay': 'Kommunikationssysteme einrichten',
    'guide.mission.journey': 'Ihre Reise planen',
  },
  ru: {
    'guide.welcome.title': 'Добро пожаловать в Arrival Atlas.',
    'guide.welcome.lead': 'Давайте вместе построим ваш путь.',
    'guide.welcome.startGuided': 'Начать сопровождаемый путь',
    'guide.welcome.exploreAlone': 'Исследовать самостоятельно',

    'guide.fabLabel': 'Путеводитель',
    'guide.dismissAria': 'Закрыть путеводитель',
    'guide.recommendedNextStep': 'Рекомендуемый следующий шаг',
    'guide.destinationLocked': 'Цель пока недоступна',
    'guide.requiredSteps': 'Необходимые шаги',
    'guide.takeMeThere': 'Провести туда',
    'guide.completingUnlocks': 'Это откроет доступ к',
    'guide.previewRoute': 'Показать маршрут',
    'guide.replayDiscovery': 'Повторить открытие',
    'guide.resumeGuided': 'Вернуться к сопровождению',
    'guide.emptyHelp':
      'Нужна помощь с следующим шагом? Выберите доступную планету, чтобы продолжить путь.',
    'guide.lockedNotAccessibleRest': ' пока недоступно.',

    'guide.reason.recommended': 'Это самый практичный шаг на вашем текущем маршруте.',
    'guide.reason.blocked': 'Если устранить это препятствие, путь впереди откроется.',
    'guide.reason.default': 'Этот узел открывает ближайшие шаги.',

    'guide.unlock.progressTitle': 'Прогресс сохранён',
    'guide.unlock.progressBody': 'Ваш маршрут обновлён.',
    'guide.unlock.newRouteTitle': 'Доступен новый маршрут',
    'guide.unlock.newRouteBody': 'Завершение «{source}» открыло доступ к «{target}».',
    'guide.unlock.newRoutesTitle': 'Открыты новые маршруты',
    'guide.unlock.newRoutesBodyTwo': 'Завершение «{source}» открыло «{a}» и «{b}».',
    'guide.unlock.newRoutesBodyMany': 'Завершение «{source}» открыло {list} и «{last}».',
    'guide.unlock.destinationsAvailable': 'Доступно новых целей: {count}',
    'guide.unlock.overlayOne': 'Открыт новый маршрут',
    'guide.unlock.overlayMany': 'Доступно новых целей: {count}',

    'guide.mission.moveToGermany': 'Создать базу прибытия',
    'guide.mission.whereYouLive': 'Задать место проживания',
    'guide.mission.householdFamily': 'Описать состав семьи',
    'guide.mission.workIncome': 'Настроить работу и доход',
    'guide.mission.healthInsurance': 'Выровнять медицинское страхование',
    'guide.mission.benefitsSupport': 'Открыть каналы пособий',
    'guide.mission.languageDisplay': 'Настроить системы общения',
    'guide.mission.journey': 'Построить ваш путь',
  },
  ua: {
    'guide.welcome.title': 'Ласкаво просимо до Arrival Atlas.',
    'guide.welcome.lead': 'Давайте разом побудуємо ваш шлях.',
    'guide.welcome.startGuided': 'Почати супроводжуваний шлях',
    'guide.welcome.exploreAlone': 'Досліджувати самостійно',

    'guide.fabLabel': 'Провідник',
    'guide.dismissAria': 'Закрити провідник',
    'guide.recommendedNextStep': 'Рекомендований наступний крок',
    'guide.destinationLocked': 'Ціль поки недоступна',
    'guide.requiredSteps': 'Необхідні кроки',
    'guide.takeMeThere': 'Провести туди',
    'guide.completingUnlocks': 'Це відкриє доступ до',
    'guide.previewRoute': 'Показати маршрут',
    'guide.replayDiscovery': 'Повторити відкриття',
    'guide.resumeGuided': 'Повернутися до супроводу',
    'guide.emptyHelp':
      'Потрібна допомога з наступним кроком? Оберіть доступну планету, щоб продовжити шлях.',
    'guide.lockedNotAccessibleRest': ' поки недоступне.',

    'guide.reason.recommended': 'Це найпрактичніший крок на вашому поточному маршруті.',
    'guide.reason.blocked': 'Якщо прибрати цю перешкоду, шлях попереду відкриється.',
    'guide.reason.default': 'Цей вузол відкриває найближчі кроки.',

    'guide.unlock.progressTitle': 'Прогрес збережено',
    'guide.unlock.progressBody': 'Ваш маршрут оновлено.',
    'guide.unlock.newRouteTitle': 'Доступний новий маршрут',
    'guide.unlock.newRouteBody': 'Завершення «{source}» відкрило доступ до «{target}».',
    'guide.unlock.newRoutesTitle': 'Відкрито нові маршрути',
    'guide.unlock.newRoutesBodyTwo': 'Завершення «{source}» відкрило «{a}» і «{b}».',
    'guide.unlock.newRoutesBodyMany': 'Завершення «{source}» відкрило {list} і «{last}».',
    'guide.unlock.destinationsAvailable': 'Доступно нових цілей: {count}',
    'guide.unlock.overlayOne': 'Відкрито новий маршрут',
    'guide.unlock.overlayMany': 'Доступно нових цілей: {count}',

    'guide.mission.moveToGermany': 'Створити базу прибуття',
    'guide.mission.whereYouLive': 'Задати місце проживання',
    'guide.mission.householdFamily': 'Описати склад сімʼї',
    'guide.mission.workIncome': 'Налаштувати роботу й дохід',
    'guide.mission.healthInsurance': 'Узгодити медичне страхування',
    'guide.mission.benefitsSupport': 'Відкрити канали допомоги',
    'guide.mission.languageDisplay': 'Налаштувати системи спілкування',
    'guide.mission.journey': 'Побудувати ваш шлях',
  },
};

export const GUIDE_I18N_KEYS = Object.keys(GUIDE_I18N.en);
