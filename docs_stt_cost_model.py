"""
Модель стоимости подключения Freedom Speech STT (2,5 ₸/мин).

Вопрос, на который отвечает модель: во сколько обойдётся распознавание речи
и какая стратегия подключения экономически осмысленна.

Контекст из ранее посчитанной юнит-экономики:
  подписка «Семейный» 2 490 ₸/мес, ~1,8 ребёнка на аккаунт,
  затраты на Claude API ~25,5 ₸ на ребёнка в месяц (7,6% выручки),
  валовая маржа 94%.
"""

STT_PRICE_PER_MIN = 2.5      # ₸ за минуту распознавания
SUBSCRIPTION = 2490          # ₸/мес, семейный тариф
CHILDREN_PER_ACCOUNT = 1.8
CLAUDE_COST_PER_CHILD = 25.5 # ₸/мес, из прошлой модели

# Замер из самого приложения: 2 книги = 7 мин 20 сек → ~3,7 мин на книгу.
MIN_PER_BOOK = 3.7

# Доля чтения на казахском (остальное — русский и английский,
# где бесплатное браузерное распознавание работает приемлемо).
KAZAKH_SHARE = 0.25

# Из симуляции точности: на казахском движок «застревает» примерно
# на 31% страниц — только там и нужен платный распознаватель.
KAZAKH_STALL_RATE = 0.31

# Доля аудио, которую реально нужно отправить при точечном обращении:
# короткое окно вокруг проблемного места, а не вся сессия.
SEGMENT_SHARE_WHEN_ESCALATED = 0.35


def monthly_minutes(books_per_day: float, days: int = 30) -> float:
    return books_per_day * MIN_PER_BOOK * days


def strategy_cost(books_per_day: float, strategy: str) -> float:
    """Стоимость STT на одного ребёнка в месяц, ₸."""
    total_min = monthly_minutes(books_per_day)

    if strategy == "all":
        billed = total_min
    elif strategy == "kazakh_only":
        billed = total_min * KAZAKH_SHARE
    elif strategy == "kazakh_fallback":
        # Платный движок включается только когда бесплатный не справился.
        billed = total_min * KAZAKH_SHARE * KAZAKH_STALL_RATE
    elif strategy == "kazakh_fallback_segments":
        # И отправляем только проблемный фрагмент, а не всю сессию.
        billed = (total_min * KAZAKH_SHARE * KAZAKH_STALL_RATE
                  * SEGMENT_SHARE_WHEN_ESCALATED)
    else:
        raise ValueError(strategy)

    return billed * STT_PRICE_PER_MIN


STRATEGIES = [
    ("all", "Всё аудио через Freedom STT"),
    ("kazakh_only", "Только казахский (рус/англ — браузер)"),
    ("kazakh_fallback", "Казахский, и только когда браузер не справился"),
    ("kazakh_fallback_segments", "То же + отправляем только фрагмент"),
]

READER_TYPES = [
    ("Редкий (0,3 книги/день)", 0.3),
    ("Обычный (1 книга/день)", 1.0),
    ("Активный (3 книги/день)", 3.0),
    ("Марафонец (5 книг/день)", 5.0),
]

print("=" * 78)
print("  СТОИМОСТЬ STT НА ОДНОГО РЕБЁНКА В МЕСЯЦ, ₸")
print("=" * 78)
header = f"{'Стратегия':46}" + "".join(f"{n.split('(')[0][:9]:>9}" for n, _ in READER_TYPES)
print(header)
print("-" * 78)
for key, label in STRATEGIES:
    row = f"{label:46}"
    for _, bpd in READER_TYPES:
        row += f"{strategy_cost(bpd, key):9.0f}"
    print(row)

print()
print("=" * 78)
print("  ДОЛЯ ОТ ВЫРУЧКИ (обычный читатель, 1,8 ребёнка на аккаунт)")
print("=" * 78)
for key, label in STRATEGIES:
    per_account = strategy_cost(1.0, key) * CHILDREN_PER_ACCOUNT
    share = per_account / SUBSCRIPTION * 100
    claude = CLAUDE_COST_PER_CHILD * CHILDREN_PER_ACCOUNT
    total_ai = per_account + claude
    margin = (SUBSCRIPTION - total_ai - SUBSCRIPTION * 0.03) / SUBSCRIPTION * 100
    print(f"  {label:46} {per_account:7.0f} ₸  = {share:5.1f}% выручки   маржа {margin:.0f}%")

print()
print("  Для сравнения: без STT маржа была 94%, Claude API занимал 7,6% выручки.")

print()
print("=" * 78)
print("  ХУДШИЙ СЛУЧАЙ: марафонец на самой дорогой стратегии")
print("=" * 78)
worst = strategy_cost(5.0, "all") * CHILDREN_PER_ACCOUNT
print(f"  {worst:.0f} ₸/мес на аккаунт при выручке {SUBSCRIPTION} ₸ → "
      f"{'УБЫТОК' if worst > SUBSCRIPTION else 'на грани'}")
print(f"  Именно поэтому нужен потолок минут на ребёнка.")

print()
print("=" * 78)
print("  БЮДЖЕТ ПИЛОТА (2–3 недели)")
print("=" * 78)
for kids in (10, 20, 50):
    for weeks in (2, 3):
        days = weeks * 7
        # На пилоте разумно считать по умеренной активности.
        total_min_all = kids * 1.0 * MIN_PER_BOOK * days
        cost_all = total_min_all * STT_PRICE_PER_MIN
        cost_opt = (total_min_all * KAZAKH_SHARE * KAZAKH_STALL_RATE
                    * SEGMENT_SHARE_WHEN_ESCALATED * STT_PRICE_PER_MIN)
        print(f"  {kids:2} детей × {weeks} нед.:  всё аудио {cost_all:7.0f} ₸   "
              f"оптимизировано {cost_opt:6.0f} ₸")

print()
print("=" * 78)
print("  РИСК ОКРУГЛЕНИЯ ТАРИФИКАЦИИ (вопрос к поставщику)")
print("=" * 78)
# Если минуты округляются вверх ПОКАЖДОМУ запросу, точечные обращения дороги.
segment_sec = 12
requests_per_session = 6
actual_min = requests_per_session * segment_sec / 60
if_rounded_up = requests_per_session * 1.0
print(f"  Сессия с {requests_per_session} точечными обращениями по {segment_sec} сек:")
print(f"    фактически звука      {actual_min:.1f} мин → {actual_min * STT_PRICE_PER_MIN:.1f} ₸")
print(f"    если округляют вверх  {if_rounded_up:.1f} мин → {if_rounded_up * STT_PRICE_PER_MIN:.1f} ₸")
print(f"    переплата в {if_rounded_up / actual_min:.0f} раз")
print()
print("  Если тарификация округляется вверх по каждому запросу — точечная")
print("  стратегия теряет смысл, и выгоднее накапливать аудио и отправлять")
print("  одним запросом на страницу. Это надо уточнить ДО начала пилота.")
print()
