import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getReportDataUseCase } from '@/src/infrastructure/container';

/** Raw data for the interactive report builder (/reports/[month]). */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = new URL(req.url).searchParams.get('month');
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: 'Missing or invalid month parameter' }, { status: 400 });
  }

  const data = await getReportDataUseCase.execute(userId, month);
  if (!data) return NextResponse.json({ error: 'No tracking data for this month' }, { status: 404 });

  return NextResponse.json(data);
}
