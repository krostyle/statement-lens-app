import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { listStatementsUseCase, s3Service, statementRepo, userProfileRepo } from '@/src/infrastructure/container';
import { processStatement } from './_process-statement';
import type { StatementType } from '@/src/domain/entities/statement';

const CREDIT_CARD_BANKS = ['santander', 'falabella', 'liderbci'];
const CHECKING_BANKS    = ['santander', 'falabella', 'bci', 'bancoestado'];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const statements = await listStatementsUseCase.execute(userId);
  return NextResponse.json(statements);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file          = formData.get('file') as File | null;
    const bank          = formData.get('bank') as string | null;
    const month         = formData.get('month') as string | null;
    const statementType = (formData.get('statementType') as string | null) ?? 'credit_card';

    if (!file || !bank || !month) {
      return NextResponse.json({ error: 'Missing required fields: file, bank, month' }, { status: 400 });
    }

    const validTypes: StatementType[] = ['credit_card', 'checking'];
    if (!validTypes.includes(statementType as StatementType)) {
      return NextResponse.json({ error: 'Invalid statementType. Use credit_card or checking' }, { status: 400 });
    }

    const allowedBanks = statementType === 'checking' ? CHECKING_BANKS : CREDIT_CARD_BANKS;
    if (!allowedBanks.includes(bank)) {
      return NextResponse.json(
        { error: `Invalid bank "${bank}" for ${statementType}. Allowed: ${allowedBanks.join(', ')}` },
        { status: 400 },
      );
    }

    await userProfileRepo.ensureExists(userId);
    const existing = await statementRepo.findByUserId(userId);

    // Duplicate = same bank + month + statementType (credit card and checking are independent)
    const duplicate = existing.find(
      (s) => s.bank === bank && s.month === month && (s.statementType ?? 'credit_card') === statementType,
    );
    if (duplicate) {
      const typeLabel = statementType === 'checking' ? 'cuenta corriente' : 'tarjeta de crédito';
      return NextResponse.json(
        { error: `Ya existe un estado de ${typeLabel} de ${bank} para el mes ${month}.` },
        { status: 409 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const statementId = crypto.randomUUID();
    const normalizedFileName = `${bank}_${statementType}_${month}.pdf`;
    const s3Key = `${userId}/${statementId}/${normalizedFileName}`;
    const s3Url = await s3Service.upload(s3Key, buffer);

    const statement = await statementRepo.create({
      userId,
      bank: bank as never,
      month,
      statementType: statementType as StatementType,
      fileName: normalizedFileName,
      s3Key,
      s3Url,
    });

    // Fetch the user's full name so the AI can identify self-transfers (e.g. "TRF A DIEGO ALBARRAN")
    const clerkUser = await currentUser();
    const userName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || undefined;

    // Process asynchronously (fire and forget)
    processStatement(statement.id, userId, buffer, bank, month, statementType as StatementType, userName).catch(console.error);

    return NextResponse.json({
      id: statement.id,
      status: statement.status,
      message: 'Statement uploaded. Processing started.',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
