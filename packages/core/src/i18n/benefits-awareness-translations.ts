/**
 * Benefits awareness copy (E4 Wohngeld + E5 Kindergeld).
 * Conservative language — no official eligibility claims.
 */
import type { SupportedLanguage } from '@arrival-atlas/ui-contract';

type Translations = Record<string, string>;

const EN: Translations = {
  'benefits.awareness.title': 'Benefits awareness',
  'benefits.awareness.subtitle':
    'Based on what Atlas currently knows about your situation — not an official decision',
  'benefits.awareness.disclaimer':
    'This is not an official eligibility decision. Atlas only highlights a possible next check using known facts.',
  'benefits.awareness.stateLabel': 'Current state',
  'benefits.awareness.missing': 'What is missing',
  'benefits.awareness.next': 'What you can do next',
  'benefits.awareness.state.NOT_ENOUGH_INFORMATION': 'Not enough information',
  'benefits.awareness.state.POTENTIALLY_RELEVANT': 'Potentially relevant',
  'benefits.awareness.state.NOT_APPLICABLE': 'Not applicable with known facts',
  'benefits.awareness.state.READY_TO_ACT': 'Ready for a next check',
  'benefits.awareness.state.COMPLETED': 'Already marked as receiving this benefit',
  'benefits.awareness.wohngeld.title': 'Wohngeld (housing benefit)',
  'benefits.awareness.wohngeld.notEnoughInformation':
    'Wohngeld (housing benefit) may be relevant later, but Atlas still needs housing rent and/or income facts.',
  'benefits.awareness.wohngeld.potentiallyRelevant':
    'Based on known rent and income facts, Wohngeld appears potentially relevant to check — not a guarantee.',
  'benefits.awareness.wohngeld.readyToAct':
    'Based on known rent and income facts, a Wohngeld check appears applicable. Confirm with the official source.',
  'benefits.awareness.wohngeld.notApplicable':
    'With the facts Atlas currently knows, Wohngeld does not appear applicable under the current heuristic. Update your profile if something changed.',
  'benefits.awareness.wohngeld.completed':
    'Your profile already records that you receive Wohngeld. Update benefits support if this is no longer accurate.',
  'benefits.awareness.wohngeld.unavailable': 'Wohngeld awareness is temporarily unavailable.',
  'benefits.awareness.kindergeld.title': 'Kindergeld (child benefit)',
  'benefits.awareness.kindergeld.notEnoughInformation':
    'Kindergeld may be relevant if you have dependent children, but Atlas needs an explicit child/family fact — household size alone is not enough.',
  'benefits.awareness.kindergeld.readyToAct':
    'Based on explicit child facts in your profile, Kindergeld may be relevant to check. Confirm with the official source — this is not an eligibility decision.',
  'benefits.awareness.kindergeld.notApplicable':
    'With the child/family facts Atlas currently knows, Kindergeld does not appear applicable. Update household details if something changed.',
  'benefits.awareness.kindergeld.completed':
    'Your profile records that you currently receive Kindergeld. This is your confirmed fact — Atlas has not verified it with an authority. Update benefits support if this is no longer accurate.',
  'benefits.awareness.kindergeld.unavailable': 'Kindergeld awareness is temporarily unavailable.',
  'benefits.awareness.missing.housingRent': 'Monthly rent (rented housing)',
  'benefits.awareness.missing.income': 'Gross monthly income',
  'benefits.awareness.missing.children': 'Explicit dependent children (not household size)',
  'benefits.awareness.missing.generic': 'Additional profile facts',
  'benefits.awareness.action.updateHousing': 'Update housing details',
  'benefits.awareness.action.updateIncome': 'Update work and income',
  'benefits.awareness.action.updateHousehold': 'Update household and family details',
  'benefits.awareness.action.openOfficial': 'Open official Wohngeld information',
  'benefits.awareness.action.openOfficialKindergeld': 'Open official Kindergeld information',
  'benefits.awareness.action.reviewBenefits': 'Review benefits support details',
  'benefits.awareness.action.none': 'No action available',
  'benefits.awareness.action.recordReceiving': 'Record Wohngeld in your profile',
  'benefits.awareness.action.recordReceivingKindergeld': 'Record Kindergeld in your profile',
  'benefits.awareness.recalculated': 'Benefits awareness updated from your latest profile facts.',
  'benefits.awareness.aggregate.oneActionable':
    'One benefit check is ready based on what Atlas currently knows.',
  'benefits.awareness.aggregate.multipleActionable':
    'More than one benefit check is ready. Cards below are ordered by what you can do next — not by legal priority or amount.',
  'benefits.awareness.aggregate.needInformation':
    'Atlas still needs profile facts before a benefit check can be suggested. Update the details listed below.',
  'benefits.awareness.aggregate.allCompleted':
    'All listed benefits are marked as receiving in your profile. Nothing else is currently actionable here.',
  'benefits.awareness.aggregate.noneActionable':
    'No benefit check is currently actionable with the facts Atlas knows.',
  'benefits.awareness.aggregate.primaryNext': 'Suggested next focus',
  'benefits.awareness.aggregate.completedMarker': 'recorded in profile',
};

const DE: Translations = {
  'benefits.awareness.title': 'Hinweis zu Leistungen',
  'benefits.awareness.subtitle':
    'Basierend auf dem, was Atlas derzeit über Ihre Situation weiß — keine offizielle Entscheidung',
  'benefits.awareness.disclaimer':
    'Dies ist keine offizielle Anspruchsentscheidung. Atlas zeigt nur einen möglichen nächsten Prüfpunkt anhand bekannter Fakten.',
  'benefits.awareness.stateLabel': 'Aktueller Stand',
  'benefits.awareness.missing': 'Was fehlt',
  'benefits.awareness.next': 'Was Sie als Nächstes tun können',
  'benefits.awareness.state.NOT_ENOUGH_INFORMATION': 'Nicht genug Informationen',
  'benefits.awareness.state.POTENTIALLY_RELEVANT': 'Möglicherweise relevant',
  'benefits.awareness.state.NOT_APPLICABLE': 'Mit bekannten Fakten nicht zutreffend',
  'benefits.awareness.state.READY_TO_ACT': 'Bereit für den nächsten Schritt',
  'benefits.awareness.state.COMPLETED': 'Bereits als Bezug dieser Leistung markiert',
  'benefits.awareness.wohngeld.title': 'Wohngeld',
  'benefits.awareness.wohngeld.notEnoughInformation':
    'Wohngeld kann später relevant sein, aber Atlas benötigt noch Miete und/oder Einkommensangaben.',
  'benefits.awareness.wohngeld.potentiallyRelevant':
    'Anhand bekannter Miete- und Einkommenswerte erscheint Wohngeld prüfenswert — keine Garantie.',
  'benefits.awareness.wohngeld.readyToAct':
    'Anhand bekannter Miete- und Einkommenswerte erscheint ein Wohngeld-Check sinnvoll. Bitte mit offizieller Quelle prüfen.',
  'benefits.awareness.wohngeld.notApplicable':
    'Mit den derzeit bekannten Fakten erscheint Wohngeld unter der aktuellen Heuristik nicht zutreffend. Profil aktualisieren, falls sich etwas geändert hat.',
  'benefits.awareness.wohngeld.completed':
    'Ihr Profil vermerkt bereits Wohngeld-Bezug. Aktualisieren Sie die Angaben, falls das nicht mehr stimmt.',
  'benefits.awareness.wohngeld.unavailable': 'Wohngeld-Hinweis ist vorübergehend nicht verfügbar.',
  'benefits.awareness.kindergeld.title': 'Kindergeld',
  'benefits.awareness.kindergeld.notEnoughInformation':
    'Kindergeld kann relevant sein, wenn abhängige Kinder vorhanden sind — Atlas braucht dafür explizite Kinderangaben; die Haushaltsgröße allein reicht nicht.',
  'benefits.awareness.kindergeld.readyToAct':
    'Anhand expliziter Kinderangaben in Ihrem Profil erscheint Kindergeld prüfenswert. Bitte mit offizieller Quelle prüfen — keine Anspruchsentscheidung.',
  'benefits.awareness.kindergeld.notApplicable':
    'Mit den derzeit bekannten Kinder-/Familienangaben erscheint Kindergeld nicht zutreffend. Haushaltsangaben aktualisieren, falls sich etwas geändert hat.',
  'benefits.awareness.kindergeld.completed':
    'Ihr Profil vermerkt, dass Sie derzeit Kindergeld erhalten. Das ist Ihre bestätigte Angabe — Atlas hat das nicht bei einer Behörde geprüft. Aktualisieren Sie die Angaben, falls das nicht mehr stimmt.',
  'benefits.awareness.kindergeld.unavailable': 'Kindergeld-Hinweis ist vorübergehend nicht verfügbar.',
  'benefits.awareness.missing.housingRent': 'Monatliche Miete (Mietwohnung)',
  'benefits.awareness.missing.income': 'Bruttomonatseinkommen',
  'benefits.awareness.missing.children': 'Explizite abhängige Kinder (nicht Haushaltsgröße)',
  'benefits.awareness.missing.generic': 'Weitere Profildaten',
  'benefits.awareness.action.updateHousing': 'Wohnangaben aktualisieren',
  'benefits.awareness.action.updateIncome': 'Arbeit und Einkommen aktualisieren',
  'benefits.awareness.action.updateHousehold': 'Haushalt und Familie aktualisieren',
  'benefits.awareness.action.openOfficial': 'Offizielle Wohngeld-Informationen öffnen',
  'benefits.awareness.action.openOfficialKindergeld': 'Offizielle Kindergeld-Informationen öffnen',
  'benefits.awareness.action.reviewBenefits': 'Leistungsangaben prüfen',
  'benefits.awareness.action.none': 'Keine Aktion verfügbar',
  'benefits.awareness.action.recordReceiving': 'Wohngeld im Profil vermerken',
  'benefits.awareness.action.recordReceivingKindergeld': 'Kindergeld im Profil vermerken',
  'benefits.awareness.recalculated': 'Leistungs-Hinweis anhand Ihrer aktuellen Profildaten aktualisiert.',
  'benefits.awareness.aggregate.oneActionable':
    'Ein Leistungs-Check ist anhand der bekannten Fakten bereit.',
  'benefits.awareness.aggregate.multipleActionable':
    'Mehr als ein Leistungs-Check ist bereit. Die Karten unten sind nach dem nächsten sinnvollen Schritt geordnet — nicht nach rechtlicher Priorität oder Betrag.',
  'benefits.awareness.aggregate.needInformation':
    'Atlas benötigt noch Profildaten, bevor ein Leistungs-Check vorgeschlagen werden kann. Aktualisieren Sie die unten genannten Angaben.',
  'benefits.awareness.aggregate.allCompleted':
    'Alle gelisteten Leistungen sind im Profil als Bezug markiert. Hier ist derzeit nichts weiter zu tun.',
  'benefits.awareness.aggregate.noneActionable':
    'Mit den bekannten Fakten ist derzeit kein Leistungs-Check umsetzbar.',
  'benefits.awareness.aggregate.primaryNext': 'Vorgeschlagener Fokus',
  'benefits.awareness.aggregate.completedMarker': 'im Profil vermerkt',
};

const RU: Translations = {
  'benefits.awareness.title': 'Ориентир по пособиям',
  'benefits.awareness.subtitle':
    'На основе того, что Atlas сейчас знает о вашей ситуации — не официальное решение',
  'benefits.awareness.disclaimer':
    'Это не официальное решение о праве на пособие. Atlas лишь подсказывает возможный следующий шаг проверки по известным фактам.',
  'benefits.awareness.stateLabel': 'Текущее состояние',
  'benefits.awareness.missing': 'Чего не хватает',
  'benefits.awareness.next': 'Что можно сделать дальше',
  'benefits.awareness.state.NOT_ENOUGH_INFORMATION': 'Недостаточно информации',
  'benefits.awareness.state.POTENTIALLY_RELEVANT': 'Потенциально релевантно',
  'benefits.awareness.state.NOT_APPLICABLE': 'Не применимо при известных фактах',
  'benefits.awareness.state.READY_TO_ACT': 'Готово к следующей проверке',
  'benefits.awareness.state.COMPLETED': 'Уже отмечено получение этого пособия',
  'benefits.awareness.wohngeld.title': 'Wohngeld (жилищное пособие)',
  'benefits.awareness.wohngeld.notEnoughInformation':
    'Wohngeld может стать актуальным позже, но Atlas ещё нужны данные об аренде и/или доходе.',
  'benefits.awareness.wohngeld.potentiallyRelevant':
    'По известной аренде и доходу Wohngeld выглядит достойным проверки — без гарантий.',
  'benefits.awareness.wohngeld.readyToAct':
    'По известной аренде и доходу проверка Wohngeld выглядит уместной. Подтвердите на официальном источнике.',
  'benefits.awareness.wohngeld.notApplicable':
    'По известным фактам Wohngeld не выглядит применимым по текущей эвристике. Обновите профиль, если что-то изменилось.',
  'benefits.awareness.wohngeld.completed':
    'В профиле уже указано получение Wohngeld. Обновите сведения о пособиях, если это больше неверно.',
  'benefits.awareness.wohngeld.unavailable': 'Ориентир по Wohngeld временно недоступен.',
  'benefits.awareness.kindergeld.title': 'Kindergeld (детское пособие)',
  'benefits.awareness.kindergeld.notEnoughInformation':
    'Kindergeld может быть актуален при наличии детей на иждивении, но Atlas нужны явные сведения о детях — размера домохозяйства недостаточно.',
  'benefits.awareness.kindergeld.readyToAct':
    'По явным сведениям о детях в профиле Kindergeld выглядит достойным проверки. Подтвердите на официальном источнике — это не решение о праве.',
  'benefits.awareness.kindergeld.notApplicable':
    'По известным сведениям о детях/семье Kindergeld не выглядит применимым. Обновите данные о домохозяйстве, если что-то изменилось.',
  'benefits.awareness.kindergeld.completed':
    'В профиле указано, что вы сейчас получаете Kindergeld. Это ваше подтверждённое сведение — Atlas не проверял его у органа. Обновите сведения о пособиях, если это больше неверно.',
  'benefits.awareness.kindergeld.unavailable': 'Ориентир по Kindergeld временно недоступен.',
  'benefits.awareness.missing.housingRent': 'Ежемесячная аренда (съёмное жильё)',
  'benefits.awareness.missing.income': 'Валовой месячный доход',
  'benefits.awareness.missing.children': 'Явные сведения о детях на иждивении (не размер домохозяйства)',
  'benefits.awareness.missing.generic': 'Дополнительные факты профиля',
  'benefits.awareness.action.updateHousing': 'Обновить данные о жилье',
  'benefits.awareness.action.updateIncome': 'Обновить работу и доход',
  'benefits.awareness.action.updateHousehold': 'Обновить данные о домохозяйстве и семье',
  'benefits.awareness.action.openOfficial': 'Открыть официальную информацию о Wohngeld',
  'benefits.awareness.action.openOfficialKindergeld': 'Открыть официальную информацию о Kindergeld',
  'benefits.awareness.action.reviewBenefits': 'Проверить сведения о пособиях',
  'benefits.awareness.action.none': 'Действие недоступно',
  'benefits.awareness.action.recordReceiving': 'Отметить Wohngeld в профиле',
  'benefits.awareness.action.recordReceivingKindergeld': 'Отметить Kindergeld в профиле',
  'benefits.awareness.recalculated': 'Ориентир по пособиям обновлён по последним фактам профиля.',
  'benefits.awareness.aggregate.oneActionable':
    'Одна проверка пособия готова на основе известных Atlas фактов.',
  'benefits.awareness.aggregate.multipleActionable':
    'Готовы несколько проверок пособий. Карточки ниже упорядочены по следующему полезному шагу — не по юридическому приоритету или сумме.',
  'benefits.awareness.aggregate.needInformation':
    'Atlas ещё нужны факты профиля, прежде чем предложить проверку пособия. Обновите указанные ниже сведения.',
  'benefits.awareness.aggregate.allCompleted':
    'Все перечисленные пособия отмечены в профиле как получаемые. Сейчас здесь нет другого действия.',
  'benefits.awareness.aggregate.noneActionable':
    'С известными фактами сейчас нет выполнимой проверки пособия.',
  'benefits.awareness.aggregate.primaryNext': 'Предлагаемый фокус',
  'benefits.awareness.aggregate.completedMarker': 'записано в профиле',
};

const UA: Translations = {
  'benefits.awareness.title': 'Орієнтир щодо допомог',
  'benefits.awareness.subtitle':
    'На основі того, що Atlas зараз знає про вашу ситуацію — не офіційне рішення',
  'benefits.awareness.disclaimer':
    'Це не офіційне рішення про право на допомогу. Atlas лише підказує можливий наступний крок перевірки за відомими фактами.',
  'benefits.awareness.stateLabel': 'Поточний стан',
  'benefits.awareness.missing': 'Чого бракує',
  'benefits.awareness.next': 'Що можна зробити далі',
  'benefits.awareness.state.NOT_ENOUGH_INFORMATION': 'Недостатньо інформації',
  'benefits.awareness.state.POTENTIALLY_RELEVANT': 'Потенційно релевантно',
  'benefits.awareness.state.NOT_APPLICABLE': 'Не застосовно за відомими фактами',
  'benefits.awareness.state.READY_TO_ACT': 'Готово до наступної перевірки',
  'benefits.awareness.state.COMPLETED': 'Вже позначено отримання цієї допомоги',
  'benefits.awareness.wohngeld.title': 'Wohngeld (житлова допомога)',
  'benefits.awareness.wohngeld.notEnoughInformation':
    'Wohngeld може стати актуальним пізніше, але Atlas ще потрібні дані про оренду та/або дохід.',
  'benefits.awareness.wohngeld.potentiallyRelevant':
    'За відомою орендою та доходом Wohngeld виглядає вартим перевірки — без гарантій.',
  'benefits.awareness.wohngeld.readyToAct':
    'За відомою орендою та доходом перевірка Wohngeld виглядає доречною. Підтвердіть на офіційному джерелі.',
  'benefits.awareness.wohngeld.notApplicable':
    'За відомими фактами Wohngeld не виглядає застосовним за поточною евристикою. Оновіть профіль, якщо щось змінилося.',
  'benefits.awareness.wohngeld.completed':
    'У профілі вже зазначено отримання Wohngeld. Оновіть відомості про допомоги, якщо це більше не так.',
  'benefits.awareness.wohngeld.unavailable': 'Орієнтир щодо Wohngeld тимчасово недоступний.',
  'benefits.awareness.kindergeld.title': 'Kindergeld (допомога на дітей)',
  'benefits.awareness.kindergeld.notEnoughInformation':
    'Kindergeld може бути актуальним за наявності дітей на утриманні, але Atlas потрібні явні відомості про дітей — розміру домогосподарства недостатньо.',
  'benefits.awareness.kindergeld.readyToAct':
    'За явними відомостями про дітей у профілі Kindergeld виглядає вартим перевірки. Підтвердіть на офіційному джерелі — це не рішення про право.',
  'benefits.awareness.kindergeld.notApplicable':
    'За відомими відомостями про дітей/сім’ю Kindergeld не виглядає застосовним. Оновіть дані про домогосподарство, якщо щось змінилося.',
  'benefits.awareness.kindergeld.completed':
    'У профілі зазначено, що ви зараз отримуєте Kindergeld. Це ваше підтверджене відомості — Atlas не перевіряв їх у органу. Оновіть відомості про допомоги, якщо це більше не так.',
  'benefits.awareness.kindergeld.unavailable': 'Орієнтир щодо Kindergeld тимчасово недоступний.',
  'benefits.awareness.missing.housingRent': 'Щомісячна оренда (орендоване житло)',
  'benefits.awareness.missing.income': 'Валовий місячний дохід',
  'benefits.awareness.missing.children': 'Явні відомості про дітей на утриманні (не розмір домогосподарства)',
  'benefits.awareness.missing.generic': 'Додаткові факти профілю',
  'benefits.awareness.action.updateHousing': 'Оновити дані про житло',
  'benefits.awareness.action.updateIncome': 'Оновити роботу та дохід',
  'benefits.awareness.action.updateHousehold': 'Оновити дані про домогосподарство та сім’ю',
  'benefits.awareness.action.openOfficial': 'Відкрити офіційну інформацію про Wohngeld',
  'benefits.awareness.action.openOfficialKindergeld': 'Відкрити офіційну інформацію про Kindergeld',
  'benefits.awareness.action.reviewBenefits': 'Переглянути відомості про допомоги',
  'benefits.awareness.action.none': 'Дія недоступна',
  'benefits.awareness.action.recordReceiving': 'Позначити Wohngeld у профілі',
  'benefits.awareness.action.recordReceivingKindergeld': 'Позначити Kindergeld у профілі',
  'benefits.awareness.recalculated': 'Орієнтир щодо допомог оновлено за останніми фактами профілю.',
  'benefits.awareness.aggregate.oneActionable':
    'Одна перевірка допомоги готова на основі відомих Atlas фактів.',
  'benefits.awareness.aggregate.multipleActionable':
    'Готові кілька перевірок допомог. Картки нижче впорядковано за наступним корисним кроком — не за юридичним пріоритетом чи сумою.',
  'benefits.awareness.aggregate.needInformation':
    'Atlas ще потрібні факти профілю, перш ніж запропонувати перевірку допомоги. Оновіть зазначені нижче відомості.',
  'benefits.awareness.aggregate.allCompleted':
    'Усі перелічені допомоги позначено в профілі як отримувані. Зараз тут немає іншої дії.',
  'benefits.awareness.aggregate.noneActionable':
    'За відомими фактами зараз немає виконуваної перевірки допомоги.',
  'benefits.awareness.aggregate.primaryNext': 'Запропонований фокус',
  'benefits.awareness.aggregate.completedMarker': 'записано в профілі',
};

export const BENEFITS_AWARENESS_I18N: Record<SupportedLanguage, Translations> = {
  en: EN,
  de: DE,
  ru: RU,
  ua: UA,
};

export const BENEFITS_AWARENESS_I18N_KEYS = Object.keys(EN);
