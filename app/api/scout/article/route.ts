import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabaseServer';

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing article ID' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    const supabase = createServerSupabase(token);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || userData?.user?.email !== 'p.kalavsky@gmail.com') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
        .from('scout_articles')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: 'Failed to delete article', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
