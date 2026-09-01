'use client';

import { useState } from 'react';

type Summary = { label: string; value: string; note?: string };

type Props = {
  title: string;
  subtitle: string;
  fileName: string;
  summary: Summary[];
  columns: string[];
  rows: string[][];
  recommendations: string[];
  label?: string;
};

const colors = { brand: 'A20D7B', ink: '172039', muted: '6E7589', soft: 'F8EAF4', line: 'E8E9F1', teal: '15927D' };

export function ReportExportButton({ title, subtitle, fileName, summary, columns, rows, recommendations, label = '生成季度汇报PPT' }: Props) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  async function exportPpt() {
    setState('working');
    try {
      const { default: PptxGenJS } = await import('pptxgenjs');
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.author = 'Yikon 全国学术支持部';
      pptx.company = 'Yikon';
      pptx.subject = subtitle;
      pptx.title = title;
      pptx.theme = {
        headFontFace: 'Microsoft YaHei',
        bodyFontFace: 'Microsoft YaHei',
      };

      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: 'F7F5FA' };
      titleSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: colors.brand }, line: { color: colors.brand } });
      titleSlide.addText('Yikon  学术支持管理平台', { x: 0.78, y: 0.72, w: 4.2, h: 0.35, fontFace: 'Microsoft YaHei', fontSize: 13, bold: true, color: colors.brand, margin: 0 });
      titleSlide.addText(title, { x: 0.78, y: 2.18, w: 10.8, h: 0.8, fontFace: 'Microsoft YaHei', fontSize: 30, bold: true, color: colors.ink, margin: 0 });
      titleSlide.addText(subtitle, { x: 0.8, y: 3.12, w: 10.6, h: 0.5, fontFace: 'Microsoft YaHei', fontSize: 15, color: colors.muted, margin: 0 });
      titleSlide.addText(`生成时间：${new Date().toLocaleString('zh-CN')}\n数据说明：接口未接通时使用界面示例数据，正式汇报前必须复核数据截止时间与统计口径。`, { x: 0.8, y: 5.55, w: 10.9, h: 0.75, fontFace: 'Microsoft YaHei', fontSize: 10, color: colors.muted, breakLine: false, margin: 0 });

      const summarySlide = pptx.addSlide();
      summarySlide.background = { color: 'FFFFFF' };
      summarySlide.addText('01  管理摘要', { x: 0.65, y: 0.45, w: 4.8, h: 0.45, fontSize: 22, bold: true, color: colors.ink, margin: 0 });
      summary.slice(0, 4).forEach((item, index) => {
        const x = 0.65 + index * 3.08;
        summarySlide.addShape(pptx.ShapeType.roundRect, { x, y: 1.28, w: 2.75, h: 1.42, rectRadius: 0.08, fill: { color: index === 0 ? colors.soft : 'F8F8FB' }, line: { color: colors.line } });
        summarySlide.addText(item.label, { x: x + 0.18, y: 1.52, w: 2.35, h: 0.25, fontSize: 10, color: colors.muted, margin: 0 });
        summarySlide.addText(item.value, { x: x + 0.18, y: 1.87, w: 2.35, h: 0.4, fontSize: 22, bold: true, color: index === 0 ? colors.brand : colors.ink, margin: 0 });
        if (item.note) summarySlide.addText(item.note, { x: x + 0.18, y: 2.34, w: 2.35, h: 0.2, fontSize: 8, color: colors.muted, margin: 0 });
      });
      summarySlide.addText('重点判断与建议', { x: 0.68, y: 3.28, w: 3.4, h: 0.35, fontSize: 16, bold: true, color: colors.ink, margin: 0 });
      recommendations.forEach((item, index) => {
        summarySlide.addShape(pptx.ShapeType.ellipse, { x: 0.72, y: 3.9 + index * 0.72, w: 0.22, h: 0.22, fill: { color: index === 0 ? colors.brand : colors.teal }, line: { color: index === 0 ? colors.brand : colors.teal } });
        summarySlide.addText(item, { x: 1.08, y: 3.82 + index * 0.72, w: 10.9, h: 0.42, fontSize: 12, color: colors.ink, margin: 0 });
      });

      const detailSlide = pptx.addSlide();
      detailSlide.background = { color: 'FFFFFF' };
      detailSlide.addText('02  明细与行动', { x: 0.65, y: 0.42, w: 4.8, h: 0.45, fontSize: 22, bold: true, color: colors.ink, margin: 0 });
      const tableRows = [
        columns.map((text) => ({ text, options: { bold: true, fill: { color: 'F7F6FA' }, color: colors.ink } })),
        ...rows.map((row) => row.map((text) => ({ text }))),
      ];
      detailSlide.addTable(tableRows, {
        x: 0.58,
        y: 1.18,
        w: 12.1,
        h: 4.9,
        border: { type: 'solid', color: colors.line, pt: 0.7 },
        fill: { color: 'FFFFFF' },
        color: colors.ink,
        fontFace: 'Microsoft YaHei',
        fontSize: 9,
        margin: 0.08,
        rowH: 0.54,
        bold: false,
      });
      detailSlide.addText('注：本页用于形成管理动作，不替代医学、实验室质量或财务部门的最终审核。', { x: 0.62, y: 6.85, w: 11.7, h: 0.25, fontSize: 8, color: colors.muted, margin: 0 });

      await pptx.writeFile({ fileName: `${fileName}.pptx`, compression: true });
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <button className="report-export" type="button" onClick={exportPpt} disabled={state === 'working'}>
      {state === 'working' ? '正在生成…' : state === 'done' ? '已生成PPT' : state === 'error' ? '生成失败，请重试' : label}
    </button>
  );
}
