import { NextResponse } from 'next/server';
import { paidAiEnabled, photoExperimentEnabled } from '../../../../lib/nutrition/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    photo: photoExperimentEnabled(),
    paidAi: paidAiEnabled(),
  });
}
