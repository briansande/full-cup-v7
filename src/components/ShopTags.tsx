'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { TagSummary, SuggestResult } from '@/src/types';
import ShopTagItem from './ShopTagItem';
import TagSearchForm from './TagSearchForm';

type Props = {
  shopId: string;
};

const PROFANITY = ["fuck", "shit", "bitch", "asshole"]; // simple filter - extend as needed

function cleanInput(s: string) {
  return String(s || '').trim().slice(0, 60);
}

function isProfane(s: string) {
  const low = s.toLowerCase();
  return PROFANITY.some((p) => low.includes(p));
}

export default function ShopTags({ shopId }: Props) {
  const [tags, setTags] = useState<TagSummary[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SuggestResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    async function init() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user ?? null;
        if (!mounted) return;
        setUserId(user?.id ?? null);

        const rpc = await supabase.rpc('get_shop_tag_popularity', { p_shop_id: shopId });
        if (!mounted) return;
        if (rpc.error) {
          setError(String(rpc.error));
          setTags([]);
        } else {
          setTags(Array.isArray(rpc.data) ? rpc.data as TagSummary[] : []);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setTags([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, [shopId, submitting]);

  // Search existing tags by name
  useEffect(() => {
    let mounted = true;
    if (!search || search.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    (async () => {
      try {
        const q = `%${search}%`;
        const res = await supabase
          .from('tags')
          .select('id,name')
          .ilike('name', q)
          .limit(8);
        if (!mounted) return;
        if (!res.error && Array.isArray(res.data)) {
          setSearchResults(res.data.map((r: any) => ({ id: String(r.id), name: r.name })));
        } else {
          setSearchResults([]);
        }
      } catch {
        if (!mounted) return;
        setSearchResults([]);
      } finally {
        if (!mounted) return;
        setSearching(false);
      }
    })();
    return () => { mounted = false; };
  }, [search]);

  async function handleAddExistingTag(tagId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;
      if (!user) {
        setError('Sign in to add tags.');
        setSubmitting(false);
        return;
      }

      // Create a shop_tags row for this user + tag + shop (upsert)
        const up = await supabase
          .from('shop_tags')
          .upsert(
            {
              shop_id: shopId,
              tag_id: tagId,
              user_id: user.id,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'shop_id,tag_id,user_id' }
          );

        if (up.error) throw up.error;

        // Automatically cast a thumbs-up vote when a user adds a tag for the first time
        // Find the representative shop_tag (most voted) for this tag at this shop
        let shopTagId: string | null = null;
        const st = await supabase
          .from('shop_tags')
          .select('id')
          .eq('shop_id', shopId)
          .eq('tag_id', tagId)
          .order('votes', { ascending: false })
          .limit(1)
          .maybeSingle();

      if (shopTagId) {
        // Insert or ignore existing vote
        await supabase
          .from('user_tag_votes')
          .upsert(
            {
              shop_tag_id: shopTagId,
              user_id: user.id,
              vote_type: 1,
            },
            { onConflict: 'shop_tag_id,user_id' }
          );
      }

      // trigger refresh
      try { window.dispatchEvent(new Event('fullcup:sync')); } catch {}
      setSearch('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSuggestTag(rawName: string) {
    const name = cleanInput(rawName);
    setError(null);
    if (!name || name.length < 2) {
      setError('Tag must be at least 2 characters.');
      return;
    }
    if (isProfane(name)) {
      setError('Tag contains inappropriate content.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;
      if (!user) {
        setError('Sign in to suggest tags.');
        setSubmitting(false);
        return;
      }

      // Insert tag (idempotent by unique index on lower(name)+category) - use category 'user'
      const t = await supabase
        .from('tags')
        .insert({ name, category: 'user', description: null })
        .select('id,name')
        .limit(1);

      if (t.error && t.status !== 409) {
        throw t.error;
      }

      let tagId: string | null = null;
      if (!t.error && Array.isArray(t.data) && t.data.length > 0) {
        tagId = String((t.data[0] as any).id);
      } else {
        // If insert conflicted, try to look up the tag id
        const find = await supabase.from('tags').select('id').ilike('name', name).limit(1);
        if (!find.error && Array.isArray(find.data) && find.data.length > 0) {
          tagId = String((find.data[0] as any).id);
        }
      }

      if (!tagId) throw new Error('Could not create or find suggested tag.');

      // Create shop_tag row for this user
      await supabase.from('shop_tags').upsert(
        {
          shop_id: shopId,
          tag_id: tagId,
          user_id: user.id,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,tag_id,user_id' }
      );

      // Add initial thumbs-up vote
      const st = await supabase
        .from('shop_tags')
        .select('id')
        .eq('shop_id', shopId)
        .eq('tag_id', tagId)
        .order('votes', { ascending: false })
        .limit(1)
        .maybeSingle();

      const shopTagId = !st.error && st.data ? String((st.data as any).id) : null;
      if (shopTagId) {
        await supabase
          .from('user_tag_votes')
          .upsert(
            {
              shop_tag_id: shopTagId,
              user_id: user.id,
              vote_type: 1,
            },
            { onConflict: 'shop_tag_id,user_id' }
          );
      }

      try { window.dispatchEvent(new Event('fullcup:sync')); } catch {}
      setSearch('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(tag: TagSummary) {
    setSubmitting(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;
      if (!user) {
        setError('Sign in to vote.');
        setSubmitting(false);
        return;
      }

      // find representative shop_tag row
      const st = await supabase
        .from('shop_tags')
        .select('id')
        .eq('shop_id', shopId)
        .eq('tag_id', tag.tag_id)
        .order('votes', { ascending: false })
        .limit(1)
        .maybeSingle();

      let shopTagId = null;
      if (!st.error && st.data) {
        shopTagId = String((st.data as any).id);
      } else {
        // create a shop_tag record owned by this user
        const create = await supabase
          .from('shop_tags')
          .insert({ shop_id: shopId, tag_id: tag.tag_id, user_id: user.id })
          .select('id')
          .limit(1);
        if (!create.error && Array.isArray(create.data) && create.data.length > 0) {
          shopTagId = String((create.data[0] as any).id);
        }
      }

      if (!shopTagId) throw new Error('Could not locate or create shop tag to vote on.');

      // Upsert user's vote (1)
      await supabase
        .from('user_tag_votes')
        .upsert(
          {
            shop_tag_id: shopTagId,
            user_id: user.id,
            vote_type: 1,
          },
          { onConflict: 'shop_tag_id,user_id' }
        );

      try { window.dispatchEvent(new Event('fullcup:sync')); } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ margin: '8px 0' }}>Tags</h3>

      {!userId ? (
        <div style={{ color: '#666', marginBottom: 12 }}>Sign in to add tags or vote. Login is in the header.</div>
      ) : null}

      <TagSearchForm
        search={search}
        setSearch={setSearch}
        searching={searching}
        searchResults={searchResults}
        handleAddExistingTag={handleAddExistingTag}
        handleSuggestTag={handleSuggestTag}
        submitting={submitting}
        error={error}
      />

      <div>
        {loading ? (
          <div>Loading tags…</div>
        ) : !tags || tags.length === 0 ? (
          <div style={{ color: '#666' }}>No tags yet. Be the first to suggest one.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tags.map((t) => (
              <ShopTagItem
                key={t.tag_id}
                tag={t}
                userId={userId}
                onVote={handleVote}
                submitting={submitting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}