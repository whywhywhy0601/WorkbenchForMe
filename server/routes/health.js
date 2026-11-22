import { Router } from 'express';
import { all, get, getSettings, run } from '../db.js';
import {
  ApiError,
  asNumber,
  estimateBodyFat,
  localDateString,
  nowIso,
  parseId,
  requireDateString,
  resolveAge,
  wrapAsync,
} from '../utils.js';

const router = Router();

function shapeHealth() {
  const settings = getSettings();
  const heightCm = settings.height_cm ? Number(settings.height_cm) : null;
  const gender = settings.gender === 'male' || settings.gender === 'female' ? settings.gender : '';
  const birthday = settings.birthday || null;
  const age = resolveAge(settings);
  const profileComplete = Boolean(heightCm && gender && birthday && age);
  const weights = all('SELECT * FROM weight_entries ORDER BY date ASC').map((row) => ({
    id: row.id,
    date: row.date,
    weight: row.weight,
    bodyFat: row.body_fat,
    estimatedBodyFat: estimateBodyFat({
      weight: row.weight,
      heightCm,
      age,
      gender,
    }),
    createdAt: row.created_at,
  }));
  const waterEntries = all('SELECT * FROM water_entries ORDER BY created_at ASC').map((row) => ({
    id: row.id,
    date: row.date,
    amount: row.amount,
    createdAt: row.created_at,
  }));
  const waterByDate = {};
  for (const entry of waterEntries) {
    waterByDate[entry.date] = (waterByDate[entry.date] || 0) + entry.amount;
  }
  return {
    today: localDateString(),
    profile: {
      heightCm,
      waterGoalMl: Number(settings.water_goal_ml) || 2000,
      gender,
      birthday,
      age,
      profileComplete,
    },
    weights,
    waterEntries,
    waterByDate,
  };
}

router.get(
  '/health',
  wrapAsync(async (_req, res) => {
    res.json(shapeHealth());
  })
);

router.put(
  '/health/weights',
  wrapAsync(async (req, res) => {
    const body = req.body || {};
    const date = requireDateString(body.date, '日期');
    if (date > localDateString()) throw new ApiError(400, '不能记录未来日期');
    const weight = asNumber(body.weight, '体重', { min: 20, max: 400 });
    // Body fat is derived from the health profile (BMI, age, gender). The
    // legacy body_fat column is cleared so stale manual values cannot leak into
    // historical entries.
    run(
      `INSERT INTO weight_entries (date, weight, body_fat, created_at) VALUES (?, ?, NULL, ?)
       ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, body_fat = NULL`,
      date,
      weight,
      nowIso()
    );
    res.json(shapeHealth());
  })
);

router.delete(
  '/health/weights/:date',
  wrapAsync(async (req, res) => {
    const date = requireDateString(req.params.date, '日期');
    const existing = get('SELECT id FROM weight_entries WHERE date = ?', date);
    if (!existing) throw new ApiError(404, '该日期没有体重记录');
    run('DELETE FROM weight_entries WHERE date = ?', date);
    res.json(shapeHealth());
  })
);

router.post(
  '/health/water',
  wrapAsync(async (req, res) => {
    const body = req.body || {};
    const date = requireDateString(body.date, '日期');
    if (date > localDateString()) throw new ApiError(400, '不能记录未来日期');
    const amount = asNumber(body.amount, '饮水量', { min: 1, max: 5000 });
    run(
      'INSERT INTO water_entries (date, amount, created_at) VALUES (?, ?, ?)',
      date,
      Math.round(amount),
      nowIso()
    );
    res.status(201).json(shapeHealth());
  })
);

router.delete(
  '/health/water/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = get('SELECT id FROM water_entries WHERE id = ?', id);
    if (!existing) throw new ApiError(404, '饮水记录不存在');
    run('DELETE FROM water_entries WHERE id = ?', id);
    res.json(shapeHealth());
  })
);

export default router;
