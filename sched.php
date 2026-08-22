<?php
/* sched.php — PHP port of the client isScheduledOn(), so the reminder engine
   agrees with the app about which items are due on a given date. */
function item_scheduled_on(array $item, DateTime $date): bool {
    $mode = $item['end_mode'] ?: 'never';
    if ($mode === 'date' && !empty($item['end_date'])) {
        $end = new DateTime($item['end_date'] . ' 23:59:59', $date->getTimezone());
        if ($date > $end) return false;
    }
    $f = $item['freq'] ?: 'daily';
    $every = max(1, (int)($item['every_days'] ?? 1));
    $start = !empty($item['start_date']) ? new DateTime($item['start_date'] . ' 00:00:00', $date->getTimezone()) : null;
    $occurs = function (DateTime $d) use ($item, $f, $every, $start): bool {
        if ($f === 'weekly') { $days = json_decode($item['days'] ?: '[]', true) ?: []; return in_array((int)$d->format('w'), array_map('intval', $days), true); }
        if ($f === 'monthly') { return (int)$d->format('j') === (int)($item['dom'] ?: 1); }
        if ($every <= 1 || !$start) return true;
        $diff = (int)floor(($d->getTimestamp() - $start->getTimestamp()) / 86400);
        return $diff >= 0 && $diff % $every === 0;
    };
    if (!$occurs($date)) return false;
    if ($mode === 'count' && !empty($item['start_date'])) {
        $start = new DateTime($item['start_date'] . ' 00:00:00', $date->getTimezone());
        if ($date >= $start) {
            $cap = (int)($item['end_count'] ?: 10); $n = 0; $cur = clone $start; $dIso = $date->format('Y-m-d');
            for ($i = 0; $i < 800; $i++) { if ($cur > $date) break; if ($occurs($cur)) { $n++; if ($cur->format('Y-m-d') === $dIso) return $n <= $cap; } $cur->modify('+1 day'); }
        }
    }
    return true;
}
