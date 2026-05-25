import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';

export async function takeRiskSnapshot(orgId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const members = await prisma.member.findMany({
    where: { organization_id: orgId },
    select: { risk_score: true },
  });

  if (members.length === 0) return;

  const avgScore = members.reduce((s, m) => s + m.risk_score, 0) / members.length;
  const count_critical = members.filter((m) => m.risk_score <= 39).length;
  const count_high     = members.filter((m) => m.risk_score >= 40 && m.risk_score <= 59).length;
  const count_medium   = members.filter((m) => m.risk_score >= 60 && m.risk_score <= 79).length;
  const count_low      = members.filter((m) => m.risk_score >= 80).length;

  await prisma.riskSnapshot.upsert({
    where: { organization_id_date: { organization_id: orgId, date: today } },
    create: {
      id: uuidv4(),
      organization_id: orgId,
      date: today,
      avg_score: Math.round(avgScore * 10) / 10,
      count_critical,
      count_high,
      count_medium,
      count_low,
      member_count: members.length,
    },
    update: {
      avg_score: Math.round(avgScore * 10) / 10,
      count_critical,
      count_high,
      count_medium,
      count_low,
      member_count: members.length,
    },
  });
}

export async function getRiskSnapshots(orgId: string, days: number = 90): Promise<object[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  return prisma.riskSnapshot.findMany({
    where: { organization_id: orgId, date: { gte: sinceStr } },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      avg_score: true,
      count_critical: true,
      count_high: true,
      count_medium: true,
      count_low: true,
      member_count: true,
    },
  });
}
