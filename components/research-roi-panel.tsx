import { researchRoiRows } from '@/lib/platform/analytics';
import { ReportExportButton } from '@/components/report-export-button';

export function ResearchRoiPanel() {
  return (
    <section className="analysis-card research-roi-card">
      <div className="card-heading analysis-heading">
        <div><p className="eyebrow">投入产出分析</p><h2>按医院看科研投入、成果与客户价值</h2><p className="heading-note">投入包括人员工时、样本/检测成本、外采费用；产出同时评价论文专利、客户粘性与可归因业务增量。</p></div>
        <ReportExportButton
          title="客户科研项目投入产出汇报"
          subtitle="医院科研项目全量盘点、资源投入、阶段成果与下一步计划"
          fileName="客户科研项目投入产出汇报"
          label="生成客户汇报PPT"
          summary={[
            { label: '纳入项目', value: '12', note: '界面示例' },
            { label: '人员投入', value: '842h', note: '待工时口径确认' },
            { label: '直接成本', value: '39.6万', note: '待财务复核' },
            { label: '阶段成果', value: '论文3/专利1', note: '含在投成果' },
          ]}
          columns={['医院', '项目数', '人员工时', '直接成本', '成果', '关联价值', '管理判断']}
          rows={researchRoiRows.map((item) => [item.hospital, item.projects, item.labor, item.cashCost, item.outputs, item.linkedValue, item.decision])}
          recommendations={['科研投入必须先分清客情科研、战略研发与收费过渡，三类项目不能用同一财务ROI硬套。', '对长期高投入、低里程碑达成项目设置继续投入门禁，避免资源被历史项目持续占用。', '客户汇报突出共同成果、临床价值和下一阶段路径，内部管理同步核算成本与可归因增量。']}
        />
      </div>
      <div className="roi-summary"><article><span>投入</span><strong>工时 + 检测 + 外采</strong><small>形成医院级全成本</small></article><i>→</i><article><span>过程</span><strong>里程碑达成率</strong><small>控制延期与资源追加</small></article><i>→</i><article><span>产出</span><strong>成果 + 客情 + 增量</strong><small>兼顾业务与学术价值</small></article></div>
      <div className="data-table-wrap analysis-table"><table><thead><tr><th>医院</th><th>项目数</th><th>人员工时</th><th>直接成本</th><th>阶段成果</th><th>关联价值</th><th>管理判断</th></tr></thead><tbody>{researchRoiRows.map((item) => <tr key={item.hospital}><td>{item.hospital}</td><td>{item.projects}</td><td>{item.labor}</td><td>{item.cashCost}</td><td>{item.outputs}</td><td>{item.linkedValue}</td><td><span className="table-status">{item.decision}</span></td></tr>)}</tbody></table></div>
    </section>
  );
}
