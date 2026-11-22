import { useEffect, useState } from 'react';
import type { Gender, HealthProfile } from '../../types';
import { useUpdateSettings } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { useToast } from '../../app/ToastProvider';
import { Modal } from '../ui/Overlay';
import { Spinner } from '../ui/basics';
import { ageFromBirthday, dateKey, isValidDateKey } from '../../lib/format';

export function HealthProfileModal({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: Pick<HealthProfile, 'heightCm' | 'gender' | 'birthday' | 'age'>;
}) {
  const toast = useToast();
  const updateSettings = useUpdateSettings();
  const [gender, setGender] = useState<Gender>('');
  const [birthday, setBirthday] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');

  useEffect(() => {
    if (!open) return;
    const derivedAge = profile.age ?? (profile.birthday ? ageFromBirthday(profile.birthday) : null);
    setGender(profile.gender || '');
    setBirthday(profile.birthday || '');
    setAge(derivedAge != null ? String(derivedAge) : '');
    setHeight(profile.heightCm ? String(profile.heightCm) : '');
  }, [open, profile.age, profile.birthday, profile.gender, profile.heightCm]);

  const handleBirthday = (value: string) => {
    setBirthday(value);
    const computed = ageFromBirthday(value);
    if (computed != null) setAge(String(computed));
  };

  const save = async () => {
    if (!gender) {
      toast.error('请选择性别，体脂率公式需要性别系数');
      return;
    }
    if (!isValidDateKey(birthday)) {
      toast.error('请输入有效的生日');
      return;
    }
    if (birthday > dateKey()) {
      toast.error('生日不能晚于今天');
      return;
    }
    const ageValue = Number(age);
    if (!Number.isInteger(ageValue) || ageValue < 1 || ageValue > 120) {
      toast.error('请输入 1–120 岁之间的年龄');
      return;
    }
    const heightValue = Number(height);
    if (!Number.isFinite(heightValue) || heightValue < 80 || heightValue > 250) {
      toast.error('请输入 80–250 cm 之间的身高');
      return;
    }
    try {
      await updateSettings.mutateAsync({
        gender,
        birthday,
        age: ageValue,
        heightCm: heightValue,
      });
      toast.success('健康档案已保存，BMI 与体脂率会据此更新');
      onClose();
    } catch (error) {
      toast.error(errorMessage(error), '保存失败');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="健康档案"
      subtitle="用于 BMI 计算与体脂率估算"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Spinner size={13} />}
            保存档案
          </button>
        </>
      }
    >
      <div className="profile-form-grid">
        <label className="field">
          <span>性别</span>
          <select value={gender} onChange={(event) => setGender(event.target.value as Gender)}>
            <option value="">请选择</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </label>
        <label className="field">
          <span>生日</span>
          <input
            type="date"
            value={birthday}
            max={dateKey()}
            onChange={(event) => handleBirthday(event.target.value)}
          />
        </label>
        <label className="field">
          <span>年龄</span>
          <input
            type="number"
            min="1"
            max="120"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            placeholder="例如 24"
          />
          <small className="field-hint">选择生日后自动计算，可手动修改。</small>
        </label>
        <label className="field">
          <span>身高（cm）</span>
          <input
            type="number"
            min="80"
            max="250"
            step="0.1"
            value={height}
            onChange={(event) => setHeight(event.target.value)}
            placeholder="例如 175"
          />
        </label>
      </div>

      <div className="profile-formula">
        <strong>体脂率估算公式</strong>
        <span>体脂率 = 1.20 × BMI + 0.23 × 年龄 − 10.8 × 性别系数 − 5.4</span>
        <small>性别系数：男性 = 1，女性 = 0。BMI 由身高与体重计算，结果仅作趋势参考。</small>
      </div>
    </Modal>
  );
}
