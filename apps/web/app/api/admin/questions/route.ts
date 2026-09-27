import 'server-only';
import { NextResponse } from 'next/server';
import { admin, getOwnerOrgAndFramework } from '../../_lib/org';
import { requireSuperadminApi } from '@/lib/server/adminApiAuth';

export async function GET() {
  const auth = await requireSuperadminApi();

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  const svc = admin();
  const { orgId, frameworkId } = await getOwnerOrgAndFramework();
  const { data, error } = await svc
    .from('org_questions')
    .select('question_no,prompt,options,weights')
    .eq('org_id', orgId).eq('framework_id', frameworkId)
    .order('question_no',{ascending:true});
  if (error) return NextResponse.json({ error: error.message }, { status:500 });
  return NextResponse.json({ questions: data ?? [] });
}
