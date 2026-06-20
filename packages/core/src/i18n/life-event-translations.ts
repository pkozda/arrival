import type { SupportedLanguage } from '@arrival-atlas/ui-contract';

type TranslationMap = Record<string, string>;

const EN: TranslationMap = {
  'life-event.state.arrival_unregistered': 'New arrival',
  'life-event.state.arrival_stabilizing': 'Arrival stabilizing',
  'life-event.state.economic_setup_pending': 'Economic setup pending',
  'life-event.state.housing_instability': 'Housing instability',
  'life-event.state.insurance_gap': 'Insurance gap',
  'life-event.state.benefits_exploration': 'Benefits exploration',
  'life-event.state.situation_stable': 'Situation stable',

  'life-event.severity.critical': 'Critical',
  'life-event.severity.high': 'High',
  'life-event.severity.medium': 'Medium',
  'life-event.severity.low': 'Low',

  'life-event.home.title': 'Your next steps in Germany',
  'life-event.home.viewFullPlan': 'View full plan',
  'life-event.home.blockedTitle': 'Why you cannot proceed yet',
  'life-event.home.secondaryTitle': 'Next best actions',

  'life-event.plan.currentSituation': 'Your current situation',
  'life-event.plan.recommendedFocus': 'Recommended focus',
  'life-event.plan.planConfidence': 'Plan confidence',
  'life-event.plan.whyThisNow': 'Why this now',
  'life-event.plan.whatIsBlocking': 'What is blocking you',
  'life-event.plan.blockedActions': 'Blocked actions',
  'life-event.plan.whyProgressConstrained': 'Why progress is constrained',
  'life-event.plan.nextActions': 'Next actions',
  'life-event.plan.confidence.high': 'High confidence',
  'life-event.plan.confidence.medium': 'Moderate confidence',
  'life-event.plan.confidence.low': 'Lower confidence',
  'life-event.plan.confidence.none': 'No confidence rating',

  'life-event.timeline.title': 'Timeline',
  'life-event.timeline.upcomingSteps': 'Upcoming steps',

  'life-event.scenario.contextShiftTitle': 'Context shift detected',
  'life-event.scenario.situationChanging': 'Your situation may be changing',

  'life-event.empty.noBlockers': 'No active blockers',
  'life-event.empty.noUpcomingActions': 'No upcoming actions',
  'life-event.empty.noPlan': 'No plan available',
  'life-event.empty.loadingPlan': 'Loading your plan...',
  'life-event.empty.loadingModule': 'Loading module...',
  'life-event.empty.moduleNotFound': 'Module not found.',

  'life-event.node.blocked': 'Blocked',

  'life-event.runtime.crossModuleImpact': 'Cross-module impact detected',
  'life-event.runtime.additionalSignals': 'additional runtime signals',
  'life-event.runtime.additionalSignal': 'additional runtime signal',
};

const DE: TranslationMap = {
  'life-event.state.arrival_unregistered': 'Neu angekommen',
  'life-event.state.arrival_stabilizing': 'Ankunft stabilisieren',
  'life-event.state.economic_setup_pending': 'Wirtschaftliche Einrichtung ausstehend',
  'life-event.state.housing_instability': 'Wohnungsunsicherheit',
  'life-event.state.insurance_gap': 'Versicherungslücke',
  'life-event.state.benefits_exploration': 'Leistungen prüfen',
  'life-event.state.situation_stable': 'Situation stabil',

  'life-event.severity.critical': 'Kritisch',
  'life-event.severity.high': 'Hoch',
  'life-event.severity.medium': 'Mittel',
  'life-event.severity.low': 'Niedrig',

  'life-event.home.title': 'Ihre nächsten Schritte in Deutschland',
  'life-event.home.viewFullPlan': 'Gesamten Plan ansehen',
  'life-event.home.blockedTitle': 'Warum Sie noch nicht fortfahren können',
  'life-event.home.secondaryTitle': 'Nächste sinnvolle Schritte',

  'life-event.plan.currentSituation': 'Ihre aktuelle Situation',
  'life-event.plan.recommendedFocus': 'Empfohlener Fokus',
  'life-event.plan.planConfidence': 'Plan-Vertrauen',
  'life-event.plan.whyThisNow': 'Warum jetzt',
  'life-event.plan.whatIsBlocking': 'Was Sie blockiert',
  'life-event.plan.blockedActions': 'Blockierte Schritte',
  'life-event.plan.whyProgressConstrained': 'Warum der Fortschritt eingeschränkt ist',
  'life-event.plan.nextActions': 'Nächste Schritte',
  'life-event.plan.confidence.high': 'Hohes Vertrauen',
  'life-event.plan.confidence.medium': 'Mittleres Vertrauen',
  'life-event.plan.confidence.low': 'Geringeres Vertrauen',
  'life-event.plan.confidence.none': 'Keine Vertrauensbewertung',

  'life-event.timeline.title': 'Zeitplan',
  'life-event.timeline.upcomingSteps': 'Bevorstehende Schritte',

  'life-event.scenario.contextShiftTitle': 'Kontextwechsel erkannt',
  'life-event.scenario.situationChanging': 'Ihre Situation könnte sich ändern',

  'life-event.empty.noBlockers': 'Keine aktiven Blocker',
  'life-event.empty.noUpcomingActions': 'Keine bevorstehenden Schritte',
  'life-event.empty.noPlan': 'Kein Plan verfügbar',
  'life-event.empty.loadingPlan': 'Plan wird geladen...',
  'life-event.empty.loadingModule': 'Modul wird geladen...',
  'life-event.empty.moduleNotFound': 'Modul nicht gefunden.',

  'life-event.node.blocked': 'Blockiert',

  'life-event.runtime.crossModuleImpact': 'Modulübergreifende Auswirkung erkannt',
  'life-event.runtime.additionalSignals': 'weitere Laufzeitsignale',
  'life-event.runtime.additionalSignal': 'weiteres Laufzeitsignal',
};

const RU: TranslationMap = {
  'life-event.state.arrival_unregistered': 'Новое прибытие',
  'life-event.state.arrival_stabilizing': 'Стабилизация после прибытия',
  'life-event.state.economic_setup_pending': 'Ожидает экономическое оформление',
  'life-event.state.housing_instability': 'Нестабильность жилья',
  'life-event.state.insurance_gap': 'Пробел в страховке',
  'life-event.state.benefits_exploration': 'Изучение пособий',
  'life-event.state.situation_stable': 'Стабильная ситуация',

  'life-event.severity.critical': 'Критический',
  'life-event.severity.high': 'Высокий',
  'life-event.severity.medium': 'Средний',
  'life-event.severity.low': 'Низкий',

  'life-event.home.title': 'Ваши следующие шаги в Германии',
  'life-event.home.viewFullPlan': 'Открыть полный план',
  'life-event.home.blockedTitle': 'Почему пока нельзя продолжить',
  'life-event.home.secondaryTitle': 'Следующие лучшие действия',

  'life-event.plan.currentSituation': 'Ваша текущая ситуация',
  'life-event.plan.recommendedFocus': 'Рекомендуемый фокус',
  'life-event.plan.planConfidence': 'Уверенность плана',
  'life-event.plan.whyThisNow': 'Почему сейчас',
  'life-event.plan.whatIsBlocking': 'Что вас блокирует',
  'life-event.plan.blockedActions': 'Заблокированные шаги',
  'life-event.plan.whyProgressConstrained': 'Почему прогресс ограничен',
  'life-event.plan.nextActions': 'Следующие шаги',
  'life-event.plan.confidence.high': 'Высокая уверенность',
  'life-event.plan.confidence.medium': 'Умеренная уверенность',
  'life-event.plan.confidence.low': 'Низкая уверенность',
  'life-event.plan.confidence.none': 'Нет оценки уверенности',

  'life-event.timeline.title': 'График',
  'life-event.timeline.upcomingSteps': 'Предстоящие шаги',

  'life-event.scenario.contextShiftTitle': 'Обнаружен сдвиг контекста',
  'life-event.scenario.situationChanging': 'Ваша ситуация может меняться',

  'life-event.empty.noBlockers': 'Нет активных блокеров',
  'life-event.empty.noUpcomingActions': 'Нет предстоящих действий',
  'life-event.empty.noPlan': 'План недоступен',
  'life-event.empty.loadingPlan': 'Загрузка плана...',
  'life-event.empty.loadingModule': 'Загрузка модуля...',
  'life-event.empty.moduleNotFound': 'Модуль не найден.',

  'life-event.node.blocked': 'Заблокировано',

  'life-event.runtime.crossModuleImpact': 'Обнаружено межмодульное влияние',
  'life-event.runtime.additionalSignals': 'дополнительных сигналов среды',
  'life-event.runtime.additionalSignal': 'дополнительный сигнал среды',
};

const UA: TranslationMap = {
  'life-event.state.arrival_unregistered': 'Нове прибуття',
  'life-event.state.arrival_stabilizing': 'Стабілізація після прибуття',
  'life-event.state.economic_setup_pending': 'Очікує економічне оформлення',
  'life-event.state.housing_instability': 'Нестабільність житла',
  'life-event.state.insurance_gap': 'Прогалина в страхуванні',
  'life-event.state.benefits_exploration': 'Вивчення допомоги',
  'life-event.state.situation_stable': 'Стабільна ситуація',

  'life-event.severity.critical': 'Критичний',
  'life-event.severity.high': 'Високий',
  'life-event.severity.medium': 'Середній',
  'life-event.severity.low': 'Низький',

  'life-event.home.title': 'Ваші наступні кроки в Німеччині',
  'life-event.home.viewFullPlan': 'Переглянути повний план',
  'life-event.home.blockedTitle': 'Чому поки не можна продовжити',
  'life-event.home.secondaryTitle': 'Наступні найкращі дії',

  'life-event.plan.currentSituation': 'Ваша поточна ситуація',
  'life-event.plan.recommendedFocus': 'Рекомендований фокус',
  'life-event.plan.planConfidence': 'Впевненість плану',
  'life-event.plan.whyThisNow': 'Чому зараз',
  'life-event.plan.whatIsBlocking': 'Що вас блокує',
  'life-event.plan.blockedActions': 'Заблоковані кроки',
  'life-event.plan.whyProgressConstrained': 'Чому прогрес обмежений',
  'life-event.plan.nextActions': 'Наступні кроки',
  'life-event.plan.confidence.high': 'Висока впевненість',
  'life-event.plan.confidence.medium': 'Помірна впевненість',
  'life-event.plan.confidence.low': 'Нижча впевненість',
  'life-event.plan.confidence.none': 'Немає оцінки впевненості',

  'life-event.timeline.title': 'Графік',
  'life-event.timeline.upcomingSteps': 'Майбутні кроки',

  'life-event.scenario.contextShiftTitle': 'Виявлено зміну контексту',
  'life-event.scenario.situationChanging': 'Ваша ситуація може змінюватися',

  'life-event.empty.noBlockers': 'Немає активних блокерів',
  'life-event.empty.noUpcomingActions': 'Немає майбутніх дій',
  'life-event.empty.noPlan': 'План недоступний',
  'life-event.empty.loadingPlan': 'Завантаження плану...',
  'life-event.empty.loadingModule': 'Завантаження модуля...',
  'life-event.empty.moduleNotFound': 'Модуль не знайдено.',

  'life-event.node.blocked': 'Заблоковано',

  'life-event.runtime.crossModuleImpact': 'Виявлено міжмодульний вплив',
  'life-event.runtime.additionalSignals': 'додаткових сигналів середовища',
  'life-event.runtime.additionalSignal': 'додатковий сигнал середовища',
};

export const LIFE_EVENT_I18N: Record<SupportedLanguage, TranslationMap> = {
  en: EN,
  de: DE,
  ru: RU,
  ua: UA,
};

export const LIFE_EVENT_I18N_KEYS = Object.keys(EN);
