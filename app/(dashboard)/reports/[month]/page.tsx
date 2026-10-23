import { notFound } from 'next/navigation';
import { ReportBuilder } from '@/src/components/reports/report-builder';

export default async function ReportMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();
  return <ReportBuilder key={month} month={month} />;
}
