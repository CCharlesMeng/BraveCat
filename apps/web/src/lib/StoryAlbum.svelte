<script lang="ts">
  import type { StoryCollection } from '@bravecat/core/stories'
  import { createPostcardPng, postcardFileName, resolveStoryComposition, shareOrDownloadPostcard } from '@bravecat/core/postcards'
  import { sharePort, webPostcardCanvas } from './platform/ports'
  import Postcard from './Postcard.svelte'
  let { collections }: { collections: readonly StoryCollection[] } = $props()
  let selectedTrip = $state<string | null>(null)
  let page = $state(0)
  let busy = $state(false)
  let notice = $state('')
  const selected = $derived(collections.find((entry) => entry.tripId === selectedTrip))
  const groups = $derived([...new Set(collections.map((entry) => entry.storyId))].map((id) => ({
    id, entries: collections.filter((entry) => entry.storyId === id).toSorted((a, b) => b.departsAt - a.departsAt),
  })))
  const save = async () => {
    const act = selected?.acts[page]
    if (!selected || !act || busy) return
    busy = true
    notice = ''
    try {
      const composition = resolveStoryComposition(act)
      const blob = await createPostcardPng(composition, selected.place, webPostcardCanvas)
      const result = await shareOrDownloadPostcard(blob, postcardFileName(`${selected.title}-第${page + 1}幕`, composition.postmarkDate), sharePort)
      notice = result === 'cancelled' ? '明信片仍留在相册里。' : result === 'shared' ? '已交给系统分享。' : '明信片已保存为 PNG。'
    } catch { notice = '这次没能保存，请稍后再试。' }
    finally { busy = false }
  }
</script>

<section aria-label="小故事相册" class="stories">
  {#if selected}
    <button type="button" onclick={() => { selectedTrip = null; notice = '' }}>返回小故事</button>
    <h3>{selected.title}{selected.closing ? ' · 已收齐' : ''}</h3>
    <p>{selected.travelerName} · {new Date(selected.departsAt).toLocaleDateString('zh-CN')} · {selected.acts.length}/4 封来信</p>
    {#if selected.acts[page]}
      <Postcard composition={resolveStoryComposition(selected.acts[page])} destinationName={selected.place} renderScene={true} />
      <p>第 {page + 1} 幕 · {selected.acts[page].recipe.copy}</p>
      <button type="button" disabled={busy} onclick={save}>{busy ? '正在生成…' : '保存或分享这一幕'}</button>
    {:else if page === 4 && selected.closing}
      <div class="closing" aria-label="故事尾页"><span aria-hidden="true">✧</span><p>{selected.closing}</p><small>这一程，已经好好收在相册里。</small></div>
    {/if}
    <nav aria-label="故事翻页">
      <button type="button" disabled={page === 0} onclick={() => { page -= 1; notice = '' }}>上一页</button>
      <span>{page === 4 ? '尾页' : `第 ${page + 1} 幕`}</span>
      <button type="button" disabled={page >= selected.acts.length - (selected.closing ? 0 : 1)} onclick={() => { page += 1; notice = '' }}>下一页</button>
    </nav>
    {#if !selected.closing}<p>下一封来信还在路上，慢慢等它寄回来。</p>{/if}
    <p aria-live="polite">{notice}</p>
  {:else if groups.length}
    {#each groups as group (group.id)}
      <section>
        <h3>{group.entries[0].title}</h3>
        {#each group.entries as entry (entry.tripId)}
          <button class="story-entry" type="button" onclick={() => { selectedTrip = entry.tripId; page = 0; notice = '' }}>
            <span>{entry.travelerName} · {new Date(entry.departsAt).toLocaleDateString('zh-CN')}</span>
            <span>{entry.closing ? '✧ 已收齐 · 顺序回看' : `${entry.acts.length}/4 封来信`}</span>
          </button>
        {/each}
      </section>
    {/each}
  {:else}
    <p>有些旅行，会寄回一个小故事。等第一封来信到家，再慢慢翻开。</p>
  {/if}
</section>
<style>
  .stories { color: #595b4b; line-height: 1.8; }
  button { border: 1px solid #c5c6b1; border-radius: 10px; background: #f8f3e8; color: inherit; padding: 10px 14px; cursor: pointer; }
  button:disabled { opacity: .45; cursor: default; }
  nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 20px; }
  .story-entry { display: flex; flex-wrap: wrap; width: 100%; justify-content: space-between; gap: 8px; margin: 12px 0; text-align: left; }
  .closing { padding: 36px 24px; background: #f8efd8; border-radius: 12px; text-align: center; }
  .closing span { font-size: 48px; }
</style>
