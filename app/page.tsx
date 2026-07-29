"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type WorkRecord = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  note: string;
};

const STORAGE_KEY = "workday-ledger-records";
const TARGET_KEY = "workday-ledger-target-hours";

function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function getWorkMinutes(record: Pick<WorkRecord, "startTime" | "endTime" | "breakMinutes">) {
  if (!record.startTime || !record.endTime) return 0;
  let duration = toMinutes(record.endTime) - toMinutes(record.startTime);
  if (duration < 0) duration += 24 * 60;
  return Math.max(0, duration - Number(record.breakMinutes || 0));
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours}小时${String(remainder).padStart(2, "0")}分`;
}

function formatDecimalHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function downloadCsv(records: WorkRecord[]) {
  const headers = ["日期", "上班", "下班", "休息（分钟）", "实际工时（小时）", "备注"];
  const rows = records.map((record) => [
    record.date,
    record.startTime,
    record.endTime,
    record.breakMinutes,
    formatDecimalHours(getWorkMinutes(record)),
    record.note,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((item) => `"${String(item).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "我的工时记录.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

const blankForm = (): Omit<WorkRecord, "id"> => ({
  date: getToday(),
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: 60,
  note: "",
});

export default function Home() {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [targetHours, setTargetHours] = useState("8");
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedRecords = localStorage.getItem(STORAGE_KEY);
        const storedTarget = localStorage.getItem(TARGET_KEY);
        if (storedRecords) setRecords(JSON.parse(storedRecords));
        if (storedTarget) setTargetHours(storedTarget);
      } finally {
        setIsReady(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (isReady) localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [isReady, records]);

  useEffect(() => {
    if (isReady) localStorage.setItem(TARGET_KEY, targetHours);
  }, [isReady, targetHours]);

  const currentMonth = getMonthKey(getToday());
  const monthRecords = useMemo(
    () => records.filter((record) => getMonthKey(record.date) === currentMonth),
    [records, currentMonth],
  );
  const monthMinutes = useMemo(
    () => monthRecords.reduce((total, record) => total + getWorkMinutes(record), 0),
    [monthRecords],
  );
  const averageMinutes = monthRecords.length ? Math.round(monthMinutes / monthRecords.length) : 0;
  const targetMinutes = Math.max(0, Number(targetHours || 0) * 60);
  const differenceMinutes = averageMinutes - targetMinutes;
  const todayRecord = records.find((record) => record.date === getToday());
  const sortedRecords = useMemo(
    () => [...records].sort((first, second) => second.date.localeCompare(first.date)),
    [records],
  );

  function updateForm(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "breakMinutes" ? Math.max(0, Number(value)) : value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.date || !form.startTime || !form.endTime) return;
    const record = { ...form, id: editingId ?? crypto.randomUUID() };
    setRecords((current) => {
      const withoutSameDate = current.filter((item) => item.id !== editingId && item.date !== form.date);
      return [...withoutSameDate, record];
    });
    setForm(blankForm());
    setEditingId(null);
  }

  function editRecord(record: WorkRecord) {
    setForm({ date: record.date, startTime: record.startTime, endTime: record.endTime, breakMinutes: record.breakMinutes, note: record.note });
    setEditingId(record.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteRecord(id: string) {
    if (!window.confirm("确定删除这条工时记录吗？")) return;
    setRecords((current) => current.filter((record) => record.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(blankForm());
    }
  }

  const formMinutes = getWorkMinutes(form);
  const differenceLabel = monthRecords.length === 0
    ? "记录第一天，开始积累本月数据"
    : differenceMinutes === 0
      ? "刚好达到目标平均工时"
      : `${differenceMinutes > 0 ? "高于" : "低于"}目标 ${formatDuration(Math.abs(differenceMinutes))}`;

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="page-title">
        <div className="brand-row"><span className="brand-mark" aria-hidden="true">时</span><span>我的工时本</span></div>
        <div className="hero-content">
          <div>
            <p className="eyebrow">每天一笔，工时心中有数</p>
            <h1 id="page-title">记录今天，掌握本月平均工时</h1>
            <p className="hero-description">填写上下班时间后自动计算。所有数据仅保存在当前设备浏览器中。</p>
          </div>
          <label className="target-control">
            <span>公司要求平均工时</span>
            <strong><input aria-label="公司要求平均工时" inputMode="decimal" min="0" step="0.25" type="number" value={targetHours} onChange={(event) => setTargetHours(event.target.value)} /><em>小时 / 天</em></strong>
          </label>
        </div>
      </section>

      <section className="summary-grid" aria-label="本月工时概览">
        <article className="summary-card accent-card"><p>本月平均工时</p><strong>{monthRecords.length ? formatDuration(averageMinutes) : "暂无记录"}</strong><span>{monthRecords.length ? `${monthRecords.length} 个工作日的平均值` : "录入第一天后开始统计"}</span></article>
        <article className="summary-card"><p>与目标相比</p><strong className={differenceMinutes < 0 ? "negative" : "positive"}>{monthRecords.length ? (differenceMinutes === 0 ? "持平" : `${differenceMinutes > 0 ? "+" : "-"}${formatDecimalHours(Math.abs(differenceMinutes))} 小时`) : "—"}</strong><span>{differenceLabel}</span></article>
        <article className="summary-card"><p>本月累计工时</p><strong>{formatDuration(monthMinutes)}</strong><span>{monthRecords.length} 条有效记录</span></article>
      </section>

      <section className="workspace-grid">
        <article className="entry-card">
          <div className="section-heading"><div><p className="eyebrow">{editingId ? "正在修改记录" : "快速录入"}</p><h2>{editingId ? "修改当天工时" : "添加当天工时"}</h2></div>{todayRecord && !editingId && <span className="status-pill">今天已记录</span>}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label><span>日期</span><input name="date" type="date" value={form.date} onChange={updateForm} required /></label>
              <label><span>休息时长（分钟）</span><input name="breakMinutes" min="0" step="5" type="number" value={form.breakMinutes} onChange={updateForm} required /></label>
              <label><span>上班时间</span><input name="startTime" type="time" value={form.startTime} onChange={updateForm} required /></label>
              <label><span>下班时间</span><input name="endTime" type="time" value={form.endTime} onChange={updateForm} required /></label>
            </div>
            <label className="note-field"><span>备注（选填）</span><textarea name="note" value={form.note} onChange={updateForm} placeholder="例如：调休、出差、加班项目…" rows={2} /></label>
            <div className="calculation-preview" aria-live="polite"><span>当天实际工时</span><strong>{formatDuration(formMinutes)}</strong><small>已自动扣除 {form.breakMinutes || 0} 分钟休息时间</small></div>
            <div className="form-actions">{editingId && <button className="secondary-button" type="button" onClick={() => { setEditingId(null); setForm(blankForm()); }}>取消修改</button>}<button className="primary-button" type="submit">{editingId ? "保存修改" : "保存今天的记录"}</button></div>
          </form>
        </article>

        <aside className="guide-card"><p className="eyebrow">使用提示</p><h2>只需三步</h2><ol><li><span>1</span>设定公司要求的每日平均工时</li><li><span>2</span>每天填入上下班时间与休息时长</li><li><span>3</span>随时查看本月平均与目标差距</li></ol><div className="privacy-note">数据保存在本机浏览器。建议定期导出备份。</div></aside>
      </section>

      <section className="records-section">
        <div className="records-heading"><div><p className="eyebrow">工时明细</p><h2>所有记录</h2></div><button className="export-button" type="button" onClick={() => downloadCsv(sortedRecords)} disabled={!records.length}>导出 CSV</button></div>
        {sortedRecords.length ? <div className="table-wrap"><table><thead><tr><th>日期</th><th>上下班</th><th>休息</th><th>实际工时</th><th>备注</th><th aria-label="操作" /></tr></thead><tbody>{sortedRecords.map((record) => <tr key={record.id}><td><strong>{formatDate(record.date)}</strong></td><td>{record.startTime} — {record.endTime}</td><td>{record.breakMinutes} 分钟</td><td><strong>{formatDuration(getWorkMinutes(record))}</strong></td><td className="note-cell">{record.note || "—"}</td><td className="row-actions"><button type="button" onClick={() => editRecord(record)}>编辑</button><button type="button" onClick={() => deleteRecord(record.id)}>删除</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span aria-hidden="true">⌁</span><h3>还没有工时记录</h3><p>从上面的表单开始，记录你的第一个工作日吧。</p></div>}
      </section>
    </main>
  );
}
