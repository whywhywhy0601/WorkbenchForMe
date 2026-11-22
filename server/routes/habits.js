import { Router } from 'express';
import { all, run } from '../db.js';
import {
  ApiError,
  computeHabitStats,
  localDateString,
  nowIso,
  requireDateString,
  wrapAsync,
} from '../utils.js';

const router = Router();
const TRACKERS = ['duolingo', 'vocabulary'];

function assertTracker(tracker) {
  if (!TRACKERS.includes(tracker)) throw new ApiError(404, '习惯类型不存在');
  return tracker;
}

function payload(tracker) {
  const rows = all(
    'SELECT date, note FROM habits WHERE tracker = ? ORDER BY date ASC',
    tracker
  );
  return {
    tracker,
    checkins: rows,
    stats: computeHabitStats(
      rows.map((row) => row.date),
      localDateString()
    ),
  };
}

router.get(
  '/habits/:tracker',
  wrapAsync(async (req, res) => {
    res.json(payload(assertTracker(req.params.tracker)));
  })
);

router.put(
  '/habits/:tracker/:date',
  wrapAsync(async (req, res) => {
    const tracker = assertTracker(req.params.tracker);
    const date = requireDateString(req.params.date);
    if (date > localDateString()) throw new ApiError(400, '不能为未来日期打卡');
    const checked = req.body?.checked !== false;
    if (checked) {
      const note =
        req.body?.note === undefined || req.body?.note === null
          ? null
          : String(req.body.note).slice(0, 500);
      run(
        `INSERT INTO habits (tracker, date, note, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(tracker, date) DO UPDATE SET note = excluded.note`,
        tracker,
        date,
        note,
        nowIso()
      );
    } else {
      run('DELETE FROM habits WHERE tracker = ? AND date = ?', tracker, date);
    }
    res.json(payload(tracker));
  })
);

router.get(
  '/vocab/deck',
  wrapAsync(async (_req, res) => {
    const cards = all(
      'SELECT id, word, phonetic, meaning, example, example_zh FROM vocab_cards ORDER BY id ASC'
    );
    res.json({
      cards: cards.map((card) => ({
        id: card.id,
        word: card.word,
        phonetic: card.phonetic,
        meaning: card.meaning,
        example: card.example,
        exampleZh: card.example_zh,
      })),
    });
  })
);

export default router;
