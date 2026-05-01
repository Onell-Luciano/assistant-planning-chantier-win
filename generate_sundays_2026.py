import datetime
d = datetime.date(2026, 1, 1)
d += datetime.timedelta(days=(6 - d.weekday()))
while d.year == 2026:
    print(f'  "{d.isoformat()}", // Dimanche')
    d += datetime.timedelta(days=7)
