'use client';

import { FormEvent, useState } from 'react';

const stages = ['申报中的单位', '筹建中单位', '试运行评审', '正式运营', '遗传咨询培训及诊疗路径梳理'];

export function PgdCenterMaintenance({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setStatus('正在保存…');
    const data = new FormData(event.currentTarget);
    const payload = {
      hospitalId: String(data.get('hospitalId') || ''),
      hospitalName: String(data.get('hospitalName') || ''),
      province: String(data.get('province') || ''),
      stage: String(data.get('stage') || ''),
      period: String(data.get('period') || ''),
      totalCycleCount: Number(data.get('totalCycleCount') || 0),
      pgdCycleCount: Number(data.get('pgdCycleCount') || 0),
    };
    try {
      const response = await fetch('/api/pgd-centers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(response.status === 403 ? '需要管理员权限，请先配置运营维护人员名单。' : '保存失败，请检查字段或接口。');
      setStatus('已保存，中心转化率已自动计算。');
      form.reset();
      onSaved?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="maintenance-shell">
      <div className="maintenance-actions"><button type="button" disabled title="待运营提供标准名单模板">批量导入待配置</button><button type="button" className="primary" onClick={() => setOpen((value) => !value)}>{open ? '收起维护入口' : '运营数据维护'}</button></div>
      {open && (
        <form className="maintenance-form" onSubmit={submit}>
          <input name="hospitalId" required placeholder="中心唯一编号" />
          <input name="hospitalName" required placeholder="中心/医院名称" />
          <input name="province" required placeholder="省份" />
          <select name="stage" required defaultValue=""><option value="" disabled>当前阶段</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select>
          <input name="period" required placeholder="统计周期，如 2026-Q3" />
          <input name="totalCycleCount" type="number" min="0" placeholder="总周期数" />
          <input name="pgdCycleCount" type="number" min="0" placeholder="PGD周期数" />
          <button type="submit" disabled={saving}>{saving ? '保存中' : '保存并计算转化率'}</button>
          {status && <p>{status}</p>}
        </form>
      )}
    </div>
  );
}
