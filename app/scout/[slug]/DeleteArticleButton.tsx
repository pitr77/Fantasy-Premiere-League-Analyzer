'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function DeleteArticleButton({ articleId }: { articleId: string }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const { data } = await supabase.auth.getUser();
            if (data?.user?.email === 'p.kalavsky@gmail.com') {
                setIsAdmin(true);
            }
        };
        checkAuth();
    }, []);

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this article?')) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/scout/article?id=${articleId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                alert('Article deleted successfully.');
                router.push('/scout');
                router.refresh();
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
            }
        } catch (e) {
            alert('An error occurred while deleting.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isAdmin) return null;

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 ml-auto"
        >
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {isDeleting ? 'Deleting...' : 'Delete Article'}
        </button>
    );
}
