import { Router } from 'express';
import { all, get, getSettings, run } from '../db.js';
import {
  ApiError,
  asInt,
  asNumber,
  computeHabitStats,
  estimateBodyFat,
  localDateString,
  oneOf,
  requireDateString,
  resolveAge,
  wrapAsync,
} from '../utils.js';
import { aiConfig } from '../services/zhipu.js';

const router = Router();

function shapeSettings() {
  const settings = getSettings();
  const heightCm = settings.height_cm ? Number(settings.height_cm) : null;
  const gender = settings.gender === 'male' || settings.gender === 'female' ? settings.gender : '';
  const birthday = settings.birthday || null;
  const age = resolveAge(settings);
  return {
    heightCm,
    waterGoalMl: Number(settings.water_goal_ml) || 2000,
    theme: settings.theme || 'light',
    gender,
    birthday,
    age,
    profileComplete: Boolean(heightCm && gender && birthday && age),
  };
}

router.get(
  '/settings',
  wrapAsync(async (_req, res) => {
    res.json(shapeSettings());
  })
);

router.put(
  '/settings',
  wrapAsync(async (req, res) => {
    const { heightCm, waterGoalMl, gender, birthday, age } = req.body || {};
    const updates = [];
    if (gender !== undefined) {
      const value = gender === null ? '' : String(gender);
      updates.push(['gender', value === '' ? '' : oneOf(value, ['male', 'female'], '性别')]);
    }
    if (birthday !== undefined) {
      if (birthday === null || birthday === '') {
        updates.push(['birthday', '']);
      } else {
        const value = requireDateString(birthday, '生日');
        if (value > localDateString()) throw new ApiError(400, '生日不能晚于今天');
        updates.push(['birthday', value]);
      }
    }
    if (age !== undefined) {
      if (age === null || age === '') {
        updates.push(['age', '']);
      } else {
        const value = asInt(age, '年龄', { min: 1, max: 120 });
        updates.push(['age', String(value)]);
      }
    }
    if (heightCm !== undefined) {
      if (heightCm === null || heightCm === '') {
        updates.push(['height_cm', '']);
      } else {
        const height = asNumber(heightCm, '身高', { min: 80, max: 250 });
        updates.push(['height_cm', String(height)]);
      }
    }
    if (waterGoalMl !== undefined) {
      const goal = asNumber(waterGoalMl, '每日饮水目标', { min: 500, max: 8000 });
      updates.push(['water_goal_ml', String(Math.round(goal))]);
    }
    if (!updates.length) throw new ApiError(400, '没有需要保存的设置');
    for (const [key, value] of updates) {
      run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        value
      );
    }
    res.json(shapeSettings());
  })
);

router.get(
  '/dashboard',
  wrapAsync(async (req, res) => {
    const settings = shapeSettings();
    const today = req.query.today ? String(req.query.today) : null;
    const todayDate = today || localDateString();

    const habitRows = all('SELECT tracker, date FROM habits ORDER BY date ASC');
    const habitStats = {};
    for (const tracker of ['duolingo', 'vocabulary']) {
      const dates = habitRows.filter((row) => row.tracker === tracker).map((row) => row.date);
      habitStats[tracker] = computeHabitStats(dates, todayDate);
    }

    const reading = { unread: 0, reading: 0, completed: 0 };
    for (const row of all('SELECT status, COUNT(*) AS n FROM papers GROUP BY status')) {
      reading[row.status] = Number(row.n);
    }

    const reminders = all(
      'SELECT due_date, completed FROM reminders WHERE completed = 0 AND due_date IS NOT NULL'
    );
    let dueToday = 0;
    let overdue = 0;
    for (const reminder of reminders) {
      if (reminder.due_date === todayDate) dueToday += 1;
      if (reminder.due_date < todayDate) overdue += 1;
    }

    const latestWeight = get(
      'SELECT date, weight, body_fat FROM weight_entries ORDER BY date DESC LIMIT 1'
    );
    const estimatedBodyFat = latestWeight
      ? estimateBodyFat({
          weight: latestWeight.weight,
          heightCm: settings.heightCm,
          age: settings.age,
          gender: settings.gender,
        })
      : null;
    const waterToday = get(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM water_entries WHERE date = ?',
      todayDate
    );

    res.json({
      today: todayDate,
      settings,
      habits: habitStats,
      reading,
      reminders: { dueToday, overdue },
      health: {
        latestWeight: latestWeight
          ? {
              date: latestWeight.date,
              weight: latestWeight.weight,
              bodyFat: latestWeight.body_fat,
              estimatedBodyFat,
            }
          : null,
        waterToday: Number(waterToday?.total || 0),
        waterGoalMl: settings.waterGoalMl,
      },
      courseCount: Number(get('SELECT COUNT(*) AS n FROM courses WHERE archived = 0')?.n || 0),
      memoCount: Number(get('SELECT COUNT(*) AS n FROM memos')?.n || 0),
      ai: { configured: aiConfig().configured, model: aiConfig().model },
    });
  })
);

export default router;
